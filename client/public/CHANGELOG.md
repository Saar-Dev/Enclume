## v118 — 2026-06-22 — REWORK-12 : useCharacterSocket — blessures + inventaire extraits

### Client — Refactoring
- [refactor] `client/src/lib/useCharacterSocket.js` créé — 6 handlers WS (`WOUND_ADDED/UPDATED/REMOVED`, `INVENTORY_ADDED/UPDATED/REMOVED`) extraits de `SessionContent`
- [refactor] `SessionPage.jsx` — `woundVersions` useState + `updateCharacter` destructuring + `useEffect([socket])` WOUND/INVENTORY supprimés

---

## v117 — 2026-06-22 — REWORK-11 : useSessionSocket — handlers session extraits

### Client — Refactoring
- [refactor] `client/src/lib/useSessionSocket.js` créé — 12 handlers WS (SESSION_*, CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, CHARACTER_UPDATED, DOC_*) extraits de `SessionContent`
- [refactor] `SessionPage.jsx` — destructurings `useSessionStore`/`useCharacterStore`/`useLibraryStore` nettoyés, `useEffect([socket])` réduit aux 6 handlers WOUND_*/INVENTORY_*

---

## v116 — 2026-06-21 — REWORK-15 : SocketProvider — lifecycle socket centralisé

### Client — Refactoring
- [refactor] `client/src/lib/SocketContext.jsx` créé — `SocketProvider` Context + `useSocket()` hook
- [refactor] `useTokenSocket`, `useEntitySocket`, `useCombatSocket` — `listen(s)` supprimé → `useSocket()` direct
- [refactor] `SessionPage.jsx` — split `SessionPage` (wrapper) + `SessionContent` — grand useEffect → 2 useEffects nommés

---

## v115 — 2026-06-21 — REWORK-06 : declarationReducer + fixes combat

### Client — Refactoring
- [refactor] `client/src/lib/declarationReducer.js` créé — reducer pur partagé (`SET_FIELD`, `SET_COMBAT_MODE`, `SET_QUICK`, `SELECT_ATTACK`, `RESET`, `RESET_NEW_TURN`)
- [refactor] `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` — 3 useState chacun → 1 `useReducer(declarationReducer, DECLARATION_INITIAL)`
- [fix] Assaut (tir) grisé non cliquable quand arme holstered → onClick + cursor pointer
- [fix] GM : curseur interdit sur bouton Assaut arme non au clair → opacity seule, curseur pointer
- [fix] Mains nues CaC par défaut (suppression auto-sélection première arme de contact)

### Serveur — Correctif
- [fix] PC23 Tir Automatique (RC/RL) — typo `TIR_AUTOMATIQUE` → `TIR_AUTOMATIQUES` dans `socketCombat.js`

---

## v114 — 2026-06-20 — FEAT2-C : Caméra LOS v2 épaule droite

### Client — Nouvelle fonctionnalité
- [feat] `client/src/lib/useCameraLOS.js` — service LOS complet (feature-as-service) : `{ losLine, onTokenClick, onPointerUp, clearLine }`
- [feat] Caméra "épaule droite" — vue subjective src→tgt après check LOS (CAM_BACK=3, RIGHT=1.5, UP=2)
- [refactor] `Canvas3D.jsx` — zéro logique LOS dans le composant (1 appel hook + 4 callables)
- [fix] P-LOS13 : ligne LOS ne disparaît plus après ¼ sec (guard `justHandledTargetRef` dans le service)
- [fix] TDZ `voxelsRef` : appel `useCameraLOS` déplacé après déclaration `voxelsRef`

---

## v113 — 2026-06-20 — FEAT2-A : LOS outil menu radial

### Client — Nouvelle fonctionnalité
- [feat] Menu radial token : secteur "Vue" (ex-"Viser") — outil ligne de vue
- [feat] `client/src/lib/losUtils.js` — `checkLOS()` pure function, `fast-voxel-raycast`, PE14
- [feat] Ray 3D vert/rouge entre tokens (`<line>` natif bufferGeometry) — persiste jusqu'au prochain check
- [feat] Overlay DOM résultat (cliquable pour fermer) + bannière mode sélection cible

---

## v112 — 2026-06-20 — REWORK-04 : FSM Combat + persistence DB

### Serveur — Architecture
- [refactor] `server/src/lib/combatFSM.js` — FSM combat (6 états, fonctions pures : `canTransition`, `nextState`, `setFSMSubPhase`, `allowedEvents`)
- [refactor] Migration 80 : table `combat_pending` — remplace 3 Maps in-memory (`pendingMeleeDefense`, `pendingDamageActions`, `pendingStunActions`)
- [refactor] Migration 81 : `combat_state.sub_phase` — sous-état FSM persisté (`SLOT_ACTIVE` / `AWAITING_DEFENSE` / `AWAITING_DAMAGE`)
- [refactor] `socketCombat.js` — guards `canTransition` sur 10 handlers + Maps → DB
- [refactor] `statusService.applyStun` — `pendingStunActions` Map → `combat_pending` DB
- [fix] Reconnexion pendant RESOLUTION — prompts (`MELEE_DEFENSE`, `DAMAGE`, `STUN`) restaurés sur reconnexion joueur

### Client — Architecture
- [refactor] `combatStore.js` — `subPhase` + `setCombatSubPhase`
- [refactor] `useCombatSocket.js` — `subPhase` propagé depuis `COMBAT_STATE_SYNC`

