# ROADMAP — Projet Enclume
> Dernière mise à jour : 2026-05-30 Session 66

---

## Chantier Documentation — Refonte architecture docs (Session 64+)

Objectif : réduire la pression contexte IA, éliminer les lectures nominales sans intégration, zéro perte de donnée.

| Étape | Tâche | Règle | État |
|---|---|---|---|
| 1 | Archiver `JOURNAL2.md` → `Old/JOURNAL2.md` + créer `JOURNAL3.md` | Doublon obligatoire — JOURNAL2 conservé en archive | ✅ session 65 |
| 2 | Éclater `SYSTEME.md` → `docs/SYSTEME/` (9 fichiers : COMBAT, DICE, BLESSURES, ENTITES, VOXELS, CORE, REACT, ASSETS, CONVENTIONS) | SYSTEME.md archivé dans Old/ | ✅ session 65 |
| 3 | Créer `docs/GLOSSAIRE.md` (termes RPG Polaris → mapping code) | Nouveau fichier | ✅ session 65 |
| 4 | Réécrire `CLAUDE.md` (protocole + pièges critiques + pointeurs SYSTEME/) | — | ✅ session 65 |
| 5 | Mettre à jour cross-références (EN_COURS, ASBUILT, ROADMAP → SYSTEME/) | — | ✅ session 65 |
| 6 | Supprimer doublons de transition | SYSTEME.md + JOURNAL2.md conservés dans Old/ intentionnellement | ✅ session 65 |

**Protocole d'exécution (par étape) :**
- JOURNALTEMPORAIRE.md utilisé comme mémoire externe de travail — effacé en fin de chantier
- Pattern : collecter une info → l'écrire dans le doc cible → effacer de la mémoire → boucle
- Boucle analyse post-rédaction : relire le doc produit, vérifier couverture vs source, itérer
- Ne jamais passer à l'étape N+1 sans confirmation que N est complet et sans perte

---

## Méthodologie de travail
- Une étape stable et certaine avant de passer à la suivante
- Pas de rustines : la bonne architecture dès le début
- Toute décision non documentée est considérée comme nulle
- Runs à vide réguliers pour vérifier l'alignement
- Priorité : CODE (mémoire externe) > conversation en cours

---

## Phase 0 — Socle technique ✅
## Phase 1 — Auth + campagnes ✅

---

## Phase 2 — Battlemap 3D + session de jeu 🔲

### Chantier 9A — Refonte voxel ✅
### Chantier 9B — Interface CRUD texture packs ✅
### Chantier 9C — Système entités interactables ✅
### Chantier 9D — Atelier du GM ✅
### Chantier 9E — Entités en session ✅

| Tâche 9E | État |
|---|---|
| Bug 9D — blueprints visibles dans palette éditeur | ✅ session 34 |
| Textures entités — pack_id dans JOIN serveur | ✅ session 34 |
| RadialMenu — menu interactions joueur | ✅ session 34 |
| EntityInstancePanel — config instance GM | ✅ session 34 |
| Flux interaction joueur → arbitrage GM → changement état | ✅ session 36 |
| S34-1 — Changement d'état visible sans F5 | ✅ session 36 |
| S34-2 — Jet sans compétence → guard skill_id | ✅ session 36 |
| S34-3 — Formule 1d20 au lieu de 2d10 | ✅ session 36 |
| S34-4 — GM auto-approve | ✅ session 36 |
| S34-5 — Notifications dans chat + couleur onglet | ✅ session 36 |
| S34-6 — Détection ⚙ robuste | ✅ session 36 |
| Géométries entités : door + trapdoor dans l'Atelier | 🔲 |
| Favicon client/public/favicon.svg | 🔲 |

### Chantier 9F-0 — Module `charStats.js` — Calcul serveur ✅ (session 36)

