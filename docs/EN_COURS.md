# EN COURS — Dettes actives et prochaines étapes
> Dernière mise à jour : 2026-06-25 Session 126
> Contenu : dettes actives + roadmap + points de vigilance permanents.
> Historique complet : voir `docs/JOURNAL5.md` (Sessions 109+), `docs/Old/JOURNAL4.md` (Sessions 86–108) et `docs/Old/JOURNAL3.md` (Sessions 64–85).

---

## ⚡ PROCHAINE ÉTAPE EXACTE

> Lire ce bloc en PREMIER. Il indique quoi faire maintenant, dans quel ordre, et vers quel fichier aller.

**1. ~~Valider Sprint 14-0~~** ✅ CLOS — Session 95 suite 2

**2. ~~REWORK-01 — statusService~~** ✅ CLOS Session 96 — Scénarios 1-5 validés

**3. ~~REWORK-03 — woundService~~** ✅ CLOS COMPLET Session 97/105 — T1–T5 validés

**4. ~~REWORK-05 — panneaux partagés (COM5 + CL2)~~** ✅ CLOS COMPLET Session 99 — 5/5 scénarios ✅ + BUG-W1 ✅ + BUG-W2 ✅ + ERG-W1 ✅ + ERG-W2 ✅

**5. ~~REWORK-07 — socketUtils (getUserColor + checkTokenOwnership + LOC_TABLE_CONTACT)~~** ✅ CLOS COMPLET Session 100

**6. ~~REWORK-02 — damageService (resolveTargetHit)~~** ✅ CLOS COMPLET Session 101/105 — Sites 1/2/4/5 validés

**7. Sprint Bugs prioritaires** *(voir BUGIDENTIFIE.md)*
   → **Cluster I** — dégâts drone (DR6 + DR4 + DMG1 + DMG2) — **Haute**
   → **Cluster D** — fenêtres combat UI (UI1 + COM8) — **Haute** *(COM5 + CL2 fixés REWORK-05)*
   → **Cluster E** — arme et statuts (COM1 + COM2 + COM4 + COM7) — Moyenne

**8. ~~REWORK-09 — SessionPage → hooks WS dédiés~~** ✅ CLOS COMPLET Session 103
   → `useTokenSocket.js` + `useEntitySocket.js` + `useCombatSocket.js` — 1509 → 1296 lignes

**9. ~~REWORK-08 — Modularisation `socket/index.js`~~** ✅ CLOS COMPLET Session 108
   → 5 modules `registerXxxHandlers` + `lib/mrTable.js`. `index.js` : 4 266 → 143 lignes. Scénarios 1–17 validés.

**10. ~~REWORK-04 — FSM Combat~~** ✅ CLOS COMPLET Session 110/111 — validé en session réelle ✅
   → 12 étapes A1→C4 — `combatFSM.js` + migrations 80+81 + guards socketCombat + DB persistence + restauration reconnexion

**11. ~~REWORK-06 — `declarationReducer`~~** ✅ CLOS COMPLET Session 113/114
   → `declarationReducer.js` créé + GM + Player migrés — V1–V15 validés
   → COM4 ✅ résolu (mains nues par défaut), PC23 ✅ (typo TIR_AUTOMATIQUES)

**12. ~~REWORK-15 — SocketProvider~~** ✅ CLOS COMPLET Session 115
   → `client/src/lib/SocketContext.jsx` (29L) — `SocketProvider` + `useSocket()`
   → `useTokenSocket` / `useEntitySocket` / `useCombatSocket` : `useSocket()` direct (plus de `listen(s)`)
   → `SessionPage.jsx` : wrapper + `SessionContent`, grand useEffect → 2 useEffects, `reconnectTrigger` supprimé
   → V1–V7 validés — P-R15-1 levé

**13. ~~REWORK-13 Étapes 1+2 — campaignStore~~** ✅ Session 115 suite 2
   → `client/src/stores/campaignStore.js` créé — `{ campaign, setCampaign, updateCampaign }` — null guard
   → `SessionPage.jsx` : `campaign useState` → `useCampaignStore()` ; `updateCampaign` dans `onCampaignUpdated` + `handleSetDefault`