---

## v111 — 2026-06-19 — WorkshopPage : messages d'erreur plus précis

### Client — Correctifs
- [fix] Atelier GM : messages d'erreur affinés — fallback `.message` + `err.message` avant le générique i18n (5 handlers : création, import, suppression pack, upload PNG, suppression fichier)

---

## v110 — 2026-06-19 — Session 109 : triage docs

### Documentation — Aucun impact utilisateur
- [refactor] ARCHI_REWORK.md allégé (969 → ~100 lignes), specs archivées dans ARCHI_REWORK_DONE.md
- [refactor] JOURNAL4.md archivé — JOURNAL5.md créé pour Sessions 109+
- [refactor] BUGIDENTIFIE.md : +FEAT1 (Map2D) + FEAT2 (LOS raycast cible)

---

## v109 — 2026-06-19 — REWORK-08 Étapes 6 & 7 : socketCombat.js

### Serveur — Architecture
- [refactor] `server/src/socket/socketCombat.js` créé — 13 handlers + 13 helpers + 7 constantes combat extraits de `socket/index.js`
- [refactor] `socket/index.js` : 2994 → 143 lignes — registre de modules uniquement
- [refactor] Disconnect PJ déplacé dans SESSION_JOIN (cleanup systématique)

---

## v108 — 2026-06-19 — REWORK-08 Étape 5 + correctifs entités

### Serveur — Architecture
- [refactor] `server/src/socket/socketEntity.js` créé — 7 handlers entités extraits de `socket/index.js`

### Client — Correctifs entités
- [fix] Entité marquée "Visible GM uniquement" désormais masquée pour les joueurs en temps réel
- [fix] Suppression d'entité possible depuis le panneau de configuration (bouton avec confirmation)
- [fix] Sablier d'interaction entité disparaît après le jet de dés, que le jet réussisse ou échoue

---

## v107 — 2026-06-18 — REWORK-10 : log déclarations intégré dans le chat

### Client — UI Combat
- [feature] Log déclarations combat (REWORK-10) déplacé depuis l'overlay vers le panel chat Sidebar
- [feature] Visible en haut du tab chat pour GM + joueurs pendant ANNOUNCEMENT et RESOLUTION
- [feature] Collapsible sur une ligne (header cliquable, état toggle persistant)
- [refactor] Suppression du render CombatDeclareLogSidebar dans CombatOverlay

---

## v106 — 2026-06-18 — REWORK-09 : SessionPage hooks WS dédiés

### Client — Architecture
- [refactor] `SessionPage.jsx` 1509 → 1296 lignes — 47 listeners WS extraits vers 3 hooks dédiés
- [refactor] `useTokenSocket.js` — 5 listeners TOKEN_* (moved, created, deleted, updated, status)
- [refactor] `useEntitySocket.js` — 4 listeners MAP_SWITCH + ENTITY_ACTION_PENDING/RESULT + ENTITY_MOVE_RESULT
- [refactor] `useCombatSocket.js` — 18 listeners COMBAT_* + 12 états résultat combat
- [fix] Dead props `tokens` et `announcementMarker` supprimées de CombatOverlay

---

## v105 — 2026-06-17 — REWORK-02 : damageService (résolution hit centralisée)

### Serveur — Architecture
- [refactor] Extraction du bloc "résolution cible" (localisation D20 → armure → RD → sévérité → blessure → shock) depuis 4 sites dupliqués vers `damageService.resolveTargetHit`
- [refactor] `LOC_TABLE` déplacée vers `shared/armorConstants.js` (import partagé)

---

## v104 — 2026-06-17 — REWORK-05 clôture : BUG-W1 + BUG-W2 + ERG-W1 + ERG-W2