| Tâche | État |
|---|---|
| `server/src/lib/charStats.js` — table AN + calcNA + calcSkillTotal + calcAttributeAN | ✅ |
| `socket/index.js` — calcul serveur dans ENTITY_ACTION_RESOLVE | ✅ |
| `SessionPage.jsx` — retirer skillTotal du payload | ✅ |

### Chantier 9F-A — Fondations mouvement ✅ (session 39)

| Tâche | État |
|---|---|
| Migration 44 — colonne `r` sur `tokens` | ✅ |
| Migration 45 — table `polaris_mr` + seed | ✅ |
| `server/src/lib/redis.js` — client ioredis + helpers collision map | ✅ |
| Collision map Redis — buildCollisionMap + maintenance complète | ✅ |
| `TOKEN_ROTATE` — event + handler serveur + clic client | ✅ |
| Affichage rotation token — `rotation.y = r * Math.PI / 4` | ✅ |

### Chantiers 9F-B/C — Mouvement entités ✅

| Chantier | Contenu | État |
|---|---|---|
| 9F-B1 | events.js + handler serveur ENTITY_MOVE_REQUEST + EntityBuilderTab refonte | ✅ session 40 |
| 9F-B2 | RadialMenu tranche Déplacer + SessionPage handleEntityMove + Canvas3D mode visée ghost | ✅ session 41 |
| 9F-C | Diagonal 45° + animation Lerp 300ms + corrections collision + polaris_mr LdB | ✅ session 43 |

### Corrections post-9F-C ✅ (session 43)

| Tâche | État |
|---|---|
| Migration 46 — polaris_mr refonte LdB officiel p.209 | ✅ |
| redis.js — convention PE14 pour voxels (buildCollisionMap + add/remove) | ✅ |
| index.js — actorBlocked à pos_z+1 (espace de marche) | ✅ |
| index.js — stepsMax = min(dmax, stepsTarget) — destination joueur respectée | ✅ |

### Chantier Dice Rework ✅ (session 44) · D20 normales GLB ✅ (session 65) · DicePanel v3 ✅ (session 65) · Jets Favoris PLAN13 ✅ (session 66)

Architecture retenue : DiceRoller monté dans Canvas3D (un seul contexte WebGL).
Pas de DiceOverlay HTML séparé — décision session 44.

| Tâche | État |
|---|---|
| `client/src/lib/diceMath.js` — PRNG, mappings, normales D4/D6/D8/D12/D20/D10 | ✅ |
| `client/src/components/DiceMesh.jsx` — géométries, matériaux, animation | ✅ |
| `client/src/components/DiceRoller.jsx` — orchestrateur R3F, plan cliquable | ✅ |
| `client/src/components/Canvas3D.jsx` — props dicePayload/onDiceDone | ✅ |
| `client/src/pages/SessionPage.jsx` — state lastDiceRoll, filtrage skillLabel | ✅ |
| D6 — BoxGeometry, texture par face, couleur lanceur | ✅ |
| D4 — TetrahedronGeometry, texture par face | ✅ |
| D8 — OctahedronGeometry, texture par face | ✅ |
| D20 — IcosahedronGeometry, texture par face | ✅ |
| D12 — DodecahedronGeometry, atlas 12 cases | ✅ |
| D10/D100 — Trapezohedron custom, Html overlay V1 | ✅ V1 |
| D10 UV texturing — modèle Blender (.glb) avec UVs kite pré-calculés | 🔲 V2 |
| Audio — `useDiceAudio.js` — sons d'impact au rebond | 🔲 |

### Chantier 10 — Module Équipement (Inventaire + Catalogue)