**14. ~~REWORK-11 — useSessionSocket~~** ✅ Session 115 suite 2
   → `client/src/lib/useSessionSocket.js` créé — 12 handlers WS (SESSION_*, CHAT_MESSAGE, DICE_RESULT, MACRO_ROLL_RESULT, CHARACTER_UPDATED, DOC_*)
   → `SessionContent` : 3 destructurings nettoyés, `useEffect([socket])` réduit aux 6 WOUND_*/INVENTORY_*
   → V1–V12 validés

**15. ~~REWORK-13 Étapes 3+4 — useBattlemapManager~~** ✅ Session 115 suite 2 (cont.)
   → `client/src/lib/useBattlemapManager.js` créé — 8 handlers CRUD + 7 useState + 1 useRef + 1 useEffect outside-click + helpers `openRenameModal` / `openCreateModal`
   → `SessionContent` : `renameBattlemap`/`addBattlemap`/`removeBattlemap` + `updateCampaign` retirés des stores ; 8 callbacks + 7 useState + 1 useRef + 1 useEffect supprimés ; 2 séquences JSX simplifiées
   → V1–V14 validés (SR + fonctionnel — confirmation Saar)

**16. ~~REWORK-12 — useCharacterSocket~~** ✅ Session 116
   → `client/src/lib/useCharacterSocket.js` créé — `useSocket()` + `useEffect([socket])` + 6 handlers nommés + cleanup
   → `SessionContent` : `woundVersions` useState + `updateCharacter` destructuring + `useEffect([socket])` WOUND/INVENTORY supprimés
   → V1–V8 validés (confirmation Saar)

**17. ~~REWORK-14 — useCombatUIState~~** ✅ Session 116
   → `client/src/lib/useCombatUIState.js` créé — 4 `useState` + 6 `useCallback`, hook UI pur (zéro socket, zéro store)
   → `SessionContent` : 4 `useState` + `handleModeReset` + 5 handlers supprimés (~60 lignes) ; ordre `useEntitySocket` → `useCombatUIState` → `useCombatSocket` (P-R14-1)
   → V1–V13 validés (confirmation Saar)

**18. ~~REWORK-16 — Combat Pre-validation Gate (ACK Socket.IO)~~** ✅ CLOS COMPLET Session 116 suite
   → `COMBAT_ACTION_PRECHECK` ACK — gate avant `CombatCacModifiersWindow` — range check serveur avant ouverture
   → Fix `resolveMeleeAction` L.1699 `socket.emit` → `io.to(campaignId).emit` (broadcast)
   → 8 logs `[DBG-CAC]` supprimés — message rouge `#e05252` dans chat
   → V1–V10, V12 validés — V11 noté Non testé (race condition LAN)

**19. ~~REWORK-17 — socketCombat.js Modularisation~~** ✅ CLOS COMPLET Session 117
   → 4 modules créés : `socketCombatState` (5 handlers), `socketCombatAnnouncement` (3 handlers), `socketCombatResolution` (6 handlers), `socketCombatHelpers` (13 fonctions + COMBAT_MODE_LABELS)
   → `socketCombat.js` réduit à 9L (orchestrateur pur) — `index.js` inchangé
   → V1–V13 validés (SR + combat complet GM + PJ)

**20. ~~REWORK-18 — socketCombatHelpers.js : séparation computation / émission~~** ⚠️ Clos partiel Session 119
   → `socket` supprimé des 3 signatures helpers — 30 émissions → descripteurs `{ to, event, data }` — `flushEmissions` dans `socketCombatResolution.js` — 4 call sites mis à jour
   → `node --check` ×2 ✅ — V5/V5b/V8 ✅ — V6/V7 partiels (DAMAGE_CONFIRM bloqué bug RW17-1)
   → V1–V4, V9/V10 non testés (session combat réelle requise)
   → Spec complète → `docs/PLAN_REWORK18.md`

**21. ~~Sprint résolution combat — bugs RW17-1 + STUN2~~** ✅ CLOS Session 120
   → **RW17-1** ✅ CLOS COMPLET — `calcDroneRD`/`calcDroneDegatsNets` dans `charStats.js` (agent précédent) — 3 call sites migrés
   → **STUN2** ✅ CLOS (SR + all OK) — guards PRECHECK+CONFIRM, message i18n, overlay fix (cause racine : FSM AWAITING_DAMAGE → `{ awaiting: true }` + `precheckRetryKey` + `COMBAT_ATTACK_RESULT`)
   → **RW18-1** : sprint séparé — voir BUGIDENTIFIE.md