### Combat — Fenêtre GM (CombatGmDeclareWindow)
- [fix] BUG-W1 : arme CaC holstérée ne se sélectionne plus par défaut — "Mains nues" si arme rangée, arme équipée si "Au clair"
- [fix] BUG-W2 : 2 attaques CaC — la sélection de cible s'enchaîne correctement (slot 1 → slot 2) — race condition `setCombatTargetMode` résolue via `setTimeout(0)`
- [erg] ERG-W1 : "Assaut (tir)" grisé mais cliquable si arme rangée — clic déclenche auto-dégainage ("Au clair") avec coût INI automatique
- [erg] ERG-W2 : panneau CaC — clic arme équipée → auto-dégainage / clic Mains nues → auto-rangement (coût INI selon matrice d'état)

---

## v103 — 2026-06-17 — REWORK-05 : panneaux combat partagés + fix COM5 + fix CL2

### Combat — Architecture UI
- [rework] REWORK-05 : panneaux droits dupliqués (`~370 lignes`) extraits en 3 composants partagés — `DroneWeaponPanel`, `AssaultRangedPanel`, `MeleeCombatPanel`
- [rework] `ACTION_LABELS`, `PURE_MOVE_TYPES`, `COMBAT_MODE_DEFS` migrés dans `combatSections.js` — source unique
- [fix] COM5 : chips mode de combat GM (`CombatGmDeclareWindow`) ne déclenchent plus le mode visée automatiquement — target entry via bouton "Cibler" explicite uniquement
- [fix] CL2 : `DeclareLogContent` exporté depuis `CombatDeclareLog.jsx` — log déclarations Joueur (`CombatActionWindow`) utilise le même composant que le GM — rendu identique garanti

---

## v102 — 2026-06-16 — REWORK-03 : woundService + fix DIV-1 couleurs sévérité combat

### Serveur — Architecture
- [rework] REWORK-03 : `resolveWoundInsertion` × 5 call sites WS → `woundService.applyWound` (module indépendant)
- [fix] DIV-1 : `worst_wound_severity` maintenant inclus dans tous les `WOUND_ADDED` WS — couleurs sévérité (token + timeline) conservées pendant tout le combat

---

## v101 — 2026-06-16 — REWORK-01 clôture : SHK4 + SHK5 + CSS [A1]

### Combat — Test de Choc
- [fix] SHK4 : D20 Test de Choc maintenant visible dans le chat (carte `shock_test` dédiée avec seuils Étourd./Inconsc.) — 5 call sites + `emitShockDiceResult` export synchrone
- [fix] SHK5 : `shock_auto_stun=false` — `CombatStunWindow` correctement routée vers le GM pour les PJ cibles (lecture `shock_auto_stun` dans branche PJ de `applyStun`)
- [fix] [A1] `CombatStunWindow` conventions CSS — `className="btn"`, classes `.combat-stun-*` dans `index.css §11`

---

## v100 — 2026-06-16 — Fix CUR1 : curseur bloqué après fermeture combat

### Combat — UX
- [fix] CUR1 : curseur / panneaux de sélection (cible, déplacement) fantômes après fermeture du combat — `combatMoveMode`, `combatTargetMode`, `pendingMoveSelection` remis à `null` dans `COMBAT_ENDED` et `COMBAT_PHASE_CHANGED`

---

## v99 — 2026-06-16 — Fix SHK6 + REWORK-01 validé complet

### Combat — Drone → PJ
- [fix] SHK6 : `COMBAT_DAMAGE_CONFIRM` rejetait silencieusement le PJ cible d'un drone (drone sans `user_id` → `pending.userId = null` → auth échouait) — fenêtre dégâts débloquée
- [fix] `targetUserId` ajouté au pending action branch 8c (`resolveDroneAssaultAction`) pour autorisation correcte

### REWORK-01 — Validation complète
- Scénarios 1-5 ARCHI_REWORK.md tous validés : PNJ cible, PJ cible (`CombatStunWindow`), non-régression, PJ offline fallback, CaC non-régression

---

## v98 — 2026-06-16 — REWORK-01 : statusService (module étourdissement)

### Combat — Architecture stun
- [rework] `resolveShockBlock` (bloc monolithique copié ×5) → `statusService.js` (module indépendant)
- [feat] `resolveShockTest` : pure, D20 uniquement, zéro DB/WS — découplé de l'émission résultat
- [feat] `applyStun` : PJ connecté → fenêtre interactive "Lancer 1D6" (`CombatStunWindow`), PNJ → D6 auto serveur
- [feat] `CombatStunWindow` : badge coloré outcome (jaune/rouge) + bouton "Lancer 1D6" — PJ choisit quand lancer
- [fix] Séquençage : `COMBAT_DAMAGE_RESULT` émis **avant** le stun → la fenêtre dégâts ne se bloque plus jamais si la résolution stun échoue
- [feat] `shock_auto_stun = false` : GM reçoit le prompt D6 pour ses PNJs (V1 partiel — PJ→fenêtre joueur, correction future)

---

## v97 — 2026-06-14 — Fix split-brain slot detection

### Combat — Architecture slots
- [fix] Split-brain slot actif : `CombatOverlay` utilise désormais `activeTokenId` (absolu) au lieu de `sortedRoster[activeSlotIdx]` (index roster complet) — élimine le cas où un token non-annoncé à INI haute bloquait le combat
- [fix] `startResolutionPhase` : premier slot envoyé depuis le roster annoncé filtré (pas le roster complet) — cohérence avec `COMBAT_ACTION_CONFIRM`
- [fix] Actions transmises au client filtrées `status='pending'` — pas de données périmées de tours précédents
- [fix] Guard CaC sans cible : `COMBAT_ACTION_DECLARE` refuse avec `COMBAT_DECLARE_ERROR` si aucune cible sélectionnée — `has_announced` non settée

---

## v96 — 2026-06-14 — Sprint CaC Étape 3 : CombatCacModifiersWindow + mods situation

### Combat — Corps à corps
- [feat] Nouvelle fenêtre modificateurs CaC (`CombatCacModifiersWindow`) — 7 mods attaquant + terrain instable défenseur + taille cible
- [feat] Deux armes au contact : détection automatique serveur (MD + MG arme contact → +3)
- [feat] Terrain instable : compétence limitative ACROBATIE_EQUILIBRE appliquée attaquant ET défenseur
- [feat] 6 clés de situation CaC dans `SITUATION_MODS` (côté, au sol, espace confiné/très confiné, position avantageuse, main non directrice)
- [feat] `confirmedModifiers` propagé sur les 4 call sites de `resolveMeleeAction` (multi-attaque inclus)
- [feat] `breakdownAtk` / `breakdownDef` : nouvelles entrées conditionnelles visibles dans le chat

---

## v95 — 2026-06-14 — Sprint CaC : correctifs mécaniques (Étapes 1+2)

### Combat — Corps à corps
- [fix] B9 — Test d'opposition §6.2 complet : les deux réussissent → meilleure MR l'emporte, égalité = rien
- [fix] B1 — Compétence défenseur selon arme équipée en main (priorité `hand_pref`), fallback Mains nues
- [fix] B2 — Charge impossible si déjà à ≤ 3m du défenseur (LdB §6.4)
- [fix] B8 — Drone défenseur CaC : test simple, dégâts via `calcDroneRD` + intégrité
- [fix] LOC — Table de localisation CaC séparée (`LOC_TABLE_CONTACT`) — 3 emplacements

### Combat — Drones
- [fix] B3 — Drone CaC `armement_contact` : modificateur portée = 0 (contact physique, pas de +5 `bout_portant`)

## v89b — 2026-06-12 — Sprint 2c : cycle combat drone joueur complet

### Drones — Combat
- [fix] Joueur peut déclarer l'attaque de son drone via `COMBAT_ACTION_DECLARE` — guard ownership corrigé (drone joueur n'était pas autorisé)
- [fix] Bouton "Agir" GM visible en RESOLUTION quand un drone a une action d'assaut déclarée
- [fix] Résolution drone sans `confirmedModifiers` — portée défaut 'courte' si absent (modifiers non requis pour drone V1)
- [fix] Fenêtre ANNOUNCEMENT GM ne s'affiche plus pour les drones appartenant à un joueur
- [fix] Champs NT dans la fiche drone — affichage en chiffres romains (I–VIII), édition GM en entier
- [fix] WeaponsTab drone — suppression du concept "Chargeur" (non applicable) ; `ammo_restant = null` → `∞`