| Sprint | Contenu | État |
|---|---|---|
| Sprint 1 | Schéma DB + migration 48 + page admin saisie manuelle | ✅ session 46-47 |
| Sprint 2 | `char_inventory` (table instance) + UI inventaire joueur | ✅ session 51 |
| Sprint 3 | Codes slots indépendants (BG/BD/JG/JD) + armures multi-couches + poids | ✅ session 54 |
| Sprint 4 | Module Armes équipées (WeaponPanel, current_ammo, nettoyage nomenclature munitions) | ✅ session 55 |
| Sprint 5 | Mille-feuille protection serveur + polarisRound unifié + ref_min_str exposé | ✅ session 56 |
| Sprint 6 | Transfert items + échange sols (WS bidirectionnel, double validation) | 🔲 |
| — | Split pile, capacity sac, custom_props UI, malus_cat dans jets Polaris | 🔲 selon besoin |

**Sprint 1 livré :**
- Migration 48 : `ref_equipment` (35 colonnes, 6 CHECK) + 3 junction tables
- Route `/api/equipment` CRUD + transaction
- Page admin `localhost:3001/equipment-admin.html` (YAML rapide + presets + multi-select compétences)

**Sprint 2 livré (session 51) :**
- Migration 50 : `char_inventory` + `char_sheet.sols`
- 5 routes REST inventaire + route sols dans `char-sheet.js`
- `InventoryPanel.jsx` — affichage par container, encombrement, édition GM (catalogue 636 items), équipement slots
- Reporté sprint 2 → chantiers futurs : transfert entre persos, WS listeners client, restriction sols→GM, split pile

**Sprint 4 livré (session 55) :**
- Migration 52 : `char_inventory.current_ammo` FK — munition chargée par arme
- Migration 53 : nettoyage nomenclature — 11 fusions doublons, 89 renommages (`Balle`→`Munition`, suppression qualificatif arme type)
- `WeaponPanel.jsx` : armes 1M équipées (MG/MD), stats, CAL, munition chargée, rechargement automatique, équipement/déséquipement
- Tri munitions : "standard" en premier + alphabétique fr
- Décision : armes 2M/Tr hors scope v1 (ignorées en WeaponPanel)

**Sprint 5 livré (session 56) :**
- `shared/polarisUtils.js` (NOUVEAU) — source unique `polarisRound` — règle PI11
- `charStats.js` — import depuis shared, + `calcResistanceArmure(equippedItems)` + `calcCarenceArmure(equippedItems, forNA)`
- `CharacterSheet.jsx` + `LocationPanel.jsx` — import depuis shared, copies locales supprimées
- `char-sheet.js` — `ref_min_str` dans les 2 SELECT GET /inventory
- Affichage carence FOR (rouge si FOR < min_str) reporté → Chantier 11 sprint 3 (nécessite forNA dans ArmorWoundPanel)

### Chantier 11 — Module Blessures (Fiche personnage)

**Architecture actée (session 49) :**
- Migration 49 : `character_wounds` — cases par localisation/gravité, stabilisation
- Calculs malus : serveur via `charStats.js` (fonctions pures)
- WS : room `campaignId` existante — client filtre par `char_sheet_id`

**Dépendance architecturale :**
```
ref_equipment (catalogue) ← ✅ 636 items
    ↓
char_inventory (possessions joueur) ← ✅ Chantier 10 sprint 2 (session 51)
    ↓
Module Armures (UI + mille-feuille) ← ✅ Chantier 10 sprint 3 (session 53-54)
Module Armes ← 🔲 Chantier 11 Étape 2
```

| Étape | Contenu | Prérequis | État |
|---|---|---|---|
| Étape 1 | `character_wounds` DB + routes + WoundManager UI + intégration `charStats.js` | — | ✅ session 49 |
| Étape 1b | Intégration `effectiveMalus` dans jets (socket) + Initiative fiche | — | ✅ session 52 |
| Étape 2 | Module Armes — DSL effets/munitions, parseur, résolution dommages par localisation | Chantier 10 sprint 4 | 🔲 |
| Étape 3 | Module Armures — ArmorWoundPanel + LocationPanel mille-feuille + SilhouettePanel | Chantier 10 sprint 2 | ✅ session 53-54 |
| Étape 4 | Polish — animations Tests de Choc, états santé (Étourdi/Inconscient/Coma) | Étapes 1-3 | 🔲 |