**22. ~~AA-1 ✅ clos Session 121~~**
   → Blessures combat affichées sans rouvrir CharacterWindow — store Zustand + fix StrictMode cancelled pattern
   → RW17-1 ✅ et STUN2 ✅ : marqués clos dans BUGIDENTIFIE.md (étaient ouverts à tort)

**23. ~~COM22 ✅ clos Session 121 (suite)~~**
   → Aucune action assault Kiwi — suppression PRECHECK LOS (`socketCombatResolution.js`) + `npm install` root Kiwi (`fast-voxel-raycast`) + npm audit fix server (0 vulns)
   → Kiwi ✅ : 2 assaults résolus, STUN2 auto-skip, melee OK

**24. ~~COM19 FAUX BUG ✅ Session 122~~**
   → LdB relu intégralement : règle "-5 INI assaut (tir)" inexistante — code conforme

**25. ~~INI Breakdown Popover ✅ Session 122~~**
   → `calcIniBreakdown` dans `combatSections.js` (source de vérité) + popover clic dans `CombatGmDeclareWindow` + `CombatActionWindow`

**26. ~~CS2 + CS3 + CS1 ✅ Session 123~~**
   → `WeaponPanel.jsx` refonte (colonnes DIR/SEC + 2M + `hand_pref`) + `ref_description` tooltip ⓘ

**27. ~~PLAN_TRADE — Système Trade (étapes 1–7) ✅ Session 124~~**
   → Migrations 84 (merchants) + 85 (trade_log) + 86 (trade_offers) + 87 (ref_equipment.generation)
   → `shared/events.js` : +12 constantes TRADE_* (4 client→serveur + 8 serveur→client)
   → `tradeRoutes.js` + `tradeService.js` : REST CRUD marchands + getCatalog (filtrage FAM/CAT/ITEM/seuils) + buyFromMerchant (atomique) + acceptTransfer (forUpdate)
   → `socketTrade.js` : `registerTradeHandlers` — rate limiter 3/min — 4 handlers PJ↔PJ
   → `MerchantsPage.jsx` : Dashboard GM — CRUD marchands + arbre catalogue tri-state + joueurs autorisés
   → `DashboardPage.jsx` : bouton "Marchands" sur carte campagne GM

**28. ~~D1 + D2 ✅ Session 124~~**
   → D1 : menu radial "fiche" drone — clos (fix mismatch type `character_id` string/number — Session antérieure)
   → D2 : `SettingsTab` `DroneWindow.jsx` — `glbStatus` (null|uploading|success|error) + timer ref + i18n `glbSuccess/glbError` + label coloré (bleu/vert/rouge + transition 0.2s)
   → Bonus D2 : rechargement token 3D fonctionnel grâce à `key={glbUrl}` + `updateCharacter` déjà en place (Canvas3D.jsx inchangé)

**29. ~~PLAN_TRADE étapes 8–9 ✅ Session 124~~**
   → Étape 8 : `TradeWindow.jsx` créé (~200L) — vue GM lite : tab Marchands (toggle OUVERT/FERMÉ + mod_global) + tab Journal (trade_log filtrable + pagination)
   → Étape 9 : vue Joueur — sélecteur marchand (filtré serveur) + catalogue navigable (FAM→items) + détail inline + panier + checkout (`POST /buy` atomique)
   → `SessionPage.jsx` : `myCharId` derivé + condition `{tradeWindowOpen &&` + props `isGm` / `myCharId` passés
   → `fr.json` : +`session.trade` + `trade.window.*` (26 clés total)

**30. ~~PLAN_TRADE étapes 10–11 ✅ Session 125~~**
   → Étape 10 : `TradeWindow.jsx` vue Échange PJ↔PJ — proposer/accepter/refuser/annuler + timer expiration + listeners WS
   → Étape 11 : slot Échange dans `TokenRadialMenu` (`enabled: !isGm`) + item Marchands dans dropdown Outils `Sidebar`
   → Bugfixes T1/T2/T3 : liste marchands vide (join tokens supprimé), `tokens.campaign_id` ×3 `socketTrade.js`, écran noir `INSUFFICIENT_FUNDS` (parsing objet → `.message`)
   → **PLAN_TRADE complet ✅** (étapes 1–11)