## v90 — 2026-06-12 — Breakdown détail jets de dé

### Chat sidebar
- [add] Bouton `⊞` sur chaque jet structuré (combat tir, CaC, action entité) — ouvre un popover avec le détail ligne par ligne des modificateurs composant le Seuil
- [add] Colorisation par type : compétence (bleu), bonus (vert), malus (rouge), Seuil (or)
- [add] Fermeture click-outside ou Escape
- [add] Payload `DICE_RESULT` enrichi côté serveur : champ `breakdown` optionnel sur 5 points d'émission (tir distance, CaC attaquant, CaC défenseur PNJ, CaC défenseur PJ, action entité)

## v94 — 2026-06-12 — Sprint Drones 2c : attaque drone (GM)

### Drones — Combat
- [add] GM peut déclarer l'attaque d'un drone en phase ANNOUNCEMENT — sélecteur arme drone + cible dans CombatGmDeclareWindow
- [add] Résolution automatique de l'attaque drone en RESOLUTION — programme armement, modificateurs situationnels (§7.3), dommages
- [add] Trois branches cible : drone (intégrité), PNJ (blessures auto), PJ (lancer des dégâts)
- [add] Pré-sélection automatique de la taille cible dans CombatModifiersWindow si la cible est un drone
- [add] Armes drone custom (sans ref_equipment) — nom + formule de dommages directs dans drone_weapons
- [add] Migration 76c — schéma drone_weapons étendu (name, damage_formula, portee, fire_mode, notes)
- [add] Migration 76d — catégories programmes `armement_distance` / `armement_contact` (remplace `armement` générique)

## v87 — 2026-06-11 — Correctifs combat + CombatDeclareLog

### Combat — Déclarations
- [add] CombatDeclareLog — panneau cumulatif des déclarations du tour, persistant pendant ANNOUNCEMENT et RESOLUTION
- [fix] Double fenêtre CombatDeclareLog côté joueur — standalone réservé au GM, déclarations intégrées dans CombatActionWindow (lecture seule) pour les joueurs
- [fix] Style lecteur clair (fond `#f4f7f8`, texte `#1a2a3a`) — même CSS partagé GM/joueur

### Combat — Correctifs
- [fix] Actions Corps à corps jamais résolues — bouton "Agir" masqué par la branche `myMeleeAction` dans le footer
- [fix] Assaut/CaC bloqué si arme non "Au clair" — guard visuel + surbrillance état arme dans StateSelector
- [fix] Dégainer automatique (QB) supprimé — dégainer coûte des INI comme le prescrit le LdB Polaris
- [fix] CaC — sélection auto arme supprimée, défaut = Mains nues (fallback si aucune arme de contact équipée)
- [fix] EXCLUSIVE_ACTIONS supprimé — Recharger ne désélectionne plus les autres actions
- [fix] Munitions vérifiées en ANNOUNCEMENT — `COMBAT_DECLARE_ERROR` si insuffisantes pour le mode de tir choisi
- [fix] Flash blanc onglet Matériel — rechargements WS silencieux via `hasLoadedRef` (ArmorWoundPanel, WeaponPanel, InventoryPanel)
- [fix] Icônes de statut s'affichant au-dessus de toute l'UI — `zIndexRange={[1, 0]}` sur le `<Html>` Drei
- [fix] Options de jet critique non mémorisées au rechargement — `detectSimpleConfig` restaure les 4 états depuis `dice_config`
- [fix] Chat combat — DICE_RESULT structuré pour les 4 jets (assaut tir, CaC attaque, CaC défense PJ, CaC défense PNJ)
- [fix] Terminologie `cdr` → `seuil` dans les payloads COMBAT_ATTACK_PLAYER_RESULT
- [fix] Dé résultat — taille fixe 20px + aligné à droite dans le chat (Sidebar)
- [fix] Joueur propriétaire peut modifier le GLB de son propre token (route `characters.js` + `CharacterWindow`)