### Chantier 11 — Système de Combat Polaris

| Sprint | Contenu | État |
|---|---|---|
| Sprint 1 | Fondations : migration 54, events, combatStore, CombatOverlay, COMBAT_START/END, SESSION_JOIN sync | ✅ session 57 |
| Sprint 2 | Surprise + Phase Annonce : CombatTimeline, CombatActionWindow, CombatPnjPanel, CombatGmDeclareWindow, COMBAT_SURPRISE_RESULT/ACTION_DECLARE/SKIP_PLAYER + migration 55 characters.type + rework UI actions (4 sections, selectedKeys[], accordion GM) | ✅ sessions 58-59 |
| Sprint 2.5 | Centrage caméra combat (combatCameraCenter prop Canvas3D + useEffect orbitRef) | ✅ session 61 |
| Sprint 3 | Migration 56 : action_key/sequence/target_pos_x/y/z + state_position/state_weapon + voxel_scale | ✅ session 61 |
| Sprint 4 | UI Déplacement Combat : anneaux 4 zones PE34, légende allures, Valider/Changer/Annuler, combatMoveMode dans Canvas3D | ✅ session 61 |
| Sprint 4.1 | calcAllures LdB p.221 corrigé (4 allures, COO+Athlétisme, lookup table) | ✅ session 60 |
| Sprint 5 | Serveur COMBAT_ACTION_DECLARE : moveAction, actionRows bulk (1 ligne/action), KEY_MOD nettoyé, PC33, modifiers:{ini_mod} JSONB + fix SURPRISE_RESULT/skipPlayer/startResolutionPhase (migration 56) | ✅ session 62 |
| Sprint 6 | Phase Résolution : startResolutionPhase complet, COMBAT_ACTION_CONFIRM (déplacement Redis + boucle slots), advanceSlot, endTurn → retour ANNOUNCEMENT, UI joueur (recap + Agir) + panneau GM slot actif | ✅ session 62 |
| Sprint 7.1 | Déclaration Assaut UI : CombatActionWindow Kiwi-style (360→720px), armes auto MG/MD, sélection cible canvas, cadence CC/RC/RL, dual-wield, migration 57 | ✅ session 64 |
| Sprint 7.2 | CombatModifiersWindow : portée, situation, taille cible, fetch weapon-skill, guard ownership | ✅ session 64 |
| Sprint 7.3 | resolveAssaultAction serveur : jet attaque, DICE_RESULT broadcast, bifurcation PJ/PNJ, pendingDamageActions, bug fix skillAssoc | ✅ session 64 |
| Sprint 7.4 | COMBAT_DAMAGE_CONFIRM handler (loc + armures PI8 + dégâts + blessures + shockTest) + CombatDamageWindow (3 phases) | ✅ session 64 |
| Sprint 7.4bis | Jet de toucher interactif côté joueur (COMBAT_ATTACK_PLAYER_RESULT, CombatModifiersWindow refactorisé, CombatOverlay PJ/GM séparés) | ✅ session 64 |
| Sprint 7.5 | Décompte munitions — migration 60 (ammo_remaining + pnj_unlimited_ammo), resolveAssaultAction décrément, POST /reload transaction, WeaponPanel picker, CampaignSettings toggle | ✅ session 66 |
| Sprint 7.6 | Recharger l'arme comme action de combat (INI=0, Phase Annonce sélection ammo, Phase 2 "en attente MJ", CombatResultReload, reload_mode campagne) | ✅ session 67 |
| Sprint 7.6 | Actions d'état dynamiques (STATE_DEFS, matrices coût INI, payload v2 {state,mapActions,quick}, UPDATE state_cover/fire_mode/vitesse) | ✅ session 65 |
| Sprint GM | Refonte CombatGmDeclareWindow (InlineChip, batch, STATE_DEFAULTS, aggregate, sections TACTIQUE/ARMEMENT/ACTION/RAPIDES) | ✅ session 65 |
| Sprint GM-A | CombatRosterWindow v2 (détection arme/armure, chips T/C/B/J, quick-equip PNJ, bannière alerte) | ✅ session 65 |
| Sprint GM-B (déplacement) | Déplacement PNJ séquentiel (DEFAULT_PNJ_ALLURES, queue moveTick, bouton Passer) | ✅ session 65 |
| Sprint GM-B (assault) | Assault PNJ Mode Minimal — queue séquentielle attackTick, weapon/target sélectionnés, payload attack complet | ✅ session 65 |