**31. ~~VENTE PJ→GM + achat ×10 munitions ✅ Session 125 suite~~**
   → Migration 90 : `counter_sols` + `merchant_id` + status `COUNTER_OFFERED` dans `trade_offers`
   → `shared/events.js` : +4 constantes `TRADE_SELL_COUNTER_*`
   → `tradeService.js` : `getMyActiveSellOffer` (restauration PJ) + `executeSell` accept COUNTER_OFFERED
   → `tradeRoutes.js` : GET `/my-sell-offer` + `sell-offers` enrichis (merchantName, status, counterSols)
   → `socketTrade.js` : constante `SELL_OFFER_TTL_SEC=120` (bugfix `tour_duration` inexistante) + 4 handlers SELL_PROPOSED/COUNTER/COUNTER_ACCEPTED/COUNTER_DECLINED
   → `useEntitySocket.js` : listener `TRADE_SELL_REQUEST` → notification chat GM toujours montée
   → `Sidebar.jsx` : rendu notification sell_request + badge
   → `TradeWindow.jsx` : réécriture complète — onglet ÉCHANGE retiré, VENTE PJ (sélecteur marchand + prix ref/boutique + contre-offre UI), REVENTES GM (récap + 3 boutons + contre-offre input)
   → Feat : achat ×10 munitions (`addToCart(item, qty=1)` + bouton `+10` conditionnel `family === 'Munitions'`)
   → Testé : achat ✅, vente proposition→acceptation ✅, ×10 munitions ✅
   → Non testé : contre-offre flux complet, restauration état rechargement, expiration 120s

**32. ~~Rechargement drone + cargo visible + ammo type ✅ Session 126~~**
   → Migration 91 : `drone_sheet.charge_utile` + `trade_log` CHECK étendu (`player_sell` + `drone_reload`)
   → `TRADE_DRONE_TRANSFER` handler (immédiat, guard propriétaire, transaction atomique)
   → `ExchangeWindow` : filtre drones par owner + flow drone (no sols, no timer)
   → `GET /drone/cargo` + `POST /drone/cargo/:invId/drop` (Larguer vers sac)
   → DroneSheet : StatField charge_utile + section Chargement + bouton Larguer
   → WeaponsTab : ammo_restant/contenance + calibre affiché

**33. ← PROCHAINE ÉTAPE : cluster suivant selon priorité**
   → Validation STUN2 en session combat réelle
   → Contre-offre flux complet (test session réelle)
   → Cluster Drone P (DR7/DR8/DR9/DR10) ou bugs actifs BUGIDENTIFIE.md

---

## État global

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **91 migrations appliquées** (91 = drone_sheet.charge_utile + trade_log constraint — Session 126)
- Migrations : voir `docs/ASBUILT.md` § Base de données

---

## En attente de validation fonctionnelle

**FEAT2-A — LOS outil menu radial ✅ MVP clos (ligne + overlay)**
- V1–V6 validés avant ajout caméra v2

**FEAT2-C — Caméra LOS v2 (épaule droite) ✅ clos complet — Session 112**
- `client/src/lib/useCameraLOS.js` réécrit — service complet (feature-as-service, ARCHI_REWORK.md)
- Canvas3D.jsx : zéro logique LOS — 1 appel `useCameraLOS(...)` + 4 callables `{ losLine, onTokenClick, onPointerUp, clearLine }`
- FEAT2-B (LOS automatique pipeline assaut) → sprint futur

---

## Dettes actives

> Détail technique de chaque bug → [`docs/BUGIDENTIFIE.md`](BUGIDENTIFIE.md)