### Documentation — Plan drones combat
- Audit exhaustif `docs/PLAN_DRONESYSCOMBAT.md` — 25 issues V1–V25 identifiées et résolues
- Architecture Sprint 2b : deux branches (PNJ→drone resolveAssaultAction, PJ→drone COMBAT_DAMAGE_CONFIRM)
- Décision V21 télépilotage Option C : propriétaire consomme son slot, drone status='done' ce round
- Simulation à blanc Sprints 2a–3 : 14 findings, 3 décisions design, 10 corrections supplémentaires au plan
- Migrations planifiées : 76, 76b, 76c, 76d, 77, 77b

## v85 — 2026-06-09 — Tour de combat complet + Corrections UI fenêtres

### Combat — Corrections critiques
- [fix] "Assaut (tir)" PNJ déclenchait le panneau Corps à corps au lieu du mode visée (isMeleeSetup)
- [fix] Fenêtre déclaration joueur (Phase 1) bloquée en haut à gauche sous la Timeline — position:fixed
- [fix] Fenêtre résolution GM bloquée en haut à gauche + largeur plein écran — position:fixed
- [fix] Drag & drop token silencieusement annulé pendant un combat pour les joueurs (intégrité)

### Combat — UX harmonisée GM/Joueur
- [add] Fenêtre validation assaut se positionne près du token cible cliqué (GM et joueur)
- [add] Fenêtre validation déplacement se positionne près de la case sélectionnée
- [add] Case de destination mise en surbrillance bleue dans la vue 3D après sélection

## v83 — 2026-06-06 — Fiche Drone + Design System CSS + Migration catalogue compétences

### Fiche Drone — Programmes
- [add] Catalogue de 34 programmes logiciels (LdB p.281) : Détection, Ami/Ennemi, Armement, Esquive, Pilotage, Analyse, Médical, Communication, Spécialisés
- [add] Section "Duel d'ordinateurs" regroupant les programmes Sécurité, Offensif, Contre-attaque et Rempart
- [add] Tooltip description au survol du nom de programme (texte LdB complet)
- [add] Mode "Catalogue" : sélection depuis le catalogue organisé par catégorie
- [add] Mode "Personnalisé" : saisie libre avec catégorie assignable (pour programmes custom hors LdB)
- [add] Validation contrainte ordinateur : niveau max (gen + 2×NT) et potentiel total (10 + gen×NT×2)
- [add] Intégrité actuelle éditable directement par le GM

### Interface Combat — Design System
- [chg] 9 composants combat migrés de styles JS inline vers classes CSS centralisées dans index.css
- [add] 27 tokens CSS --combat-* dans :root
- [add] Section 11 COMBAT WINDOW SYSTEM (~320 lignes) : .combat-win, .combat-float-win, .btn-tac-confirm, .combat-timeline-bar, badges, chips, selects

### Catalogue compétences (migration 74)
- [fix] 10 groupes structurels manquants insérés (Mutation, Pouvoirs Polaris, Armes Spéciales, Arts martiaux, Commerce/Trafic, Pilotage, Génie technique…)
- [fix] Compétence Arts martiaux restaurée avec le bon attribut (COO/ADA) et le malus (-3) sur ses sous-compétences
- [fix] MUTATION_* et POUVOIRS_POLARIS_* : marqueur (X) appliqué — ces compétences se masquent correctement si non acquises
- [fix] Prérequis CHIRURGIE, FALSIFICATION et 3 compétences Polaris/Mutation ajoutés
- [fix] Typo identifiant ACCROBATIE_EQUILIBRE → ACROBATIE_EQUILIBRE

---

## v81 — 2026-06-05 — Sprint Annonce v2 + corrections combat + roster personnages

### Combat — Phase Annonce
- [chg] Déclaration séquentielle stricte : une fenêtre à la fois dans l'ordre d'initiative, le GM ne peut plus grouper des PNJs en batch
- [add] Ghost de déplacement (cube bleu semi-transparent) visible pour tous après chaque déclaration
- [add] Ligne ambre reliant l'assaillant à sa cible annoncée, visible pour tous les spectateurs
- [add] Mini-panneau "vient d'annoncer" en bas-gauche (nom, INI, destination, cible)
- [chg] Timeline phase Annonce : le déclarant actif est affiché en grand, les déclarés sont atténués
- [add] Bouton "Passer" dans la fenêtre GM quand un joueur bloque le flux d'annonce

### Combat — Monitoring GM en temps réel
- [add] Le GM voit en direct ce que le joueur actif est en train de déclarer : actions choisies, cible visée, destination de déplacement, mode de combat — mis à jour en temps réel (150ms) sans attendre la confirmation
- [add] Reconnexion du GM en cours de déclaration : le preview courant est resynchronisé automatiquement

### Combat — Fenêtre de déclaration
- [add] Roster PNJs collapsible (GM) avec mémorisation de l'état ouvert/fermé
- [add] Roster de personnages collapsible (joueurs) : liste tous les persos du joueur en combat, visible dans tous les états (attente, déclaré, formulaire). Utile pour hackers avec drones ou PNJ alliés assignés
- [add] Ligne de déplacement bleue de l'origine à la destination + nom du token au-dessus — les spectateurs voient clairement qui se déplace et où