**Mécanique Polaris (rappel LdB) :**

| Localisation | Légères | Moyennes | Graves | Critiques | Mortelles |
|---|---|---|---|---|---|
| Tête | 3 | 3 | 2 | 2 | 1 |
| Corps | 4 | 3 | 3 | 2 | 2 |
| Bras D/G | 3 | 3 | 2 | 2 | 1 |
| Jambe D/G | 3 | 3 | 2 | 2 | 1 |

Promotion : ligne pleine → ligne vidée + 1 case gravité supérieure cochée.
Malus par gravité : Légère −1 / Moyenne −3 / Grave −5 / Critique −10 / Mortelle −20.
Tests de Choc : Grave (tête/corps) + Critique + Mortelle (toutes localisations).

**WoundManager.jsx — SUPPRIMÉ session 55.**
Remplacé par `LocationPanel` (grille de blessures intégrée par localisation dans `ArmorWoundPanel`). Archivé dans `docs/Old/WoundManager.jsx`.

**Mécaniques armure — implémentées ou reportées :**

- **Arrondi mille-feuille** — Résolu session 56 : `polarisRound(rest / 2)`. `calcResistanceArmure` dans `charStats.js`. `calcMillefeuille` client synchronisé.

- **Carence FOR côté serveur** — Résolu session 56 : `calcCarenceArmure(equippedItems, forNA)` dans `charStats.js`. Malus = −1 par point de FOR manquant, appliqué à tous les jets (LdB).

- **Affichage carence FOR (fiche perso)** — Reporté Chantier 11 sprint 3. `ref_min_str` disponible dans le SELECT GET /inventory. L'affichage rouge (FOR < min_str) nécessite `forNA` dans `ArmorWoundPanel` — logiquement groupé avec la résolution dommages en combat.

- **DSL effets armes/munitions (Étape 2 Module Armes)** — `ref_equipment.effects` contient un DSL type `DMG_H=SET(1D6+2);CHOC=SET(BP:5D10,C:4D10);TXT=FX=ASSOMMANTE`. Syntaxe : `TYPE=ACTION(VALEUR)` séparés par `;`. Actions : `SET` (écrase), `ADD` (ajoute), `TXT=FX=` (tag qualitatif). Chargement d'une munition → override des stats de l'arme via ce parseur. Fail-safe : si DSL malformé → console.warn + stats de base de l'arme.

### PC22 — Fix 403 toggle is_learned MUTATION/POLARIS ✅ (session 50)

### Chantier reporté — Paramètre campagne GM entity move mode 🔲
3 options : réaliste / à la carte / divine. Voir EN_COURS.md.

### Serveur — Routes
| Tâche | État |
|---|---|
| Routes battlemaps CRUD + voxels | ✅ |
| Routes tokens | ✅ |
| Routes characters | ✅ |
| Lock éditeur + heartbeat | ✅ |
| Upload screenshot sortie éditeur → MinIO | 🔲 |