| ID | Description | Priorité |
|---|---|---|
| ~~DMG1+DMG2~~ | ~~Labels DICE_RESULT dégâts drone (Compétence/Seuil faux)~~ | ✅ Clos Session 105 |
| ~~DR4~~ | ~~`calcDroneRD` : RD négatif → drone plein subit dégâts suppl.~~ | ✅ Clos Session 101 |
| ~~DR6~~ | ~~Blindage drone non lu (0 affiché malgré DB=15)~~ | ✅ Clos Session 101 |
| ST1 | Badge statut illisible sur token canvas (texte trop petit) | Haute — Sprint 14-2 |
| ST3 | Fenêtre THUG STATUTS trop petite — overflow des icônes statuts | Moyenne |
| CH1 | Historique chat perdu au F5 (rechargement page) | Haute |
| ~~UI1~~ | ~~Fenêtre déclaration design blanc~~ | ✅ REWORK-10 clos complet — scénarios 1–8 validés (Session 109) |
| ~~COM1~~ | ~~Recharger ne fait rien~~ | ✅ Clos Session 109 |
| ~~CL1~~ | ~~Portraits PNJ non visibles timeline joueur~~ | ✅ Clos Session 109 |
| ~~COM15~~ | ~~Propriétaire slot non identifiable GM~~ | ✅ Clos Session 118 |
| COM8 | Fenêtre annonce visible pendant sélection cible | Moyenne |
| ~~COM12~~ | ~~Mode de tir : chips CC/RC/RF sans filtre disponibilité arme~~ | ✅ REWORK-06 Session 114 |
| ~~COM13~~ | ~~Assaut tir joueur : "Tir simple" par défaut non validé sans re-clic~~ | ✅ REWORK-06 Session 114 |
| ~~RANGE1-drone~~ | ~~Drone CaC : fenêtre s'ouvre hors portée~~ | ✅ REWORK-16 Session 116 suite |
| ~~LOS1-drone~~ | ~~Drone ranged LOS bloquée → pas de `COMBAT_DECLARE_ERROR`~~ | ✅ REWORK-16 Session 116 suite |
| COM2 | Vérif statut arme absente côté GM | Moyenne |
| ~~COM4~~ | ~~CaC exige arme au clair (mains nues impossible)~~ | ✅ REWORK-06 Session 114 |
| COM5 | ~~Mode combat sélectionne aussi la cible (GM)~~ | ✅ REWORK-05 Session 99 |
| COM7 | Multi-attaque CaC : duplicata / bouton grisé | Moyenne |
| CL2 | ~~Design CombatDeclareLog + divergence GM/joueur~~ | ✅ REWORK-05 Session 99 |
| ~~CL3~~ | ~~Ghosts déplacement d'annonce disparus~~ | ✅ Clos Session 125 |
| ~~D1~~ | ~~Menu radial "fiche" drone ne s'ouvre pas~~ | ✅ Clos Session 124 |
| COM9 | Viser une localisation précise — non implémenté | Moyenne — sprint dédié |
| — | "Changer le mode de tir" — non implémenté | Moyenne — sprint futur |
| — | Sprint Annonce v2 — actions en lecture seule | Moyenne — sprint futur |
| ~~D2~~ | ~~Token drone : changement GLB non fonctionnel~~ | ✅ Clos Session 124 |
| DR2 | Drone : déplacement absent | Basse — sprint futur |
| INI1 | Surprise critique (roll=1) → initiative=1 | Basse |
| INI2 | Initiative non recalculée après blessure en combat | Basse — post-REWORK-08 |
| ~~WS1~~ | ~~WorkshopPage crash `err.response?.data?.error`~~ | ✅ Clos Session 109 |
| AU1 | `useDiceAudio.js` — sons dés | Basse |
| TC1 | `.gitattributes:3` — attribut invalide | Très basse |
| DCO1 | `onTokenRotate` dead code Canvas3D/Scene | Très basse |
| VX1 | `getVoxelSurfaceTop` — pas de cas slope/wedge | Très basse |
| — | Kiwi P-SRV-5 — ports Docker non restreints | Infra |
| — | Logs debug `index.js` — conservés volontairement | Infra |
| **STAT1** | is-stunned / unconscious — exclusion mutuelle + refresh 10→9 | **Haute** — Cluster L |
| ~~**COM19**~~ | ~~-5 INI à Assaut (tir)~~ | ✅ FAUX BUG — Session 122 |
| **COM22** | LOS bloquée affichée pour tout le monde | **Haute** — Cluster N |
| **KIWI2** | Import GLB token : local ✅ / Kiwi ❌ | **Haute** — Cluster R |
| ~~**CS3**~~ | ~~Arme à deux mains dans chaque main → "Main Directrice"~~ | ✅ CLOS Session 123 |
| **CS4** | Catégorie "Techniques" + liste compétences | Moyenne — Cluster O |
| **CS5** | Compétence réservée (X) : ouverture 1 XP, reste -3 | Moyenne — Cluster O |
| **CS6** | Force Polaris = Avantage (pas Mutation) | Moyenne — Cluster O |
| ~~**CS1**~~ | ~~Onglet Matériel : description arme manquante~~ | ✅ CLOS Session 123 |
| ~~**CS2**~~ | ~~Changement d'arme : menu déroulant~~ | ✅ CLOS Session 123 |
| **DR8** | Drone arme = munitions infinies | Moyenne — Cluster P |
| **DR9** | Logiciels drone pas à jour (BDD) | Moyenne — Cluster P |
| **DR7** | Drone : propriétaire ne peut pas modifier | Moyenne — Cluster P |
| **DR10** | Drone joueur : GM reçoit aussi la fenêtre | Moyenne — Cluster P |
| **COM20** | Phase 1 : afficher arme (munitions + type) | Moyenne — Cluster N |
| **COM21** | Collision tokens : deuxième bloqué | Moyenne — Cluster N |
| **COM23** | Label token : fixe, ne rentre pas dans les murs | Moyenne — Cluster N |
| **UI2** | Alignement dés | Basse — Cluster Q |
| **UI3** | Dé 100 : affichage chat | Basse — Cluster Q |
| **FEAT3** | Token actif : cercle de sélection | Moyenne — FEAT |