### Combat — Test de Choc
- [add] Option campagne "Appliquer l'étourdissement automatiquement" (activée par défaut) — désactivez pour arbitrer manuellement
- [add] Bouton "Appliquer l'étourdissement" dans le panneau résultat GM quand l'option est désactivée
- [fix] L'échec d'un Test de Choc applique désormais le badge Étourdi ou Inconscient sur le token
- [fix] La fin du combat retire automatiquement les badges Étourdi/Inconscient des participants
- [fix] Le MJ voit le panneau résultat dégâts quand un PJ attaque un PNJ

### Combat — Bugs corrigés
- [fix] Écran noir joueur au passage en mode combat (erreur JavaScript interne)
- [fix] Bouton "Assaut (tir)" grisé à tort pour les armes n'ayant jamais été rechargées via l'interface (migration 70 : initialisation automatique du chargeur à l'équipement)

---

## v80 — 2026-06-04 — Bibliothèque : images uploadées dans le cloud

### Bibliothèque
- [fix] Images insérées dans un document sont maintenant hébergées sur le serveur (était : stockées en base64 dans le contenu, alourdissait les documents)
- [chg] Le bouton image dans l'éditeur upload le fichier et insère un lien — comportement identique côté MJ

---

## v79 — 2026-06-04 — Fix placement tokens

### Playground — Tokens
- [fix] Tokens posés sur des demi-dalles (`slab_bottom`) ne flottent plus dans les airs
- [fix] Drop du token se fait maintenant à l'endroit exact où le ghost était affiché, pas là où pointe le curseur
- [fix] Ghost ne saute plus sur la case voisine en bord de voxel pendant le drag
- [fix] Crash écran noir au démarrage de session (TDZ `statusPanel`)

---

## v77 — 2026-06-04 — Optimisation Voxels Phase B

### Playground — Voxels
- [fix] Cubes avec textures multi-faces (east≠south≠top…) affichent désormais la bonne texture sur chaque face lors d'une rotation (r=1/2/3). Invisible avec les textures actuelles (toutes `all`) — correction active pour les futurs packs multi-faces.

---

## v76 — 2026-06-04 — Menu radial Token + Design System + Optimisation Playground

### Playground — Tokens
- [add] Menu radial SVG sur les tokens (clic simple) : 8 secteurs, style hard-SF HUD
- [add] "Fiche" : ouvre la fiche personnage directement depuis le token
- [add] "Retirer" : retire le token du plateau
- [add] Boussole directionnelle dans le cœur du menu : orienter le token en 8 directions
- [add] Cœur coloré selon la pire blessure active (jaune → rouge foncé)
- [add] Animation bloom + pulse danger si critique/mortelle
- [chg] Clic simple sur token = menu radial (était : rotation 45°)

### Playground — Performances voxels
- [perf] Rendu voxels : faces cachées entre cubes adjacents éliminées (face culling)
- [perf] Draw calls réduits de N voxels → nb_textures × 6 maximum
- [perf] Carte complexe : lag quasi supprimé (confirmé session)

### Design System — Interface
- [add] Police Venus Rising active sur les titres (Login, Dashboard)
- [add] 36 tokens CSS : surfaces session, couleurs blessures, accents statuts, familles de polices
- [add] 15 icônes HUD hexagonales de statuts (étourdi, hypothermie, en feu…)
- [add] Boutons harmonisés : style chamfré hard-SF unifié sur Dashboard, Sidebar, CombatOverlay, CombatActionWindow, SessionPage, LibraryPanel
- [add] Badges MJ/Joueur/Résultat chamfrés sur toutes les vues
- [add] Bouton "Quitter la session" dans l'onglet Profil (→ tableau de bord)
- [fix] Timeline mode combat : ne chevauche plus la sidebar (s'arrête au bord gauche de la sidebar)
- [chg] Bouton ⚔ Combat : rouge en mode combat actif, bleu sinon

---

## v75 — 2026-06-03 — Bibliothèque de campagne

### Bibliothèque
- [add] Onglet "Bibliothèque" dans la Sidebar : liste des documents de campagne accessibles
- [add] Éditeur de texte riche (Quill 2.0) : gras, italique, titres, listes, alignement, liens, couleurs, images inline
- [add] Notes du MJ : second éditeur visible uniquement par le MJ
- [add] Permissions par document : "Personne / Tous les joueurs / sélection individuelle" (dropdown multi-select)
- [add] Indicateurs de partage : œil masqué (non partagé), œil ouvert (tous), punaise colorée (joueur(s) spécifique(s))
- [add] Propagation temps réel : document créé/modifié/supprimé visible instantanément par les joueurs autorisés

### Interface
- [chg] Fusion onglets "Joueurs" et "Config" → onglet "Profil" (réglages en haut, liste connectés en bas)

---

## v74 — 2026-06-02 — CaC : Attaque multiple

### Combat — Corps à corps
- [add] Attaque multiple melee : déclarer 2 attaques (malus −5) ou 3 attaques (malus −7) en un tour (LdB p.218)
- [add] Sélection séquentielle des cibles dans le panel CaC (PJ) : N boutons "Choisir l'adversaire"
- [add] GM : chips "1 / 2 (−5) / 3 (−7)" dans le panneau CaC + queue étendue (N cibles par PNJ)
- [add] Résolution séquentielle dans le même slot : attaque 1 → résultat → attaque 2 → etc.

---

## v73 — 2026-06-01 — Correctifs UX & Playground

### Dashboard
- [fix] Boutons Créer/Rejoindre asymétriques → deux cartes identiques avec formulaire inline (filigrane + et →)
- [add] Carte "Rejoindre une campagne" avec champ pré-rempli #code-invitation toujours visible

### Playground — Tokens
- [fix] Étiquettes de nom des tokens ne faisaient pas face à la caméra (Billboard drei)
- [fix] Couleur des étiquettes ne correspondait pas à la couleur du joueur (user_color via JOIN)
- [fix] Drag & Drop imprécis sur terrain plat : token snappe désormais au centre de la case
- [fix] Drag & Drop décalé sur terrain en altitude : raycast voxel remplace plan y=0

### Fiche personnage
- [add] Panel description compétence : bouton ⓘ sur chaque compétence → panel fixe avec texte complet du LdB (scrollable, fermeture clic extérieur)

### Chat
- [fix] Messages partagés entre toutes les campagnes → chaque campagne conserve son propre historique

## v72 — 2026-06-01 — Multi-adversaires Corps à Corps

### Combat — Corps à corps
- [add] Malus encerclement CaC (LdB p.224) : −5 pour 2 adversaires, −7 pour 3, −10 pour 4+
- [add] Critère positionnel : tout ennemi à portée (3m + allonge de son arme) au moment de la résolution
- [add] Alerte ⚠ dans le popup défense PJ : "Encerclé — malus −X à votre défense" si applicable
- [add] Alerte ⚠ dans le panneau résultat melee : indique qui est encerclé et de combien

## v71 — 2026-06-01 — Timeline combat BG3-style

### Combat — Timeline initiative
- [add] Portraits illustrés plein format (illustration fiche personnage)
- [add] Bordure de carte = couleur de la pire blessure active (légère jaune → mortelle rouge foncé)
- [add] Carte active agrandie (64px vs 44px) avec halo doré
- [add] Phase Annonce : cartes triées INI croissante (lents à gauche), curseur flèche ←
- [add] Phase Résolution : cartes depuis les actions déclarées, curseur flèche →
- [add] Timer de tour (si configuré dans les options campagne) — vert/orange/rouge
- [add] Maximum 12 cartes affichées, badge +N pour le surplus
- [add] Animations fluides : entrée/sortie et réordonnancement si INI change (Motion FLIP)
- [fix] Portrait URL cassée (image jamais affichée depuis session 57)
- [fix] Blessures temps réel : bordure se met à jour sans rechargement

## v70 — 2026-06-01 — Token par défaut campagne + stabilité serveur

### Tokens 3D
- [fix] Crash écran noir quand un token sans modèle 3D est placé sur une carte
- [add] Token par défaut de campagne : le GM peut uploader un GLB dans les options campagne
- [add] Bouton "Réinitialiser" pour retirer le token par défaut de campagne
- [add] Hiérarchie fallback : modèle personnage → token campagne → défaut bundle → silhouette

### Serveur
- [fix] Migrations automatiques au démarrage du serveur (plus de migration manuelle)
- [fix] "Erreur lors de l'enregistrement" sur la page Options campagne (colonne inconnue)

## v69 — 2026-06-01 — Serveur Alpha Kiwi + correctifs UI

### Serveur distant Alpha "Kiwi"
- [add] Déploiement sur serveur Linux maison (accessible via internet)
- [add] Services systemd — démarrage automatique au boot, redémarrage en cas de crash
- [fix] api.js : baseURL hardcodée `localhost:3001` → `VITE_API_URL` (fix critique distant)
- [fix] Titres onglets navigateur : toutes les pages s'appelaient "client" → titres explicites par page
- [fix] SessionPage : titre dynamique `Enclume — <nom de la campagne>`

### Atelier du GM
- [fix] Bouton "Supprimer ce pack" maintenant visible sur les packs sans propriétaire (packs migrés)
- [fix] Séparation des droits : Export (propriétaire uniquement) vs Supprimer (propriétaire ou pack orphelin)

## v68 — 2026-05-31 — Modes de combat Corps à Corps + correctifs Dashboard

### Modes CaC (Sprint CaC 3)
- [add] Mode Défensif : aucune attaque, +3 défense si attaqué (LdB p.223)
- [add] Mode Retraite : aucune attaque, +5 défense si attaqué, recul optionnel gratuit (zone lente)
- [add] Recul Retraite : sélection destination en zone lente (identique Charge), ini_mod=0 forcé serveur
- [fix] Chips modes CaC : même couleur verte pour les 5 modes (Défensif/Retraite n'étaient pas verts)
- [fix] Mode Défensif/Retraite : arme QB non modifiée au clic — état arme inchangé (règle LdB)

### Modes CaC (Sprint CaC 2)
- [add] Mode Offensif : +3 attaque, −5 défense si attaqué — déclarable Phase 1
- [add] Mode Charge : +3 attaque, +3 dégâts, −7 défense / requiert ≥3m + déplacement court gratuit
- [add] Sélecteur de mode (chips) dans le panneau CaC côté joueur et côté GM
- [add] Charge PJ : flux séquentiel automatique (déplacement → cible, zone lente uniquement)
- [add] Charge PNJ (GM) : queue combinée move_short + cible, panneau droit étendu (720px)
- [add] Validation distance déplacée en Phase 2 (post-déplacement réel) — Phase 1 = intention libre
- [chg] GM : fenêtre Corps à corps étendue à 720px avec panneau droit dédié
- [chg] GM : batch PNJs libre (DST+CTC ensemble) — filtre type arme appliqué uniquement au démarrage assault
- [fix] Double sélection Assaut+CaC lors du clic CaC (GM) — corrigé
- [fix] Boutons "Passer" fantômes quand deux queues actives simultanément (GM) — corrigé

### Dashboard
- [fix] Formulaire "Rejoindre avec un code" restauré (champ absent depuis la refonte UI)
- [fix] Card "Créer une campagne" : label centré, "+" flottant supprimé

## v67 — 2026-05-31 — Corps à Corps, Rechargement en combat

### Corps à Corps (Sprint CaC 1)
- [add] Action "Corps à corps" déclarable en Phase 1 : sélection cible + arme de contact (ou mains nues)
- [add] Allonge des armes de contact respectée (lance +3m, bâton +2m, etc.)
- [add] Résolution en opposition : jet attaquant vs jet défenseur (Polaris LdB)
- [add] Défenseur PJ lance son dé interactivement — le slot reste bloqué jusqu'à confirmation
- [add] Dégâts melee : formule arme + Mod.Dom. (FOR_na) — identique au corps à corps Polaris
- [add] GM : sélection cible PNJ séquentielle (même queue que l'assaut)
- [add] Résultat opposition affiché (jets attaque/défense, touche ou esquive)
- [fix] Auto-ciblage impossible (on ne peut pas se cibler soi-même)
- [fix] Message d'erreur explicite si cible hors portée (distance affichée)
- [fix] Sélections décochées automatiquement au nouveau tour

### Rechargement en combat
- [add] Action "Rechargement" en Phase 1 : sélection munitions dans panneau droit
- [add] Phase 2 : résultat rechargement (succès / aucune munition) affiché au joueur
- [add] Option campagne : mode de rechargement Chargeur complet (défaut) ou Complément
- [chg] Le joueur ne clique plus "Agir" pour le rechargement — le MJ est maître du timing
- [fix] Exclusion mutuelle des actions de combat (Assaut, CàC, Rechargement, etc.)
- [fix] "Assaut (tir)" grisé automatiquement si chargeur vide

## v66 — 2026-05-30 — Décompte munitions, Jets Favoris, Test de Choc, i18n
- [add] Localisation i18n : 17 composants wired (fiche perso, builder, sidebar, sessions, auth…)
- [add] Fiche personnage : labels Polaris FR (attrs, stats, bio, tooltips allures LdB)
- [add] Système i18n prêt pour EN futur (structure Option C documentée)
- [chg] RegisterPage : traduite en français (était en anglais)
- [add] Décompte munitions en combat (ammo_remaining, skip si chargeur vide)
- [add] Option campagne : munitions illimitées pour les PNJs
- [add] Rechargement avec picker de variante de munition
- [add] Jets Favoris : macros en un clic depuis le DicePanel
- [add] Formulaire création macro avec aperçu du seuil en direct
- [add] Fenêtres combat déplaçables (drag + localStorage)
- [add] Changelog Dashboard (ce panneau)
- [add] Code d'invitation beta (accès sécurisé)
- [add] Test de Choc : résultat affiché (Résistance / Étourdi / Inconscient) + is_stunned appliqué
- [fix] Sévérité promue correctement diffusée dans résultats PNJ (bug P49)

## v65 — 2026-05-28 — Combat avancé, Pathfinding, DicePanel v3
- [add] Sélecteurs d'état dynamiques (couverture, vitesse, mode de tir)
- [add] Déclaration assaut avec sélection de cible sur le canvas
- [add] Déplacement PNJ séquentiel avec queue
- [add] Assaut PNJ (mode minimal) avec picker cible
- [add] Pathfinding A* Chebyshev en temps réel pour le déplacement combat
- [add] Raycast précis sur terrain élevé (fast-voxel-raycast)
- [add] Roue radiale D20 avec favoris persistants et jets secrets au MJ
- [chg] Refonte complète DicePanel v3

## v64 — 2026-05-24 — Jets d'attaque, Dégâts, Blessures combat
- [add] Phase Résolution : jets d'attaque, dégâts, blessures localisées
- [add] Fenêtre dégâts joueur (animation + résultats colorés par sévérité)
- [add] Jet de toucher interactif côté joueur (CombatModifiersWindow)
- [add] Déclaration assaut : cadence CC/RC/RL, dual-wield, sélection cible
- [fix] Calcul compétence arme via chaîne weapon_inv_id → ref_equipment_skill_assoc

## v62 — 2026-05-18 — Phase Résolution combat
- [add] Phase Résolution complète : slots, avancement, fin de tour
- [add] Déplacement combat avec zones A* et anneaux concentriques
- [chg] Payload déclaration v2 — états + mapActions + quick

## v57 — 2026-05-10 — Fondations combat Polaris
- [add] Timeline initiative, phases Surprise, Annonce & Résolution
- [add] Roster de combat avec vérification équipement pré-combat
- [add] Fenêtre déclaration PJ (21 actions, multi-select, INI delta)
- [fix] Distinction PJ / PNJ / Entité de décor (PC27)