### Client — Canvas 3D
| Tâche | État |
|---|---|
| Voxels { tex, geo, r } | ✅ |
| Tokens 3D + rotation 8 orientations | ✅ session 39 |
| Éditeur voxel (Editor3D) | ✅ |
| Entités interactables (EntityMesh + EntityEditorScene) | ✅ |
| Palette blueprints dans éditeur | ✅ session 34 |
| EntityBuilderTab — formulaire interactions SkillCheck/Déplacement | ✅ session 40 |
| Mode visée déplacement entités — ghost wireframe + snap 8 axes + couleurs + Lerp | ✅ session 43 |
| Animation dés 3D (DiceRoller dans Canvas3D) | ✅ session 44 |
| Sprint Pathfinding — A* Chebyshev temps réel (cases colorées par allure, murs respectés, remplace anneaux concentriques) | ✅ session 65 |
| Sprint Raycast — raycastVoxelColumn via fast-voxel-raycast (précis sur terrain élevé, remplace plan fixe y=0) | ✅ session 65 |
| X-Ray voxels devant tokens | 🔲 |
| Outil règle/mesure 3D | 🔲 |

### Client — Sidebar
| Tâche | État |
|---|---|
| Chat + dés + persos + joueurs | ✅ |
| Palette textures voxel | ✅ |
| Onglets Voxels/Entités en mode édition | ✅ |
| Badge MR displacement dans chat | ✅ session 43 |
| Toggle visible character temps réel (Bug A) | ✅ session 44 |
| Bibliothèque documents | 🔲 |

### PLAN 14 — Système de Statuts (Status Effects) 🔲

Plan complet dans `docs/PLAN14_StatusEffects.md`.
**Bloqué** : en attente des 15 fichiers SVG (1 par statut).

| Statut | Code | Temporalité |
|---|---|---|
| Étourdi | `stunned` | Combat, N tours |
| Inconscient | `unconscious` | Combat |
| Saisi | `grappled` | Combat |
| Entravé | `restrained` | Persistant |
| Déséquilibré | `off_balance` | Combat, 1 tour |
| Enflammé | `burning` | Combat, DoT |
| Corrodé | `acid` | Combat, DoT |
| Asphyxie | `asphyxia` | Combat |
| Décompression | `decompression` | Combat, DoT |
| Électrocuté | `electrocuted` | Combat, 1 tour |
| Aveuglé | `blinded` | Combat, N tours |
| Hypothermie | `hypothermia` | Long terme |
| Infecté | `infected` | Long terme |
| Empoisonné | `poisoned` | Long terme |
| Irradié | `irradiated` | Long terme |

Architecture : nouvelle table `combat_status_effects` (migration à assigner — 63 prise par melee, voir `docs/PLAN14_StatusEffects.md`) + icônes `Html` R3F au-dessus des tokens.

---

### Chantier CaC — Corps à Corps Polaris ✅ (sessions 67-68)

Spec originale archivée dans `docs/Old/PLAN_12_CONTACT.md`. Implémentation documentée dans `docs/SYSTEME/COMBAT.md`.

| Sprint | Contenu | État |
|---|---|---|
| Sprint CaC 1 | Migration 63 (+melee chk_action_type), `resolveMeleeAction`, opposition PNJ auto / PJ bloque slot, UI CombatActionWindow melee, GM queue séquentielle | ✅ session 67 |
| Sprint CaC 2 | Migration 64 (`state_combat_mode`), modes Normal/Offensif/Charge PJ+PNJ, `handleChargeFlow`, bonus attaque/défense/dégâts | ✅ session 68 |
| Sprint CaC 3 | Modes Défensif (+3) / Retraite (+5) PJ+PNJ, `handleRetraiteMove`, `freeMove` étendu à retraite | ✅ session 68 |
| Sprint CaC 4 | Multi-adversaires (−5/−7/−10 LdB), modes avancés — voir `docs/SYSTEME/REGLES_LdB.md` | 🔲 priorité basse |

### Client — Dashboard
| Tâche | État |
|---|---|
| Changelog rétractable (ChangelogPanel + CHANGELOG.md, auto-open localStorage) | ✅ session 66 |
| D2 Jets Favoris — drag-to-reorder macros (sort_order DB, UI non faite) | 🔲 |