---

## Roadmap

- ~~**Sprint Dégâts Drone**~~ ✅ → B6 (Loc) + B7 (Dmg) — Clos Sessions 94
- **Sprint Drones 2d** — auto-announcement drone → voir `docs/Old/PLAN_DRONESYSCOMBAT.md`
- **Sprint Drones 2e** — resolveDroneAutoAction
- **Sprint Drones 3** — Télépilotage (drone lié à PJ pilote)
- **Sprint PLAN 14-1** — Menu contextuel token (right-click → ajouter/retirer statuts)
- **Sprint PLAN 14-2** — Affichage badges (SVGs `docs/Character/Statuts/`, Canvas3D)
- **Sprint PLAN 14-3** — FIX-D + mécaniques enforced (bypass défense stunned/surprised)
- ~~**Sprint stunted_until_turn**~~ ✅ — supplanté par Sprint 14-0 — voir PLAN 14
- **Sprint CaC 4b** — validation fonctionnelle requise avant
- **Sprint Annonce v2** — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- **Sprint Tooltips Compétences** — SkillsPanel bouton ⓘ (déjà codé Session 73)
- **Sprint Waypoints** — déplacement points intermédiaires (déclaration serveur, alt+clic)
- **Sprint Page Santé Serveur** — `/api/health/detailed` (mémoire, uptime, températures)
- **D2 Jets Favoris** — drag-to-reorder macros (sort_order UI)
- **i18n combat+équipement** — 18 composants hors scope (sprint dédié futur)

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
- DiceMesh useMemo — deps [geoDef.type, color, dieType] — dieType obligatoire pour D10 (PE32)
- D10 Html overlay — position=[0,0,0] — ne pas déplacer (PE33)
- P49 — promotion blessures : always GET /wounds si promoted === true (ne pas ajouter wound localement)
- PI11 — polarisRound : source unique `shared/polarisUtils.js` — jamais redéfini localement
- PC41 — Express 5 : routes sans `/` initial → 404 silencieux — toujours `'/:id/foo'`
- PC42 — `WHERE NOT col = 'val'` exclut les NULL en PostgreSQL → toujours `(col IS NULL OR col != 'val')`
- PC43 — `orderByRaw('CASE WHEN ? IS NOT NULL ...')` : PostgreSQL ne peut pas inférer le type UUID sans cast → éviter pour les UUID, préférer le JS post-fetch
- PC44 — `io.fetchSockets()` nécessaire quand le GM clique Agir pour un slot joueur (socket ≠ joueur)
- PC45 — `combat_actions.type` (serveur, valeur brute) ≠ `action_key` (client, clé UI) — deux colonnes distinctes, valeurs identiques pour 'melee'. Confondre les deux → 0 résultat sur les queries
- PC46 — `meleePrecheckId` dans `CombatOverlay` : `activeMeleeAction?.id ?? playerActiveMeleeAction?.id ?? null` — stable en RESOLUTION. `useEffect` doit inclure `[meleePrecheckId, socket]` — re-tourne à chaque reconnexion (SocketProvider crée nouvelle instance)
- PL-Q1 — `getSemanticHTML()` Quill 2.0 retourne vide — utiliser `querySelector('.ql-editor').innerHTML`
- PL-Q2 — Quill insère la toolbar comme `previousElementSibling`, pas à l'intérieur du container — guard `classList.contains('ql-container')`
- PL-Q3 — `containerRef.current` peut être null dans le cleanup React 19 — toujours capturer en variable locale en début d'effect
- PL-Q4 — `editor.destroy()` n'existe pas en Quill 2.0 public API