### Corrections en attente
| Bug | Description | État |
|---|---|---|
| Bug A | Toggle visible character non répercuté en temps réel | ✅ session 44 |
| Bug B | Modification faces voxel existant non exposée dans UI | 🔲 |
| Bug WebGL | Context Lost au switch play/edit — non bloquant | documenté |
| Bug surprise | roll=1 → initiative=1 (agit en dernier) — sémantique PJ surpris à revoir | 🔲 |
| Dette | EntityEditorOLD.jsx commité par erreur — à supprimer | ✅ session 44 |
| Dette | .gitattributes:3 attribut invalide — à corriger | 🔲 |
| Dette arch. | `pendingDamageActions` Map in-memory — données perdues si redémarrage serveur entre ATTACK_PLAYER_RESULT et DAMAGE_CONFIRM — persister en DB ou Redis | 🔲 |

---

## Phase 3 — Polish + assets 🔲

| Tâche | État |
|---|---|
| Scènes 2D ambiance | 🔲 |
| Avatars utilisateur | 🔲 |
| Optimisation voxel face culling | 🔲 |
| Persistance viewport caméra | 🔲 |
| Reconnexion WebSocket | 🔲 |
| Favicon application | 🔲 |

---

## Chantiers futurs — à analyser

### Audit localisation (blessures)
Le système de localisation des blessures est implanté (LOC_TABLE D20, `character_wounds` avec `wound_location`, `ArmorWoundPanel`, `LocationPanel`) mais le suivi a été négligé ou mal fait. Faire un point complet : vérifier que les localisations sont bien enregistrées, affichées et prises en compte dans tous les flux (assaut PJ + PNJ, shock test, carence FOR). Sprint d'audit avant toute extension.

### Environnement de carte 2D (Redis)
Alternative à la carte 3D voxel — mode "Roll20-like" : image en fond, quadrillage 2D, tokens 2D.
- Backend : couche Redis dédiée (tokens 2D distincts des tokens 3D)
- Frontend : canvas 2D (pas Three.js) — image background, overlay grille, drag tokens
- Scope : nouvelle page `Session2DPage` ou mode switchable dans `SessionPage`
- Complexité estimée : élevée (nouveau moteur de rendu, nouvelle couche données)

---

## Idées documentées — à planifier

### Paramètre campagne GM entity move mode
Voir EN_COURS.md — chantier reporté.

### Mode spectateur
Rôle `spectator` dans `campaign_members.role`.
Accès lecture identique à `player` — aucune émission WS.
Complexité estimée : faible à moyenne.

### Géométrie slope et wedge custom
BufferGeometry custom Three.js — aucun changement modèle de données.
Complexité estimée : faible.

### Export ZIP pack complet
À ajouter : blueprints JSON dans `entites/`, GLB dans `glb/`.

### Sprint SkillTooltips — Tooltips descriptifs LdB sur SkillsPanel
Source : `docs/Character/SkillTooltips.md` (descriptions complètes LdB, 1182 lignes).
Travail préalable requis :
1. Nettoyer les artefacts OCR du fichier source (`￾`, doublons colonnes PDF, pages)
2. Établir le mapping `skill.id` (DB) → clé tooltip (vérifier le seed `2_seed_equipment.js` + ref_skills)
3. Ajouter les clés `skills.tooltip.*` dans `fr.json`
4. Ajouter icône ℹ dans `renderSkillRow` + composant tooltip (pattern identique `SecondaryField`)
Complexité estimée : moyenne (nettoyage OCR + mapping = travail éditorial, implémentation technique = faible).

### Chat MP
Messagerie privée entre joueurs/GM.

### Sauvegarde/export carte 3D
Export battlemap complète (voxels + entités + tokens).

---

## Hors scope V1
- Fog of war
- Webcam / audio / vidéo
- Sources lumineuses dynamiques
- Chat MP (V2)
- Sauvegarde/export carte 3D (V2)
