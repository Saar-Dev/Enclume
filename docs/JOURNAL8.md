# JOURNAL8 — Décisions et validations durables

> Rôle du fichier (CLAUDE.md §10) : conserve les décisions et validations durables de chaque session
> close, pas les notes de réflexion. Chaque entrée = un bloc `## Session N (Dev) — Date — Titre`,
> clôturé par **Testé / Non testé / Données / Retour arrière**. Ne jamais dupliquer ce contenu dans
> `docs/EN_COURS.md` : ce dernier retire l'entrée de ses sections actives dès qu'un chantier est clos
> et journalisé ici.
>
> Suite de `docs/Old/JOURNAL7.md` (archivé le 2026-08-01 après fusion avec l'historique accumulé dans
> `EN_COURS.md`). Dernière entrée du fichier précédent : Session 192 (Saar) — `PLAN_TEST_CRITIQUE.md`
> Lot 2.

---

## Session (Saar) — 2026-08-04 — Réorganisation documentaire + TEST_CRITIQUE Lot 3

**Réorganisation documentaire** : `docs/` restructuré (fichiers déplacés vers `REGLES/`, `SYSTEME/`,
`MANUELS/`, `PLANS/`, `REFACTOR/`, `Old/`), committé tel quel sur demande de Saar (commit `4f3027e`,
`docs/` uniquement — `Sidebar.jsx`/`surfaceData.js` déjà modifiés dans le worktree laissés hors
périmètre de ce commit).

**TEST_CRITIQUE Lot 3** (tooltips degré RAW + popup Réussite critique/Catastrophe) — détail complet
dans `docs/Old/PLAN_TEST_CRITIQUE.md` §11 (archivé — Règle 10, contenu durable transféré vers
`docs/SYSTEME/COMBAT.md` §"Résolution des Tests"). Résumé : `getMrDegreeKey` (nouvelle autorité,
`shared/polarisTestResolution.js`) + tooltips `title=` sur les badges de résultat (`Sidebar.jsx`) ;
popup plein écran texte seul sur Réussite critique/Catastrophe (`CriticalEffectOverlay.jsx`, déclenché
via `sessionStore.js`/`useSessionSocket.js`), architecture séparant déclenchement et rendu pour un futur
vrai effet visuel. Trouvaille corrigée au passage : `cardType` jamais forwardé par `onDiceResult`
malgré une lecture déjà existante côté `Sidebar.jsx` (dead code silencieux préexistant).

**Testé** : `node --test shared/polarisTestResolution.test.mjs` (20/20), `eslint` propre sur les 5
fichiers client touchés, `vite build` complet sans erreur.
**Non testé** : scénario réel en navigateur (tooltip au survol, popup Réussite critique/Catastrophe) —
à la charge de Saar.
**Données** : aucune migration.
**Retour arrière** : additif, rien committé cette session sur ce chantier — `git diff`/`git checkout`
suffisent.

---

## Session (Saar) — 2026-08-04 — `PLAN_REFACTOR_SURFACE.md` vérifié et déployé

**Contexte** : Saar avait tenté seul, à la main, le refactor de `client/src/lib/surfaceData.js`
(~3100 lignes) en 9 modules à responsabilité unique décrit par `docs/PLANS/PLAN_REFACTOR_SURFACE.md`,
fichiers déposés dans `docs/REFACTOR/` sans être branchés au projet. Demande explicite de Saar :
vérifier chaque ligne avant tout déploiement, sans approximation, quitte à prendre le temps qu'il
faut — Saar n'a pas le niveau technique pour juger lui-même et savait avoir probablement introduit des
erreurs.

**Méthode de vérification** : extraction par AST (`@babel/parser`) de chaque fonction du fichier
d'origine et de sa copie dans `docs/REFACTOR/`, diff automatisé fonction par fonction (script jetable,
non conservé) plutôt qu'une relecture à l'œil — fiable sur ~115 fonctions réparties sur 9 fichiers là
où une relecture manuelle aurait été le point faible exact que la demande de Saar cherchait à éviter.

**4 défauts réels trouvés et corrigés** (tous dans l'assemblage final, jamais dans le contenu déplacé
lui-même, qui s'est révélé fidèle à plus de 95 %) :
1. Barrel (`surfaceData.js`) n'exportant plus `getWallRenderBox`, `roomsWallRenderPaths`,
   `makeWallsFromDrag`, `findRoomsInSelection` — aurait cassé `Editor3D.jsx`, `SurfaceDungeonScene.jsx`
   et l'éditeur lui-même au premier appel.
2. `normalizedSurfaceMaterial(profile)` (ex-`surfaceMaterial.js`) fusionnée à tort avec
   `normalizeSurfaceMaterialPreset(tool)` — deux fonctions à contrat différent portant le même nom
   après unification. Aurait réinitialisé silencieusement le matériau de sol/plafond/mur à chaque
   ouverture de l'éditeur de matériau. Séparées à nouveau dans `materialDecision.js`.
3. `profileOrDefault` (helper de 5 lignes) perdue à l'extraction, remplacée par un raccourci qui
   perdait la couleur de plafond par défaut (`#6b7280`) — restaurée dans `surfaceRooms.js`.
4. Cycle d'imports découvert en creusant le point 1 : le plan lui-même se contredit entre son Lot 4
   (« `surfaceData.js` garde les getters ») et son schéma de dépendances (« `surfaceData.js` ne fournit
   rien en retour »). Restructuration réelle : `surfaceCore.js` devient la vraie fondation (constantes,
   forme du document, `normalizeSurfaceData`, getters outil/salle, clés sol/plafond, cellules
   d'empreinte — ~27 éléments déplacés hors du barrel) ; `connectors.js` importe désormais
   `findRoomAtCell` directement depuis `surfaceRooms.js`. Bonus détecté en creusant ce point :
   `connectors.js` importait déjà `getRoomFloorThickness` depuis un `surfaceCore.js` qui ne l'exportait
   pas encore — import cassé préexistant, silencieux tant que le code ascenseur/échelle n'était pas
   exercé, corrigé de facto par la restructuration.

**Vérification avant déploiement** : diff fonction-par-fonction, complétude des 88 exports publics du
barrel (diff d'ensembles, identique avant/après), graphe de dépendances reconstruit et confirmé
acyclique, puis chargement réel du module par Node (arborescence miroir + `import()`) et smoke tests
sur les 4 fonctions manquantes + les 2 fonctions matériau + le défaut plafond.

**Déploiement** : copie directe des fichiers `docs/REFACTOR/` (déjà vérifiés) vers `client/src/lib/` et
4 composants (`SurfaceEditorScene.jsx`, `SurfaceMaterialEditor.jsx`, `SurfaceRoomPanel.jsx`,
`SurfaceWallPanel.jsx`), suppression de `surfaceMaterial.js` (unifiée dans `materialDecision.js`). Le
passage à l'échelle réelle (ESLint du projet, jamais exécuté sur `docs/REFACTOR/` jusque-là) a révélé
34 imports/fonctions mortes hérités du travail original de Saar (dont le test unitaire copié utilisant
`vitest`, absent du projet, et un chemin d'import erroné) — nettoyés sans toucher aux réexports
publics.

**Testé** : `node --test client/src/lib/*.test.mjs` (61/61, dont 13 nouveaux pour
`materialDecision.js`), `node --test` monde partagé (147/149, 2 skip DB), `npm run build` (client,
propre), ESLint sur les 14 fichiers touchés (0 erreur), `git diff --check` propre. **Validé
fonctionnel en navigateur par Saar** (création salle/mur/connecteur/matériau).
**Non testé** : aucun scénario de non-régression exhaustif au-delà de la validation manuelle de Saar
(pas de suite Playwright dédiée à l'éditeur de surface).
**Données** : aucune migration, aucun effet runtime — code client uniquement.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` applicable si besoin.

---

## Session (Saar) — 2026-08-04 — `PLAN_CHARACTER_STATES.md` Lots 0-2b clos, Lot 2c différé

**Contexte** : `combat_roster.state_position`/`state_weapon` sont supprimées à `COMBAT_END` (table
éphémère) — un personnage perdait sa posture entre deux combats, et `endTurn()` remettait à tort
`state_position` à `'standing'` à chaque fin de tour (contraire à REGLESYSCOMBAT.md : le coût
d'Initiative d'un changement de position n'a de sens que si la position obtenue persiste).

**Lot 0** — nouvelle autorité additive : `ref_character_state_values` (catalogue extensible) +
`character_states` (ancrée sur `token_id`, pas `character_id` — un GM peut poser plusieurs tokens
partageant le même `character_id`, chacun avec son propre état), `characterStateService.js` (point de
résolution unique, miroir `woundService.js`). Migration `229` — dernière appliquée était 227, aucune
pending.

**Lot 1** — double-écriture shadow (méthode Scientist, même dispositif que `PLAN_RW_SYSCOMBAT.md §2.3`)
aux 3 sites qui écrivent `combat_roster.state_position`/`state_weapon`, dans la même transaction,
comparaison `[DBG-DECOUPLAGE]` jamais bloquante.

**Lot 2a** — 5 endroits dupliquaient le même spread de mise en forme du broadcast roster (trouvé en
vérifiant l'inventaire du plan avant Lot 0 : le plan d'origine n'en citait qu'1). Extraction
`buildBroadcastRoster` (`server/src/lib/combatRosterBroadcast.js`) — seule la mise en forme mutualisée,
chaque site garde son propre `io.emit` (payloads hétérogènes).

**Lot 2b** — `buildBroadcastRoster` devient async, source `state_position`/`state_weapon` depuis
`characterStateService.getCharacterStatesForTokens` (batché) au lieu des colonnes `combat_roster`, et
retrait du reset fautif dans `endTurn()`. **Portée volontairement limitée au broadcast** (analyse à
charge en session) : `socketCombatAnnouncement.js:139` (`entry`) lit encore `combat_roster` directement
pour une règle de jeu serveur authentique (coût d'Initiative + validation Tir Visé, `isAimEligible`) —
couper cette écriture aurait cassé cette validation. `combat_roster.state_position`/`state_weapon`
restent donc écrites, `characterStateShadowCheck.js` reste actif.

**Lot 2c (retrait des colonnes + migration de `entry`) différé** : Saar a indiqué que Codex et Kiwi ne
font plus partie du projet (plus d'urgence fusion), et souhaite clôturer ce point avec
`docs/PLANS/PLAN_RW_TOKEN.md` (Phase 7 — animations, qui doit de toute façon consommer cette même table)
plutôt que maintenant. Suivi : `docs/EN_COURS.md` (ETATSPERS-LOT2C), `docs/SYSTEME/ETATS_PERSONNAGE.md`.

**Documentation** : `docs/SYSTEME/ETATS_PERSONNAGE.md` créé (contenu durable, modèle `BLESSURES.md`) ;
`docs/SYSTEME/COMBAT.md` corrigé (documentait le bug `state_position` comme comportement voulu) ;
`docs/PLANS/PLAN_CHARACTER_STATES.md` archivé dans `docs/Old/`.

**Testé** : migration 229 up/down/re-up ; `characterStateService`/`combatRosterBroadcast` contre la DB
de dev (contraintes unique/FK, atomicité transaction, batching) ; `combatRosterBroadcast.test.mjs` (2
tests, patron rollback) ; 4 sessions de combat réelles par Saar au fil des lots — persistance de
position confirmée, effet cumulé des mods de position sur plusieurs tours validé comme comportement
voulu, Tir Visé toujours refusé après un changement d'état déclaré, aucun `[DBG-DECOUPLAGE]` sur aucune.
**Non testé** : Lot 2c — différé, hors périmètre de cette clôture (décision Saar).
**Données** : migration `229` (nouvelle table, additive). Aucune autre migration — les colonnes
`combat_roster.state_position`/`state_weapon` ne sont pas retirées (Lot 2c).
**Retour arrière** : 4 commits isolés sur `dev/Saar` (`96d04ef`, `60d3d31`, `e7c6d60`, `ba77a1a`), chacun
testé et confirmé par Saar avant le suivant.

---

## Session (Saar) — 2026-08-04 — `PLAN_KNEELING_POSITION.md` clos (« à genou » jouable)

**Contexte** : en clôturant `PLAN_CHARACTER_STATES.md` (ETP2), trouvé en run à vide que `kneeling`
existait déjà dans le catalogue `ref_character_state_values` (Lot 0 de ce plan) mais restait
inatteignable en jeu — aucun coût d'Initiative RAW nommé pour cette position
(`REGLESYSCOMBAT.md:929-941` ne cite que « S'accroupir/Se redresser » -3 et « Se jeter à terre » -5).
Décision Saar : `kneeling` coûte exactement ce que coûte `crouching`, y compris pour la transition
directe `crouching↔kneeling` (gratuite — tranchée explicitement en relecture à charge du plan, seule
paire que la consigne initiale ne couvrait pas).

**Lot 1** — dédoublonnage préalable : la table de coût de transition de position existait en 2 copies
manuellement synchronisées (`STATE_COSTS.position` serveur, `STATE_DEFS.position.cost` client) — même
dette que celle déjà corrigée ailleurs dans ce projet pour les mods de situation
(`PLAN_RW_SYSCOMBAT.md`). Extraction `shared/combatStatePositionCost.js`, comportement identique
bit-à-bit (valeurs vérifiées égales avant extraction), premier test automatisé sur cette table.

**Lot 2** — migration `231` (élargit `chk_state_position` à 4 valeurs, testée up/down/re-up), entrée
`kneeling` dans la table partagée, sélecteur client (`STATE_DEFS.position.states`), libellé i18n
(`combat.json`, "À genou"/"Gen."). **Trouvaille au codage** : un balayage de vérification avant de
demander le test en jeu a révélé un 3e verrou serveur absent de l'inventaire initial du plan —
`VALID_STATES.position` (`socketCombatAnnouncement.js:79`, handler `COMBAT_ACTION_DECLARE` — la
déclaration de tour normale, distincte de `VALID_POS` qui ne gate que l'état initial) — corrigé avant
de livrer, sans quoi `kneeling` aurait été rejeté silencieusement à chaque tour.

**Testé** : `shared/combatStatePositionCost.test.mjs` (2 tests), migration up/down/re-up (contrainte
vérifiée directement en base via `pg_get_constraintdef`), ESLint propre. Validé en jeu réel par Saar à
deux reprises (Lot 1 : coût inchangé pour standing/crouching/prone ; Lot 2 : déclaration `kneeling` en
état initial et en déclaration de tour, coût correct, Tir Visé toujours refusé après transition,
libellé affiché correctement).
**Non testé** : rien de connu — chantier clos sans dette ouverte.
**Données** : migration `231` (élargissement `CHECK`, aucune donnée existante affectée).
**Retour arrière** : 2 commits isolés sur `dev/Saar` (Lot 1 `0a67633`, Lot 2 à committer), chacun testé
et confirmé par Saar avant le suivant.

---

## Session (Saar) — 2026-08-04 — `PLAN_CHAT.md` Phase 1 (module `server/src/chat/`, rien branché)

**Contexte** : préparation à l'implantation de `docs/PLANS/PLAN_CHAT.md` (chat persistant, dette CH1).
Avant de coder, correction préalable de CLAUDE.md §5 : la règle de numérotation pair(Codex)/impair
(Claude) des migrations est abrogée (Codex/Kiwi hors projet, décision Saar 2026-08-04) — numérotation
strictement séquentielle désormais. Dernière migration réelle avant ce chantier : 231.

**Revue de complétude avant codage** (Saar : "SI ET SEULEMENT SI ce plan est sérieux et complet") :
audit du plan V1.0 contre l'état réel du dépôt (dépendances serveur, patrons d'autorisation
existants). 5 écarts trouvés et tranchés explicitement, documentés dans `PLAN_CHAT.md` §16 plutôt que
corrigés en silence :
- **Autorisation absente** (`chatRoutes.js`/`socketChat.js` ne vérifiaient l'appartenance à la
  campagne nulle part) → pattern repris de `tradeRoutes.js` (`requireAuth` + `campaign_members`).
- **Schéma whisper incomplet** (`recipients` cité §10 sans colonne en §4.1) → ajout
  `chat_messages.recipient_user_id` + canal dédié `channel_id = 'whisper'`.
- **Dépendances inexistantes** (Zod, lib de sanitization Markdown, ni l'une ni l'autre dans
  `server/package.json`, aucun autre module serveur n'utilise Zod) → validateur et sanitizer maison
  (`chatValidation.js`, `chatSanitizer.js` — échappement HTML puis whitelist regex des 4 patterns
  Markdown autorisés, blocs code protégés d'une réinterprétation gras/italique).
- **Migration sans `down()`** → complétée, pattern `231_kneeling_position.js`.
- **i18n** (trouvé en écrivant `chatCommands.js`, pas dans l'audit initial) : les réponses de
  commandes (`/help`, `/w`, `/gm`) prévues par le plan renvoyaient du texte FR figé — violation directe
  de `.claude/rules/i18n.md`. Corrigé en `i18nKey` (namespace `chat.commands.*`), pattern
  `system:true`+`i18nKey` déjà en place (`socketCombatHelpers.js`/`useSessionSocket.js`). Les entrées
  `client/src/locales/` restent à créer en Phase 3 (rendu), pas avant.

**Codé** (rien branché dans l'existant — le handler `CHAT_MESSAGE` de `socketDice.js` continue de
fonctionner tel quel) : migration `232_chat_messages.js` ; `shared/events.js` (+`CHAT_SEND`,
`CHAT_MESSAGE_CREATED`, `CHAT_MESSAGE_DELETED`, `CHAT_ERROR`) ; `server/src/chat/` complet
(`eventBus.js`, `chatValidation.js`, `chatSanitizer.js`, `chatRepository.js`, `chatService.js`,
`chatCommands.js` — `/help`/`/w`/`/gm` réellement enregistrés, `/r`/`/roll` volontairement exclus du
registre en V1 §15 — `chatRoutes.js`, `chatBroadcast.js`, `socketChat.js`). Messages Builders
(`combatDamage.js` etc.) délibérément non codés en Phase 1 : dépendent d'une réconciliation de topics
(`combat.damage` vs `COMBAT_ATTACK_RESULT`/`COMBAT_DAMAGE_RESULT` réels) qui n'a de sens qu'au moment
du branchement Phase 3-4.

**Testé** : 33 tests (5 fichiers `.test.mjs`, Node test runner, écritures DB réelles + nettoyage
explicite, patron `woundReviewService.test.mjs`) — validation, sanitization (XSS + bug code/markdown
trouvé et corrigé en cours d'écriture), rate limit 10 msg/s/utilisateur, filtrage whisper (un tiers non
concerné ne reçoit rien, vérifié avec 3 sockets mockées), `/help`/`/w`/`/gm`, enforcement de
permission (`permission: 'gm'` déclaré par le plan mais jamais vérifié — ajouté), bypass `/r`. Migration
232 auto-appliquée par nodemon et vérifiée en base. Confirmé fonctionnel par Saar.
**Non testé** : tout ce qui suppose le branchement réel (Phase 2 — mount du router, appel à
`registerChatHandlers` depuis `socket/index.js`, double-écriture derrière `CHAT_PERSISTENCE_ENABLED`).
Aucun scénario navigateur : Phase 1 n'expose aucune UI.
**Données** : migration `232` (table `chat_messages`, additive, réversible).
**Retour arrière** : tout le chantier est un commit isolé sur `dev/Saar` — revert seul suffit
(`server/src/chat/` neuf, `shared/events.js`/`CLAUDE.md`/docs modifiés uniquement de façon additive).

---

## Session (Saar) — 2026-08-04 — ALLURE-TURNGATE1 clos (panneau allure/déplacement visible hors tour)

**Contexte** : signalement direct de 3 bugs (`docs/BUGIDENTIFIE.md`) — seul ALLURE-TURNGATE1 traité
dans cette session, les deux autres (CLICKATTACK-MOVECONFLICT1, SIDEBAR-CDL-CONTRAST1) restent en
attente. Une première passe d'analyse groupant les 3 bugs avec hypothèses de cause a été retirée en
cours de session (violation de la règle « un bug à la fois » + demande explicite de Saar de noter sans
diagnostiquer) avant toute reprise propre.

**Décision Saar** : demande initiale d'un rework plutôt qu'un correctif ponctuel («la priorité du
projet a toujours été la qualité »). Recherche (React « Don't Sync State, Derive It », sélecteurs
Redux, XState) et relecture critique du rework proposé (V0.1, 6 fichiers) ont montré qu'il était
surdimensionné — la vraie cause était concentrée dans un seul fichier. Périmètre resserré à 3 fichiers
(V0.2/V0.3, `docs/PLANS/PLAN_COMBAT_MODE_AMBIANT.md`), validé avant tout code.

**Cause racine [VÉRIFIÉ]** : `useAutoMoveMode.js` (survol déplacement ambiant, décision
COMBAT-DEPLACEMENT-HOVER 2026-07-31) savait s'armer via effet mais jamais se désarmer — le nettoyage
existant (`handleModeReset`, câblé sur `COMBAT_END`/`PHASE_CHANGED`/`COMBAT_SLOT_ADVANCED`) était
immédiatement contredit par un réarmement automatique, la condition `enabled` des 3 appelants
(PJ/MJ/drone) ne vérifiant jamais la phase ni le tour.

**Correctif** :
- `client/src/lib/useAutoMoveMode.js` — désarmement ajouté (transition `enabled` vrai→faux et
  démontage, ref miroir), corrige les 3 appelants en un seul endroit.
- `client/src/components/CombatActionWindow.jsx` — `isMyTurnInResolution`/`isMyTurnInAnnouncement`
  (déjà existants, corrects) remontés avant le hook, ajoutés à `enabled`.
- `client/src/components/CombatGmDeclareWindow.jsx` — `isActivePnj` (déjà existant, correct) remonté
  avant le hook, remplace `!activeDroneCharId` dans `enabled` (appel non-drone).

**Explicitement exclu** : le drone (MJ) — `moveHoverEnabled` (`useDroneDeclare.js`) pilote à la fois le
survol et le clic-attaque ; corriger l'un aurait changé l'autre (CLICKATTACK-MOVECONFLICT1, bug séparé,
non traité). Le drone reste donc affecté par ALLURE-TURNGATE1 — résiduel documenté sur
CLICKATTACK-MOVECONFLICT1.

**Testé** : ESLint sur les 3 fichiers (0 régression, comparé via `git stash` à l'état avant
modification ; l'erreur préexistante `set-state-in-effect` de `CombatGmDeclareWindow.jsx` n'est pas
liée) ; `npm run build` (client) propre ; relecture manuelle multi-angles (React StrictMode, ordre de
montage/démontage, transitions de phase, cas multi-personnages) avant tout code. **Confirmé fonctionnel
en jeu par Saar** (PJ et MJ, hors drone).
**Non testé** : le cas drone (exclu du périmètre) ; le cas multi-personnages d'un même joueur en
Annonce (question de règle du jeu ouverte, pas d'architecture — non tranchée, voir
`PLAN_COMBAT_MODE_AMBIANT.md` §4).
**Données** : aucune — 100 % client, aucune migration.
**Retour arrière** : commit isolé sur `dev/Saar`, aucun changement serveur.

---

## Session (Saar) — 2026-08-04 — CLICKATTACK-MOVECONFLICT1 clos (clic sur token adverse déclenchait un déplacement au lieu d'une attaque)

**Contexte** : suite directe d'ALLURE-TURNGATE1 (même session de signalement, `docs/BUGIDENTIFIE.md`,
`docs/PLANS/PLAN_COMBAT_MODE_AMBIANT.md`) — traité isolément après clôture du premier, un seul bug à la
fois. Symptôme : cliquer un token adverse en combat proposait un déplacement vers la case occupée par
la cible plutôt qu'une attaque.

**Cause racine [HYPOTHÈSE renforcée par lecture, non instrumentée en exécution]** : `Canvas3D.jsx` —
la détection « case occupée par un token » (censée transformer un clic en attaque plutôt qu'en
déplacement) n'était calculée que pendant le survol (`handlePointerMove`, écrite dans
`hoveredOccupantTokenRef`). Le clic (`handlePointerUp`) se contentait de lire cette ref sans jamais la
revérifier sur la destination réelle du chemin de déplacement calculé. Sans `pointermove` ayant mis à
jour la ref exactement sur la cible juste avant le clic (curseur immobile depuis avant l'armement du
survol ambiant, léger écart entre le point brut survolé et l'extrémité du chemin renvoyé par le
serveur), un déplacement pouvait partir vers une case en réalité occupée — correspond exactement au
symptôme décrit.

**Correctif** — `client/src/components/Canvas3D.jsx` seul :
- Détection d'occupation extraite dans un helper unique `findOccupantAt(destination, excludeTokenId)`,
  réutilisé par le survol (comportement inchangé) et rappelé, fraîchement, dans `handlePointerUp` sur
  la destination réelle du chemin (`dest.x`/`dest.z`) juste avant de committer un déplacement — élimine
  la dépendance à l'ordre des événements (classe de bug supprimée) plutôt qu'un rustinage de timing.

**Explicitement non corrigé** (causes distinctes, un seul bug à la fois) : le résiduel drone hérité
d'ALLURE-TURNGATE1 et l'absence de garde de tour sur `useCombatClickAttack` — regroupés dans une
nouvelle dette dédiée, **CLICKATTACK-TURNGATE1** (`docs/BUGIDENTIFIE.md`), aucun symptôme observé en
jeu à ce jour.

**Testé** : ESLint sur `Canvas3D.jsx` — 16 problèmes (13 erreurs, 3 warnings) avant **et** après le
correctif, tous préexistants (pattern refs P40 déjà présent ailleurs dans le fichier, vérifié par
`git stash`) — 0 nouvelle erreur introduite ; `npm run build` (client) propre. **Confirmé fonctionnel
en jeu par Saar (2026-08-04)**.
**Non testé** : le résiduel drone et le cas PJ hors-tour (CLICKATTACK-TURNGATE1, aucun symptôme
observé, non prioritaire).
**Données** : aucune — 100 % client, aucune migration.
**Retour arrière** : commit isolé sur `dev/Saar`, aucun changement serveur, aucun changement de
comportement pour un clic sur case libre.

---

## Session (Saar) — 2026-08-04 — SIDEBAR-CDL-CONTRAST1 clos (Récapitulatif des Déclarations illisible + séparation module)

**Contexte** : 3ᵉ et dernier bug du signalement groupé du jour (`docs/BUGIDENTIFIE.md`), après
ALLURE-TURNGATE1 et CLICKATTACK-MOVECONFLICT1. Saar demandait en plus d'en profiter pour séparer le
module (1 fichier = 1 responsabilité). Plan présenté et soumis à relecture critique avant tout code —
2 failles trouvées et corrigées dans le plan initial (voir ci-dessous) avant que Saar ne tranche via
la boussole du projet (architecture robuste/pérenne, qualité > vitesse, refactor autorisé si le
matériau de base ne suffit pas).

**Cause racine [VÉRIFIÉ par lecture — cascade CSS déterministe]** : `index.css` portait deux variantes
sombres du même panneau (`.cdl-body`, fenêtre flottante GM morte ; `.cdl-chat`, version chat réellement
utilisée). `.cdl-body` surchargeait toutes les couleurs de texte du panneau de base (pensé pour un fond
clair) ; `.cdl-chat` ne surchargeait que le fond, oubliant le texte — resté bleu foncé (`#1a2a3a`) sur
fond quasi-noir (`#0d0d16`).

**Relecture critique du plan initial — 2 failles trouvées avant tout code** :
1. L'état plié/déplié (`cdlOpen`, local à `Sidebar.jsx`, survit aux montages/démontages du bloc)
   deviendrait un state interne perdu à chaque transition de phase si le nouveau composant le gérait
   lui-même — corrigé en composant contrôlé (`isOpen`/`onToggle`).
2. Le plan initial proposait de *fusionner* les couleurs `.cdl-body`/`.cdl-chat` dans des sélecteurs
   partagés, en supposant les deux variantes vivantes — invalide une fois `.cdl-window`/`.cdl-body`
   supprimés (JSX repurposé) : correction en *déplacement* des valeurs + suppression du bloc CSS
   orphelin entier, plus l'ajout d'une règle `.combat-declare-log-actor` manquante (séparateur entre
   déclarants, pas seulement les couleurs).

**Correctif codé** :
- `index.css` — palette déplacée `.cdl-body → .cdl-chat`, bloc `.cdl-window*` (code mort documenté
  depuis Session 106c, `docs/Old/ARCHI_REWORK.md`) supprimé entièrement.
- `CombatDeclareLog.jsx` — `CombatDeclareLogSidebar` (mort, mauvais nom) → `CombatDeclareLogChatPanel`
  (export nommé, contrôlé, nom qui décrit ce qu'il fait réellement).
- `Sidebar.jsx` — bloc inline (header/toggle/texte FR en dur) remplacé par l'import/usage du composant ;
  `cdlOpen` déplacé en props, pas dupliqué ; `currentTurn` retiré (devenu inutile ici, même source
  `useCombatStore` côté composant).

**Testé** : ESLint (`Sidebar.jsx`/`CombatDeclareLog.jsx`) — 0 erreur, 0 warning ; `npm run build`
(client) propre. **Confirmé fonctionnel en jeu par Saar (2026-08-04)** — lisibilité OK.
**Données** : aucune — 100 % client, aucune migration.
**Retour arrière** : commit isolé sur `dev/Saar`, `DeclareLogContent` (corps du log) inchangé.

Les 3 bugs signalés en bloc ce jour (ALLURE-TURNGATE1, CLICKATTACK-MOVECONFLICT1,
SIDEBAR-CDL-CONTRAST1) sont désormais tous clos et confirmés en jeu.

---

## Session (Saar) — 2026-08-05 — COMBAT-INTERAGIR-DISTANCE : garde de portée serveur pour les interactions génériques

**Contexte** : triage complet de `docs/BUGIDENTIFIE.md` demandé par Saar, sélection motivée d'un bug
au périmètre décidé (règle dure 1,5m déjà actée par Saar) et au correctif non ambigu (patron déjà
validé en jeu par `ENTITY_MOVE_REQUEST`), plutôt qu'un bug bloqué par une décision produit.

**Cause racine [VÉRIFIÉ par lecture]** : `ENTITY_ACTION_REQUEST` (`socketEntity.js`) ne vérifiait
aucune distance avant d'agir sur une entité — ni pour les interactions à compétence (arbitrage MJ), ni
pour la résolution directe sans MJ (`resolveEntityState`, appelée immédiatement quand l'interaction n'a
ni `skill_id` ni `attribute_id`). Ce second cas, plus grave, n'était pas explicite dans le texte
d'origine de la dette — trouvé en lisant le handler en entier avant de coder. Le mécanisme jumeau
`ENTITY_MOVE_REQUEST`, juste à côté dans le même fichier, faisait déjà ce qu'il fallait
(`measureBattlemapTokenEntityDistance` + `overrides.range ?? interaction.range ?? 1.5`).

**Correctif** : un seul garde, posé avant la séparation des deux branches, réutilisant telle quelle
`measureBattlemapTokenEntityDistance` (aucun calcul de distance dupliqué) — token acteur résolu côté
serveur depuis `characterId`+`battlemap_id` (pas besoin d'un nouveau champ client). Échec → nouveau
`reason:'out_of_range'` sur `ENTITY_ACTION_RESULT`, même forme que `timeout`/`no_gm`/`mortally_wounded`
déjà existants (`useEntitySocket.js`, `session.actionOutOfRange` dans `fr.json`). Aperçu client
(`RadialMenu.jsx`) généralisé à toute interaction (plus seulement le déplacement), avec exclusion
explicite du raccourci MJ (`ENTITY_ACTION_GM_DIRECT`, qui ignore la portée par conception).

**Testé** : suite serveur complète `node --test` (185/185 ✅) ; ESLint (0 nouvelle erreur/warning,
confirmé par `git stash`) ; `npm run build` (client) propre. **Confirmé fonctionnel en jeu par Saar
(2026-08-05)**.
**Données** : aucune migration.
**Retour arrière** : commit `6ba0353`, isolé, 4 fichiers ; `ENTITY_ACTION_GM_DIRECT` inchangé.

---

## Session (Saar) — 2026-08-05 — CLICKATTACK-TURNGATE1 : garde de tour unifié pour le clic-attaque ambiant

**Contexte** : bug suivant du même triage, sélectionné pour la même raison (cause déjà vérifiée par
lecture, correctif qui réutilise un patron déjà validé en jeu — `ALLURE-TURNGATE1` — aucune décision
produit à trancher).

**Cause racine [VÉRIFIÉ par lecture]** : `useCombatClickAttack` (clic direct sur un token adverse pour
proposer une attaque) n'avait jamais reçu le garde de tour appliqué à son hook jumeau
`useAutoMoveMode` (`ALLURE-TURNGATE1`) — écart explicitement noté en commentaire lors de la correction
de ce dernier, jamais traité depuis.

**Analyse approfondie avant correctif** — lecture complète de `CombatGmDeclareWindow.jsx` (pas
seulement les 3 lignes visées), même invariant élargi, pas des bugs séparés :
- `clickIsActivePnj` était un doublon exact d'`isActivePnj` (même expression, déjà calculée plus haut
  dans le même fichier) — aucune contrainte technique ne justifiait la duplication.
- `moveHoverEnabled: !!activeDroneCharId` (drone) manquait `!has_announced` (gap documenté) **et**
  n'excluait pas un drone possédé par un joueur, alors que `isActiveDrone` (déjà calculée, déjà utilisée
  par `canDeclare` pour la même distinction) le fait déjà — le survol/clic-attaque ambiant du MJ pouvait
  s'armer pour un drone qui n'est pas de son ressort.

**Correctif** : réutilisation systématique de variables déjà existantes, aucune logique nouvelle —
nouvelle constante unique `isMyTurnToAct` (`CombatActionWindow.jsx`) réutilisée par les 3 hooks
ambiants (`useAutoMoveMode`, `useCombatClickAttack`, `moveHoverEnabled` drone) au lieu de réécrire le
même ternaire à chaque site ; `isActiveDrone` remplace `!!activeDroneCharId` ; `clickIsActivePnj`
supprimé au profit d'`isActivePnj`.

**Testé** : ESLint (9 problèmes avant/après, identiques, confirmés préexistants par `git stash`) ;
`npm run build` (client) propre. **Confirmé fonctionnel en jeu par Saar (2026-08-05)**.
**Données** : aucune, 100% client, aucune migration.
**Retour arrière** : commit `b306b05`, isolé, 4 fichiers.

---

## Session (Saar) — 2026-08-05 — PLAN_INVENTORY_UX Étapes 0-5 : refonte ergonomique de l'onglet Matériel

**Contexte** : chantier de refonte de l'onglet Matériel de la fiche personnage (`docs/PLANS/PLAN_INVENTORY_UX.md`,
V1.5, relu et vérifié par exploration croisée client/serveur avant tout code — toutes les affirmations
`[VÉRIFIÉ]` du plan confirmées contre le code réel, y compris les numéros de ligne). Plan en 10 étapes ;
Étapes 0 à 5 traitées cette session, chacune testée et confirmée par Saar avant la suivante.

**Étape 0 — Socle de données** : `characterStore.js` étendu (`inventoryByCharId`, `thresholdByCharId`,
`iniPenaltyByCharId`, `solsByCharId`, `handPrefByCharId`, garde `inventoryFetchEpoch` contre la course
fetch-vs-subscribe). Nouveaux modules `inventoryDataSync.js` (fetch initial dédupliqué par characterId
+ `refreshDerivedTotals` ciblé) et `useInventoryData.js` (façade React). `useCharacterSocket.js`/
`useWizardInventorySync.js` écrivent désormais directement dans le store depuis les WS
`INVENTORY_ADDED/UPDATED/REMOVED` — `WS.SOLS_UPDATED` câblé pour la première fois côté client (aucun
listener n'existait avant, trou du plan original comblé). `shared/inventoryMath.js` (nouveau) porte
`computeTotalWeight`, importé par le client **et** `inventoryService.js` (autorité unique de la
formule de poids, refactor serveur pur sans changement de comportement). `upsertInventoryItem` corrigé
en no-op si le characterId n'a jamais été peuplé par un fetch complet (sinon un event WS pour un
personnage non consulté par ce client créait une entrée partielle, bloquant silencieusement le futur
fetch initial de ce personnage).

**Étape 1 — InventoryBanner.jsx** (nouveau) : jauge de poids (barre + %) toujours visible, migrée de
l'overlay `ArmorWoundPanel.jsx` (weightColor/weightRatio) et du header `InventoryPanel.jsx`. Asymétrie
sols (un non-GM ne peut que diminuer, 403 serveur sinon) bornée côté client — l'input refuse la saisie
plutôt que de laisser un 403 surprendre l'utilisateur, trou identifié dans le plan original.

**Étapes 2-3 — Réorganisation Armes/Conteneurs** : Sac/Ceinture déplacés d'`ArmorWoundPanel.jsx` vers
une nouvelle section "Conteneurs portés" dans `WeaponPanel.jsx`, avec le bouton Customisation (moding)
à sa suite (`onOpenModing` reroutée depuis `CharacterWindow.jsx`, `ModingWindow.jsx` inchangé).

**Étape 4 — Grille 2 colonnes puis annulation** : codée conforme au plan (seuil sur `size.w` de la
fenêtre flottante, pas un media query CSS — la largeur pertinente est celle de `CharacterWindow.jsx`,
pas du viewport), validée par Saar, puis **annulée après un second test** (bloc trop massif, silhouette
écrasée) : retour à l'empilement vertical d'origine.

**Étape 5 — Drag & drop** : `@dnd-kit/core` + `@dnd-kit/utilities` installés (`@dnd-kit/sortable` du
plan original écarté, inutile pour des zones distinctes plutôt qu'une liste réordonnée). Mutations
réseau+store extraites dans `inventoryMutations.js` (`setItemSlot`/`setItemContainer`/`deleteItem`),
réutilisées par les `<select>` existants et le nouveau drag & drop — même chemin, aucune logique
dupliquée. `DndContext` unique au niveau `CharacterWindow.jsx` (zones source et cible réparties dans
des composants frères) ; chaque zone cible fournit son propre callback via `data.onDrop`, le routeur
central ne fait que le déclencher. IDs `dnd-kit` préfixés par contexte de rendu (`inv-`, `loc-`,
`weapon-`, `container-`) : un item équipé apparaît simultanément dans la liste plate d'InventoryPanel
et dans son panneau d'équipement, même `item.id`, deux nœuds draggables distincts. Dialogue de conflit
main/2M (`window.confirm`, pattern déjà existant pour la suppression de personnage) uniquement sur le
chemin drag (409 serveur) — le chemin bouton existant garde son auto-déséquipement silencieux, les deux
coexistent sans régression. Feedback visuel bordure bleue (cible valide)/rouge (invalide) basé sur
l'item réellement en cours de glissement (`activeDragItem`), pas un simple survol générique.

**Décisions Saar après démonstration** (hors texte du plan, documentées dans `PLAN_INVENTORY_UX.md`
V1.6) : zone "2 Mains" dédiée supprimée — une arme 2 mains déposée sur Main Directrice OU Secondaire
s'équipe directement sur le bon slot (`resolveTargetSlot`), le choix Trépied devient un bouton
apparaissant *après* l'équipement plutôt qu'un `<select>` préalable. Retrait des `<select>` Sac/Coffre
et Slot dans `InventoryPanel.jsx` (redondants avec le drag & drop) noté dans `docs/ROADMAP.md` —
différé : nécessite un `KeyboardSensor` dnd-kit d'abord pour ne pas régresser l'accessibilité clavier
exigée par le plan §5.5 (implémentation actuelle : `PointerSensor` seul).

**Testé** : `eslint` ciblé sur chaque lot de fichiers (0 erreur dans le diff à chaque étape) et
`npm run build` (client) propres tout du long. **Confirmé fonctionnel en jeu par Saar** à chaque étape
(0-3 en bloc, 4 puis son annulation, 5 avec scénario de conflit main/2M explicite, empilement vertical
et fusion 2-mains en clôture).
**Non testé** : round-trip HTTP authentifié scripté ; accessibilité clavier du drag & drop (jamais
implémentée, cf. ci-dessus).
**Données** : migration `shared/inventoryMath.js` — aucune migration DB, refactor serveur pur
(`inventoryService.js`) sans changement de comportement observable.
**Retour arrière** : commit isolé à venir sur `dev/Saar`, hors du chantier chat parallèle
(`server/src/chat/`, `Sidebar.jsx`/`CharacterModal.jsx`/`DiceBreakdownPopover.jsx` en cours par
ailleurs, non touchés).

---

## Session (Saar) — 2026-08-05 — MELEE-INHAND + ASSAULT-INHAND-RESOLUTION : autorité unique arme en main

**Contexte** : un premier correctif MELEE-INHAND avait été codé et commité sans lecture complète du
contrat de session (pas d'explication préalable, pas d'instrumentation, cause simplement "vérifiée
par lecture" alors que la méthode du projet exige une observation en exécution) — reproché à raison
par Saar, commit annulé (`git reset` + restauration ciblée, aucune perte pour les chantiers
parallèles en cours dans le même worktree). Repris intégralement avec la méthode correcte.

**Instrumentation réelle** : test isolé (hors dépôt, lecture seule, fixtures réelles nettoyées)
rejouant la requête vulnérable exacte — confirmé qu'un `weaponInvId` appartenant à un autre
personnage résolvait ses dégâts (`1D10+1`) au lieu de mains nues. Bug passé de `[HYPOTHÈSE]` à
`[VÉRIFIÉ]` avant tout correctif.

**Prise de recul architecturale (demandée explicitement par Saar, "peu importe le temps")** : plutôt
qu'un correctif ponctuel (qui aurait constitué une 5ᵉ réimplémentation SQL divergente du même
contrôle), recherche d'une autorité existante avant d'en écrire une nouvelle — trouvé
`server/src/services/inventoryService.js` (couche déjà utilisée par les routes et `modingService.js`,
possédant déjà `WEAPON_SLOTS` et `getItemWithRef`, mais jamais consommée par le combat).

**Correctif** : nouvelle fonction `getOwnedHandWeapon(characterId, itemId, { slotCodes, category })`,
autorité unique. Migration des 6 sites de résolution d'arme (Tir + CaC, principale + secondaire,
Déclaration + Résolution) — `fetchHandWeaponForAssault` (réimplémentation locale) supprimée. Invariant
documenté dans `docs/SYSTEME/COMBAT.md` §"Pattern de fetch". 2 trouvailles annexes loggées sans
correctif (RELOAD-INHAND, ASSAULT-CATEGORY — basse priorité, hors scope).

**Testé** : `inventoryService.test.mjs` (7/7, ownership/en-main/catégorie/slots-refusés) ; suite
serveur complète (192/192) ; `node --check` sur les 3 fichiers. **Confirmé fonctionnel en jeu par
Saar (2026-08-05)** — scénario de combat normal, et Tir à deux armes (PJ avec un pistolet dans
chaque main, `fetchAssaultWeaponAndMods` exercée en vrai sur les deux mains). Non revérifiés
spécifiquement : CaC à deux armes, déclaration MJ/PNJ, drone — même mécanisme, aucune régression
attendue mais pas observés isolément.
**Données** : aucune migration.
**Retour arrière** : commits `f72dd61` (correctif) sur `dev/Saar`, isolés du chantier
inventaire/Sidebar parallèle.

---

## Session (Saar) — 2026-08-05 — Drop personnage : position curseur au lieu d'un point fixe

**Contexte** : trouvé en testant le lot 4b du chantier `PLAN_REFACTOR_SIDEBAR.md` (extraction de
`SidebarCharactersTab.jsx`) — le drag&drop d'une carte personnage depuis la Sidebar vers la carte ne
créait aucun token sur certaines cartes. Bug préexistant, sans lien avec le refactor Sidebar en cours
(confirmé par lecture : la fonction en cause vit dans `SessionPage.jsx`, non touché par ce chantier).

**Cause racine** : `handleCharacterDrop` (`SessionPage.jsx`) envoyait systématiquement
`destination: { x: 0, y: 0, z: 0 }`, quel que soit l'endroit réel du lâcher. Côté serveur,
`resolveBattlemapPlacement` (`server/src/routes/tokens.js`) cherche une surface praticable libre
**près de cette destination** et renvoie 409 si rien n'est trouvé à proximité — erreur avalée en
`console.error` seul côté client, sans retour visible. Sur une carte sans rien construit près de
l'origine, le drop échouait donc toujours, silencieusement.

**Correctif** : la destination envoyée au serveur est maintenant la position monde réelle sous le
curseur au moment du lâcher, calculée dans `Canvas3D.jsx`/`Canvas2D.jsx` (seuls composants ayant accès
à la caméra/scène Three.js) via les fonctions de raycast déjà existantes (`raycastWorldSupport` /
`raycastGround` en 3D — même repli MJ→sol que le déplacement de token existant ;`raycastPlane` en
2D) — aucune nouvelle méthode de calcul, réutilisation du patron déjà en place pour le déplacement de
token par pointeur. Un nouveau prop `onCharacterDrop(characterId, worldPosition)` remonte jusqu'à
`SessionPage.jsx`, qui garde seul la responsabilité de l'appel API — seule la résolution spatiale a
changé de place, conforme à `world.md` ("le client envoie une intention, le serveur recalcule la
position atteinte"). Le serveur reste inchangé, déjà autoritaire.

**Effet de bord assumé** : la destination pouvant désormais être n'importe où visible à l'écran (pas
seulement près de l'origine), un échec 409 réel (drop loin de toute construction) devient possible en
pratique là où avant seul un point fixe pouvait échouer. Retour visible ajouté en conséquence : message
`declare_error` dans le chat (réutilise le rendu déjà existant dans `Sidebar.jsx`, aucun nouveau
composant) au lieu du silence précédent.

**Testé** : `eslint` (erreurs préexistantes sur `Canvas3D.jsx` vérifiées une à une contre le diff,
aucune dans le code ajouté), `npm run build` (propre). **Confirmé fonctionnel en jeu par Saar
(2026-08-05)** — drop positionné correctement.
**Non testé** : le rayon de recherche exact de `resolveBattlemapPlacement` (comportement déduit du
message d'erreur et de la route, pas lu directement dans `worldMovementService.js`) ; message d'erreur
visible non déclenché en situation réelle (cas limite, pas testé par Saar).
**Données** : aucune migration. Nouvelle clé i18n `session.tokenDropNoSurface` (`fr.json`).
**Retour arrière** : commit isolé à venir sur `dev/Saar`, distinct du lot Sidebar 4a/4b (fichiers
disjoints : `SessionPage.jsx`/`Canvas3D.jsx`/`Canvas2D.jsx`/`fr.json` contre
`Sidebar.jsx`/`SidebarHelpModal.jsx`/`SidebarCharactersTab.jsx`).

---

## Session (Saar) — 2026-08-05 — PLAN_CHAT.md Phases 1-3 closes : chat persistant

**Contexte** : chantier repris et poursuivi dans cette session à partir d'une Phase 1 déjà codée
(module `server/src/chat/` + migration 232, non committée) trouvée dans le worktree partagé.
Vérifiée avant de construire dessus (priorité CLAUDE.md — le code observé prime sur la mémoire) :
33 tests réellement exécutés contre PostgreSQL réel (`node --env-file=../.env --test`, piège trouvé
— sans `--env-file`, 12 tests skip silencieusement faute de `DATABASE_URL`), rien branché dans
l'existant (grep confirmé). Formalisée en commit (`d41cf6b`) avant d'enchaîner.

**Phase 2 — double-écriture** (`c79bf65`) : le handler `CHAT_MESSAGE` existant (`socketDice.js`)
appelle désormais `chatService.sendMessage()` en plus de son broadcast direct inchangé, derrière
`CHAT_PERSISTENCE_ENABLED` (défaut `false`). Recherche faite avant de coder (Strangler Fig / shadow
write, pattern confirmé par la littérature pro) — le pattern Outbox (cohérence garantie entre deux
stores durables) écarté explicitement : un seul côté est durable ici, l'autre (broadcast) est déjà
éphémère, une écriture manquante est un trou d'historique acceptable en Phase 2, pas une corruption.
Vérifié en base directement (`SELECT * FROM chat_messages`) après activation manuelle du flag par
Saar — fonctionnel, confirmé par la donnée, pas par le comportement UI (qui ne lit encore rien).

**Correctif annexe trouvé en préparant la Phase 3** (`a0bb41a`) : la notice "dual-wield dégradé"
(COM29, `socketCombatHelpers.js`) détournait `CHAT_MESSAGE` au lieu de suivre le patron "un
événement dédié par situation" déjà utilisé partout ailleurs dans ce fichier. Nouvel événement
`COMBAT_SYSTEM_NOTICE` (`shared/events.js`) — un retour éphémère à un joueur n'est pas un message de
chat persistant, les deux concepts ne devaient pas partager un événement, d'autant que `CHAT_MESSAGE`
allait devenir spécifiquement l'entrée du chat persisté.

**Phase 3 — bascule client**, en 5 sous-lots isolés (discipline "un problème à la fois" maintenue
malgré la taille du morceau) :
- **3a** (`a12d33b`) : branchement serveur — `chatRouter` monté sur `/api/campaigns/:campaignId/chat`,
  `registerChatHandlers` dans `socket/index.js`. Serveur redémarré réellement pour vérifier (pas
  qu'un `node --check`) — tous les imports résolvent, arrêté sur port déjà utilisé (process existant).
- **3b** (`dc8240a`) : extensions `sessionStore.js` (`setMessages`/`prependMessages`/`removeMessage`,
  dédup par id sur `addMessage`). Décision consciente : `channelId` reste une métadonnée par message,
  pas un axe de stockage séparé — pas de vue multi-canal en V1, restructurer le store pour une
  fonctionnalité différée aurait été prématuré.
- **3c** (`db27128`) : `useChatSocket.js` — historique initial, temps réel, scroll infini. Trouvaille :
  l'historique doit charger `general` ET `whisper` (deux appels fusionnés triés chronologiquement),
  un whisper vivant dans un canal séparé côté API. Vérifié avant 3d : forme exacte des données
  confirmée en appelant `getHistory()` directement sur les 2 messages réels en base (pas une
  hypothèse — `createdAt`, `author.username/color`, pagination, tout correspondait).
- **3d** (`991f51b`) : `MessageRendererRegistry.jsx` — extraction fidèle de la cascade if/else de
  330 lignes vers un registre type → renderer, plus `TEXT`/`WHISPER` pour le nouveau format. Trouvé
  en vérifiant : le fichier doit être `.jsx` (pas `.js` comme suggéré au plan) — ce projet n'active
  le parsing JSX que sur cette extension, et le build précédent ne le prouvait pas (fichier jamais
  importé donc jamais réellement parsé par esbuild).
- **3e** (`4fe00f6`) : bascule réelle — `Sidebar.jsx` émet `chat:send` au lieu de `CHAT_MESSAGE`,
  rend via `renderMessage()`. Seul point de rupture réel du chantier (tout le reste était additif,
  jamais bloquant) — décision explicite prise avant de coder : pas de flag runtime supplémentaire
  pour ce cutover (aurait doublé la surface de code à maintenir juste pour un risque visible
  immédiatement, pas un risque silencieux comme la Phase 2), `git revert` du commit isolé comme
  filet, cohérent avec le reste du chantier. Trouvaille en câblant : la prose du plan §9 ("parsing
  client des commandes") ne correspondait pas au code déjà écrit — `socketChat.js` fait déjà tout le
  parsing `/help /w /gm` côté serveur, le client envoie le texte brut. Deuxième trouvaille : les
  réponses de commande arrivent via `CHAT_MESSAGE_CREATED` avec `system:true` + `i18nKey` brut,
  même mécanisme de résolution que `COMBAT_SYSTEM_NOTICE` — ajouté à `useChatSocket.js`.

**Confirmé fonctionnel en jeu par Saar (2026-08-05)** immédiatement après 3e : F5 conserve
l'historique (les 2 messages de test envoyés pendant la Phase 2 sont réapparus), nouveaux messages
persistés et affichés normalement.

**Documentation de clôture** : `docs/SYSTEME/CHAT.md` entièrement réécrit (décrivait encore l'ancien
système éphémère), `docs/PLANS/PLAN_CHAT.md` archivé vers `docs/Old/`, `docs/EN_COURS.md` — entrée
CH1 (bug d'origine, résolu) retirée, remplacée par `CHAT-SCROLL1` (scroll infini construit mais pas
câblé — seul reste concret de la Phase 4), `docs/PLANS/PLAN_REFACTOR_SIDEBAR.md` lot 4d mis à jour
(rendu + envoi désormais satisfaits par cette Phase 3, reste conteneur + 2 hooks, non bloqué).

**Testé** : 192/192 tests serveur (dont les 5 fichiers dédiés chat, 33 tests) à chaque étape,
`eslint` (0 erreur) sur chaque fichier client touché, `npm run build` propre, serveur démarré
réellement (3a). Scénario réel confirmé par Saar après 3e (F5, envoi, persistance).
**Non testé** : `/help`/`/w`/`/gm` en situation réelle (server-side déjà testé unitairement,
33/33) ; scroll infini (non câblé, `CHAT-SCROLL1`) ; whisper réel (aucun en base pour vérifier le
chargement d'historique, dépend d'un `/w` réel).
**Données** : migration 232 (`chat_messages`), déjà appliquée. Aucune donnée existante affectée
(table neuve).
**Retour arrière** : 8 commits isolés sur `dev/Saar` (`d41cf6b`, `c79bf65`, `a0bb41a`, `a12d33b`,
`dc8240a`, `db27128`, `991f51b`, `4fe00f6`) — chacun revertable indépendamment, `git log` fait foi.

---

## Session (Saar) — 2026-08-06 — Blessures : Guérison/Infection (clôture) + polish badges de statut

**Blessures — Guérison/Infection** (`docs/Old/PLAN_BLESSURES_GUERISON.md`, archivé ce jour) : le
chantier était déjà entièrement codé (moteur `woundEvolutionService.js`, routes `campaigns.js`,
écran de revue MJ `BlessuresReviewPanel.jsx`, panneau joueur `PendingRollsPanel.jsx`) depuis les
sessions du 2026-07-30, dernière étape ouverte = validation navigateur. Reprise ce jour : vérification
fichier par fichier de tout le circuit (routes, socket, service, handlers, client) contre le plan,
dernière lacune trouvée — §9 du plan demandait une entrée `docs/VOCABULARY.md` "Guérison"/"Infection"
jamais ajoutée, comblée (section "Concepts métier Polaris", jusque-là un simple placeholder vide,
premier contenu réel : Stabilisation/Guérison/Infection). Contenu durable transféré vers
`docs/SYSTEME/BLESSURES.md` (nouvelle section "Guérison et Infection").

**Polish badges de statut** (Chantier 11 — Module Blessures, Étape 4, `docs/ROADMAP.md`) : animation
d'apparition ajoutée sur `TokenStatusBadges` (`TokenPresentation.jsx`) — chaque `<img key={code}>` ne
se (re)monte que pour un statut réellement nouveau (Étourdi/Inconscient/Coma inclus), donc une
animation CSS au montage (`.badge-status-appear`, `index.css` : scale 0 → 2× → 1 sur 0.3s, repli
`prefers-reduced-motion` comme le reste du projet) ne rejoue jamais sur les badges déjà affichés.
Ces badges étant du DOM (`<Html>` de drei), l'animation est en CSS, pas en Three.js. Reste ouvert :
l'animation propre aux Tests de Choc (fenêtre/résultat), si distincte de ce polish — non traité ici.

**Croix de fermeture** (`TokenStatusPanel.jsx`, demande directe Saar "on en profite") : bouton
`btn btn-icon` + `✕` dans l'en-tête, patron repris tel quel d'`ExchangeWindow.jsx`
(`onClick={onClose}`, `title={t('common.close')}`) — s'ajoute aux fermetures déjà existantes
(clic dehors, Échap), aucune n'est retirée.

**Testé** : suite serveur complète 192/192 (`node --env-file=../.env --test "src/**/*.test.mjs"`,
inclut les 66 tests dédiés Guérison/Infection), `eslint` propre sur les 3 fichiers client touchés
(`TokenPresentation.jsx`, `TokenStatusPanel.jsx`, `index.css` non concerné par eslint), `vite build`
propre à chaque étape. **Confirmé fonctionnel en navigateur par Saar** : écran de revue MJ / panneau
joueur / avance du temps (Guérison-Infection), animation d'apparition des badges, croix de fermeture.
**Non testé** : aucun reste connu sur le périmètre de cette session.
**Données** : aucune migration (le chantier Guérison/Infection avait déjà ses migrations 219/221/223
appliquées depuis le 2026-07-30).
**Retour arrière** : additif sur fichiers existants + un fichier déplacé (`git mv`) — `git revert` du
commit de clôture suffit, aucune donnée affectée.

---

## Session (Saar) — 2026-08-06 — Clôture Refonte UX Matériel (Étapes 6-9) + fix drag&drop Coffre

**Validation Étapes 6-9** (`docs/Old/PLAN_INVENTORY_UX.md`, codées 2026-08-05, restaient non testées
en navigateur) : checklist groupée soumise à Saar (filtres/pagination catalogue GM, confirmation
suppression, séparation Coffre + tooltip, boutons "Prendre dans le Sac"/"Ranger dans le Coffre",
libellés de slot traduits, non-régression du fix `InteractiveAwarePointerSensor`) — **tout confirmé
fonctionnel**.

**Bug trouvé en testant** : drag & drop Sac/Ceinture → Coffre (et inversement) impossible, seuls les
boutons fonctionnaient. Cause : `InventoryPanel.jsx` n'a jamais eu de zone `useDroppable` pour le
Coffre — décision documentée du plan §5.3 ("aucune zone de drop Coffre n'existe"), qui s'est révélée
être un manque plutôt qu'un choix définitif à l'usage. Complication additionnelle trouvée à la lecture :
le bloc Coffre ne se rendait que s'il contenait déjà des objets (`length > 0`), donc même après l'ajout
de la zone de drop, aucune cible visible pour y déposer un premier objet. Corrigé : `coffreDrop`
(`useDroppable`, symétrique à `sacDrop`/`ceintureDrop`, réutilise `handleDropToContainer` existant) +
le bloc Coffre est désormais toujours rendu, avec un message "Coffre vide" (nouvelle clé i18n
`inventoryPanel.emptyVaultMessage`) au lieu de disparaître.

**Hygiène documentaire de clôture** : plan archivé (`git mv` vers `docs/Old/`, bandeau de clôture
Règle 10), contenu durable transféré vers `docs/SYSTEME/CHARACTER.md` (§2 structure des fichiers,
§5 flux de données inventaire — remplace l'ancien flux `reloadKey`/`inventoryVersion` devenu obsolète
depuis l'Étape 0, §7 nouvelles entrées ArmorWoundPanel/WeaponPanel/InventoryBanner/InventoryPanel) et
`docs/ASBUILT.md` (section Inventaire étendue aux Étapes 6-9 + fix Coffre). `docs/ROADMAP.md` et
`docs/EN_COURS.md` (retrait dette `INVUX-679`) mis à jour. `docs/VOCABULARY.md` : ambiguïté trouvée en
documentant — "Coffre" désignait déjà le stockage de compte (`vaultService.js`, transfert = copie) et
désigne aussi, sans rapport, une valeur de `char_inventory.container` (transfert = déplacement) —
distinction ajoutée pour éviter la confusion future.

**Testé** : les 6 scénarios de la checklist Étapes 6-9 confirmés en navigateur par Saar ; `eslint`
propre sur `InventoryPanel.jsx` après le fix Coffre.
**Non testé** : le fix de la zone de drop Coffre lui-même (Sac/Ceinture↔Coffre par drag) — codé après
la validation de Saar, reste à confirmer en navigateur.
**Données** : aucune migration — chantier 100% client (une clé i18n ajoutée).
**Retour arrière** : un fichier déplacé (`git mv`, plan archivé) + patchs ciblés sur fichiers existants
— `git revert` du commit de clôture suffit, aucune donnée affectée.

---

## Session (Saar) — 2026-08-06 — Onglet Matériel : polish mise en page (verticalité)

Confirmé fonctionnel : le fix de la zone de drop Coffre (session précédente) fonctionne en navigateur.

**Demande directe Saar** : réduire la verticalité de l'onglet Matériel. Sac/Ceinture passent en 2
colonnes (`WeaponPanel.jsx`, réutilise le pattern grid déjà en place pour Dir/Sec). La jauge poids/sols
et le bouton "Modification d'arme" passent aussi en 2 colonnes, sous Sac/Ceinture (jauge à gauche,
bouton à droite — ordre et position ajustés une fois par retour direct de Saar après premier essai).
`InventoryBanner.jsx` reste un composant autonome : `CharacterWindow.jsx` le construit et le passe en
prop `inventoryBanner` à `WeaponPanel.jsx`, qui décide seul de sa position — pas de connaissance de la
mise en page dans `InventoryBanner.jsx` lui-même. Contenu durable transféré vers
`docs/SYSTEME/CHARACTER.md` §7 et `docs/ASBUILT.md`.

**Testé** : `eslint` propre et `vite build` propre à chaque itération. **Confirmé fonctionnel en
navigateur par Saar.**
**Non testé** : aucun reste connu sur le périmètre de cette session.
**Données** : aucune — chantier 100% client.
**Retour arrière** : patchs ciblés sur fichiers existants — `git revert` du commit suffit.

---

## Session (Saar) — 2026-08-06 — Clôture World Runtime Effects Store (validation navigateur)

`docs/Old/PLAN_WORLD_RUNTIME_EFFECTS_STORE.md` (Lots A-C) avait été codé et committé (`5e3dc84`)
lors d'une session précédente, mais restait `en cours` faute de validation navigateur — la
documentation elle-même était en retard (statuts par lot encore sur "commit isolé à venir" alors que
les trois lots avaient été fusionnés en un seul commit déjà publié sur `origin/dev/Saar`).

**Vérification indépendante avant clôture** (au-delà de la lecture du code et du message du commit
précédent) : relecture des 5 fichiers touchés (`worldRuntimeStore.js`, `useWorldRuntimeSync.js`,
`Sidebar.jsx`, `Editor3D.jsx`, `Canvas3D.jsx`, `battlemaps.js`) confirmant le comportement décrit par
chaque lot ; relint (mêmes 13 erreurs + 12 warnings préexistants documentés, 0 nouveau) ; rebuild
client propre ; `node --check` sur la route serveur.

**Validation navigateur** (checklist soumise à Saar, 5 scénarios) : régions d'effets runtime visibles
en 3D, création/suppression d'un effet personnalisé dans le panneau MJ de la Sidebar avec mise à jour
immédiate, bascule mode édition/jeu sans perte des régions affichées, transition d'ascenseur avec
poll 300ms fluide, et surtout le correctif serveur — propagation de la création d'un effet
personnalisé à un second client connecté à la même campagne sans action de sa part (bug qui existait
avant ce chantier : seul l'auteur de l'action voyait sa liste se rafraîchir). **Tout confirmé par
Saar.**

**Hygiène documentaire de clôture** : plan archivé (`git mv` vers `docs/Old/`, bandeau de clôture
Règle 10), contenu durable transféré vers `docs/SYSTEME/EDITEUR.md` §7 (réécrit pour décrire
l'architecture store/hook plutôt que les 3 fetchs dupliqués historiques) et `docs/ASBUILT.md`
(nouvelle section dédiée). `docs/EN_COURS.md` : retrait de la ligne de dette `WORLDRUNTIME1`.
`docs/PLANS/PLAN_REFACTOR_SIDEBAR.md` (Lot 5) et `docs/PLANS/REFACTOR_GLOBAL.md` (§2, §6) : mis à
jour pour refléter la dépendance résolue et confirmée — `SurfaceEditorPanel.jsx` (reste du Lot 5)
peut maintenant être extrait, pas encore commencé. `docs/ROADMAP.md` : paragraphe Lot 5 raccourci
(narrative de blocage devenue obsolète une fois la dépendance levée).

**Testé** : cf. vérification indépendante ci-dessus (lint/build/syntaxe) + les 5 scénarios navigateur,
tous confirmés par Saar.
**Non testé** : aucun reste connu sur le périmètre de ce chantier.
**Données** : aucune migration — chantier 100% code (client + une route serveur).
**Retour arrière** : `git revert` du commit de clôture (déplacement de fichier + patchs
documentaires) ; le code fonctionnel lui-même est dans `5e3dc84`, déjà publié séparément.

---

## Session (Saar) — 2026-08-06 — `PLAN_RW_SYSCOMBAT.md` Lot 5 : `computeMeleeRawDamage`

Réouverture du chantier de découpage `socketCombatHelpers.js` (Lots 0-4 clos depuis le 2026-07-28) —
Lot 5, cadré le jour même (§2.7 du plan) : noyau pur dédupliquant
`degautsBruts = rawDice + getMrModifier(mr) + modDom + combatModeBonus`, présent à l'identique à 5
sites (`resolveDefenselessTarget`, `resolveMeleeDefensePnj`, `resolveMeleeDefenseDrone`,
`confirmMeleeDefense`, `confirmDamage` branche `melee`) — trouvé en cadrant le chantier, jamais dans le
périmètre des Lots 0-4 (qui excluaient `damageService.js`, cette duplication vivait côté appelant).

Les 5 sites ont été relus intégralement (pas seulement grep) avant de coder pour confirmer que le
fichier n'avait pas dérivé depuis la dernière réactualisation du plan (2026-08-06, post-commit
`d496481`) — confirmé stable. `computeMeleeRawDamage` ajoutée à `server/src/lib/combatAttackRoll.js`
(même famille que `computeAttackRoll`, import `getMrModifier` ajouté à `shared/polarisTestResolution.js`
déjà importé pour `resolveTestOutcome`). Les 5 sites remplacent uniquement leur ligne finale de calcul
— aucun changement à `getEffectiveMeleeDamage` (DB, paramètres propres à chaque site préservés) ni à la
branche `assault` de `confirmDamage` (formule différente, `modDegatsMode`, hors périmètre §2.7.a).

**Nuance méthodologique relevée en clôture** (question directe de Saar : « pourquoi pas satisfait du
Lot 5 ? ») : le script d'équivalence jetable écrit pour la vérification (§2.7.c.2, sans DB) réimplémente
l'ancienne formule en local plutôt que d'appeler le code réellement supprimé — sa valeur probante est
donc plus faible qu'annoncé initialement. Aucune conséquence sur le code livré (correct, confirmé par
les tests unitaires à valeurs calculées à la main et la relecture ligne à ligne du diff, qui restent la
vraie garantie de ce Lot) — seulement sur la façon dont la vérification avait été présentée. Rien à
recoder.

**Testé** : `node --test server/src/lib/combatAttackRoll.test.mjs` (18/18 — 9 tests Lot 1 inchangés + 9
nouveaux `computeMeleeRawDamage`, bornes `modDom`/`combatModeBonus` à 0/null/undefined, `mr` sur toute
la table `MR_TABLE`, un cas réaliste par site) ; `node --check` propre sur les 2 fichiers serveur
touchés ; diff relu ligne à ligne (aucune clé renommée, `getMrModifier` toujours utilisé par la branche
Tir hors périmètre — vérifié par grep, aucune référence orpheline) ; session de jeu réelle Saar
confirmée (« Enclume fonctionne, combat validé »).
**Non testé** : aucun reste connu sur le périmètre de ce Lot.
**Données** : aucune migration, aucun effet runtime.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

Prochaine étape : Lot 6 (`resolveDroneAssaultAction`, §2.8) — les numéros de ligne cités dans le plan
sont déjà caducs après ce Lot (fonction déplacée de L.2103 à L.2098, delta non trivial car 3 des 5
sites du Lot 5 précèdent cette fonction dans le fichier) : à revérifier avant de coder, pas à déduire
du texte du plan tel quel.

---

## Session (Saar) — 2026-08-07 — `PLAN_RW_SYSCOMBAT.md` Lot 6 : branchement cible `resolveDroneAssaultAction`

Extraction du branchement cible (drone/PNJ/PJ) de `resolveDroneAssaultAction` (§2.8 du plan) en 3
fonctions sœurs `resolveDroneAssaultHitDrone`/`Pnj`/`Pj`, même patron que les Lots 2/4 (guard clauses,
`ctx` assemblé par la coquille, aucune fonction extraite n'a son propre `try/catch`). Fonction relue
intégralement à l'état réel du fichier avant de coder (L.2098, décalée de -5 vs le texte du plan après
le Lot 5) — structure interne (3 branches de 28/52/34 lignes) confirmée identique malgré le décalage.
Le closure `fetchCibleNA` de la coquille a disparu (chaque fonction extraite appelle
`damageService.fetchCibleNA(db, ...)` directement), cohérent avec l'usage déjà en place ailleurs dans
le fichier.

**Vérification — première fixture jetable en base réelle de ce chantier** (les Lots 2/4 avaient utilisé
la méthode mais leurs scripts n'avaient jamais été committés, donc pas de recette à reprendre) :
campagne/battlemap (`surface_data` vide, mêmes modalités que `worldService.test.mjs`)/personnages/
tokens construits à la main, `resolveDroneAssaultAction` appelée pour de vrai avec un `io` mocké
(`to().emit()` uniquement) et `programme.level: 20` pour garantir `isSuccess` sur tout jet 1d20 possible.
5 scénarios initiaux tous OK. **Trouvaille en cours de route** : le 6ᵉ scénario prévu au plan
(`resolveTargetHit` renvoie `null` pour une cible PNJ) s'est révélé structurellement inatteignable —
lecture intégrale de `damageService.resolveTargetHit` : son seul `return null` est sur `cibleType ===
'drone'`, un cas que `resolveDroneAssaultHitPnj` ne reçoit jamais (intercepté plus tôt par le guard
`cibleCharacter?.type === 'drone'` de la coquille). Corrigé dans le plan — pas un bug, une prémisse de
scénario erronée de la rédaction initiale du §2.8.e.

**Faux bug évité en vérifiant avant de conclure** : le premier passage signalait un rollback silencieux
d'`applyWound` (`condition_type "wound_healing_check" absent de shared/echeanceTypeRegistry.js`) —
pas un défaut du serveur réel : ce registre est peuplé par effet de bord via l'import de
`server/src/lib/echeanceHandlerRegistrations.js` dans `server/src/index.js`, jamais exécuté par un
script isolé qui n'importe que `socketCombatHelpers.js`. Ajouté cet import au fixture — écart disparu.

**Durcissement après relecture critique** (Saar : « corrections avant de commit ? », réponse : rien à
corriger dans le code livré, seulement dans la rigueur de la vérification, faite puisque le temps ne
manquait pas) : assertions resserrées (valeur exacte plutôt que tolérante, nom d'event vérifié plutôt
que seulement la forme du payload), scénario supplémentaire cible PNJ **avec armure** sur les 6 slots
réels (`shared/armorConstants.js` LOC_TABLE) — jamais exercé par la première version, confirmant que
`damageService.resolveTargetHit` engage réellement `etq` quand une armure existe (`diffLabel:
"Armure:3..."`) — et 20 passes de la suite complète avec de vrais jets de dés (non mockés) : 420
assertions, 0 échec. **Résidu de mes tout premiers essais trouvé et nettoyé** : 2 campagnes de test
orphelines restées en base (échecs de contraintes `chk_dp_source`/`drone_programs_level_check` avant
d'avoir trouvé les bonnes valeurs, survenus hors du bloc `try/finally` du fixture) — supprimées
explicitement, cascade FK vérifiée (`characters`/`battlemaps` → `campaigns` = `ON DELETE CASCADE`), 0
résidu confirmé sur les 4 tables concernées après coup. Sans rapport avec la validité du Lot 6 lui-même
(échecs survenus avant toute exécution de `resolveDroneAssaultAction`).

**Testé** : `node --check` propre, 18 tests Lot 1/5 toujours au vert (fichiers non touchés), diff relu
ligne à ligne (corps des 3 branches déplacé verbatim, `ctx` vérifié champ par champ contre l'usage réel,
aucune clé renommée) ; fixture jetable en base réelle — 6 scénarios, 20 passes, 420 assertions, 0 échec,
0 résidu ; session de jeu réelle Saar confirmée fonctionnelle (tir drone → PNJ et → PJ, « Enclume
fonctionne, combat validé »).
**Non testé** : aucun reste connu sur le périmètre de ce Lot.
**Données** : aucune migration, aucun effet runtime — le résidu DB trouvé et nettoyé n'était pas un
effet du code livré, mais de mes propres essais de mise au point du script de fixture.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

Prochaine étape : Lot 7 (`confirmMeleeDefense`, §2.9) — le plus sensible des trois derniers lots : son
contrat de retour diffère (`suspendForDamage` remonté explicitement plutôt que `{ suspend, emissions }`
uniforme), et sa vérification doit prouver une **absence** (`advanceTimeline` non appelé quand
l'attaquant est PJ) — une forme de test que les fixtures des Lots 2/4/6 (toutes construites pour
vérifier des présences) ne couvrent pas encore. À concevoir avant de coder, pas pendant.

---

## Session (Saar) — 2026-08-07 — `PLAN_RW_SYSCOMBAT.md` Lot 7 : branchement post-hit `confirmMeleeDefense` + clôture du chantier

Extraction du branchement post-hit (type de l'attaquant) de `confirmMeleeDefense` (§2.9 du plan) en 2
fonctions sœurs `resolveMeleeDefenseHitAttackerPj`/`resolveMeleeDefenseHitAttackerPnj`. Écart trouvé au
codage : §2.9.b prescrivait une signature `(io, campaignId, ctx, emissions)` copiée par convenance de
celle des Lots 2/4/6 — paramètre mort, `confirmMeleeDefense` n'utilise aucun tableau `emissions[]`, elle
émet en direct (§2.4.l, déjà documenté comme volontaire). Codé sans ce paramètre, plan corrigé en
conséquence. Contrat de retour distinct des Lots précédents : la branche PJ retourne `{ suspendForDamage
: true }`, consommé explicitement par la coquille avant sa propre décision d'appeler `advanceTimeline`.

**Trouvaille en auto-critique, avant tout retour de Saar** : la première version de la fixture jetable
prouvait `suspendForDamage` en vérifiant `combat_state.sub_phase === 'AWAITING_DAMAGE'` — preuve
insuffisante. `endTurn` (`socketCombatHelpers.js:1141-1147`) ne touche jamais `sub_phase`, seulement
`phase`/`current_turn` : un bug réel (suspendForDamage mal remonté, `advanceTimeline` appelé à tort)
aurait laissé `sub_phase` inchangé lui aussi, donc le test serait resté vert même en cas de régression.
Corrigé avec une preuve directe (`current_turn`/`phase` inchangés après l'appel — la seule chose que
`endTurn` modifie s'il est atteint), rejouée 5 fois avec jets réels, 5/5 OK.

**Vérification — fixture jetable en base réelle**, 3 scénarios (§2.9.f) : attaquant PJ touche (prompt
dégâts + `suspendForDamage`), attaquant PNJ touche (dégâts auto-résolus, blessure "légère" garantie par
construction — `for_na`/`con_na` à 0 → RD hors table → aucune échéance de guérison créée, cleanup
simplifié), raté (aucune des deux branches). **10 passes** avec jets de dés réels non mockés
(`crypto.randomInt`), 0 échec, cleanup vérifié 0 résidu à chaque passe. Un résidu d'un essai antérieur
au script (avant correctif de la contrainte `chk_combat_phase` — `phase` doit être `ROSTER`/
`ANNOUNCEMENT`/`RESOLUTION`, pas une valeur libre) repéré et nettoyé séparément (1 campagne + 1 user +
1 battlemap en cascade). 18 tests unitaires `combatAttackRoll.test.mjs` + suite complète serveur (204
tests) toujours au vert.

**Session de jeu réelle Saar** : un seul des deux chemins exercé — attaquant PNJ touche un défenseur PJ
(`resolveMeleeDefenseHitAttackerPnj`), confirmé fonctionnel (dégâts calculés, combat continue
normalement ensuite). Le chemin attaquant PJ (`resolveMeleeDefenseHitAttackerPj`) n'a pas pu être
reproduit par Saar — reste couvert par fixture seulement, `⚠️ clos partiel` (`EN_COURS.md`).

**Deux bugs trouvés en testant, sans rapport avec ce Lot, documentés `docs/BUGIDENTIFIE.md`** (pas
corrigés — un plan = un problème, `CLAUDE.md` §13) :
- **ANNONCE-PRECHECK-STALE1** — "Action non autorisée (phase:ANNOUNCEMENT, sous-état:?)" en fin de
  combat. Vérifié sans rapport avec le diff du Lot 7 (`endTurn`/`COMBAT_PHASE_CHANGED`/client non
  touchés) ; pattern déjà documenté une fois (`docs/Old/JOURNAL5.md`), correctif partiel existant
  (`useCombatSocket.js`) qui ne couvre peut-être pas toute la surface d'état client. `[HYPOTHÈSE]` non
  instrumentée, repro précise à obtenir de Saar.
- **CATASTROPHE-SCOPE1** — une Catastrophe semble affecter deux protagonistes au lieu du seul lanceur
  de dé. Vérifié : le serveur n'applique aujourd'hui aucun effet mécanique (`EFFECT_HANDLERS` vide,
  Lot 1 du chantier Catastrophe) et chaque `pending_catastrophes` est scopée à un seul `token_id` —
  hypothèse la plus probable : deux jets de Catastrophe indépendants (attaquant + défenseur, un test
  d'opposition en produit toujours deux) mal présentés comme une seule entrée dans la file MJ.
  `[INCONNU]`, investigation dédiée hors périmètre.
- Vérifié à cette occasion (demande explicite Saar) : le moteur RAW critique/catastrophe
  (`shared/polarisTestResolution.js`) est conforme au texte cité (bonus de maîtrise ajouté à la Marge,
  jamais au résultat du dé ; Échec critique = relance + cumul ; seuil Catastrophe = Marge ≥ 15) — le
  doute de Saar est plus probablement expliqué par CATASTROPHE-SCOPE1 que par un calcul de marge faux.

**Décision de clôture du chantier (Saar, 2026-08-07)** : pas de Lot 8. `confirmDamage` (247 lignes,
même classe de dette que les fonctions traitées par ce chantier) reste entièrement intacte — le plan
lui-même (§3.2) la décrit comme structurellement différente (FIFO + branchement CaC/Tir + drone +
jusqu'à 6 émissions), méritant son propre cadrage `METHODO_PLAN.md` plutôt qu'une extension rapide du
patron Lot 2/4/6/7. Non urgent, repris séparément si Saar le souhaite un jour — pas ouvert dans
`EN_COURS.md` tant que non décidé.

**Testé** : `node --check` propre, diff relu ligne à ligne (code déplacé à l'identique, aucune clé `ctx`
renommée, même ordre exact d'`await`), 18 tests `combatAttackRoll.test.mjs` + 204 tests suite serveur
complète au vert, fixture jetable 3 scénarios × 10 passes (jets réels) + re-vérification ciblée 5 passes
(preuve directe `suspendForDamage`), cleanup vérifié 0 résidu à chaque fois, session de jeu réelle Saar
confirmée pour le chemin attaquant PNJ.
**Non testé** : chemin attaquant PJ (`resolveMeleeDefenseHitAttackerPj`) en jeu réel — Saar ne peut pas
reproduire ce cas actuellement, reste `⚠️ clos partiel` (`EN_COURS.md`). ANNONCE-PRECHECK-STALE1 et
CATASTROPHE-SCOPE1 non instrumentés, non corrigés.
**Données** : aucune migration, aucun effet runtime en dehors du code déplacé.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit — aucune donnée vivante affectée.

Chantier `PLAN_RW_SYSCOMBAT.md` (Lots 0-7) conclu à ce stade — Lot 8 (`confirmDamage`) non engagé,
décision explicite Saar, non urgent.

## Session (Saar) — 2026-08-07 — SECU-1 : rate limiting login/register

**Contexte** : `docs/AUDIT.md` SECU-1 — `/api/auth/login` et `/api/auth/register` sans aucune
limitation de tentatives depuis l'audit du 2026-07-25, non corrigé malgré 97 commits (RC4 :
`rate-limiter-flexible` déjà en dépendance et déjà utilisé sur `socketTrade.js`, jamais étendu à
l'auth). Demande explicite Saar de suivre les recommandations pro plutôt qu'un simple portage du
pattern trade.

**Recherche avant code** (demande explicite Saar, docs/pratiques pro plutôt que réinventer) : recette
officielle de brute-force protection publiée par l'auteur de `rate-limiter-flexible`
(wiki + gist animir), cohérente avec OWASP Credential Stuffing Prevention Cheat Sheet et Authentication
Cheat Sheet — deux paliers combinés (compte ciblé + IP volumétrique), reset uniquement sur succès,
consommation d'échec seulement si le compte existe (évite de créer une clé mémoire par email
énuméré). Saar a ensuite demandé une sévérité supérieure à la recette de base, avec un mécanisme
d'escalade (récidive après un premier blocage → blocage aggravé) que la lib ne fournit pas nativement.

**Architecture retenue** — `server/src/lib/authRateLimit.js` (nouveau, testé indépendamment de la DB
et des routes Express) :
- Login, palier email+IP : 5 échecs → bloqué 1h ; toute récidive après ce blocage → 24h.
- Login, palier IP (tous comptes confondus) : 10 échecs/24h → IP bloquée 24h ; récidive → 7 jours.
- Escalade implémentée via un second petit limiteur « indicateur » (`points:1`) par palier : posé au
  premier blocage, lu avant chaque nouvel échec — s'il est déjà posé, le blocage aggravé est forcé
  directement via `RateLimiterMemory.block()` au lieu de repasser par le compteur normal.
- Remise à zéro complète (compteur + indicateur) des deux paliers sur tout succès de connexion.
- Register : un seul palier IP, 10 échecs/1h, non escalade (`REGISTRATION_CODE` reste la vraie
  barrière, SECU-2 non traité ici, toujours Basse).
- `server/src/routes/auth.js` : gating (`get()`, sans consommer) avant toute requête DB/bcrypt —
  un attaquant bloqué ne fait plus tourner bcrypt — puis consommation uniquement sur échec réel,
  réponse `429` + header `Retry-After` si bloqué.

**Deux bugs réels trouvés en écrivant les tests avant la mise en prod** (pas juste des ajustements de
chiffres) :
1. `rate-limiter-flexible` ne bloque qu'au dépassement strict de `points` (le (N+1)-ième échec, pas le
   N-ième) — `points` fixé à N-1 (4 et 9) pour que « 5 échecs bloque » corresponde bien au 5e échec.
   Trouvé parce que le test de blocage utilisait à tort `remainingPoints <= 0` (vrai un cran trop tôt),
   corrigé en `consumedPoints > limiter.points` (le même test que celui utilisé en interne par la lib).
2. `duration: 30 * DAY` en millisecondes dépasse la limite 32 bits de `setTimeout` Node
   (`TimeoutOverflowWarning` observé en test) — le timer de nettoyage interne de la lib se serait
   déclenché après 1ms au lieu de 30 jours, effaçant compteur et indicateur d'escalade presque
   immédiatement en production. Remplacé par `duration: 0` (aucune auto-expiration, seul un succès
   réinitialise) — plus fidèle à la spec de toute façon (aucune décroissance dans le temps demandée).

**Documentation** : `docs/AUDIT.md` SECU-1 annoté `[CORRIGÉ 2026-08-07]`. Dette hors-périmètre notée en
cours de session (remarque Saar) : `SECU-EMAIL1` (`docs/EN_COURS.md`) — le serveur de déploiement
actuel n'a aucune mécanique d'envoi d'email, bloque toute fonctionnalité qui en dépendrait à l'avenir.

**Analyse critique demandée par Saar après premier codage** — relecture à charge du correctif tout
juste posé, pas seulement une confirmation :
- Point fort vérifié : la clé composite email+IP (pas email seul) pour le palier ciblé empêche un
  attaquant distant de verrouiller le compte d'une victime depuis sa propre IP (DoS par lockout,
  faille classique documentée OWASP) — c'est la raison d'être de la composition dans la recette
  officielle, pas un détail cosmétique.
- **Nouveau bug trouvé** : le correctif du bug d'overflow (`duration: 0`) ouvrait une fuite mémoire —
  sans nettoyage automatique, une IP d'attaque qui n'aura jamais de succès reste en mémoire pour
  toujours. Confirmé par la doc officielle de la lib (wiki "Memory" : limite dure 2 147 483s/~24,8j
  pour `RateLimiterMemory`, `setTimeout` 32 bits). Corrigé : fenêtre bornée à 20 jours
  (`LONG_MEMORY_SEC`) au lieu de 0 — élimine l'overflow et la fuite mémoire, concession documentée
  (auto-reset après 20j d'inactivité totale, pas seulement sur succès). Garde de non-régression
  ajoutée : le fichier de test écoute `process.on('warning')` et échoue si une
  `TimeoutOverflowWarning` apparaît, peu importe la valeur exacte choisie plus tard — vérifié qu'il
  détecte bien la régression (repro manuelle avec l'ancienne valeur 30j, warning capturée).
- **Limite connue, non corrigée** (décision produit, pas un correctif de code) : le mécanisme
  d'escalade ne se réinitialise que sur succès — sans email (SECU-EMAIL1), CAPTCHA ni outil admin,
  un joueur légitime multipliant les erreurs de frappe n'a aucune échappatoire sinon le redémarrage
  complet du serveur (efface tous les compteurs de tous les utilisateurs, pas un outil ciblé). Signalé
  à Saar dans `docs/AUDIT.md` SECU-1, à trancher (accepter tel quel pour un petit groupe fermé, ou
  outiller un déblocage ciblé email/IP plus tard).

**Testé** : `node --test src/lib/authRateLimit.test.mjs` — 7/7 (paliers email+IP et IP sous seuil puis
bloqués, escalade après récidive, reset complet sur succès, non-consommation email+IP pour compte
inexistant, register, garde anti-régression `TimeoutOverflowWarning`). Suite serveur complète rejouée
après le changement — 211 tests, 119 pass, 92 skip (DB indisponible en session), 0 fail, aucune
régression. `node --check` propre sur les 3 fichiers touchés/créés.
**Non testé** : scénario réel en navigateur (tentatives de connexion répétées, vérification du 429 et
du header `Retry-After` côté client) — le client actuel n'a pas de gestion dédiée de ce code d'erreur,
`[INCONNU]` si un message utilisateur adapté s'affiche ou si l'erreur générique suffit ; à valider par
Saar. Comportement sous VRAI écoulement du temps (le fait qu'un blocage 1h se lève bien après 1h) non
observé en conditions réelles — déduit du code de la lib (`blockDuration` correctement isolé de la
fenêtre de 20j), pas chronométré en dehors des tests synchrones.
**Données** : aucune migration. Nouvel état en mémoire process (limiteurs `RateLimiterMemory`) — perdu
au redémarrage du serveur (nodemon en dev), cohérent avec l'archi mono-instance actuelle (INFRA-8) et
avec `socketTrade.js` déjà sur ce même modèle.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit — aucune donnée persistante
affectée, aucun état DB créé.

---

## Session (Saar) — 2026-08-07 — Curseurs et réticules combat (CASE/CIBLE)

**Contexte** : remplacement de `client/public/assets/reticule.svg`/`reticule2.svg` par 4 assets dédiés
fournis par Saar — `CURSEUR_CASE.svg`/`CURSEUR_CIBLE.svg` (curseur souris sur le canvas 3D) et
`RETICULE_CASE.svg`/`RETICULE_CIBLE.svg` (réticules 3D existantes : case de déplacement et billboard
de ciblage sur token). Demande explicite de Saar en cours de route : retirer à `Canvas3D.jsx` la
responsabilité curseurs/réticules (extraction dédiée).

**Décisions et détours** :
- `TargetReticule`/`GroundCursorReticule` extraites vers `SceneReticules.jsx` (nouveau), assets
  basculés sur `RETICULE_CIBLE.svg`/`RETICULE_CASE.svg`. `currentColor` remplacé par `#ffffff` explicite
  dans les deux SVG — invariant déjà documenté dans le code d'origine : chargés comme texture Three.js
  hors DOM, `currentColor` y résout en noir et casse la teinte dynamique (`material.color` multiplié).
- `GroundCursorReticule` accepte désormais un prop `color`. Le chemin de déplacement combat
  (`currentPath`) n'affiche plus des carrés pleins colorés par allure + une réticule blanche séparée
  sur la case survolée : chaque case du chemin affiche directement le réticule, teinté par
  `getCombatPathColor` — un seul système visuel (retour Saar : « le réticule est censé prendre les
  couleurs d'allure, sur TOUTES les cases »).
- `RETICULE_CASE.svg` : retour à la technique de masque de l'ancien `reticule.svg` (fond blanc plein
  troué par la forme) sur demande Saar (« inversion transparence/couleur »), toujours teinté par allure.
- Curseurs souris CASE/CIBLE : premier essai en `cursor: url()` natif — **abandonné**. Deux limites
  navigateur découvertes en testant : (1) aucun navigateur n'anime une image de curseur référencée en
  CSS (Saar voulait une pulsation sur CASE) ; (2) `CURSEUR_CIBLE.svg` (masque + filtre + `<use>`) ne se
  rendait jamais comme curseur natif (« curseur_cible toujours totalement invisible »), alors que
  `CURSEUR_CASE.svg` (masque + `<path>` simple) fonctionnait. Remplacé par `SceneCursorOverlay.jsx`
  (nouveau) : un `<img>` DOM classique qui suit la souris (`position:fixed` + `clientX`/`clientY` bruts,
  pas de calcul de rect nécessaire), animé en CSS (`index.css`, `@keyframes` pulsation), avec le curseur
  natif du canvas masqué (`cursor:none`) tant qu'un mode est actif.
- **Cause racine** du symptôme restant (« curseur_case ne cède jamais sa place ») : le mode de curseur
  ne réagissait qu'à `combatTargetMode`/`losMode` (mode Ciblage explicite, rare), jamais au survol
  ambiant d'un token pendant `combatMoveMode` (`ambientHoverTokenId`) — pourtant déjà la source de
  l'anneau rouge `TargetReticule` existant sur les tokens survolés. `combatMoveMode` restant actif en
  arrière-plan tout du long, CIBLE ne pouvait jamais apparaître dans ce flux. Corrigé par
  `hoveringTokenRef`, miroir de `ambientHoverTokenId` (pattern P40 — ref écrite dans `Scene`, lue par
  l'overlay à chaque `pointermove`, aucun re-render du sous-arbre 3D). Un seul curseur actif à la fois
  garanti par une fonction de résolution unique (`resolveMode`), utilisée à la fois pour choisir
  l'image affichée et pour masquer le curseur natif — plus de risque de désynchronisation.
- Suppression de CURSEUR_CIBLE au survol d'une entité interactive non-cible (coffre, etc.) : `EntityMesh`
  avait déjà un callback `onHover(entity, bool)` jamais branché dans `Canvas3D.jsx` — câblé via
  `handleEntityHover` → `hoveringEntityRef` (même pattern miroir), lu par l'overlay.
- `CURSEUR_CIBLE.svg` inversé une fois (ère curseur natif, cohérence avec CASE), puis ré-inversé
  (retour à une croix blanche + lueur sur fond transparent, masque retiré) une fois passé en `<img>`
  DOM — le « trou dans un aplat blanc » ne fonctionnait pas comme réticule de ciblage une fois rendu
  normalement (plus les contraintes du curseur natif qui l'avaient motivé).

**Fichiers touchés** : `client/src/components/Canvas3D.jsx` (extraction, câblage, rendu du chemin),
`client/src/components/SceneReticules.jsx` (nouveau), `client/src/components/SceneCursorOverlay.jsx`
(nouveau), `client/src/lib/useSceneCursor.js` (nouveau), `client/src/index.css` (classes
`.scene-cursor-overlay*` + animations), `client/public/assets/CURSEUR_CASE.svg`/`CURSEUR_CIBLE.svg`/
`RETICULE_CASE.svg`/`RETICULE_CIBLE.svg` (nouveaux), `client/public/assets/reticule.svg`/`reticule2.svg`
(supprimés, plus référencés).

**Testé** : `npm run build` (client) après chaque étape, propre à chaque fois. Confirmé fonctionnel en
jeu par Saar : animation de pulsation CASE, bascule CASE↔CIBLE au survol d'un token pendant le
déplacement combat (« Parfait, fonctionnel »), cases du chemin teintées par allure via le réticule,
réticule ciblage/case inversés comme demandé.
**Non testé** : suppression de CURSEUR_CIBLE au survol d'une entité interactive (coffre/porte) en mode
Ciblage combat explicite (`combatTargetMode`/`losMode`) — code non modifié depuis l'écriture initiale,
mais jamais observable avant la correction de la cause racine ci-dessus (rien à supprimer tant que
CIBLE n'apparaissait jamais) ; dernière teinte de `CURSEUR_CIBLE.svg` (retour croix blanche + lueur,
non inversée) pas encore revue par Saar en navigateur.
**Données** : aucune migration, aucun effet runtime serveur — uniquement assets statiques et composants
client.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit — aucun état serveur/DB affecté.

## Session (Saar) — 2026-08-11 — `docs/BUG WIZARD.md` bugs #1-5 (un par un)

**Contexte** : reprise de `docs/BUG WIZARD.md` (liste de bugs beta-testeurs du Wizard de création),
traités un par un sur demande explicite de Saar. Pour chacun, l'analyse déjà écrite dans le doc a été
revérifiée contre le code réel avant correction — plusieurs diagnostics initiaux se sont révélés faux
ou incomplets (cause racine sous-estimée), jamais appliqués tels quels.

**Bug #1 — « Méthode de mutation invalide : null »** : diagnostic du doc confirmé à l'identique par le
code. `getStep3State` (`creationService.js`) renvoyait `method: null` pour un personnage n'ayant que
des mutations `'revers'` ; `reconcileCreation` rejette tout `step3.method` hors de
`['chosen','random','none']`. `openPeek`/`handleTerminate` (`WizardCreation.jsx`) lisaient les
variables fermées du rendu au lieu de `useCreationStore.getState()`, contrairement à `advanceStep`
(pattern déjà en place juste au-dessus, avec un commentaire documentant un bug réel similaire).
Corrigé : `null` → `'none'` ; `openPeek`/`handleTerminate` passés à `getState()`.

**Bug #2 — Organe sensoriel manquant coûte des PC au lieu d'en donner** : le doc affirmait « aucune
modification de code nécessaire », faux. Table RAW réelle relue (`docs/REGLES/REGLE_CREATION.md:760-884`,
la source citée par la migration 118 déjà en place) : la migration 118 avait corrigé les *montants*
(1/1/2/3 au lieu de 0/0/1/2) mais gardé le *signe positif* — la mutation coûtait encore des PC au lieu
d'en rapporter (`cost_pc` négatif = convention déjà utilisée par `Purulence`, `cost_pc:-2`, dette
`EN_COURS.md` MUT1 déjà repérée). Second problème, en code cette fois : `Step3Mutations.jsx:308`
(`cost_pc >= 0`) excluait de l'écran d'achat toute mutation désavantageuse, contredisant
`REGLE_CREATION.md:761-767` (« le joueur peut également choisir de donner des mutations
désavantageuses à son personnage... qui rapportent le nombre de PC indiqué »). Corrigé : migration 235
(signe cost_pc, 4 lignes `Organe sensoriel manquant`) + filtre `availableMutations` (`cost_pc < 0 ||
cost_pc <= pcLeft`) + affichage `+X PC` (nouvelle clé i18n `step3.gain`) + `method_choose_desc` mis à
jour (affirmait à tort que les désavantageuses étaient réservées au tirage). Effet de bord légitime :
`Purulence` redevient aussi achetable (même règle RAW, même filtre) — dette MUT1 close par ricochet.

**Bug #3 — Finalisation : compétences remises à zéro** : cause racine différente et plus sévère que ce
que documentait le bug (pas un cas rare lié au MJ — déterministe pour tout joueur solo). Chaîne
vérifiée : `routes/creation.js` diffuse `WIZARD_STATE_SYNC` à `io.to(room)` — room entière, **émetteur
inclus** (contrairement à `WIZARD_LIVE_UPDATE` qui exclut l'émetteur via `socket.to`).
`WizardLockSync.jsx` applique cet écho sans filtrage MJ/joueur. `getStep4State` renvoyait
`skillAllocations: {}` en dur (reconstruction jugée trop risquée, commentaire d'origine assumant que
cette perte était « cosmétique », les points restant corrects en base). Cette hypothèse est fausse :
`openPeek`/`handleTerminate` renvoient toujours `step1..step5` complets, y compris un `step4` jamais
retouché depuis sa validation initiale mais corrompu par l'écho — `reconcileCreation` (ligne ~865)
supprime et réinsère `char_skills` à partir de ce payload vide dès que `step4` est présent. Tentative
initiale de fix rejetée avant codage : arrêter le renvoi de `step4` casse `finalize` (`isComplete =
!!(step1 && step2 && step3 && step4 && step5)` calculé sur le payload reçu, pas l'état serveur).
Corrigé : migration 236 (`char_pc_ledger.skill_allocations`/`autodidacte_allocations`, jsonb),
persistées telles que soumises (jamais recalculées) dans le bloc STEP4 de `reconcileCreation`, lues
par `getStep4State`. Vérifié que `vaultService.js#cloneRows` (clonage Vault) fait un `SELECT *`/spread
— aucune adaptation nécessaire là-bas.

**Bug #4 — « PC insuffisants : X requis » avec 0 PC restants** : cause du doc (`pc_postcreation`)
écartée — colonne jamais écrite nulle part dans le serveur, toujours 0. Vraie cause, vérifiée par
simulation numérique : `getStepBudget()` (`creationStore.js`, prop `pcDispo` de `Step3Mutations`,
`CareersAllocator` et `Step5Advantages` via `WizardCreation.jsx`) incluait la contribution PC **déjà
committed** de l'étape en cours d'édition (`step3Data.pcSpent`/`step4Data.pcSpent`/`step5Data.pcNet`),
alors que le composant recalcule cette même contribution en direct sur sa sélection locale — double
comptage à tout retour sur une étape déjà validée. Le commentaire d'origine de `getStepBudget()`
visait explicitement à éviter ce cas (« leur passer une valeur déjà nette... créerait un double
décompte ») sans l'implémenter correctement ; même confusion explicite dans un commentaire de
`Step4Experience.jsx:445` (« toujours brut, jamais affecté »). Corrigé : `getStepBudget(excludeStep)`
omet la contribution de l'étape passée en paramètre ; `WizardCreation.jsx` appelle `getStepBudget(step)`
(un seul point d'appel, `step` vaut déjà 3/4/5 au bon moment). Même dette que `EN_COURS.md` WIZ-2,
close par le même fix (portée plus large que CareersAllocator seul, comme documenté sur place).

**Rework écarté** : Saar avait préparé `docs/PLANS/PLAN_RW_WIZARD.md` (sync live MJ/joueur, remount
`gmSyncKey`) en se demandant s'il fallait l'engager pour couvrir #3 et les bugs liés aux allers-retours
entre étapes. Analyse à charge : le plan cible la perte de position de navigation du MJ (`subStep`) au
remount — un problème réel mais mineur (papercut MJ) — pas la cause réelle de #3 (déterministe, sans
MJ, via l'auto-écho `WIZARD_STATE_SYNC`). Le rework, même complet, n'aurait pas fermé #3 ni #5 (âge —
nécessite une colonne `base_age` séparée, indépendant du remount). Rework non engagé ; seule sa Phase 1
(retrait `gmSyncKey` étape 4) reste une piste mineure séparée si un jour priorisée.

**Bug #5/#15 — L'âge progresse à chaque test sans jamais régresser** : diagnostic du doc confirmé par
le code, sur le même principe que #3. `reconcileCreation` (bloc STEP4) écrit l'âge **final**
(`baseAge + higherEdYears + totalCareerYears`) dans `char_archetype.age`. `getStep4State` renvoyait ce
même champ comme âge de **base** au client ; `Step4Experience.jsx` réutilise `initialData.age` comme
point de départ (`useState`), donc chaque réhydratation (reload, ou l'auto-écho `WIZARD_STATE_SYNC` du
bug #3) repart de l'âge final précédent et cumule. Vérifié que `char_archetype.age` sert aussi hors
Wizard comme âge courant du personnage (`char-sheet.js:222`, édition fiche) — son sens ne devait pas
changer. Corrigé (Option A du doc) : migration 237 (`char_archetype.base_age`, nullable), écrite en
parallèle de `age` dans le bloc STEP4, lue par `getStep4State` à la place de `age`. Aucun changement
client nécessaire. Personnages déjà en cours de création avec un âge déjà cumulé non réparés
rétroactivement (`base_age` NULL → repli 16 à la prochaine reprise) — pas de nouvelle corruption,
pas de réparation automatique de l'existant.

**Correction de processus documentaire (Saar)** : après clôture des bugs #1-4, `docs/BUGIDENTIFIE.md`
et `docs/EN_COURS.md` avaient été mis à jour en parallèle (entrées barrées + note dans les deux). Saar
a corrigé : `BUGIDENTIFIE.md` a sa propre règle d'hygiène (ligne 8, « tout bug clos est SUPPRIMÉ de ce
registre ») — une clôture s'y **supprime**, ne s'y annote jamais ; `docs/EN_COURS.md` est le seul
foyer de suivi d'un bug corrigé (ligne barrée + `⚠️ clos partiel` jusqu'à validation en jeu, puis
retrait complet + JOURNAL). `docs/BUG WIZARD.md` (liste de pistes fournie par Saar pour cette tâche)
n'entre pas dans ce circuit et n'a pas vocation à survivre. Les 4 entrées `BUGIDENTIFIE.md` retirées ;
`EN_COURS.md` complété (WIZ5 = bug #1, WIZ6 = bug #3 ; #2/#4 déjà couverts par MUT1/WIZ-2 existants).
Mémoire `feedback_doc_updates.md` corrigée en conséquence.

**Audit round-trip suite à une question directe de Saar** (« l'architecture du Wizard est-elle remise
en cause par ce genre de bugs ? ») : plutôt que de répondre par une réassurance non vérifiée, audit
complet de chaque `getStepNState` contre son bloc d'écriture correspondant et contre chaque
consommateur client (`WizardReview.jsx` en particulier, jamais vérifié jusqu'ici). Trouvé 4 champs
manquants, tous du même mécanisme que #3 (écho `WIZARD_STATE_SYNC` auto-inclus pour l'émetteur,
`getStepNState` incomplet) :
- `getStep3State` ne renvoyait pas `mutationsMeta` (nom/coût/sous-type des mutations) — consommé par
  `WizardReview.jsx:16` pour le Récap. Les mutations, bien que persistées en base, disparaissaient
  purement visuellement du Récap dès le premier écho.
- `getStep5State` ne renvoyait ni `advantagesMeta` (même défaut, Récap) ni `pcNet` — ce dernier
  consommé par `creationStore.js` (`getPcDispo`/`getStepBudget`, y compris ma propre correction du
  bug #4) : après tout écho suivant la soumission de l'étape 5, le budget PC global oubliait
  entièrement la contribution de cette étape (passait à 0 au lieu du net réel).
- `getStep4State` ne renvoyait pas `finalAge`, consommé par `WizardReview.jsx:15`
  (`step4Data?.finalAge ?? step4Data?.age`). **Régression que mon propre fix du bug #5 aurait
  introduite seule** : avant ce fix, `age` (alors égal à l'âge final par le bug lui-même) servait de
  repli accidentel à ce champ manquant ; en séparant `base_age`, ce repli serait devenu l'âge de base
  au lieu de l'âge final sur le Récap. Trouvé et corrigé dans la même session, avant tout commit.

Correctifs : les trois fonctions enrichies (jointures `ref_mutations`/`ref_mutation_subtypes` pour
#3, `ref_advantages` + ledger pour #5, `archetype.age` exposé sous un nom dédié pour #4) — aucune
migration nécessaire, toutes les données sources existaient déjà, seule la lecture était incomplète.
`subtype`/`subtypeDbName` : le serveur ne traduit jamais de texte visible (`i18n.md`) — renvoie soit
le nom déjà affichable (`ref_mutation_subtypes.name`), soit un code brut que `WizardReview.jsx`
traduit via `t('step3.subtype_labels.<code>')`, même convention que `Step3Mutations.jsx#variantLabel`.
Vérifié par exécution réelle (pas seulement lecture statique) : script `.mjs` dans le scratchpad,
`getStep3State`/`getStep4State`/`getStep5State` appelées contre 5 fiches réelles en base — jointures
valides, `pcNet: -5` cohérent pour un avantage à 5 PC, mutations correctement résolues par nom.

**Conclusion de l'audit (réponse aux deux questions de Saar)** : (1) les correctifs de cette session
(bugs #1-5 + cet audit) aggradent l'architecture — ils comblent des lacunes de modélisation
(donnée absente, colonne à double sens) en réutilisant exactement les conventions déjà en place
(mêmes tables, même pattern jointure, même séparation client/serveur pour l'i18n), sans mécanisme
parallèle ni cas spécial. (2) l'architecture de navigation du Wizard (aller-retour libre, remontage
par étape, `highestStep` comme garde) n'est pas en cause — chaque bug trouvé est une même classe
récurrente et désormais bien identifiée (`getStepNState` incomplet par rapport à ce que le client
réinjecte après écho), jamais un défaut du modèle de navigation lui-même. Le remount MJ (`gmSyncKey`,
`docs/PLANS/PLAN_RW_WIZARD.md`) reste un problème distinct, mineur, déjà écarté du périmètre. Reste
un risque non éliminé structurellement : rien n'empêche aujourd'hui qu'un futur champ ajouté au
payload d'une étape souffre du même oubli — seule la vigilance/l'audit au cas par cas le détecte pour
l'instant, pas un test automatisé dédié (piste non engagée, à évaluer si Saar la juge utile).

**Garde-fou round-trip (Saar : « garde-fou d'abord »)** — la piste ci-dessus engagée immédiatement.
Nouveau test `server/src/services/creationRoundTrip.test.mjs` : crée une fiche réelle (fixture
`users`/`campaigns`/`campaign_members` + `startCreation`, nettoyage par cascade FK sur suppression
de la campagne), soumet un payload représentatif des 5 étapes (mutation désavantageuse avec sous-type,
carrière avec compétence allouée, avantage + désavantage), lit l'état via `getStepNState`, **renvoie
ce résultat tel quel comme second `reconcileCreation`** — exactement ce que fait `openPeek`/
`handleTerminate` — puis vérifie que le résultat ne bouge plus (`deepEqual`, rejoué une 3e fois pour
confirmer un point fixe stable, pas une simple convergence). Assertions explicites sur chacun des
bugs #3 (la compétence allouée ne doit pas être effacée) et #5 (l'âge ne doit pas cumuler), plus les
4 champs de l'audit. Carrière de test choisie sans aucun prérequis (« Marchand », `ref_career_
prerequisites` vide, aucun min d'Attribut/génotype requis) pour ne pas avoir à construire un
personnage complexe juste pour satisfaire l'éligibilité.

Vérifié que le garde-fou détecte réellement une régression (pas un test qui passe trivialement) :
`age: archetype?.base_age` retransformé temporairement en `archetype?.age` (bug #5 réintroduit) →
le test échoue et affiche exactement le symptôme réel (`age: 21` puis `22` au round-trip suivant,
diff `deepEqual` explicite) ; fix restauré → vert à nouveau. Suite serveur complète rejouée après
restauration : 220/220 tests passent (aucune régression ailleurs).

Trouvé au passage (hors périmètre, documenté sans corriger) : `DeprecationWarning` pg (« client
already executing a query ») pendant le bloc STEP5 — `addAdvantage` (`advantageService.js`) lance un
`Promise.all` de plusieurs requêtes sur la même transaction/connexion, pattern déjà présent ailleurs
dans le fichier, jamais exercé bout-en-bout par un test avant celui-ci. Aucune erreur aujourd'hui,
deviendra un throw en pg 9 — `docs/EN_COURS.md` WIZ-ROUNDTRIP-DEPWARN.

**Fichiers touchés** : `server/src/services/creationService.js` (`getStep1State`..`getStep5State`,
bloc STEP4), `server/src/services/creationRoundTrip.test.mjs` (nouveau),
`server/src/db/migrations/235_fix_ref_mutations_organe_sensoriel_manquant_sign.js`,
`236_char_pc_ledger_skill_allocations.js`, `237_char_archetype_base_age.js` (nouveaux),
`client/src/components/creation/WizardCreation.jsx` (`openPeek`, `handleTerminate`, `stepBudget`),
`client/src/components/creation/Step3Mutations.jsx` (filtre achat, affichage coût),
`client/src/components/creation/Step4Experience.jsx` (commentaire corrigé),
`client/src/components/creation/WizardReview.jsx` (traduction subtype),
`client/src/stores/creationStore.js` (`getStepBudget`), `client/src/locales/creation.json`
(`step3.gain`, `method_choose_desc`), `docs/BUG WIZARD.md` (statuts #1-4), `docs/BUGIDENTIFIE.md`
(items 12/23/27/28-29 supprimés), `docs/EN_COURS.md` (MUT1, WIZ-2, WIZ5-8, WIZ-ROUNDTRIP-DEPWARN).

**Testé** : chaque cause racine vérifiée contre le code réel (pas la mémoire ni le doc) avant de coder ;
`node --check` sur les fichiers serveur modifiés et les migrations ; `eslint` sur les fichiers client
modifiés (exit 0) ; migrations 235/236/237 appliquées automatiquement par le watcher nodemon et
vérifiées en base (valeurs `cost_pc`, colonnes `jsonb`/`base_age` créées) ; simulation numérique du
double comptage #4 (19 affiché avant fix vs 16 réel, 16 après fix) ; `getStep3State`/`getStep4State`/
`getStep5State` exécutées réellement contre 5 fiches en base après l'audit ; **nouveau test round-trip
automatisé, vérifié rouge/vert (régression réintroduite puis restaurée)** ; suite serveur complète
220/220 après restauration.
**Non testé** : les 5 bugs + l'audit ne sont vérifiés qu'en base/tests automatisés, rien n'a été
rejoué en navigateur (création de personnage réelle bout en bout, avec MJ observateur pour #1/#3,
Récap Étape 7 pour l'audit). ⚠️ clos partiel pour l'ensemble (le garde-fou couvre la non-régression
serveur, pas le rendu client réel).
**Données** : migrations 235 (signe cost_pc, `ref_mutations`), 236 (`char_pc_ledger.skill_allocations`/
`autodidacte_allocations`) et 237 (`char_archetype.base_age`) — additives/nullables, aucun personnage
existant affecté rétroactivement, rétrocompatibles. Le test round-trip nettoie intégralement ses
données (cascade FK sur suppression de la campagne de test) — vérifié aucun résidu après exécution.
**Retour arrière** : `down()` fourni sur les trois migrations ; le reste est un commit isolé sur
`dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-11 — `docs/BUG WIZARD.md` bug #7 (compétences à prérequis SKILL_MIN)

**Contexte** : suite de la session précédente, bug #7 seul (« Playground – Augmentation possible des
compétences limitatives sans prérequis »). Diagnostic du doc revérifié contre le code réel avant toute
correction.

**Lecture** : `char-sheet.js` (`POST /:characterId/skills/buy`) revalide déjà `SKILL_MIN` côté serveur
depuis une base fraîche (jamais l'état client), via `calcSkillTotal` (`server/src/lib/charStats.js`,
autorité unique déjà partagée avec socketDice/socketEntity/socketCombat) — gaté par
`settings.skill_prerequisites` (OPT-07). `SkillsPanel.jsx` masque le bouton d'achat avec exactement la
même condition côté client (`skillPrerequisitesEnabled`). Les deux sont cohérents entre eux : ce
n'était donc pas un bug de désynchronisation client/serveur comme le supposait le doc — le mécanisme
est solide (`✅ Session 141` déjà noté dans `EN_COURS.md` OPT-W1), aucun bricolage à corriger, aucun
rework nécessaire.

**Le vrai gap** : `SETTINGS_SCHEMA.skill_prerequisites.default` était `false`
(`campaignSettingsService.js`). Vérifié dans `docs/REGLES/REGLECOMPETENCE.md` p.190 : le marqueur †
est présenté par le LdB lui-même comme « COMPÉTENCE PRÉ-REQUISE NÉCESSAIRE (OPTIONNEL) » — variante
optionnelle du LdB, mais dont le défaut RAW est actif. 84 lignes réelles dans
`ref_skill_requirements` (vérifié en base, pas supposé) — mécanique substantielle, pas un stub. Note
de Saar déjà présente dans `docs/BUG WIZARD.md` : « Si elle existe, il faut qu'elle soit active par
défaut ».

**Effet de bord trouvé avant de coder** (justifie la pause de confirmation) : la base réelle montre que
la campagne « La Forêt Maudite » a déjà `settings.skill_prerequisites: false` **explicite** en JSONB
(écrit dès la première sauvegarde de la page Réglages — `CampaignSettingsPage.jsx` envoie l'objet
`settings` complet à chaque `PUT`, jamais un diff). Changer uniquement le défaut du schéma n'aurait
donc eu aucun effet sur la seule campagne réelle concernée par le bug signalé par les beta-testeurs.
Décision Saar (question posée) : basculer le défaut ET la campagne existante.

**Corrigé** :
- `server/src/lib/campaignSettingsService.js` — `skill_prerequisites.default` → `true`, commenté (LdB
  p.190, lien vers cette session).
- Campagne « La Forêt Maudite » (`7997c6ce-...`) — `settings.skill_prerequisites` → `true` en base,
  même pattern de merge JSONB atomique que la route `PUT /campaigns/:id`.

**Testé** : `campaignSettingsService.test.mjs` référence `SETTINGS_SCHEMA` dynamiquement (aucune valeur
en dur) — non cassé par le changement de défaut, confirmé par la suite complète 220/220. Valeur en
base revérifiée par requête indépendante après écriture. `ref_skill_requirements` (84 lignes SKILL_MIN
réelles) confirmé en base.
**Non testé** : achat réel d'une compétence gated (ex. Chirurgie sans Médecine 10) en mode Progression
navigateur, sur une campagne avec l'option maintenant active. ⚠️ clos partiel — détail `docs/EN_COURS.md`
WIZ9.
**Données** : un `UPDATE` ciblé sur `campaigns.settings` (une ligne, « La Forêt Maudite ») — pas de
migration (pas un changement de schéma SQL, JSONB existant). Réversible par Saar lui-même dans la page
Réglages de campagne (décoche la case) si le défaut ne convient pas à l'usage réel.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit pour le code ; la donnée campagne
peut être rebasculée manuellement dans les Réglages.

## Session (Saar) — 2026-08-11 — `docs/BUG WIZARD.md` bug #12 (mutation Parasite, jet 1D4)

**Contexte** : bug #12 seul — « Le personnage abrite 1D4 parasites » (`REGLE_MUTATION.md:179`), aucun
jet effectué nulle part pour déterminer ce nombre.

**Solution du doc écartée avant de coder** : le doc proposait d'ajouter un champ `count` ad hoc dans
l'objet de résultat de `rollOneMutation`, avec un cas spécial `mutation_id === 'parasite'` codé en dur,
propagé à la main jusqu'au serveur. Lecture du schéma réel : `char_mutations.count` existe déjà, mais
avec un sens générique établi et actif ailleurs — « nombre de fois cette mutation a été choisie »,
consommé directement par la vue SQL `char_mutation_effects` (migrations 109/127/128,
`(cm.count - 1) * stack_deltas`). Réutiliser cette colonne pour « nombre de parasites » l'aurait
surchargée de deux sens différents sur la même colonne — mine potentielle pour l'implémentation future
des effets mécaniques de Parasite (`EN_COURS.md` MUT3 Lot 7, actuellement non câblés).

**Cause racine réelle et solution retenue** : "Parasite" a exactement la même structure RAW que
"Caractère génétique animal" (`REGLE_MUTATION.md:32`, "Lancez 1D4" aussi) — mutation_id 6, déjà
entièrement géré par le mécanisme sous-type existant : `ref_mutation_subtypes` (colonne `d4_roll`
déjà nommée pour ça), `has_subtable` sur `ref_mutations`, `rollOneMutation`
(`Step3Mutations.jsx:141-163`, pioche déjà uniformément dans `mut.subtable`), la modale d'achat
manuel (`pendingSubtype`/`handleSelectSubtype`, déjà générique), `getStep3State`
(`mutationsMeta[].subtypeDbName`, déjà générique) et `WizardReview.jsx` (déjà générique). "Parasite"
avait seulement `has_subtable: false` et aucune ligne dans `ref_mutation_subtypes` — un trou de
donnée, pas un trou de code.

**Corrigé** : migration 238 — `has_subtable: true` sur "Parasite" (matché par `name`, jamais
`mutation_id` qui est un serial dépendant du seed de l'instance, cf. `.claude/rules/core.md`), 4
lignes `ref_mutation_subtypes` ("1 parasite" à "4 parasites", `d4_roll` 1-4, `mod_*` à 0 — les effets
mécaniques restent MUT3 Lot 7, non touchés ici pour ne pas câbler une partie du sujet en douce).
**Aucune ligne de code client ou serveur modifiée.**

**Testé** : suite serveur complète 220/220. Vérification fonctionnelle réelle (pas seulement lecture
de code) : simulation de la requête `GET /mutations` (nesting subtable) confirmée sur "Parasite" ;
fixture réelle (personnage + `char_mutations` avec `subtype_id` = "3 parasites") relue via
`getStep3State` → `mutationsMeta[0].subtypeDbName === "3 parasites"` confirmé, donc le Récap Étape 7
affichera bien « Parasite — 3 parasites » sans changement de `WizardReview.jsx`.
**Non testé** : tirage aléatoire réel et achat manuel en navigateur (Step3Mutations.jsx, Math.random()
côté client, non observable depuis Node).
**Données** : migration 238, additive (nouvelle donnée de référence, `down()` fourni). Aucun
personnage existant affecté (aucun `char_mutations` existant ne référence "Parasite" dans cette base).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit ; `down()` de la migration 238
retire proprement les 4 sous-types et repasse `has_subtable` à `false`.

## Session (Saar) — 2026-08-11 — `docs/BUG WIZARD.md` bug #13/#14 (diffusion live Avantages & Revers)

**Contexte** : bug #13/#14 seul (la numérotation interne du doc est incohérente entre son tableau et
ses sections détaillées — deux entrées différentes portent "#13" ; la section détaillée pertinente
est en réalité titrée "Bug #14"). Sujet : le MJ ne voit pas en temps réel les choix du joueur
(avantages professionnels, tirages 1D10) dans la sous-étape « Avantages & Revers » de l'Étape 4.

**Diagnostic confirmé** : `Step4Experience.jsx`, le `useEffect` de diffusion live appelait
`onLiveChange?.(buildPayload())`, mais sa liste de dépendances (dupliquée à la main, pas dérivée du
corps de `buildPayload`) omettait `proAdvantages`/`randomPicks` — pourtant lus par `buildPayload`.
Confirmé indépendamment du code source par `npx eslint` : warning `react-hooks/exhaustive-deps` sur
cet effet avant correctif.

**Fix retenu, différent de la solution proposée par le doc** : ajouter les 2 champs manquants à la
liste de deps de l'effet aurait corrigé cette instance mais laissé le mécanisme fragile — toute
future évolution de `buildPayload` (nouveau champ) referait dériver silencieusement les deux listes,
exactement la cause de ce bug. `buildPayload` passé en `useCallback` avec sa propre liste de deps
(vérifiable par ESLint contre son propre corps, pas indirectement via un effet distant) ; l'effet de
diffusion se réduit à `useEffect(() => { onLiveChange?.(buildPayload()) }, [buildPayload, onLiveChange])`.
Élimine la classe de bug, pas seulement l'instance.

**Vérifié avant de considérer la boucle infinie écartée** : ce composant a déjà un incident réel
documenté (« Maximum update depth exceeded », trouvé par Saar en test réel, cf. commentaire
`validSetbackRolls`) causé par une dépendance recréée à chaque rendu sans mémoïsation. Chaque
dépendance du nouveau `useCallback` revérifiée une par une : primitives (age, finalAge, originGeo...)
ou `useState` (careers, proAdvantages, randomPicks, skillAllocations...) — référence stable tant que
le state ne change pas réellement — ou déjà mémoïsée (`validSetbackRolls`, `useMemo`). `onLiveChange4`
(`WizardCreation.jsx`) est lui-même un `useCallback([])` à deps vides, stable par construction — même
garantie qu'avant le fix, aucune régression possible sur ce point précis.

**Chaîne de diffusion revérifiée jusqu'au bout** (pas supposée) : `buildPayload` → `onLiveChange4`
(stable) → `emitLiveRef.current` → `emitLive` (`WizardLockSync.jsx`) → `socket.emit(WS.WIZARD_LIVE_UPDATE, ...)`.
Confirmé par lecture directe de `WizardLockSync.jsx`, pas supposé sur la seule foi du commentaire du
doc ("Aucune modification du serveur n'est nécessaire").

**Testé** : `npx eslint src/components/creation/Step4Experience.jsx` — warning `react-hooks/exhaustive-deps`
disparu (reste une erreur `no-unused-vars` préexistante sur `showSetbacks`, sans rapport, non touchée).
`npx vite build` — build client OK.
**Non testé** : scénario réel navigateur (MJ observateur pendant qu'un joueur modifie ses avantages
pro/tirages à l'Étape 4).
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-11 — `docs/BUG WIZARD.md` bug #16 (traductions ref_advantages)

**Contexte** : bug #16 seul — noms d'avantages/désavantages avec un terme anglais entre parenthèses
non traduit (« Sens diminué (hearing) », « Faiblesse naturelle (drug) », etc.).

**Diagnostic confirmé** : `ref_advantages.name` contient directement le texte final affiché — `grep`
sur `Step5Advantages.jsx` et `AdvantagesPanel.jsx` confirme `adv.name`/`dis.name` rendus tels quels,
aucune indirection i18n (contrairement au mécanisme sous-type des mutations, `subtypeDbName`/i18n
fallback, déjà traité cette session pour bug #2/#12). Correction à la source (donnée), seule autorité,
couvre tous les consommateurs (Wizard Étape 5, Récap Étape 7 via `getStep5State.advantagesMeta`,
fiche personnage `AdvantagesPanel.jsx`) sans dupliquer la logique.

**Périmètre vérifié avant de coder** : 46 lignes de `ref_advantages.name` contiennent des parenthèses,
mais la plupart sont déjà en français (« Carte au trésor (1 PC) », « Phobie (maladies) »...). Seules
14 lignes sont réellement anglaises : les 5 sens (« Sens développé »/« Sens diminué » × vue/ouïe/
odorat/toucher/goût, RAW `REGLE_AVANTAGES.md:96-97,204`) et « maladie »/« drogue » (« Faiblesse
naturelle »/« Résistance naturelle augmentée » × disease/drug). « poison » et « radiation » sont
laissés tels quels : mots identiques en français (`REGLE_AVANTAGES.md:154` "poisons, maladies,
radiations ou drogues").

**Corrigé** : migration 239, 14 `UPDATE` par `advantage_id` (clé métier stable — texte fixe, pas de
serial, vérifié sur le schéma avant de matcher dessus).

**Note du doc écartée après vérification** : BUG WIZARD.md affirmait que ce correctif "entraîne la
validation de PLAN_LOCALISATION". Fichier retrouvé (`docs/PLANS/PLAN_LOCALISATION.md`, pas
`docs/PLAN_LOCALISATION.md` comme écrit) — lu en entier : ce chantier couvre le texte JSX en dur sans
`useTranslation` (Combat/Équipement/Builder/Dice), sujet disjoint des données `ref_advantages`.
Aucune mention de ce bug dans ce plan. Affirmation du doc fausse, aucune action prise dessus.

**Testé** : re-scan complet `ref_advantages.name` après migration — 46 lignes avec parenthèses
restantes, toutes vérifiées en français ; re-scan `description` (regex mots anglais suspects) — 0
résultat. Suite serveur complète 220/220.
**Non testé** : rendu réel navigateur (Étape 5, Récap, fiche personnage).
**Données** : migration 239, `UPDATE` sur données de référence existantes (pas de nouvelle ligne),
`down()` fourni. Aucun impact sur `char_advantages` (la table référence `advantage_id`, pas `name`).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit ; `down()` de la migration 239
restaure les 14 valeurs anglaises.

## Session (Saar) — 2026-08-11 — Décision d'architecture : i18n du contenu de catalogue (`ref_*`)

**Contexte** : en clôturant bug #16, Saar a posé une question de principe — pourquoi laisser "poison"/
"radiation" tels quels (mots identiques en FR) alors que "la norme i18n" demande une traduction pour
chaque mot, pour pouvoir ajouter EN/DE/JAP plus tard sans tout refaire. Vérification faite :
`docs/SYSTEME/LOCALISATION.md` documente déjà que le multi-langue actif n'est pas un objectif produit
(§1/§5, décision Saar 2026-07-23) — pas de contradiction sur l'objectif produit, mais Saar confirme
vouloir l'architecture prête dès maintenant, sans relancer le multi-langue actif.

**Écart trouvé** : `docs/PLANS/PLAN_LOCALISATION.md` — que Saar pensait avoir déjà couvert ce sujet —
ne scanne que le texte `.jsx` des composants (§1, méthode d'audit par `grep`). Il ne pouvait par
construction pas trouver le texte de jeu stocké en base dans les 10 tables `ref_*` (~1519 lignes,
compté en base, pas estimé : `ref_equipment` 678, `ref_career_random_benefits` 370, `ref_skills` 249,
`ref_advantages` 79, `ref_mutations` 45, `ref_careers` 37, `ref_setbacks` 27, `ref_backgrounds` 22,
`ref_mutation_subtypes` 8, `ref_genotypes` 4).

**Recherche menée avant de trancher** (demande explicite Saar : "on suit les bonnes pratiques des
pros, documente-toi") — le cadrage initial en "Option A (clés i18next) vs Option B (table de
traduction séparée)" s'est révélé être une fausse alternative : la pratique pro traite texte UI et
contenu de catalogue comme deux problèmes distincts, jamais par le même canal. Pour un volume de
~1500 lignes avec des champs `description` parfois longs (paragraphes RAW retranscrits), la pratique
recommandée n'est ni l'un ni l'autre : une colonne JSONB par champ traduisible directement sur la
table `ref_*` (évite le gonflement du bundle JS d'i18next et la jointure d'une table séparée). Sources :
- Database Designs for Multilingual Apps (dev.to/dwarvesf) — 3 patterns (colonnes par langue/JSONB/
  table de traduction), JSONB recommandé pour un volume modeste sans requêtes complexes.
- SimpleLocalize, ButterCMS — séparation texte UI (i18next/fichiers) vs contenu (mécanisme dédié),
  traitées comme deux problèmes différents dans la pratique professionnelle.

**Décision retenue** : colonnes JSONB `<champ>_i18n` (ex. `name_i18n`, `description_i18n`) sur chaque
table `ref_*`, clé = code langue, seul `fr` peuplé aujourd'hui. Cohérent avec l'usage JSONB déjà établi
dans le projet (`campaigns.settings`, `char_pc_ledger.skill_allocations`) — pas un nouveau pattern.
Résolution centralisée par un helper serveur unique (à écrire au Lot 5), jamais dupliquée par table ;
le client continue de recevoir une chaîne déjà résolue, jamais l'objet JSONB brut (même principe
d'autorité serveur que `LOCALISATION.md` §4).

**Corrigé** :
- `docs/SYSTEME/LOCALISATION.md` — nouveau §6 documentant ce mécanisme, §5 mis à jour (le contenu de
  catalogue n'est plus "hors périmètre"), en-tête/statut datés 2026-08-11, référence `PLAN_LOCALISATION.md`
  corrigée (mauvais chemin : `docs/PLAN_LOCALISATION.md` n'existe pas, le fichier réel est sous
  `docs/PLANS/`).
- `docs/PLANS/PLAN_LOCALISATION.md` §7 (Lot 5) — remplace le fork Option A/B non tranché par la
  décision et ses sources, statut mis à jour en tête de fichier.

**Non fait, volontairement** : aucune migration, aucun code. La décision d'architecture est prise et
documentée ; l'exécution (audit détaillé par table, ordre des lots, forme du helper de résolution,
retrofit de tous les consommateurs `adv.name`/`mut.name`/etc.) reste un chantier à part entière, pas
improvisé derrière cette décision.
**Testé** : n/a (documentation uniquement).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-11 — WIZ13 : crash `invalid input syntax for type uuid: "null"`

**Contexte** : signalement beta-testeur, sans pas-à-pas reproductible — "beaucoup navigué d'une étape
à l'autre pour expérimenter des builds ou découvrir les possibilités". Message d'erreur brut collé par
Saar : `select * from char_sheet where id = $1 limit $2 - invalid input syntax for type uuid: "null"`.

**Confirmé par lecture** : `resolveSheetAccess` (`creationService.js:414`, garde d'accès partagée par
le middleware REST `router.param('sheetId')` et les 3 handlers WebSocket `socketWizard.js`) fait
`db('char_sheet').where({ id: sheetId }).first()` sans valider le format avant d'interroger la base.
La chaîne littérale entre guillemets dans l'erreur pg ("null") confirme que ce n'est pas un SQL NULL
mais une vraie chaîne de 4 caractères — nécessairement produite côté client par un template
`` `/creation/${sheetId}/...` `` interpolé alors que `sheetId` valait JS `null`/`undefined`.

**Cause côté client tracée mais NON confirmée** — chaque chemin identifié s'est révélé déjà gardé
avant d'utiliser `sheetId` :
- Nouvelle création (Step0 → Step1) : `startCreation()` est `await`é avant `setStep(1)`, `sheetId`
  déjà résolu dans le store au moment où Step1 (qui ne le consomme même pas) rend.
- Reprise via URL (`urlSheetId`) : tant que `urlSheetId !== sheetId`, seul un écran de chargement rend
  (`WizardCreation.jsx:220-228`), jamais les étapes réelles.
- Reset MJ (`resetCreation`, quittant le brouillon d'un joueur) : `step` et `sheetId` repassent à 0/
  `null` dans le **même** `set()` Zustand — pas de fenêtre où une étape encore montée lirait un
  `sheetId` déjà nul (hypothèse initiale envisagée, écartée après lecture du code réel).
- `CharacterPoolPage.jsx` (liste de brouillons + démarrage pour un joueur) : les deux `navigate()`
  utilisent un `sheetId` qui vient de `char_sheet.id`, clé primaire `NOT NULL` — structurellement ne
  peut pas être `null` pour une ligne réellement retournée par la requête serveur.

Aucun autre chemin trouvé. Cause racine côté client non identifiée — pas de correctif client tenté
sur une hypothèse non vérifiée (règle du protocole : ne jamais coder sur un `[HYPOTHÈSE]`).

**Corrigé, indépendamment de la cause exacte** : garde-fou format UUID dans `resolveSheetAccess`,
avant toute requête — `AppError(404, 'Fiche introuvable')` propre au lieu du crash pg brut, plus un
log `console.warn('[DBG-WIZNULL] ...')` capturant la valeur reçue et l'userId. Bénéfice réel même sans
cause confirmée : plus aucun signalement "erreur SQL brute" possible pour ce chemin, et si le bug se
reproduit, le log donnera enfin un point d'entrée concret (timing, utilisateur) pour remonter à la
cause côté client.

**Testé** : suite serveur complète 220/220. Vérification directe de `resolveSheetAccess` : `sheetId:
"null"` → `AppError` propre + log `[DBG-WIZNULL]` (au lieu du crash) ; un vrai `sheetId` UUID existant
→ passe le garde-fou sans effet, échoue plus loin comme avant (comportement légitime inchangé).
**Non testé** : reproduction du bug original en navigateur (impossible sans pas-à-pas).
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-11 — WIZ13 (suite) : cause racine trouvée grâce au log

**Contexte** : quelques minutes après la 1re passe de WIZ13 (garde-fou + log, sans cause client
trouvée), Saar reproduit lui-même précisément : nouveau personnage, Étape 1, clic "Suivant" →
"Fiche introuvable". Le log `[DBG-WIZNULL]` ajouté juste avant confirme immédiatement
`POST /api/creation/null/reconcile` — la chaîne littérale "null" dans l'URL, comme prévu.

**Cause racine, trouvée par lecture de code (pas par nouvelle hypothèse au hasard)** : Saar est MJ de
sa campagne. L'effet "Hygiène de navigation" (`WizardCreation.jsx:86-93`, avant fix) :
```js
useEffect(() => {
  if (!urlSheetId && isGmView) resetCreation()
}, [urlSheetId, isGmView, resetCreation])
```
teste `isGmView` seul pour détecter "un MJ revient de consulter le brouillon d'un autre joueur". Or
`startCreation` (même fichier, commentaire déjà présent avant ce fix) pose aussi `isGmView: true` pour
tout MJ démarrant SON PROPRE personnage — rôle réel de campagne, ajouté pour un bug différent
(bouton Matériel Étape 6 invisible pour un MJ créant pour lui-même). Personne n'avait répercuté ce
changement de sens sur cet effet. Séquence exacte : `startCreation()` pose `{sheetId, isGmView:true,
...}` → l'effet se redéclenche (sa dépendance `isGmView` vient de changer) → `!urlSheetId && isGmView`
est vrai (aucune des deux conditions ne distingue "mon propre personnage" de "celui d'un autre") →
`resetCreation()` efface `sheetId` (et `isGmView`, et `step`) quelques instants après leur pose. Au
clic "Suivant" de l'Étape 1, le `sheetId` lu par `advanceStep` est déjà retombé à `null`.

**Signal correct trouvé** : `ownerUserId` (store) n'a lui qu'un seul sens — le propriétaire du dernier
brouillon chargé via `loadExistingSheet` (Lot A3, résolution serveur, jamais posé par `startCreation`).
Pour un MJ créant son propre personnage, `ownerUserId` reste `null` (jamais touché). Pour un MJ qui
vient de consulter le brouillon du joueur A, `ownerUserId` vaut l'id de A — différent du sien.
`ownerUserId !== user.id` distingue donc sans ambiguïté les deux cas, contrairement à `isGmView` seul.

**Corrigé** : condition remplacée par `!urlSheetId && ownerUserId && ownerUserId !== user?.id`,
`isGmView` retiré des deps de cet effet (reste utilisé ailleurs dans le fichier pour son propre rôle
d'affichage MJ, non touché). Vérifié par relecture du scénario original (MJ consultant le brouillon
d'un autre puis revenant au sien) : `ownerUserId` de ce brouillon est bien différent du sien,
`resetCreation()` se déclenche toujours correctement dans ce cas — comportement legacy préservé.

**Corrigé (1re passe, conservé)** : le garde-fou serveur (`resolveSheetAccess`) reste en place —
défense en profondeur, ce bug précis n'était pas le seul chemin possible vers un `sheetId` malformé.

**Testé** : ESLint clean sur `WizardCreation.jsx`, `vite build` propre. Trace logique complète du
scénario réel (MJ créant son propre personnage) et du scénario original que l'effet doit préserver
(MJ quittant le brouillon d'un autre joueur) — les deux aboutissent au comportement attendu.
**Non testé** : navigateur (impossible à observer depuis Node — dépend du timing réel des effets
React/re-renders, pas simulable statiquement avec certitude absolue, seulement par trace logique).
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-11 — WIZ14 : grille de répartition visible avant carrière ajoutée (bug #23)

**Contexte** : Saar remonte en test réel (indépendamment de `docs/BUG WIZARD.md` #23, déjà catalogué)
que la grille de répartition des points de compétences (Step 4 Profession) s'affiche avant que le
nombre d'années d'une profession soit confirmé.

**Confirmé par lecture** : `<div className="wiz4-board">` (`CareersAllocator.jsx`) n'avait aucune
condition — rendu à chaque fois, y compris avec `selectedCareers` vide (dans ce cas seules les
compétences d'origine y apparaissent, mais la section reste visible et laisse croire qu'une
répartition est en cours). Diagnostic du doc confirmé exact, y compris la précision de Saar :
`selectedCareers` est déjà le tableau des carrières **ajoutées** via `handleAdd` (bouton "Ajouter",
après confirmation des années) — pas la carrière en cours de sélection/édition dans la colonne de
gauche (`selectedCareerId`/`years`, état de saisie séparé). Un seul et même correctif couvre donc la
formulation du doc ("avant sélection d'une profession") et celle de Saar ("avant confirmation des
années") : `selectedCareers.length > 0`.

**Corrigé** : `wiz4-board` enveloppé dans `{selectedCareers.length > 0 && (...)}`. Le statut en pied
de page (`career_status_none`, déjà existant) reste le seul message tant qu'aucune carrière n'est
ajoutée — pas de nouveau texte à traduire.

**Testé** : ESLint clean, `vite build` propre. Confirmé en navigateur par Saar (2026-08-11).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-11 — WIZ15 : granularité du suivi MJ sur Step 4 (gmSyncKey)

**Contexte** : Saar remonte que sur Step 4 (Profession), dès que le joueur modifie une sous-étape, le
MJ est renvoyé sur "Récap" et ne peut rien voir.

**Cause confirmée** : `gmSyncKey` (`WizardCreation.jsx`, `isGmView ? gm-sync-${stateSyncVersion} :
undefined`) est posé en `key` sur chacun des 5 composants d'étape — un remontage complet force leurs
`useState(initialData)` à se resynchroniser dès qu'un `WIZARD_STATE_SYNC` arrive (nécessaire : sans
ça le MJ verrait des données périmées, exigence déjà posée par Saar). Mais `Step4Experience.jsx` est
le seul des 5 à porter sa propre sous-navigation locale (`subStep` : Âge/Origines/Formation/Carrières/
Avantages & Revers/Récap) — un état UI qui n'a rien à voir avec les données synchronisées. Le
remontage la réinitialisait aussi, et comme `initialData` existe déjà (le joueur a avancé), elle
repart directement sur `SUB_STEPS.SUMMARY`.

**Recherche avant de coder** (analyse à charge demandée par Saar avant d'implémenter) : le plan
initial ("déplacer `subStep` dans le store Zustand") a été révisé après vérification de la doc
officielle React (`react.dev/learn/preserving-and-resetting-state`) — un `key` changeant est fait pour
tout réinitialiser d'un coup ; quand une partie de l'état doit rester locale pendant qu'une autre se
resynchronise depuis les props, le pattern documenté est de séparer le composant en deux (wrapper
externe jamais remonté + composant interne remonté). Préféré au store Zustand : ne mélange pas une
préoccupation UI propre à Step4 avec les données de personnage partagées par tout le Wizard.

**Corrigé** : `Step4Experience.jsx` scindé — le nom `Step4Experience` (export par défaut) devient un
wrapper fin qui porte `useState` pour `subStep`/`highestSubStep` (jamais remonté, car
`WizardCreation.jsx` ne pose plus `key={gmSyncKey}` dessus) ; l'ancien corps entier (~480 lignes,
inchangé) est renommé `Step4ExperienceInner`, reçoit `subStep`/`setSubStep`/`highestSubStep`/
`setHighestSubStep` en props au lieu d'un `useState` local — mêmes noms de variables partout dans le
corps, donc **aucune ligne de logique déplacée ou réécrite**, seules 2 déclarations changent de forme.
`gmSyncKey` descend désormais en prop normale depuis `WizardCreation.jsx`, appliqué comme `key` React
uniquement sur `Step4ExperienceInner`.

**Testé** : ESLint clean sur les deux fichiers touchés (seule erreur restante, `showSetbacks` non
utilisé, déjà confirmée préexistante avant cette session — bug #13/#14). `vite build` propre.
Vérifié par lecture que `gmSyncKey` n'est référencé nulle part ailleurs dans le fichier, et que le
wrapper externe n'est lui-même remonté que par la navigation normale entre étapes (`step === 4`),
jamais par un changement de `gmSyncKey` seul. Confirmé en navigateur par Saar (2026-08-11).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ16 : main directrice, Ambidextre sélectionnable sans coût (bug #19)

**Contexte** : `docs/BUG WIZARD.md` #19, classé "Mineurs – UI/ergonomie". Diagnostic du doc : le
`<select>` main directrice de Step1 reste actif après le tirage 2D10, et l'option "Ambidextre" est
accessible sans coût.

**Vérifié avant de coder** (lecture `Step1Attributes.jsx`, `identityService.js`,
`creationService.js`, `ref_advantages`, `REGLE_CREATION.md:1301-1311`) : le problème réel dépasse
l'ergonomie. RAW : main directrice = jet 2D10 (2-15 Droitier, 16-19 Gaucher, 20 Ambidextre) ; en
dessous de 20, Ambidextre ne s'obtient que par l'achat de l'Avantage dédié — confirmé en base
(`ref_advantages.advantage_id = 'adv_002'`, `cost_pc: 1`, `mod_identity: {hand_pref: "A"}`). Et
`hand_pref` n'est pas cosmétique : il détermine la priorité de slot d'arme en défense CaC
(`socketCombatHelpers.js:1651`, `slotPriority`). Un joueur pouvait donc obtenir gratuitement l'effet
mécanique d'un Avantage payant.

**Options écartées avant le correctif final** :
- **Garde serveur** (vérifier qu'un Avantage/mutation actif couvre `hand_pref: 'A'` avant d'accepter
  la soumission) : écartée — le jet 2D10 gagnant est, comme tous les tirages du Wizard (mutations,
  avantages pro 1D10), calculé côté client en `Math.random()` sans aller-retour serveur (pattern déjà
  établi ailleurs dans le code). Le serveur ne peut pas distinguer un vrai 20 d'une valeur forgée — une
  garde aurait aussi rejeté à tort un jet gagnant légitime, et créé une incohérence avec tous les
  autres tirages Wizard, non protégés par choix architectural assumé.
- **Exemption MJ** sur la restriction ("A" non sélectionnable manuellement) : écartée après vérification
  — le trait est une propriété du personnage, pas un privilège du rôle MJ ; RAW ne prévoit aucune
  exception pour un PJ créé par le MJ pour un joueur absent (`EN_COURS.md` DBG-C1). Le MJ dispose de
  toute façon déjà d'un accès freeform à `hand_pref` hors Wizard via `PUT /char-sheet/:id/identity`
  (`char-sheet.js:168`), sans garde sur l'état du Wizard — pas besoin d'un second chemin de contournement
  à l'intérieur du Wizard lui-même.

**Corrigé** : `Step1Attributes.jsx` — `<option value="A" disabled={handPref !== 'A'}>` : non
sélectionnable manuellement, reste affichée/conservée si déjà acquise (jet gagnant, ou fiche rechargée
avec l'Avantage déjà possédé). Le bouton de tirage (`handleRollHandPref`) pose l'état directement via
`setHandPref`, hors du `<select>` — non affecté par `disabled`. Renommé au passage : le bouton
"Définir" (vague) devient "Lancer 2D10" (`creation.json`, `step1.handRoll`), aligné sur la convention
"Lancer 1D20"/"Lancer 1D10" déjà utilisée pour les autres tirages du Wizard.

**Effet de bord noté, hors périmètre** : un retour à l'étape 1 après achat de l'Avantage Ambidextre à
l'étape 5, suivi d'un changement manuel vers R/L puis validation, écrirait `hand_pref` sans repasser
par `recomputeIdentity` (celui-ci n'est appelé que par les blocs STEP3/STEP5, jamais STEP1) —
incohérence pré-existante, indépendante de ce bug, à traiter séparément si remontée.

**Testé** : ESLint clean (`Step1Attributes.jsx` — seule erreur restante, `poolBase` non utilisé,
confirmée préexistante par `git diff` avant cette session). `vite build` propre. Vérifié en base
l'existence et le coût réel de `adv_002 "Ambidextre"`. Confirmé en navigateur par Saar (2026-08-11).
**Non testé** : —
**Données** : aucune migration — modification de code et de traduction uniquement.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ17 : bouton "Suivant" grisé sans explication si nom vide (bug #20)

**Contexte** : `docs/BUG WIZARD.md` #20. `canNext` (`Step1Attributes.jsx`) combine
`charName.trim().length > 0` ET `validation.valide` — mais seul le second cas (répartition
d'Attributs invalide) affichait un message conditionnel (`hard_block_warning`). Un nom vide grisait
le bouton sans qu'aucun texte n'explique pourquoi.

**Corrigé** : nouveau bloc conditionnel indépendant, affiché dès que `charName.trim().length === 0`
— peut apparaître en même temps que `hard_block_warning` si les deux causes sont réunies (pas
mutuellement exclusif, contrairement à `hard_block_warning`/`budget_warning` qui le sont via
`validation.valide`). Nouvelle clé `step1.name_required_warning` (`creation.json`).

**Testé** : ESLint clean (seule erreur restante, `poolBase` non utilisé, confirmée préexistante).
`vite build` propre. Confirmé en navigateur par Saar (2026-08-11).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ18 : carte "Aucune mutation" peu visible (bug #21)

**Contexte** : `docs/BUG WIZARD.md` #21. La carte "Aucune mutation" (`Step3Mutations.jsx`, écran
d'achat) était stylée en très faible contraste — `noneTitle` `#5a5a7a`, `noneDesc` `#3a3a5e`, bordure
`#1e1e2e` identique au fond — contre `#c0c0d0`/`#6a6a8a` pour une carte mutation normale
(`cardName`/`cardDesc`). Une entrée `BUGIDENTIFIE.md` liée signalait aussi l'absence d'une
"troisième voie" — vérifié faux : l'écran de choix n'a que deux cartes (Achat/Aléatoire) par
conception, "Aucune mutation" est une action à l'intérieur de l'écran Achat, pas un troisième choix
de méthode. Entrée supprimée avec le reste (malentendu, pas un bug).

**Corrigé** : couleurs de `noneTitle`/`noneIcon` remontées à `#9090c8` (teinte déjà utilisée ailleurs
dans le fichier pour `cardVariant`), `noneDesc` remonté à `#6a6a8a` (identique à `cardDesc`), bordure
éclaircie à `#3a3a52`. Icône "⊘" ajoutée avant le titre — pas de librairie d'icônes dans ce fichier
(uniquement des glyphes unicode inline déjà présents, ex. "→"), reste cohérent avec le style local
plutôt que d'introduire une nouvelle dépendance pour un seul usage.

**Testé** : ESLint clean. `vite build` propre. Confirmé en navigateur par Saar (2026-08-11).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ19 : bouton "Suivant" inatteignable en Autodidacte (bug #22)

**Contexte** : `docs/BUG WIZARD.md` #22 (registre `BUGIDENTIFIE.md`, doublon sous "Bug #9"). En
sous-étape Formation, quand `AutodidacteAllocator` (répartition de 7 points sur une longue liste de
compétences) est affiché, le bouton "Suivant" de `BackgroundSelector.jsx` devenait inaccessible.

**Vérifié avant de coder, plus sévère que le diagnostic du doc** : `BackgroundSelector.jsx` n'avait
aucun scroll interne (`s.container` : flex/column simple, contenu grandit avec `AutodidacteAllocator`).
Mais son ancêtre `WizardCreation.jsx` (`body: { overflow: 'hidden' }`) coupe tout excédent de hauteur
sans offrir de scroll de secours — le bouton n'était donc pas juste "tout en bas" (atteignable en
scrollant la page), il pouvait être purement et simplement invisible/inatteignable, aucun ascendant
n'exposant de barre de défilement.

**Corrigé** : plutôt que `position: sticky` (absent du reste du projet, introduirait un nouveau
patron) ou une `max-height` propre à `AutodidacteAllocator` seul (aurait isolé son scroll du reste du
contenu de l'étape, incohérent visuellement), repris le patron déjà utilisé par
`StepMaterielEtBiens.jsx` pour le même problème (contenu variable + nav qui doit rester visible) :
`container` (`overflow:hidden`) > `scroll` (nouveau, `flex:1, minHeight:0, overflowY:auto`, contient
tout le contenu variable) + `nav` (sibling, `flexShrink:0`, hors du scroll — toujours visible).
Appliqué à `BackgroundSelector.jsx`, partagé par les 3 sous-étapes Origine géo/Origine sociale/
Formation (pas seulement Autodidacte — la même classe de bug touchait potentiellement toute
sélection avec beaucoup de détails affichés). `Step4Experience.jsx` : `minHeight: 0` ajouté sur son
propre `container` — sans ça, le scroll interne de `BackgroundSelector` ne se serait jamais déclenché
(un flex item hérite d'un `min-height: auto` qui le fait grandir avec son contenu au lieu de se
borner à l'espace disponible, gotcha CSS classique des scrolls imbriqués en flexbox).

**Testé** : ESLint clean sur les deux fichiers touchés. `vite build` propre. Point signalé comme
sensible (scroll imbriqué flexbox, notoirement fragile) — confirmé fonctionnel en navigateur par
Saar (2026-08-11).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ20 : boutons +/- non harmonisés (bug #24)

**Contexte** : `docs/BUG WIZARD.md` #24 scope à tort sur "les 3 allocateurs Step4" (`wiz4-sbtn`) —
vérifié identiques, aucune incohérence là (aucune règle CSS parent-spécifique ne surcharge
`.wiz4-sbtn`, `index.css`). Le même registre porte un item plus large, `BUGIDENTIFIE.md` #8 :
"Boutons -/+ non harmonisés **sur tout le wizard**" — c'est là que ça se confirme.

**Vérifié** : 3 classes CSS pour le même pattern +/- stepper dans le Wizard :
- `.wiz1-spin-btn` (Step1, points d'Attributs) — cyan, 24×24, radius 4px, font 14px.
- `.wiz4-stepbtn` (Step4, années de carrière) — cyan quasi identique, 26×26, radius 6px, font 15px.
- `.wiz4-sbtn` (Step4, grilles de points — compétences carrière, Autodidacte, avantages pro) — gris
  discret, 22×22, radius 5px, font 13px.

Plus une incohérence de glyphe : `+` ASCII dans `wiz1-spin-btn`, `＋` pleine chasse partout ailleurs.

**Décision (soumise à Saar avant de toucher du CSS partagé entre 3 fichiers)** : les deux variantes
"cyan" (`wiz1-spin-btn`/`wiz4-stepbtn`) servent le même rôle sémantique — ajuster une quantité
proéminente, une seule instance visible à la fois (points d'Attributs, années de carrière) —
manifestement la même intention réimplémentée deux fois avec des valeurs dérivées, pas un choix
délibéré. `wiz4-sbtn` sert un rôle différent (grille dense, beaucoup de lignes répétées) où un style
plus discret limite le bruit visuel — conservé distinct. Option confirmée par Saar plutôt que tout
fusionner en une seule classe.

**Corrigé** : nouvelle classe partagée `.wiz-spin-btn` (`index.css`, convention `wiz-*` déjà utilisée
pour les éléments transverses du Wizard — `wiz-btn-start`, `wiz-stepper`, etc., placée à côté de
`wiz-btn-start`). `wiz1-spin-btn` et `wiz4-stepbtn` (styles + règles `:hover`/`:disabled`) supprimées
de `index.css`, remplacées par `wiz-spin-btn` dans `Step1Attributes.jsx` (2 usages) et
`CareersAllocator.jsx` (2 usages, contrôle années de carrière). Glyphe `+` ASCII de
`Step1Attributes.jsx` uniformisé en `＋`. `.wiz4-sbtn` non touché.

**Testé** : ESLint clean. `vite build` propre. Grep de confirmation : aucune référence résiduelle à
`wiz1-spin-btn`/`wiz4-stepbtn` dans le code (seulement dans le commentaire explicatif de
`index.css`). Navigateur — confirmé par Saar (testé à chaque bug avant de passer au suivant,
clarifié rétroactivement le 2026-08-12, voir mémoire `feedback_bug_suivant_means_tested`).
**Non testé** : —.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ21 : MJ renvoyé sur Récap en rejoignant Step4

**Contexte** : Saar remonte, après validation de WIZ15, qu'un MJ **rejoignant** une fiche déjà avancée
sur Step4 (Profession) est encore renvoyé vers Récap. Distinct de WIZ15 (qui corrigeait le remontage
*pendant* l'observation — `gmSyncKey`/`key` — pas le calcul du premier montage).

**Cause confirmée** : `Step4Experience.jsx` (wrapper externe) — `useState(initialData ?
SUB_STEPS.SUMMARY : SUB_STEPS.AGE)`, jamais retouché par WIZ15, ne distingue pas "joueur qui reprend
son propre brouillon" (Récap a du sens) de "MJ qui observe" (veut voir où en est réellement le
joueur).

**Recherche avant de coder** (Saar a demandé si une solution existait déjà ailleurs dans le Wizard,
et si elle valait la peine d'être harmonisée) : aucun précédent — Step4 est le seul des 5 steps à
avoir une sous-navigation, rien à harmoniser avec les autres. Mais le canal de diffusion live
existant (`onLiveChange`/`liveStep4Data`, purement éphémère, jamais persisté — déjà utilisé pour
l'âge, les carrières, etc.) est le bon point d'accroche : réutilisé plutôt qu'un nouveau mécanisme
parallèle.

**Corrigé** :
- `Step4ExperienceInner` : `subStep` (déjà reçu en prop depuis WIZ15) ajouté à l'appel `onLiveChange`
  — `onLiveChange?.({ ...buildPayload(), subStep })` — jamais dans `buildPayload()` lui-même, qui
  reste utilisé tel quel par `handleSubmit`/`onNext` (soumission serveur) : un état de navigation UI
  n'a rien à faire dans le payload persisté.
- `Step4Experience` (wrapper externe) : suit `initialData?.subStep` (le miroir live reçu), mais
  uniquement côté MJ (`gmSyncKey != null`, même signal qu'`isGmView` côté `WizardCreation.jsx`) —
  jamais côté joueur, dont la saisie locale reste prioritaire (§2.5 du plan collab, déjà la règle
  pour le reste de la diffusion live). Utilisé à la fois pour l'état initial (le flux
  `WIZARD_LIVE_UPDATE` ne rejoue rien à l'arrivée — `WizardLockSync.jsx` — donc une valeur déjà en
  store au montage doit être prise immédiatement) et pour les mises à jour suivantes.
- ESLint a rejeté un premier essai en `useEffect` + `setState` (`react-hooks/set-state-in-effect`) —
  repris avec le pattern officiel "adjusting state during render" (react.dev), déjà utilisé ailleurs
  dans le projet (`SidebarChatTab.jsx`) : comparaison à une copie précédente en state, ajustée
  pendant le rendu.

**Testé** : ESLint clean (seule erreur restante, `showSetbacks`, confirmée préexistante). `vite
build` propre. Navigateur — confirmé par Saar (clarifié rétroactivement le 2026-08-12, voir mémoire
`feedback_bug_suivant_means_tested`).
**Non testé** : —.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ22 : "Compétences professionnelles" redondant avec la grille

**Contexte** : capture d'écran de Saar (Step4 Profession, `CareersAllocator.jsx`) — carrière
"Sous-marinier" survolée (pas ajoutée) affiche son bloc "Compétences professionnelles" juste
au-dessus de la grille "Répartition des points de compétence", laquelle reflète en réalité
"Soldat/Milicien" (seule carrière réellement ajoutée). Les deux blocs peuvent donc porter sur des
métiers différents sans que rien ne le distingue à l'écran — "les deux sur un même écran n'ont aucun
sens" (Saar).

**Vérifié** : la grille elle-même est correcte — un budget de points partagé entre toutes les
carrières *ajoutées* (`boardSkillIds`, `CareersAllocator.jsx`), cohérent avec le texte RAW du
tutoriel Step4 ("chaque année d'expérience professionnelle... donne 10 points de Compétence à
répartir"). Le vrai problème est la coexistence du bloc informatif "Compétences professionnelles"
(carrière *survolée*, éventuellement non ajoutée) avec la grille (carrières *ajoutées*) — deux
échelles différentes présentées côte à côte sans distinction.

**Premier jet erroné** : bloc "Compétences professionnelles" supprimé purement et simplement,
"Compétences au choix" conservé. Repéré comme faux par Saar en test réel via capture d'écran (métier
survolé "Assassin", pas encore ajouté, aucune compétence conditionnelle) : l'écran affichait un
espace quasiment vide entre l'en-tête et la barre de navigation — l'aperçu des compétences offertes
par le métier (seule information disponible avant de cliquer "Ajouter") avait disparu, alors que
Saar avait demandé un affichage **conditionnel** ("soit... soit...", pas une suppression). Erreur de
lecture de sa demande, pas un choix technique délibéré.

**Corrigé** : bloc "Compétences professionnelles" réintégré, conditionné à `!isAdded` — visible tant
que le métier survolé n'est pas ajouté (rien d'autre ne montre ses compétences à ce stade), masqué
une fois ajouté (la grille en dessous le montre alors, en interactif, ce qui rend l'aperçu statique
redondant). "Compétences au choix" inchangé. `groupedSkills`, CSS `.wiz4-groups`/`.wiz4-chips`/
`.wiz4-chip` et clé i18n `career_skills_pro` (retirés par erreur avec le premier jet) restaurés à
l'identique.

**Testé** : ESLint clean. `vite build` propre (confirme aussi `creation.json` toujours un JSON
valide après restauration de la clé).
**Non testé** : navigateur.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ23 : agrandissement au clic de l'illustration de métier

**Contexte** : Saar demande, suite à de bons retours sur les illustrations de métier (Step4
Profession), de pouvoir cliquer dessus pour l'agrandir/rétrécir.

**Périmètre vérifié avant de coder** : l'illustration existe à 4 endroits du Wizard
(`Step0Method.jsx`, `Step2Genotype.jsx`, `Step3Mutations.jsx`, `CareersAllocator.jsx`), mais sous
deux patrons différents. Step0/Step2/Step3 utilisent l'image comme fond d'une carte **cliquable
pour sélectionner** l'option (`wiz-card`/`wiz2-card`, `onClick` déjà pris par la sélection) — y
ajouter un agrandissement entrerait en conflit avec ce clic existant. Seul `CareersAllocator.jsx`
(`wiz4-illus`) est une image autonome, non cliquable pour autre chose : la vignette du métier
survolé dans le panneau de détail, à côté du texte. Portée limitée à cet unique emplacement — les 3
autres non traités, à revoir séparément si Saar veut un affordance différente là-bas (ex. une icône
loupe séparée plutôt que le clic direct).

**Corrigé** : `CareersAllocator.jsx` — clic sur `.wiz4-illus` (vignette recadrée, `object-fit:
cover`) ouvre un overlay plein écran montrant l'illustration entière (`object-fit: contain`, jusqu'à
720px/90vw × 85vh) ; clic n'importe où dans l'overlay (fond ou image, aucun `stopPropagation`,
aucun autre élément interactif à l'intérieur) referme. Repris le patron overlay déjà existant
(`SidebarHelpModal.jsx` : fond cliquable pour fermer) plutôt qu'une nouvelle bibliothèque de modale.
`z-index: 1500` — au-dessus du contenu Wizard courant (max observé 1100), en dessous des overlays
système critiques (2000+).

**Testé** : ESLint clean. `vite build` propre. Navigateur — confirmé par Saar (clarifié
rétroactivement le 2026-08-12, voir mémoire `feedback_bug_suivant_means_tested`).
**Non testé** : —.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ24 : icône ⚠ trop petite (bug #25)

**Contexte** : `docs/BUG WIZARD.md` #25. Icône de restriction géographique (`wiz4-restr`, rail des
métiers Step4) trop petite pour être bien visible.

**Vérifié** : `.wiz4-restr` (`CareersAllocator.jsx`, seul usage) n'a pas de `font-size` propre —
hérite de `.wiz4-railmeta` (10px), la taille du texte salaire/rang environnant. Diagnostic du doc
confirmé exact.

**Corrigé** : `font-size: 13px` + `line-height: 1` ajoutés directement sur `.wiz4-restr`
(`index.css`), sans toucher `.wiz4-railmeta` ni le reste de la ligne (salaire, rang).

**Testé** : `vite build` propre (CSS pur, ESLint non pertinent). Navigateur — confirmé par Saar
(clarifié rétroactivement le 2026-08-12, voir mémoire `feedback_bug_suivant_means_tested`).
**Non testé** : —.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-11 — WIZ25 : tooltip restriction géographique sur titre + sous-titre

**Contexte** : suite à WIZ24 (icône ⚠ agrandie), Saar demande — capture d'écran à l'appui (métier
"BARMAN") — que le tooltip de restriction géographique apparaisse au survol de l'ensemble
titre+sous-titre du métier (rail gauche Step4), pas seulement l'icône elle-même, et après un délai
plutôt qu'instantanément.

**Constat** : le `title` HTML natif (posé sur `.wiz4-restr` seul) ne peut être ni élargi à une autre
zone de déclenchement, ni configuré en délai — le comportement (délai fixe contrôlé par le
navigateur, zone = l'élément exact) n'est pas ajustable. Un tooltip custom est nécessaire.

**Réutilisé plutôt que recréé** : le patron de tooltip custom existait déjà (`Step1Attributes.jsx`,
`tooltip`/`showTooltip`, positionné via `getBoundingClientRect()`, classe `.wiz1-tooltip`) — mais
sans délai (affichage instantané au `onMouseEnter`) et scoped au nom "Step1". Renommé `wiz-tooltip`
(transverse, même décision que `.wiz-spin-btn`/WIZ20 : une classe utilisée par plus d'un step change
de préfixe) et réutilisé tel quel dans `CareersAllocator.jsx`, avec l'ajout du délai qui manquait
(`setTimeout`/`clearTimeout`, 700ms, nettoyé au démontage et au `mouseleave`).

**Corrigé** :
- `index.css` : `.wiz1-tooltip` → `.wiz-tooltip` (aucun changement de style, juste le nom).
  `Step1Attributes.jsx` mis à jour en conséquence.
- `CareersAllocator.jsx` : le `title` natif retiré de `.wiz4-restr` (aurait fait doublon avec le
  tooltip custom, l'icône étant à l'intérieur de la zone de déclenchement). Bloc titre+sous-titre
  (`wiz4-railname` + `wiz4-railmeta`) enveloppé d'un conteneur portant `onMouseEnter`/`onMouseLeave`
  (posés uniquement si `restricted_geographic_origin`, sinon `undefined` — pas de handler inutile).
  700ms choisi comme délai par défaut (aucune valeur précise demandée par Saar), ajustable si le
  ressenti en usage réel ne convient pas.

**Testé** : ESLint clean. `vite build` propre. Navigateur — confirmé par Saar (clarifié
rétroactivement le 2026-08-12, voir mémoire `feedback_bug_suivant_means_tested`) ; délai 700ms non
signalé comme gênant.
**Non testé** : —.

-----
## Session (Saar) — 2026-08-12 — WIZ26 : regroupement Step5 Avantages/Désavantages (bug #28)

**Contexte** : Saar juge la page Step5 chargée, propose d'abord deux colonnes Avantages/
Désavantages, puis valide plutôt l'option catalogué en `docs/BUG WIZARD.md` #28 : regrouper par
famille.

**Vérification avant codage** : le doc suppose que `family` (`ref_advantages`) est une taxonomie
complète ("Capacités innées", "Ressources", "Relations"...). Faux — vérifié en lisant la migration
92 et `advantageConstraints.js` : `family` sert uniquement la contrainte `family_limit`
(variantes mutuellement exclusives d'un même avantage/désavantage — Phobie 5 variantes,
Déséquilibre mental 6, Allergie 3, Sens développé 5, Secret/Recherché/Infirmité 2 chacun,
quelques familles à 1 membre). La grande majorité des ~50+ items ont `family: null` et ne
rentreraient dans aucun groupe si on appliquait la solution du doc telle quelle.

**Décision (Saar, question posée)** : grouper uniquement les items qui ont une `family` réelle,
sous un bloc dédié avec en-tête + compteur "X/Y sélectionné(s)" ; le reste (majorité) garde la
grille plate actuelle, inchangée. Rejeté : refonte en deux colonnes, et fusion des deux options.

**Corrigé** :
- `Step5Advantages.jsx` : `groupByFamily(items)` sépare `ungrouped` (family null) de `families`
  (regroupées par valeur de `family`, avec `limit` = `family_limit` du premier item du groupe).
  Cartes extraites en `renderAdvCard`/`renderDisCard` (réutilisées pour la grille plate et les
  blocs famille — pas de JSX dupliqué). Nouveau `renderFamilyBlock(fam, renderCard)` : en-tête
  (nom de famille + compteur) et grille des membres du groupe.
- Compteur purement informatif — pas de blocage de sélection ajouté côté client à la limite
  atteinte (déjà appliqué côté serveur, `advantageConstraints.js`) : hors scope de ce bug, à
  traiter séparément si Saar le souhaite (constat noté, pas un correctif silencieux).
- `creation.json` : clé `step5.family_limit_counter` ("{{n}}/{{max}} sélectionné(s)").
- Noms de famille affichés bruts (contenu catalogue DB, même traitement que `adv.name`/`dis.name`
  déjà dans ce fichier — décision i18n catalogue, `LOCALISATION.md` §6).

**Testé** : ESLint clean. `vite build` propre.
**Non testé** : navigateur — rendu des blocs famille, compteur, sélection dans un groupe limité.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

**Révision (2026-08-12)** — capture d'écran réelle : le regroupement inline ne réduit pas assez le
défilement, plusieurs familles (Carte au trésor, Concession, Parts, Sens développé/diminué,
Résistance/Faiblesse naturelle augmentée, Déséquilibre mental, Phobie) sont en réalité des **paliers
d'un même avantage/désavantage** (1 PC → 5 PC, texte quasi identique), pas des variantes distinctes
à comparer côte à côte. Saar demande de vérifier si le mécanisme existe déjà ailleurs dans le Wizard
avant d'en construire un nouveau.

**Réutilisé plutôt que recréé** : `Step3Mutations.jsx` a exactement ce besoin déjà résolu —
`has_subtable`/`subtable`, une mutation-parent ouvrant une modal de choix de sous-type
(`pendingSubtype`, `handleSelectSubtype`, styles `overlay`/`modal`/`subtypeBtn`). `ref_advantages`
n'a pas cette structure explicite (juste `family`/`family_limit` sur des lignes soeurs à plat) —
dérivé côté client sans migration : un groupe de plus de 2 items = comportement "a_subtable".

**Corrigé** : seuil sur la taille du groupe.
- Familles ≤2 membres : inchangé (WIZ26 initial, `renderFamilyBlock`, cartes côte à côte).
- Familles ≥3 membres : `renderFamilySummaryCard` — une seule carte (nom de famille, coût min-max,
  palier choisi affiché une fois sélectionné) ouvre une modal (`pendingFamily`) listant les paliers,
  patron repris de Step3 (overlay + `subtypeBtn` + description). `handleSelectFamilyVariant` retire
  d'abord toute variante de la même famille déjà choisie avant d'ajouter la nouvelle (family_limit=1
  partout en données actuelles) ; re-cliquer la variante déjà choisie la retire sans rien
  sélectionner. Verrou MJ (`isLockedForPlayer`/`WizardLockToggle`) et budget PC (désactivation par
  palier, pas par carte entière — `familyRemaining` recrédite le coût du palier déjà choisi avant de
  comparer) préservés à l'intérieur de la modal, pas seulement sur la grille plate.
- `creation.json` : clés `family_selected`, `family_choose_hint`, `choose_variant`, `cancel`.

**Testé** : ESLint clean. `vite build` propre. Navigateur — confirmé fonctionnel par Saar
("Beaucoup mieux. validé et fonctionnel.").
**Non testé** : —.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

-----
## Session (Saar) — 2026-08-12 — WIZ27 : bandeau tutoriel par étape (bug #18/#27)

**Contexte** : bug #27 (tooltip génotype manquant, Step 2) renvoie vers le bug #18 (absence de
texte de tutoriel en haut de chaque étape — textes déjà rédigés par Saar, composant à créer).
Saar choisit d'implémenter le chantier complet #18 plutôt qu'un tooltip isolé sur Step 2.

**Vérifié avant codage** :
- `StepTutorial` n'existe nulle part dans le code (`grep` négatif) — le doc était à jour sur ce
  point précis.
- Le doc liste 7 fichiers d'étape (Step0 à "Step 6 — Récapitulatif") en reprenant sa propre
  numérotation. La numérotation réelle du code diverge : `WizardCreation.jsx` a un step
  supplémentaire, `StepMaterielEtBiens.jsx` (`step === 6`, "Matériel et biens"), inséré après la
  rédaction du bug #18 — le Récapitulatif du doc correspond en réalité à `step === 7`
  (`WizardReview.jsx`). Aucun texte de tutoriel n'existe pour ce step 6, absent du périmètre
  d'origine du bug.
- Le doc prévoit des fichiers séparés `creation.fr.json`/`creation.en.json` avec synchronisation
  anglaise. Le projet n'a qu'un seul fichier `creation.json` (contenu français direct) — l'anglais
  est gelé (`i18n.md`, décision `LOCALISATION.md` §6, session antérieure). Suivi la convention
  réelle, pas celle du doc.
- Un badge d'info existe déjà par étape (`wizard.info_stepN`, dans l'en-tête `WizardHeader`) —
  vérifié : un simple libellé de quelques mots ("Type génétique"), pas le paragraphe explicatif
  demandé. Aucun chevauchement fonctionnel, les deux coexistent à des emplacements différents.

**Corrigé** :
- `StepTutorial.jsx` (nouveau) : lit `stepN.tutorial` (namespace `creation`), ne rend rien si la
  clé est absente (`defaultValue: ''`) — pas de fallback moche affiché à l'écran pour un step sans
  texte. Un seul point d'intégration dans `WizardCreation.jsx` (branche `step === 0` avant
  `Step0Method`, et une fois avant `<div style={st.body}>` pour tous les autres steps) plutôt que
  dans chacun des 7 composants d'étape comme le suggérait le doc — élimine la duplication de
  markup, et couvre naturellement les sous-étapes de `Step4Experience.jsx` (le tutoriel reste
  affiché puisqu'il vit au niveau du parent, pas remonté/redémonté par la navigation interne du
  step).
- `index.css` : `.wiz-tutorial`/`.wiz-tutorial-icon`/`.wiz-tutorial-text`, même patron que
  `.wiz-error` (bordure gauche 3px, fond légèrement teinté) en bleu-gris plutôt que rouge, icône
  ℹ️.
- `creation.json` : clés `step0.tutorial`, `step1.tutorial` … `step5.tutorial`, `step7.tutorial`
  (textes de Saar repris tels quels). `step6.tutorial` volontairement absent — Matériel et biens
  n'a pas encore de texte.

**Testé** : ESLint clean. `vite build` propre. JSON valide.
**Non testé** : navigateur — affichage sur les 6 steps couverts, absence de bandeau sur Step 6.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

-----
## Session (Saar) — 2026-08-12 — Rôle administrateur, page /admin, gestion des utilisateurs

**Contexte** : parti d'une demande de système de ticket de bug côté joueurs/MJ, recentré par Saar sur
la fondation manquante — aucun rôle admin global n'existait (seul `campaign_members.role` par
campagne). Conception dans `docs/PLANS/PLAN_ADMIN.md` (méthodologie `METHODO_PLAN.md`), 3 lots validés
un par un, plusieurs erreurs réelles trouvées et corrigées en cours de route plutôt qu'après coup :
gate initial de `equipment.js` qui aurait cassé l'inventaire de tout joueur (corrigé avant code),
bootstrap par migration invalide pour une valeur différente par instance (remplacé par
`ADMIN_BOOTSTRAP_EMAIL`), `equipment-admin.html` gaté côté API seulement alors que la page elle-même
restait publique (déplacée hors de `server/public/`), test de migration qui aurait avorté sa propre
transaction Postgres, garde "dernier admin" recadrée après recherche (better-auth#3651) pour être un
invariant général plutôt qu'un cas particulier d'auto-rétrogradation.

**Construit** :
- **Lot 1** — `users.role`/`role_granted_by`/`role_granted_at` + contrainte `CHECK`
  (`240_users_role.js`), `bootstrapAdmin.js` (promotion idempotente par variable d'environnement au
  démarrage), `requireAdmin.js` (fail-closed, relit toujours la base, jamais le JWT).
- **Lot 2** — `requireAdmin` sur les 3 routes de mutation d'`equipment.js` (GET gameplay intacts) et
  sur `health.js`. Page `/admin` (`AdminPage.jsx`), `AdminRoute` côté client. `equipment-admin.html`
  déplacé/renommé (`server/src/admin/ref-equipment-tool.html`), servi par une route authentifiée
  (`routes/adminTools.js`) au lieu d'`express.static` sans garde.
- **Lot 3** — `adminUserService.js` (liste + `changeUserRole` avec garde dernier admin),
  `routes/adminUsers.js`, `AdminUsersPage.jsx` (confirmation avant tout changement de rôle).
- **Hors plan, ajouté en cours de session** : `MePage.jsx` (`/me`) — profil self-service complet
  (username/email/couleur/mot de passe), manquant pour permettre à un admin bootstrap de changer son
  mot de passe temporaire ; lien depuis le nom de compte du Dashboard.
- Documentation durable transférée vers `docs/SYSTEME/ADMIN.md` (Règle 10) ; `PLAN_ADMIN.md` gardé
  pour son détail de conception, pas encore archivé (instance distante non testée).

**Testé** : 10 tests automatisés (`bootstrapAdmin.test.mjs`, `adminUserService.test.mjs`) exécutés
pour de vrai contre PostgreSQL local (Docker, actif sur ce poste), 10/10 verts, y compris la garde
dernier admin réellement déclenchée. `eslint`/`vite build` propres à chaque lot. Confirmé par Saar en
navigateur sur l'instance locale : bootstrap (compte promu en base), bouton "Administration" visible,
chaque tuile de `/admin` (Santé, Dice, BDD, Utilisateurs), changement de mot de passe via `/me`.
**Non testé** ⚠️ : instance distante — rien committé/poussé à ce stade, donc pas encore atteignable.
**Données** : migration `240_users_role.js`, appliquée (auto, nodemon) sur l'instance locale
uniquement.
**Retour arrière** : rien committé sur ce chantier — fichiers listés ci-dessus encore dans le
worktree local, aux côtés de modifications non liées d'autres sessions en cours (Wizard). `git diff`
ciblé sur les fichiers cités si besoin, jamais un `git checkout .` global.

-----
## Session (Saar) — 2026-08-12 — Système de tickets (Lots 1-2) + fusion BUGIDENTIFIE.md

**Contexte** : demande initiale du tout premier échange de la journée (interface de ticket de bug
joueur/GM), mise en pause le temps de construire la fondation admin (session précédente ci-dessus),
reprise une fois `docs/SYSTEME/ADMIN.md` disponible. Conception dans `docs/PLANS/PLAN_TICKETS.md`
(archivé), recherche externe citée avant codage : bonnes pratiques de formulaire de bug report
(priorité/sévérité posées par l'équipe, jamais par le rapporteur), GitHub Issues (labels texte libres
plutôt que colonnes figées — a directement simplifié le design du regroupement), FreeScout
(`app/Conversation.php` réel, patron `closed_by_user_id`/`closed_at` — confirme le patron
`reviewed_by`/`reviewed_at` déjà utilisé côté Enclume). En cours de conception, Saar demande la fusion
complète avec l'ancien `docs/BUGIDENTIFIE.md` — actée mais découpée en Lot 2 séparé plutôt que codée
d'un coup avec le formulaire de base, le temps de vérifier l'impact réel (méthode de triage utilisée
par Claude pendant le code, ligne d'autorité `EN_COURS.md`).

**Construit** :
- **Lot 1** — table `bug_tickets` (migration `241_bug_tickets.js`, 4 `CHECK`, patron
  `vault_transfer_requests`), `ticketService.js` (`createTicket` avec `origin` calculé serveur —
  admin > MJ membre de campagne > joueur, jamais déclaré par le client — `listTickets`/
  `listTicketsForReporter`, `updateTicket` avec provenance `reviewed_by`/`reviewed_at`), routes
  `POST /api/tickets`, `GET /api/tickets/mine`, `GET`/`PATCH /api/admin/tickets`. Client :
  `ReportTicketPage.jsx` (`/tickets/new`, formulaire minimal — ni priorité ni sévérité, posées par
  l'admin au triage), `AdminTicketsPage.jsx` (`/admin/tickets`, liste groupée par origine, filtres,
  édition inline du `cluster_label` en texte libre), tuile "Tickets" activée sur `/admin`, lien
  "Signaler un problème" dans le footer du Changelog, namespace i18n dédié `tickets.json`.
- **Lot 2** — `server/src/scripts/importBugIdentifie.js` : transcription manuelle (pas un parseur
  markdown — le fichier source mélange 3 formats différents) du contenu de l'ancien
  `docs/BUGIDENTIFIE.md` (sections Clusters/Détail + table BETA), 45 tickets créés, `origin='admin'`,
  `linked_bug_code` posé à l'identifiant d'origine. Deux entrées BETA (#18, #22) exclues — le fichier
  source les déclarait lui-même résolues dans ses propres notes de fin. Deux divergences réelles
  trouvées entre `EN_COURS.md` et `BUGIDENTIFIE.md` pendant la transcription (cluster UI2/UI3 ;
  CS4/CS5/COM20/COM21 absents du registre `BUGIDENTIFIE.md`) — documentées dans les `admin_notes`
  des tickets concernés et dans le script, pas corrigées silencieusement. `docs/EN_COURS.md` nettoyé
  des 14 dettes désormais suivies en base (avec enrichissement de 4 tickets dont la description
  `EN_COURS.md` était plus complète que celle de `BUGIDENTIFIE.md` avant suppression de la ligne, pour
  ne pas perdre l'information). `docs/Old/BUGIDENTIFIE.md` archivé (bandeau de redirection).
- Documentation durable : `docs/SYSTEME/TICKETS.md` (architecture, invariants, méthodologie de
  triage reprise de l'ancien `BUGIDENTIFIE.md`), `docs/VOCABULARY.md` (+Ticket, +Cluster (ticket)),
  `docs/SYSTEME/INDEX.md` mis à jour. `docs/Old/PLAN_TICKETS.md` archivé.

**Testé** : migration 241 — 5/5 tests (colonnes, insert valide, `down`, les 4 `CHECK`) contre
PostgreSQL local réel. `ticketService.js` — 11/11 tests contre la base locale réelle (origine
calculée correctement selon des lignes `users`/`campaign_members` réellement insérées, filtres,
provenance, rejets 400/404). `eslint`/`vite build` propres (2 erreurs trouvées et corrigées en cours
de route : variable inutilisée, `setState` synchrone dans un effet — remplacé par le patron `key`
recommandé par React plutôt qu'un effet de resynchronisation). Script d'import exécuté pour de vrai
contre la base locale (45 tickets créés, comptages vérifiés par requête directe). Confirmé par Saar en
navigateur sur l'instance locale : signalement joueur (auto-signalé un ticket de test), écran
`/admin/tickets` fonctionnel, import visible.
**Non testé** ⚠️ : instance distante — rien poussé à ce stade. CLI terminal pour créer des tickets
sans navigateur (hors périmètre Lot 2, le script d'import à usage unique a suffi pour la bascule).
**Données** : migrations `241_bug_tickets.js` (appliquée, auto nodemon, instance locale), import de
45 lignes `bug_tickets` via `importBugIdentifie.js` (exécuté une fois, script conservé pour
traçabilité).
**Retour arrière** : rien committé sur ce chantier au moment de la rédaction de cette entrée — voir
commit qui suit immédiatement dans l'historique pour le détail exact des fichiers.

-----
## Session (Saar) — 2026-08-12 — WIZ28 : prérequis de carrière invisibles (bug #29)

**Contexte** : capture d'écran de Saar (`CareersAllocator.jsx`, Step4 Profession) — le filtre
"Accessibles" (actif par défaut) masque simplement les métiers dont le prérequis n'est pas rempli
(ex. années dans un autre métier). Saar demande explicitement une recherche UX avant de coder :
faut-il cacher, ou tout afficher avec une indication visuelle ?

**Recherche menée (WebSearch)** : consensus net dans les patrons de talent tree/skill tree
professionnels (Path of Exile, WoW, XCOM) — toujours tout afficher (cacher retire une info de
planification utile au joueur), grisé + tooltip expliquant le prérequis manquant au survol, jamais
de rouge (réservé aux erreurs/blocages urgents, pas à "pas encore accessible").

**Vérifié avant de coder** : toute la mécanique d'éligibilité existait déjà côté client —
`evaluateCareerEligibility` (`shared/careerEligibility.js`, fonction pure déjà partagée
client/serveur) calculée pour chaque carrière dans `eligibilityById` (`CareersAllocator.jsx`), déjà
utilisée pour griser le bouton "Ajouter" et afficher la raison dans le panneau de détail. Le filtre
"Accessibles" utilisait déjà ce même calcul pour cacher les lignes. **Rien à construire côté
logique métier — uniquement une lacune d'affichage sur le rail gauche.**

**Corrigé** :
- Filtre par défaut : `'eligible'` → `'all'` (`initialReducerState`).
- Ligne du rail : nouvelle classe `.wiz4-railrow.ineligible` (`opacity: .5`), posée quand la carrière
  n'est ni ajoutée ni éligible.
- Icône ⚠ + tooltip : fusionnés avec l'avertissement géographique existant (WIZ25) dans la même zone
  de survol plutôt que d'empiler deux icônes sur une ligne déjà dense — `warningDetails` concatène
  la raison d'inéligibilité (`formatReason`, déjà utilisé ailleurs dans ce fichier) et le détail
  géographique s'ils s'appliquent tous les deux.
- Un métier déjà ajouté (`added`) n'est jamais grisé même s'il redevient inéligible entre-temps
  (ex. la carrière prérequise est retirée après coup) — éviter la contradiction visuelle avec le
  badge "✓ Retenu".

**Testé** : ESLint clean. `vite build` propre. Navigateur — confirmé par Saar ("Parfait. validé.").
**Non testé** : —.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

-----
## Session (Saar) — 2026-08-12 — WIZ29 : tirage 1D10 semble coûter des points de Compétence (bug #11)

**Contexte** : `docs/BUG WIZARD.md` #11, déjà analysé en amont — le tirage 1D10 d'avantages
professionnels (Step4, sous-étape Avantages & Revers) retire 5 points du budget "Avantages
professionnels" de la tranche de 5 ans concernée, jamais des points de Compétence. Mécanique
conforme RAW (`computeRandomBudgetDelta`, `shared/careerAdvantages.js`) — le bug était uniquement
une confusion d'affichage, jamais un problème de calcul.

**Vérifié avant de coder** : le bloc "Tirage 1D10 (optionnel)" (`ProAdvantagesAndSetbacks.jsx`) est
rendu juste en dessous du bloc "Avantages professionnels" avec son compteur "pt(s) à répartir",
mais rien dans le texte ne relie explicitement les deux — un joueur voit son solde baisser après un
tirage sans qu'aucun libellé ne dise dans quel budget.

**Corrigé** : note `wiz4-note` ajoutée sous le titre "Tirage 1D10 (optionnel)" — précise
explicitement que le tirage retire 5 points du budget Avantages professionnels affiché juste
au-dessus, jamais des points de Compétence. Clé i18n `step4.career_random_note`. Aucun changement
de logique — correctif de clarté uniquement, comme demandé par l'analyse du doc.

**Rappel à l'ordre de Saar** : ce bug a été choisi et codé sans présentation ni autorisation
préalable ("bug suivant" pris à tort comme blanc-seing pour choisir et coder le suivant sans
validation). Reconnu explicitement — plus aucun bug ne sera codé sans présentation + feu vert
explicite, quelle que soit sa taille apparente.

**Analyse à charge demandée par Saar avant clôture** : la note affirmait "retire 5 points"
inconditionnellement — faux pour un métier sans catégorie de points (`categories.length === 0` →
`budget = 0` inconditionnel, `careerAdvantages.js:14-18`, tirage purement narratif dans ce cas).
Vérifié en base réelle (script Knex ad hoc, pas supposé) : **zéro carrière n'a actuellement de
catégories vides** — Chasseur de primes était le seul cas, une véritable faute de données déjà
corrigée par la migration `186_fix_chasseur_primes_data.js` (une migration antérieure, 120, avait
affirmé à tort l'absence RAW d'avantages professionnels pour ce métier ; RAW réel : "5 points/an :
Célébrité, Relations, Matériel"). Conclusion : la branche `budget=0` du code est un garde-fou
défensif contre une erreur de données déjà survenue, pas une mécanique RAW active — ajouter une
condition dans la note serait de la complexité pour un état qui n'a plus d'instance réelle. Note
conservée inconditionnelle. Risque résiduel assumé et documenté : le "5" est en dur dans le texte
(pas lu depuis la constante du code), mais cohérent avec le patron déjà en place sur la clé voisine
`career_random_block` ("5 ans" également en dur).

**Testé** : ESLint clean. `vite build` propre. JSON valide. Navigateur — confirmé par Saar
("Parfait.") après relecture à charge du correctif (stabilité, absence de bricolage, sérieux
architectural).
**Non testé** : —.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

-----
## Session (Saar) — 2026-08-12 — Triage `bug_tickets` : recoupement contre `docs/BUG WIZARD.md`/`EN_COURS.md`, clôtures WIZ6/WIZ27

**Contexte** : à la demande de Saar, revue des 46 tickets de `bug_tickets` (import initial
`BUGIDENTIFIE.md` + tickets `BETA-*` du round de beta-test Wizard) pour repérer ceux déjà corrigés
sans que le statut en base le reflète — Saar se souvenait que « un certain nombre » l'étaient déjà.

**Constat** : recoupement systématique code lié (`linked_bug_code`) ↔ `docs/BUG WIZARD.md` (table de
statuts) ↔ `docs/EN_COURS.md` (dettes actives). Trouvé :
- 3 tickets `resolved` en base alors que le correctif associé était encore marqué « non testé
  navigateur » dans les deux docs : **BETA-1** (#18 tooltips → `EN_COURS.md` WIZ27), **BETA-13** (#9
  points déjà investis, même cause racine que WIZ6), **BETA-17** (#11 note tirage 1D10 → WIZ29, déjà
  retiré de la table entre-temps, état antérieur non revérifié).
- **BETA-20** (#30 wishlist matériel) marqué `resolved` alors que le chantier était encore non
  committé dans ce worktree au moment du contrôle.
- **BETA-34** (module arme disparu) marqué `resolved` avec un `admin_notes` interne demandant
  explicitement confirmation, jamais levée depuis l'import.
- **BETA-32** (implants, #32) marqué `new` alors que déjà analysé et explicitement écarté par Saar
  (« chantier à part, pas traité maintenant », `docs/BUG WIZARD.md` #32) — mauvaise classification,
  pas un oubli de triage : `new` implique non-trié, alors que la décision existait déjà.

**Décisions Saar** :
- BETA-1/13/17/20/34 : confirmés testés en navigateur par Saar → restent `resolved` en base, aucune
  écriture nécessaire.
- BETA-32 : basculé `suspended` — appliqué via `ticketService.updateTicket()` (script Node ad hoc,
  attribué au compte admin de Saar pour poser `reviewed_by`/`reviewed_at` normalement, pas de
  `UPDATE` SQL brut hors service).
- `docs/EN_COURS.md` WIZ6/WIZ27 : passés en ✅ Résolu — **ligne conservée, pas de retrait** : écart
  volontaire à la discipline habituelle du fichier (§ en-tête, clôture confirmée = retrait +
  compte-rendu ici) sur demande explicite de Saar pour cette fois précise.

**Testé** : `getTicketCounts()` (nouvelle fonction, cf. session ticket UI) vérifié contre la base
réelle (46 tickets, arithmétique cohérente : 34 ouverts/12 clos avant l'ajustement BETA-32). La
validation navigateur des 5 tickets BETA-1/13/17/20/34 est actée par la confirmation explicite de
Saar en conversation — pas rejouée par l'agent.
**Non testé** : les ~30 tickets restants (`triaged`/`suspended`, clusters A-T non liés au Wizard)
n'ont pas été recoupés un par un dans cette passe — seuls les tickets `BETA-*` l'ont été.
**Données** : un `UPDATE` en base (BETA-32 → `suspended`, via le service applicatif).
**Retour arrière** : `docs/EN_COURS.md`/`docs/JOURNAL8.md` — commit isolé, `git revert` suffit.

-----
## Session (Saar) — 2026-08-12 — SCHEMADRIFT-EXOTEMPLATES1 : migration 233 réparée + angle mort des tests de migration fermé

**Contexte** : premier ticket traité du tri (Tier 1 — fondations). `ref_exo_templates` (233_exo_sheet.js,
`docs/PLANS/PLAN_EXOARMURE.md`) avait été édité le 2026-08-06 pour ajouter 8 colonnes/2 contraintes
(mode de déplacement, `speeds_extra`, descriptif/commerce), sous l'hypothèse "pas encore appliquée"
(§7.5 du plan). Faux : `knex_migrations` la datait de 09:50:27 le même jour, avant l'édition.

**Consigne explicite de Saar avant de coder** : « on vérifie », rigueur maximale, sûr à 100 % —
aucun correctif accepté sur la base d'une simple relecture.

**Vérifié (pas supposé), dans l'ordre** :
1. `\d ref_exo_templates` en base réelle confirme l'absence exacte des 8 colonnes/2 contraintes
   décrites dans le fichier — dérive réelle, pas une hypothèse.
2. `exo_sheet` (même migration) : aucune dérive, conforme au fichier.
3. `ref_exo_templates`/`exo_sheet` : 0 ligne, aucun personnage `type='exo'` — correctif purement
   additif, zéro donnée en jeu.
4. Rejeu de la chaîne complète (206 migrations) sur une base neuve jetable (`vtt_schema_check`,
   supprimée après usage) : succès — confirme que restaurer 233 + ajouter une migration 243 ne casse
   rien pour un environnement neuf.
5. `git log` : `233_exo_sheet.js` committé une seule fois (`66f4219`), déjà poussé sur
   `origin/dev/Saar`. Seul développeur actif (`CLAUDE.md` §3) → aucun risque qu'un autre clone ait
   tourné sur une version intermédiaire. Retoucher le fichier ajoute un commit correctif normal, pas
   une réécriture d'historique partagé.
6. Exécution réelle de `233_exo_sheet.test.mjs` contre la base : passait (✔) sans rien vérifier — le
   test commence par `if (await db.schema.hasTable('exo_sheet')) return`, un faux vert dès que la
   migration a déjà tourné (le cas normal en dev, nodemon l'applique à l'écriture du fichier). Ce
   même patron `alreadyApplied` existe dans **9 fichiers** de test de migration du projet — angle
   mort structurel, pas un accident isolé sur 233.
7. Diff colonne par colonne des 8 autres migrations testées par ce patron (154, 155, 221, 223, 234,
   240, 241, 242) contre le schéma réel : **aucune autre dérive trouvée**. Seule `ref_exo_templates`
   était affectée.

**Corrigé** :
- `233_exo_sheet.js` restauré à son contenu réellement exécuté le 2026-08-06 (retrait des 8
  colonnes/2 contraintes) — `down()` inchangé (dropTableIfExists, déjà cohérent). En-tête du fichier
  documente la restauration et pointe vers 243.
- `243_ref_exo_templates_movement_and_commerce.js` (nouvelle migration) : porte pour de bon les 8
  colonnes/2 contraintes, avec les commentaires RAW déplacés depuis 233 (raisonnement mouvement
  pilot/blocked/speeds_extra, descriptif/commerce).
- `server/src/db/migrations/testHelpers/schemaAssertions.mjs` (nouveau, sous-dossier — un helper posé
  directement dans `migrations/` casse `knex migrate:latest`, `NaturalMigrationSource` traite tout
  `.js`/`.mjs` du dossier comme candidat migration sauf `*.test.mjs`) : 3 fonctions
  (`assertTableExists`/`assertColumnsExist`/`assertConstraintExists`) qui lisent l'état réel de la
  base sans passer par `up()`/`down()`.
- **Les 9 fichiers de test existants + le nouveau test de 243** reçoivent chacun un test
  supplémentaire, gardé seulement par `!DATABASE_URL` (jamais par `alreadyApplied`) — c'est ce test
  qui aurait détecté la dérive dès le 2026-08-06 au lieu du 2026-08-12. Les listes de colonnes
  dupliquées dans les tests transactionnels existants sont remplacées par des constantes partagées
  (une seule source par fichier).
- `docs/PLANS/PLAN_EXOARMURE.md` §7.5 : référence `243_...` au lieu de « 233 éditée ».
- Ticket `SCHEMADRIFT-EXOTEMPLATES1` → `resolved` (`ticketService.updateTicket`, attribué au compte
  admin de Saar).

**Testé** : `node --check` sur les 13 fichiers touchés/créés. Migration 243 appliquée en base réelle
(nodemon, confirmé par `knex_migrations` et `\d ref_exo_templates`). Suite de tests migrations complète
rejouée contre la base réelle : **30/30 verts**, y compris les 10 nouvelles assertions de schéma
inconditionnelles (chacune a réellement interrogé la base, pas de skip). Suite serveur complète :
**244/244 verts**, aucune régression. Rejeu intégral depuis une base neuve (207 migrations, 233
restauré + 243) : `\d ref_exo_templates` diffé et identique octet-pour-octet contre la base réelle.
**Non testé** : scénario réel navigateur — sans objet ici (0 ligne en jeu, aucun écran ne lit encore
`ref_exo_templates`, chantier Exo-armures toujours au Lot 1/2 bloqué).
**Données** : migration 243 (additive, `down()` fourni, aucune ligne existante affectée — table vide).
**Retour arrière** : `down()` de 243 supprime proprement les 8 colonnes/2 contraintes. Reste un commit
isolé sur `dev/Saar`, `git revert` suffit.
BETA-32 rebasculable via `/admin/tickets` si besoin.

-----
## Session (Saar) — 2026-08-12 — Jauges de Matériel (`GAUGES-MATERIEL`) : 3 bugs bloquants trouvés et corrigés en validation navigateur, chantier confirmé fonctionnel

**Contexte** : `docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md` codé de bout en bout par une session
précédente (migration 242, routes, store, `GaugesPanel.jsx`), committé mais explicitement marqué
« non testé en navigateur » dans son propre message de commit. Premier test réel par Saar : « ça ne
fonctionne juste pas » — aucun menu de création d'objet côté joueur, aucune jauge affichée. Diagnostic
mené par lecture de code + requêtes SQL directes contre la base réelle (jamais de correctif sur une
simple hypothèse), en plusieurs passes au fil des retours de Saar.

**Bug 1 — joueur sans aucun droit sur sa propre fiche (`isOwner` toujours faux)** :
`StepMaterielEtBiens.jsx` calcule `canEdit = isGmView || isOwner`. `isOwner` (`WizardCreation.jsx`)
dépend de `ownerUserId`, jamais posé par `startCreation` (flux normal Step0 → "Suivant", utilisé par
tout joueur créant/reprenant son propre personnage) — seul `loadExistingSheet` (MJ qui consulte, lien
de reprise direct) le renseignait. Même angle mort que le bug MJ déjà corrigé avant (`isGm` ajouté à
la réponse `/start`, commentaire déjà présent dans `routes/creation.js`), jamais fait côté joueur.
Corrigé : `routes/creation.js` (`/start`) renvoie `ownerUserId` ; `creationStore.js#startCreation`
l'applique au store. Vérifié sans risque de régression WIZ13 (`resetCreation()` si `ownerUserId !==
user.id`) : `targetUserId` (MJ démarrant pour un joueur ciblé) n'est envoyé par aucun code client
existant, `ownerUserId` vaut donc toujours l'utilisateur courant sur ce chemin.

**Bug 2 — jauges jamais semées pour un personnage repris avec carrières déjà choisies** :
`Step4Experience.jsx#computeInitialSubStep` (correctif du même chantier, cf. entrée précédente sur le
Step4) atterrissait sur Récap dès que `careers.length > 0`, sans jamais passer par "Avantages &
Revers" — exclusion volontaire à l'origine (état conditionnel, aucun champ persisté "visité"). Un
personnage repris avec une carrière déjà enregistrée ne pouvait donc plus jamais choisir de
Pro-Avantage "Matériel", confirmé en base (carrière avec `pro_advantages: {}`, aucune ligne
`char_gauges`). Corrigé, avec l'accord explicite de Saar (revient sur l'exclusion initiale) :
heuristique ajoutée — si aucune carrière ne porte de Pro-Avantage choisi ET qu'aucun tirage de Revers
n'existe, renvoie sur "Avantages & Revers" au lieu de Récap. Cas limite assumé et documenté en
commentaire : une carrière qui n'offre réellement aucun Pro-Avantage y sera revisitée sans rien à
cocher — jamais un plantage, juste une repasse mineure.

**Bug 3 (mineur, UX)** : bouton "Ajouter" (`InventoryPanel.jsx`) stylé comme un lien fantôme (fond
transparent, texte gris 11px, en bas de panneau) — invisible en pratique ("je ne l'avais pas du tout
vu"). Passé en `className="btn btn-gold"` (même style que "Suivant" en Step6, standard du projet pour
une action principale, `react.md`).

**Confirmé par Saar en navigateur** après les 3 correctifs : joueur peut ajouter du matériel à sa
wishlist, MJ peut valider/ajuster.

**Testé** : `node --check` (fichiers serveur), `eslint` (fichiers client, propre — hors une erreur
préexistante non liée sur `Step4Experience.jsx#showSetbacks`), `creationRoundTrip.test.mjs` rejoué à
chaque étape (toujours vert), requêtes SQL directes contre la base réelle pour confirmer chaque
diagnostic avant de coder (jamais une hypothèse non instrumentée). Validation fonctionnelle complète
confirmée par Saar en navigateur (création joueur, ajout d'objet, jauge Matériel semée et visible,
+/- MJ).
**Non testé** : le +/- MJ sur une jauge n'a pas été explicitement rejoué par Saar dans son message de
confirmation (code déjà vérifié correct, gated `isGm`, mais pas de clic confirmé) ; `GaugesPanel.jsx`
côté fiche permanente (onglet Matériel hors Wizard) non mentionné dans le test de Saar, seul le
parcours Wizard Step6 est confirmé.
**Données** : aucune migration. Le personnage de test (JeanMi, déjà utilisé pour d'autres bugs cette
session) garde sa carrière à `pro_advantages: {}` en base — sera corrigé de lui-même la prochaine fois
qu'il repasse par Step4 (atterrira maintenant sur Avantages & Revers).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit — aucun changement de schéma.

`docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md` : statut mis à jour (validé fonctionnel), pas archivé —
« stable en jeu réel » (condition du document pour archivage/fusion DOMAIN, `RegleDocumentaire.md`
Règle 10) suppose un usage réel en partie, pas seulement cette validation de développement.

-----

## Session (Saar) — 2026-08-16 — Jauges de Matériel (`GAUGES-MATERIEL`) : clôture des deux derniers points non testés

**Contexte** : les deux réserves laissées ouvertes par la validation du 2026-08-12 (stepper +/- MJ
sur une jauge, `GaugesPanel.jsx` côté fiche permanente hors Wizard) n'avaient encore jamais été
rejouées explicitement par Saar.

**Fait avant validation** : audit du code réel (pas du journal) contre chaque section du plan
(migration 242, routes `char-sheet.js`, `creationService.js`, `characterStore.js`, `gaugesDataSync.js`/
`useGaugesData.js`/`gaugesMutations.js`, handlers `GAUGE_UPDATED` dans `useCharacterSocket.js` ET
`useWizardInventorySync.js`, `isOwner`/`canEdit`/`pendingCount`, insertion `GaugesPanel.jsx` dans
`CharacterWindow.jsx`, clés i18n) — aucun écart trouvé avec `PLAN_WIZARD_MATERIEL_GAUGES.md`, rien à
coder.

**Testé** : les deux scénarios restants confirmés par Saar en navigateur — stepper +/- MJ sur une
jauge (Wizard Step6) et `GaugesPanel.jsx` fiche permanente (onglet Matériel).
**Non testé** : usage réel en partie (aucun scénario bloquant identifié — décision explicite de Saar
de clore et archiver sur la base de cette validation de développement, sans attendre un usage en
partie réelle).
**Données** : aucune migration, aucun changement de code.
**Retour arrière** : sans objet (documentation uniquement).

**Clôture (même jour)** : `docs/PLANS/PLAN_WIZARD_MATERIEL_GAUGES.md` archivé vers `docs/Old/` sur
demande explicite de Saar (`docs/RegleDocumentaire.md` Règle 10). Contenu durable transféré dans
`docs/SYSTEME/CHARACTER.md` (schéma `char_gauges`/`validated_by_gm`, routes `.../gauges`, flux
store/socket, `GaugesPanel.jsx`, pièges PC23/PC24) et `docs/SYSTEME/ARCHITECTURE_SOCKET.md`
(`GAUGE_UPDATED`, `SOLS_UPDATED` ajouté au passage — même hook `useCharacterSocket.js`, absent de la
liste par oubli antérieur, sans rapport avec ce chantier).

-----

## Session (Saar) — 2026-08-13 — PLAN_COMBATANT_CONTEXT Lots A-F : point de couture unique du contexte de Test combat

**Contexte** : `EXOARM-COMBATFILE` bloquait `PLAN_EXOARMURE.md` Lot 2 — `socketCombatHelpers.js`
recalculait la chaîne attrs/archetype/charSkill/refSkill/wounds/inventory/mutationEffects →
`calcSkillTotal`/`calcAttributeNA`/`calcActiveMalus` séparément à 7 endroits, aucun point d'entrée
unique pour brancher un pilote d'exo-armure. `docs/PLANS/PLAN_COMBATANT_CONTEXT.md` (2026-08-06)
prévoyait 7 lots (A-G) : construire `combatantContextService.js`, migrer les 7 sites un par un, puis
seulement au Lot G ajouter la branche `exo`.

**Lot A** — `server/src/lib/combatantContextService.js` (`resolveHumanoidTestContext`) créé, extrait
du site attaquant CaC (le plus complet des 7). Branché en mode Scientist (`[DBG-DECOUPLAGE]`,
patron déjà en place `PLAN_RW_SYSCOMBAT.md` §2.3) en parallèle du chemin inline, jamais consommé.
9 tests unitaires (fixture DB réelle) : skill trouvée/absente/inconnue, mains nues, mastery,
génotype, mutation (2 gaps de couverture fermés en cours de route — la branche génotype/mutation
n'était testée par aucun code du projet avant ce lot), blessure, encombrement.

**Lot B** — Site attaquant CaC branché, chemin inline retiré, **seulement après confirmation par
Saar** que le dispositif Scientist n'avait déclenché aucun `[DBG-DECOUPLAGE]` sur 3 combats CaC réels
(dont un à modificateurs cumulés multi-adversaires + deux-armes). Analyse à charge post-lot : un
`ctx`/`ctxAcrobatie` pouvait théoriquement être `null` (fenêtre de concurrence entre le garde initial
et le fetch interne du service) sans garde — corrigé avant qu'un vrai incident ne le révèle.

**Lot C** — Défenseur CaC. Le plan groupait le site #1 (`isTargetDefenseless`) avec le site #3
(défenseur) par proximité thématique — vérifié en lisant le code : `isTargetDefenseless` n'appelle
jamais `calcSkillTotal`, rien à refactorer, retiré du lot. À l'inverse, `grep calcSkillTotal(` a
révélé 2 duplicatas invisibles à l'audit initial du plan (basé sur un grep `char_sheet`, qui ne voit
pas un site réutilisant un `char_sheet_id` déjà résolu) : `resolveMeleeDefensePnj` et
`confirmMeleeDefense` recalculaient chacun la Compétence Acrobatie/Équilibre pour le terrain
instable. Périmètre élargi à 3 sites après validation explicite de Saar. Garde `null` posée dès
l'écriture cette fois (leçon du Lot B).

**Lot D** — Tireur (`resolveAssaultAction`). Un `grep` plus large (`char_attributes`/`char_archetype`/
`ref_genotypes`/`getMutationEffects` sur tout le fichier) n'a cette fois trouvé aucun duplicata caché
— site #6 confirmé isolé. Nuance réelle trouvée avant codage : le tireur n'a pas d'équivalent "mains
nues" — si `ref_equipment_skill_assoc` ne trouve pas l'arme (trou de catalogue réel), l'ancien code
calculait quand même `effectiveMalus`/`for_na`. Passer `skillId=null` aurait routé vers le palier "NA
seul" (pensé pour les cibles passives) et perdu ces champs pour un tireur actif — évité en passant
`''` (force le palier complet, comportement verrouillé par un test unitaire renforcé). Confirmé en
jeu réel (2 tirs, PNJ et PJ, aucune erreur).

**Lot E** — Investigué, aucun changement dans `socketCombatHelpers.js`. Les 3 sites que le plan
assignait à ce lot (#4/#5/#7, cibles Tir/Drone) étaient **déjà** unifiés via
`damageService.fetchCibleNA`, extrait le 2026-07-30 dans un chantier antérieur
(`PLAN_FATIGUE_DOMMAGES.md` §9) — jamais recroisé par l'audit initial du plan (créé le 2026-08-06).
En creusant, découvert que le palier "NA seul" de `combatantContextService.js` (écrit au Lot A,
jamais exercé par aucun site réel jusque-là) réimplémentait ce même calcul sans le savoir — corrigé
avant que ce lot n'en fasse le premier vrai appelant : délègue désormais à `fetchCibleNA`.

**Lot F** — Nettoyage. `grep` de contrôle confirmant les 7 fetchs `char_sheet` restants sont tous
légitimes (garde locale ou alimentation exclusive de `resolveHumanoidTestContext`/`fetchCibleNA`,
plus aucune réimplémentation inline). Imports morts retirés (`calcSkillTotal`/`calcAttributeNA`/
`getModDom`/`calcActiveMalus`/`getMutationEffects`/`calcDroneRD` — `calcDroneDegatsNets` conservé,
toujours utilisé). `docs/SYSTEME/COMBAT.md` : la section "Pattern de fetch — réutiliser sans
réinventer" disait littéralement *"copier ce pattern"* en montrant l'ancien anti-patron — corrigée en
"Contexte de Test d'un combattant", pointant vers `resolveHumanoidTestContext`/`fetchCibleNA`.

**Testé** : `node --check` sur tous les fichiers touchés à chaque lot, suite `combatantContextService.test.mjs`
(9 tests, verte à chaque lot), smoke-test de chargement du module après le nettoyage d'imports (Lot F).
Confirmé en jeu réel : Lot B (3 combats CaC dont un à modificateurs cumulés), Lot D (2 tirs réels PNJ+PJ),
Lot C bloc principal (2 défenses CaC supplémentaires observées lors des tests Lot D/E).
**Non testé** : les 2 branches "terrain instable défenseur" du Lot C (`resolveMeleeDefensePnj`/
`confirmMeleeDefense`) — nécessitent le choix explicite du modificateur situationnel
`cac_terrain_instable` à la Déclaration (pas de détection automatique côté défenseur, contrairement à
l'attaquant), jamais sélectionné dans les combats de test disponibles à ce jour.
**Données** : aucune migration sur l'ensemble des lots A-F — lecture seule partout.
**Retour arrière** : chaque lot est un commit isolé (`8a6bd34`, `b3ab641`, `9b8c230`, `a542ddb`,
`01accf0`, `4916088`, `2aa7568`, et le commit de Lot F) — `git revert` suffit pour n'importe lequel,
aucune donnée vivante affectée.

Reste ouvert (`EN_COURS.md` EXOARM-COMBATFILE, réduit à ce qui est actif) : validation jeu réel du
terrain instable défenseur (Lot C) ; Lot G (dispatcher `resolveCombatantTestContext` +
`resolveExoTestContext`) — seul lot qui débloquera réellement `PLAN_EXOARMURE.md` Lot 2, dépend aussi
de `computeExoStats` (calcul externe, autre plan) non encore construit.

---

## Session (Saar) — 2026-08-14 — `PLAN_EXOARMURE.md` §7.1 : `computeExoStats` codée

**Contexte** : dernière dépendance externe bloquant `PLAN_COMBATANT_CONTEXT.md` Lot G (cf. entrée
ci-dessus) — `computeExoStats(exoSheet, template)`, jamais construite (`grep` vide sur `server/src/`
et `shared/` avant ce jour). Contrat de sortie déjà figé par `PLAN_EXOARMURE.md` §7.1 : fonction pure
sans DB, retour minimal `{ exf, ... }`, jamais de `NaN`/`undefined` silencieux si `template_id` est
`NULL`.

**Codé** : `shared/exoStats.js` — pas `server/src/lib/charStats.js` (périmètre explicitement disjoint
depuis Lot 1 §1.2, "pas de passage par charStats.js" pour l'exo), fichier `shared/` par cohérence avec
`shared/polarisUtils.js`/`shared/exoConstants.js` (fonction pure réutilisable côté client sans
dupliquer la formule). Retour `{ exf, bld, rd }` — `bld`/`rd` ajoutés par cohérence architecturale
au-delà du strict besoin du Lot G ; `vit` explicitement exclu (déjà porté par
`movementBudgetService.js` §7.4, éviter une deuxième autorité). `template` absent → `null`.

**Deux ambiguïtés RAW soumises à Saar avant codage** (`REGLEARMURE.md:565-621` ne les tranche pas
explicitement) : Exosquelette+Générateur cumulent-ils leur réduction d'EXF, et le Générateur détruit
implique-t-il EXF=0 ? Les deux confirmées par Saar.

**Analyse à charge demandée par Saar avant clôture** — un vrai problème trouvé, un non-problème
écarté, deux renforcements :
1. **Bug réel** : le premier jet appliquait le cumul Exosquelette/Générateur par deux `floor`
   séquentiels (Exosquelette d'abord). Calcul exhaustif : `floor(floor(x×a)×b) ≠ floor(floor(x×b)×a)`
   dans 225 cas sur la plage réaliste (EXF 20-70, Intégrité 0-15) — ex. EXF 21/Exosquelette 7/
   Générateur 3 → 7 dans un ordre, 6 dans l'autre. Cause racine : `exo_sheet` ne garde aucun
   historique de quel composant a été touché en premier (§1.7, "recalculées à chaque lecture"), donc
   choisir un ordre revenait à trancher une question RAW inexistante sans le dire. **Corrigé** :
   arrondi unique sur `base × facteur_exosquelette × facteur_générateur` (commutatif par
   construction) — confirmé par Saar après reformulation ("il n'y a pas d'ordre chronologique
   disponible, une seule multiplication").
2. **Non-problème vérifié** : `EXO_RD_TABLE` (`shared/exoConstants.js`, codée au Lot 1) confrontée
   ligne à ligne à `REGLEARMURE.md:90-98` — exacte, rien à corriger.
3. **Renforcement** : `computeExoStats` levait silencieusement `rd=0` pour une catégorie absente de
   `EXO_RD_TABLE` (repli `?? 0`, indiscernable de la valeur réelle d'exo-alpha) — remplacé par une
   erreur explicite.
4. **Renforcement** : tests initiaux (14) ne couvraient aucune borne exacte de palier (11/10, 6/5,
   1/0) ni le cas de divergence d'ordre — 4 tests ajoutés (18 au total), dont un test de régression
   documentant explicitement l'ancien bug d'ordre.

**Trouvaille distincte, non corrigée ici** (CLAUDE.md §6.8, un plan = un seul problème) :
`getExoMovementBudget` (`movementBudgetService.js`, §7.4 déjà clos) n'applique aucune réduction de
Vitesse liée aux paliers Exosquelette/Générateur alors que le RAW le prévoit aux mêmes lignes. Ouvert
comme ticket `EXOARM-VIT-PALIERS1` (`bug_tickets`, confirmé par Saar) plutôt que dans `EN_COURS.md`.

**Testé** : `node --check` sur `shared/exoStats.js`/`shared/exoStats.test.mjs` ; `node --test` — 18/18
verts (2 exemples chiffrés littéraux du RAW, cumul à arrondi unique, régression du bug d'ordre, bornes
exactes des 3 paliers, rejet de catégorie RD inconnue).
**Non testé** : intégration réelle via `resolveExoTestContext`/Lot G — cette fonction n'est appelée
par aucun code de production pour l'instant, le Lot G reste à coder (`PLAN_COMBATANT_CONTEXT.md`).
**Données** : aucune migration. 1 ticket créé dans `bug_tickets` (`EXOARM-VIT-PALIERS1`, via script
jetable exécuté puis supprimé, même patron que `server/src/scripts/importBugIdentifie.js`).
**Retour arrière** : additif, rien branché en production — `git revert` du commit suffit, aucune
donnée vivante affectée.

Reste ouvert (`EN_COURS.md` EXOARM-COMBATFILE) : Lot G (dispatcher `resolveCombatantTestContext` +
`resolveExoTestContext`, `PLAN_COMBATANT_CONTEXT.md`) — plus aucune dépendance externe bloquante,
prêt à démarrer ; validation jeu réel du terrain instable défenseur (Lot C, portée close depuis).

## Session (Saar) — 2026-08-15 — PLAN_COMBATANT_CONTEXT Lot G : dispatcher exo assemblé

**Contexte** : dernier lot du plan — assembler `resolveCombatantTestContext` (dispatcher) +
`resolveExoTestContext` (`combatantContextService.js`) et rebrancher les sites `pj`/`pnj` dessus, pour
qu'un pilote d'exo-armure obtienne enfin un Seuil de Test dérivé de son pilote (attributs/Compétences)
avec l'Exo-Force à la place de la Force (`MANUEL_EXOARMURE.md` §4.1).

**Décision produit actée avec Saar avant le code** : l'exo-armure est bien un personnage séparé du
pilote, avec son propre token sur le plateau (confirmé par lecture de `MANUEL_EXOARMURE.md` §3.1,
déjà écrit ainsi). Le token du pilote pendant qu'il pilote (`MANUEL_EXOARMURE.md` §6.3, laissé ouvert
par le MANUEL et par `PLAN_EXOARMURE.md` Lot 1 §6.6, "hors périmètre v1") est tranché : **aucune
mécanique serveur** — inutilisé/retiré du plateau à la charge des joueurs/MJ. Si le MJ oublie de
retirer un des deux tokens, le personnage peut agir deux fois : comportement accepté, pas un bug à
corriger. À reporter dans `PLAN_EXOARMURE.md` (§6.3) quand ce document sera repris.

**Écart trouvé entre le texte du plan (§2, audit du 2026-08-06) et le code réel** — les Lots C/E,
clos depuis, avaient déjà réduit les "7 sites" à 6 appelants réels de `resolveHumanoidTestContext`
(site #1 `isTargetDefenseless` jamais migré — ne lit pas `calcSkillTotal`, Lot C ; sites cibles
Tir/Drone #4/#5/#7 déjà unifiés via `damageService.fetchCibleNA`, jamais via ce service, Lot E) — plan
non mis à jour en conséquence. Périmètre réel du Lot G : les 6 appelants directs restants.

**3 bugs trouvés en creusant au-delà du remplacement direct des appels** (`CLAUDE.md` — cause racine,
pas de rustine) :
1. **Le vrai blocage n'était pas l'appel à `resolveHumanoidTestContext` lui-même** mais un fetch
   `char_sheet` + garde *antérieur*, séparé, dans chacune des 3 fonctions concernées (attaquant CaC
   `resolveMeleeAction`, défenseur CaC même fonction, tireur `resolveAssaultAction`) — un pilote d'exo
   (jamais de `char_sheet` propre) y retournait avant même d'atteindre le point que le plan ciblait.
   Corrigé aux 3 sites : le garde d'existence passe maintenant par `resolveCombatantTestContext`
   (attaquant/tireur, un seul appel — la détermination du skillId a été avancée dans la fonction,
   aucune dépendance ne s'y opposait) ou `resolveCombatantSheetId` (défenseur — nouvelle fonction,
   identité seule, coût minimal pour un humain : 1 requête, identique à l'ancien fetch direct ; la
   main directrice du défenseur doit être connue avant de savoir quelle Compétence tester, donc avant
   de pouvoir appeler le dispatcher complet).
2. **`modDom` (dégâts au contact) restait calculé avec la Force du pilote** dans mon premier jet : en
   ne remplaçant que `for_na` dans le retour de `resolveExoTestContext` sans recalculer `modDom` (déjà
   calculé plus tôt, à l'intérieur de `resolveHumanoidTestContext`, avec la FOR du pilote). Contraire à
   `MANUEL_EXOARMURE.md` §4.6 ("modificateur appliqué à l'EXF... et non à la Force du pilote"). Corrigé
   proprement : `resolveHumanoidTestContext` accepte un paramètre interne `forNAOverride` (`undefined`
   par défaut, aucun changement pour un appelant humanoïde direct) qui recalcule `for_na`/`modDom`/
   l'encombrement de `effectiveMalus` depuis l'EXF dès le départ — jamais `skillTotal`
   (`calcSkillTotal` recalcule l'Attribut depuis `attrs` bruts, indépendant de ce paramètre : la FOR
   propre du pilote reste utilisée pour toute Compétence qui la testerait, §0.2 du plan, "jamais aux
   autres calculs d'Attribut"). Même bug de "recalcul oublié" aurait touché l'encombrement sans ce
   paramètre — trouvé en relisant `calcActiveMalus`, corrigé avant qu'un vrai combat n'en dépende.
3. **Risque d'écrire une Blessure humaine directement sur le pilote** en contournant l'armure : en
   laissant `char_sheet_id_cible`/`for_na_cible`/`con_na_cible`/`vol_na_cible` (consommés plus loin par
   `resolveTargetHit`/`applyWound` — pipeline de dégâts, pas le Test de défense lui-même) refléter le
   pilote pour un défenseur exo touché. Le pipeline de dégâts de l'armure (Intégrité/Avaries/RD fixe
   par catégorie) n'existe pas encore (`PLAN_EXOARMURE.md` Lot 4, hors périmètre de ce plan). Corrigé :
   ces 4 valeurs restent au repli neutre préexistant (8/8/8/`null`) pour un défenseur exo — exactement
   le comportement d'avant ce chantier (`applyWound` retourne déjà `null` sans écrire si
   `charSheetId` est vide, vérifié dans `woundService.js`) — seul le Seuil de défense de l'armure
   (dérivé du pilote) est corrigé, pas ce qui se passe si l'attaque touche.

**Fichiers modifiés** :
- `server/src/lib/combatantContextService.js` — `resolveExoTestContext` (interne) + dispatcher exporté
  `resolveCombatantTestContext` + `resolveCombatantSheetId` (identité seule) ; `resolvePilot` (interne,
  autorité unique exo→pilote, partagée par les deux) ; `resolveHumanoidTestContext` étendue du
  paramètre optionnel `forNAOverride`.
- `server/src/socket/socketCombatHelpers.js` — 6 sites rebranchés sur le dispatcher ; 3 gardes
  d'existence (`sheetAttaquant`/`sheetCible`/`sheetTireur`) remplacés ; `char_sheet_id_cible` et les 3
  NA cible protégés pour un défenseur exo (point 3 ci-dessus) ; import mis à jour.
- `server/src/lib/combatantContextService.test.mjs` — 9 tests ajoutés (18 au total) : nominal exo,
  palier NA seul sans `modDom`, paliers d'Intégrité dégradés (formule exacte §4.8.2, cumul un seul
  floor), pas de pilote, pas de template ("non configurée"), non-régression du dispatch humain,
  `resolveCombatantSheetId` (humain/exo/sans pilote).

**Testé** : `node --check` sur les 2 fichiers de code ; `node --test` sur
`combatantContextService.test.mjs` — 18/18 verts contre PostgreSQL réel (0 résidu après coup,
vérifié). `PLAN_COMBATANT_CONTEXT.md` §6 (validation attendue Lot G) : "un Test résolu sans crash,
skillTotal/for_na correctement dérivés du pilote/de l'EXF" — couvert par les tests ci-dessus.
**Non testé** : scénario réel en navigateur — aucune exo-armure réelle en jeu, cohérent avec le plan
lui-même ("Lot G seul n'est pas jouable de bout en bout" tant que `PLAN_EXOARMURE.md` Lot 2 n'existe
pas — routage de la confirmation de défense d'un exo notamment, jamais tranché, voir ci-dessous).
**Données** : aucune migration — lecture seule, comme les Lots A-F.
**Retour arrière** : commit isolé, `git revert` suffit — aucune donnée vivante affectée.

**Hors périmètre, confirmé pas oublié** :
- Routage de la confirmation de défense pour un type `'exo'` dans `resolveMeleeAction` (`if
  (defenderCharacter.type === 'pnj') ... else resolveMeleeDefensePj` — aucune branche `'exo'`,
  retombe sur le chemin PJ) — appartient à `PLAN_EXOARMURE.md` Lot 2.
- `atkEnemyType`/`defEnemyType` (comptage multi-adversaires, `character.type === 'pj' ? 'pnj' : 'pj'`)
  traite tout `exo` comme `'pj'` par défaut de code, pas par décision — correct seulement si le pilote
  est un PJ. Dette distincte, notée dans `EN_COURS.md`, pas corrigée ici (un plan = un problème).
- Pipeline de dégâts exo en tant que cible (point 3 ci-dessus) — `PLAN_EXOARMURE.md` Lot 4.

`PLAN_COMBATANT_CONTEXT.md` est clos (Lots A-G tous confirmés) — à archiver vers `docs/Old/` une fois
`docs/SYSTEME/COMBAT.md` mis à jour (fait dans ce commit) et `EN_COURS.md` nettoyé.

---

## Session (Saar) — 2026-08-15 — Création de personnage directement dans le Coffre (sans campagne)

**Contexte** : demande initiale simple en apparence (Dashboard, carte Coffre — permettre de créer un
personnage sans forcer le choix d'une campagne). L'investigation a montré que l'infrastructure
existait déjà partiellement (migration 129 : `characters.vault_id`/`campaign_id` nullable + contrainte
`chk_characters_campaign_xor_vault`), mais qu'aucun chemin natif n'existait — un personnage Coffre
n'existait jusqu'ici que par clonage d'un personnage de campagne déjà terminé (`vaultService.js
cloneToVault`). Tout le pipeline (Wizard, `char-sheet.js`, socket) vérifiait une appartenance
`campaign_members` à chaque contrôle d'accès, sans branche pour un personnage sans campagne.
Décision Saar : le flag PJ/PNJ n'est pas structurant (un personnage peut changer de rôle plus tard) —
un personnage Coffre-native est toujours créé `type: 'pj'`.

**Fichiers modifiés** :
- `server/src/services/characterOwnershipService.js` — `resolveOwnership` : branche `!campaignId` →
  `type: 'pj'` toujours, aucune lecture `campaign_members`.
- `server/src/services/vaultCoreService.js` (nouveau) — `getOrCreateVault` extrait de
  `vaultService.js` pour éviter un cycle d'import (`vaultService.js` importe déjà `lockWizard` depuis
  `creationService.js`, qui a maintenant besoin de `getOrCreateVault`).
- `server/src/services/vaultService.js` — importe/réexporte `getOrCreateVault` depuis le nouveau
  module, surface publique inchangée.
- `server/src/services/creationService.js` — `startCreation` : `campaignId` optionnel (normalisé
  `undefined`→`null`), résolution du Vault hors transaction (accesseur paresseux idempotent, pas
  transactionnel avec l'appelant — un Vault vide orphelin en cas de rollback est inoffensif),
  idempotence et insert conditionnés vault/campagne. `resolveSheetAccess` : branche
  `campaign_id == null` → accès = propriétaire uniquement, `isGm: false` (aucun MJ possible sans
  campagne).
- `server/src/routes/creation.js` — `POST /start` : `campaignId` optionnel, `targetUserId` refusé
  sans campagne (aucune notion de MJ ciblant un autre joueur).
- `server/src/routes/character/char-sheet.js` — `router.param('characterId')` : branche Coffre-native
  gatée sur `char_sheet.wizard_locked_at IS NULL` — préserve l'invariant documenté dans
  `vaultService.js` (« un personnage en Vault est un instantané figé, jamais traversé par les routes
  de mutation de char-sheet.js ») : accessible seulement tant que le Wizard est encore en cours
  (étape Matériel & Biens), plus jamais après verrouillage, même pour le propriétaire.
- `server/src/services/inventoryService.js` — `addItem` : paramètre `isGm` renommé `autoValidate`
  (le service n'a plus besoin de connaître la notion de campagne ; nommer `isGm` un booléen vrai en
  l'absence de tout MJ aurait été trompeur).
- `server/src/socket/index.js` — `SESSION_JOIN` : branche solo si `campaignId` absent — pas de
  vérification `campaign_members`, pas de room à rejoindre, mais `SESSION_JOINED` quand même émis
  (sinon `ready` ne passe jamais à vrai côté client) et `registerWizardHandlers` reste posé (room
  `wizard:<sheetId>`, indépendante de toute campagne — vérifié par lecture complète de
  `socketWizard.js`, qui réutilise `resolveSheetAccess` sans réimplémentation).
- `client/src/pages/DashboardPage.jsx` — option « Pas de campagne (Coffre uniquement) » dans le
  sélecteur existant (sentinelle `NO_CAMPAIGN`, distincte de la chaîne vide).
- `client/src/App.jsx` — routes `/vault/creation` et `/vault/creation/:sheetId`, réutilisent
  `WizardCreationPage` tel quel (`WizardCreation.jsx` n'a nécessité aucune modification — `campaignId`
  simplement absent des `useParams()`, déjà toléré par `startCreation`/`SocketProvider`).
- `client/src/locales/fr.json` — clé `dashboard.noCampaignOption`.
- `server/src/services/creationVaultNative.test.mjs` (nouveau), `inventoryService.test.mjs` (étendu) —
  voir Testé.

**Testé** : `creationVaultNative.test.mjs` (4 tests, PostgreSQL réel — création avec `vault_id` posé/
`campaign_id` NULL, idempotence un seul Vault, accès propriétaire OK, accès tiers refusé 403) ;
`inventoryService.test.mjs` (9 tests dont 2 nouveaux sur `autoValidate`) ; `creationRoundTrip.test.mjs`
(non-régression chemin campagne, inchangé) — 14/14 verts en un seul passage. `node --check` sur les 10
fichiers serveur touchés, `eslint` propre sur les fichiers client touchés. **Confirmé fonctionnel en
navigateur par Saar** (parcours complet Dashboard → Coffre → Pas de campagne → Wizard → Terminer).
**Non testé** : transfert Coffre → campagne d'un personnage créé par ce nouveau chemin (le mécanisme
existant `requestImport`/`approveImport` devrait fonctionner sans modification — `creation_state`/
`wizard_locked_at` posés identiquement à un personnage cloné — mais jamais exercé avec cette origine).
**Données** : aucune migration (infrastructure déjà en place depuis la migration 129).
**Retour arrière** : rien committé avant ce commit — `git revert` du commit suffit, aucune donnée
vivante affectée en dehors des personnages créés par les utilisateurs via ce nouveau chemin.

**Hors périmètre, confirmé pas oublié** (décision Saar — un lot à la fois) :
- Création instantanée (drone/exo, sans Wizard) sans campagne — équivalent Coffre de
  `POST /api/campaigns/:campaignId/characters`. Drone déjà supporté par le Coffre (registre
  `vaultService.js`), exo-armure bloquée par un manque préexistant (`COMPANION_REGISTRY` ne connaît
  pas encore `exo` — indépendant de ce chantier, `PLAN_EXOARMURE.md` en cours ailleurs).
- Navire — n'existe pas comme type de personnage dans le code, aucun ticket ne peut le couvrir
  aujourd'hui.

---

## Session (Saar) — 2026-08-15 — WIZ5 : régression du saut d'étape (toute création atterrissait à l'étape 3)

**Contexte** : signalé par Saar en testant le chantier ci-dessus — toute création de personnage,
Coffre ou campagne, sautait de l'étape 0 (choix de méthode) directement à l'étape 3 (Mutations).
Diagnostic à charge avant correctif (règle du projet) : `git diff` sur `creationService.js` ne touche
ni `getStep3State` ni aucun code lié — reproduit à l'identique sur le chemin **campagne**, jamais
modifié par le chantier en cours, confirmant que le bug était préexistant et indépendant du Coffre.

**Cause racine** trouvée dans `docs/EN_COURS.md` : **WIZ5** (correctif du 2026-08-11, avant ce
chantier, marqué à l'époque « clos partiel — scénario réel navigateur non testé »). Avant WIZ5,
`getStep3State` renvoyait `method: null` pour une fiche neuve, causant « Méthode de mutation
invalide : null » sur Terminer/Voir ma fiche. Le correctif a changé le défaut en `method: 'none'`
(valeur légitime acceptée par la validation serveur de `reconcileCreation`), mais côté client
`computeHighestStep` (`creationStore.js`) testait `if (step3?.method) highestStep = 3` — `'none'` est
une chaîne non vide, donc vraie, même sur une fiche où l'étape 2 n'a jamais été touchée. Le correctif
WIZ5 a soigné un bug pour en créer un autre, jamais vérifié en navigateur à l'époque.

**Correctif** : `computeHighestStep` rendu séquentiel — chaque étape n'est retenue que si la
précédente l'est déjà (`step3Done = step2Done && !!step3?.method`, etc.), généralisant le seul garde-
fou qui existait déjà (step4→step5 seul était conditionné sur `highestStep === 4` avant ce correctif ;
step2→step3 et step3→step4 ne l'étaient pas). Vérifié par table de vérité exécutée à part (6 scénarios
dont la fiche neuve du bug rapporté, une reprise réelle à chaque étape, et le marqueur `step6_done`).

**Limite résiduelle connue, non corrigée** (décision explicite — hors périmètre du bug signalé) : si un
joueur termine l'étape 2 puis ferme l'onglet sans jamais avoir ouvert l'étape 3, la reprise affiche
quand même l'étape 3 avec « Aucune mutation » pré-sélectionné au lieu d'un formulaire vierge —
`method: 'none'` ne distingue pas « jamais visité » de « visité, aucune mutation choisie », et rien en
base ne permet de le faire aujourd'hui (`char_pc_ledger.pc_spent_step3` a le même défaut `0` dans les
deux cas). Pas un saut d'étape entière (l'utilisateur atterrit sur l'étape juste suivante, pas plus
loin) — cohérent avec la philosophie déjà documentée de `computeHighestStep` (« imprécis par nature »).
Une résolution complète demanderait une migration (marqueur explicite « étape 3 soumise »).

**Fichiers modifiés** : `client/src/stores/creationStore.js` (`computeHighestStep` uniquement).

**Testé** : table de vérité (script Node jetable, 6 scénarios, non conservé) — comportement conforme.
`eslint` propre. **Confirmé fonctionnel en navigateur par Saar.**
**Non testé** : le cas résiduel documenté ci-dessus (accepté tel quel, pas un regression de ce
correctif — déjà présent dans le comportement WIZ5 d'origine).
**Données** : aucune migration.
**Retour arrière** : commit isolé, `git revert` suffit — aucune donnée vivante affectée (fonction pure,
aucune écriture).

---

## Session (Saar) — 2026-08-15 — Deux bugs trouvés en testant le Coffre-native : main directrice tardive + badge Validé trompeur

**Bug 1 — « Main directrice invalide : » à l'Étape 7.** Signalé « trop tard pour l'afficher, il faut
le réclamer Étape 1 » — clarifié avec Saar : le champ reste optionnel (narratif, non bloquant,
`REGLE_CREATION.txt:1317-1324`), la demande portait sur l'erreur elle-même, pas sur le rendre
obligatoire. Cause racine : `getStep1State` (`creationService.js`) renvoyait `handPref: identity?.
hand_pref ?? ''` — une chaîne vide n'appartient pas au domaine contraint R/L/A (contrairement aux
champs texte libre voisins, où `?? ''` est le bon défaut). Un NULL en base (jamais choisi) devenait
donc `''` à chaque resynchronisation serveur (`WIZARD_STATE_SYNC`, reprise), et `openPeek`/
`handleTerminate` (Étape 7, `WizardCreation.jsx`) renvoient le state du store tel quel, sans repasser
par la normalisation `handPref || null` propre au composant `Step1Attributes.jsx` — le serveur
rejetait alors sa propre valeur « non choisi ». Corrigé : `?? null`, cohérent avec `height`/`weight`
juste au-dessus dans la même fonction.

Diagnostic vérifié empiriquement avant correctif (pas seulement par lecture) : script jetable
confirmant `char_identity.hand_pref` réellement NULL en base et `getStep1State` renvoyant bien `''`
dans l'ancien code. Découverte annexe en écrivant le test dédié : `creationRoundTrip.test.mjs`
existant ne détectait PAS ce bug malgré un scénario a priori équivalent — son Étape 5 accorde
l'avantage adv_002 (Ambidextre), qui pose mécaniquement `hand_pref='A'` en base, masquant totalement
le défaut `?? ''` avant même qu'il s'exprime. Nouveau test isolé de cet effet de bord.

**Bug 2 — badge « Validé » affiché sans MJ possible (Coffre).** Le bouton « Valider »
(`InventoryPanel.jsx`) était déjà correctement gardé par `isGm` (toujours faux sans campagne). Mais le
badge « Validé » (`item.validated_by_gm`) s'affichait pour tout le monde, sans condition de MJ — et
depuis l'auto-validation ajoutée à la session précédente (Coffre-native), un objet Coffre est
*toujours* `validated_by_gm: true`, donnant l'illusion d'une validation qui n'a jamais eu lieu. Pas
gérable via `isGm` seul : en vraie campagne, le badge doit continuer à s'afficher pour le joueur
(confirmation que le MJ a validé son objet) — il fallait un signal distinct « pas de campagne du
tout », inexistant jusqu'ici. Nouvelle prop `hasCampaign` (défaut `true`, aucun appelant existant à
modifier), dérivée de `!!campaignId` (`WizardCreation.jsx`, `useParams()`), traversant
`StepMaterielEtBiens.jsx`/`CharacterWindow.jsx` → `InventoryPanel.jsx` → `ItemRow` (composant interne,
deux points de rendu — Sac/Ceinture et le conteneur "Coffre" du personnage lui-même, sans rapport avec
le Coffre-compte, qui avait le même défaut).

**Fichiers modifiés** :
- `server/src/services/creationService.js` — `getStep1State`, une ligne.
- `server/src/services/creationRoundTrip.test.mjs` — nouveau test dédié (round-trip Étape 1, isolé de
  l'effet de bord Ambidextre).
- `client/src/character/InventoryPanel.jsx` — prop `hasCampaign` sur le composant et sur `ItemRow`
  (interne), badge gaté.
- `client/src/components/creation/StepMaterielEtBiens.jsx`, `client/src/character/CharacterWindow.jsx`,
  `client/src/components/creation/WizardCreation.jsx` — transmission de `hasCampaign`.

**Testé** : `creationRoundTrip.test.mjs` (2/2, dont le nouveau, vérifié qu'il échoue sans le correctif
avant de le valider avec), suite complète Coffre-native + inventaire (15/15). `eslint` propre sur les
4 fichiers client touchés. **Confirmé fonctionnel en navigateur par Saar** (les deux scénarios : Étape
1 sans main directrice → Terminer ; Étape 6/7 Matériel en Coffre → plus de badge trompeur).
**Non testé** : rien d'identifié restant sur ces deux bugs précis.
**Données** : aucune migration.
**Retour arrière** : commit isolé, `git revert` suffit.

---

## Session (Saar) — 2026-08-16 — Coffre : clôture, validation navigateur complète

Chantier `/vault` (topbar illustrée, création directe pj/drone/exo, catalogue équipement) confirmé
terminé et validé de bout en bout par Saar en navigateur — les deux bugs restants après les passages
partiels précédents (main directrice tardive, badge Validé trompeur, session ci-dessus) sont les
derniers trouvés ; aucun défaut supplémentaire remonté sur ce passage de validation final. Retiré de
`docs/EN_COURS.md` (bloc `🔒 En cours (Saar)`).

**Philosophie produit actée** : le Coffre est un espace personnel — le propriétaire y expérimente
librement (personnages, drone, exo), sans plafond ni coût interne. Le contrôle se fait à la
frontière, au transfert vers une campagne : le MJ cible juge (approuve/refuse), pas un flag
technique côté Coffre.

**Serveur (313/313, PostgreSQL réel)** :
- `char-sheet.js` — gel `wizard_locked_at` retiré sur la branche Coffre, `req.isVaultOwner` (routes de
  construction uniquement : attributs/compétences/XP/sols/mutations/avantages — jamais fatigue/
  quick-equip/jauge, qui restent `isGm` strict).
- `vaultService.js` — `cloneCharacterDeep` n'exige plus `creation_state==='complete'` ;
  `VAULT-REGISTRY-DRIFT1` corrigé (6 tables non couvertes par le garde-fou anti-dérive, dont
  `exo_sheet` et `char_inventory_slots`, double FK, clonage dédié) ; test `vaultCloneRegistry.test.mjs`.
- `vault.js` — `POST /characters` (création directe pj/drone/exo, propriétaire seule autorité).
- `charSheetService.js` — `createCompanionSheet` extraite (branchement par type auparavant dupliqué,
  jamais testé, dans `routes/characters.js`) ; test `charSheetService.test.mjs`.
- `characters.js` (`actionsRouter`) — `req.isOwner` sur `PUT /:id`/`POST /:id/portrait`/
  `PUT /:id/token-style`/`POST /:id/glb` (dépendance `CharacterWindow.jsx` réutilisée pour le Coffre).
  `DELETE /:id` reste GM strict (suppression Coffre = `vault.js` uniquement).
- Bugs trouvés et corrigés au passage : `PUT /sols` et `broadcastCharacterUpdate` émettaient
  `io.to(campaign_id)` sans garde (`null` pour un Coffre) — conditionné à `campaign_id` non nul.

**Client** :
- `VaultPage.jsx` — topbar `vault.webp`, 4 boutons de création, clic-ligne pour ouvrir, tags de type.
- `VaultCharacterPage.jsx` (`/vault/characters/:id`) — dispatcher par type : `drone` → `DroneWindow`,
  `exo` → message explicite (fenêtre dédiée jamais construite, gap préexistant, ticket
  `ARMORWINDOW-MISSING1`), `pj`/`pnj` → `CharacterWindow`.
- `EquipmentCatalogPage.jsx` (`/equipment`) — catalogue `ref_equipment` lecture seule.
- Skin réel de l'appli repris sur les 3 pages (`className="app-shell"`, `.btn`/`.btn-ghost`/
  `.btn-danger`) après un premier jet en styles inline inventés — voir PC47 (`docs/EN_COURS.md`
  "Points de vigilance permanents").

**Tickets ouverts, différés (hors périmètre Coffre, suivi `bug_tickets`)** : `COFFRE-INVROOM1` (room
socket inventaire Wizard pour un Coffre-natif jamais verrouillé), `ARMORWINDOW-MISSING1` (fenêtre
exo-armure, chantier à part).

**Hors scope, noté pour plus tard, pas bloquant** : enrichir la vue MJ
(`listPendingRequestsForCampaign`, `vaultService.js:274-291`) d'un vrai aperçu de fiche avant
approbation (aujourd'hui : nom/type/demandeur seulement) — optionnel, seul filtre du système à ce jour.

**Testé** : validation navigateur complète par Saar (création drone/exo, upload portrait, demande de
transfert, catalogue équipement, style corrigé) — aucune régression, aucun défaut restant.
**Non testé** : —
**Données** : aucune migration dans cette clôture (migrations déjà appliquées lors du codage initial).
**Retour arrière** : commits déjà en place sur `dev/Saar`.

---

## Session (Saar) — 2026-08-18 — Ticket "Blocage - Joueur surpris au premier tour"

Premier bug traité via le nouveau système de tickets (`bug_tickets`, ticket `9e7aa7d5`, sans
`linked_bug_code`) plutôt que depuis `docs/EN_COURS.md`. Symptôme rapporté : joueur surpris sans
aucune interface pour agir, MJ sans moyen de lui passer le tour — combat bloqué en phase Annonce.

**Cause racine `[VÉRIFIÉ]`** : défaut de fenêtre temporelle entre deux composants du flux de Surprise
qui devaient être synchronisés mais ne l'étaient pas. `COMBAT_START` (`socketCombatState.js`) émettait
le prompt `COMBAT_SURPRISE_ROLL` immédiatement — donc en phase `ROSTER` — alors que la FSM
(`combatFSM.js`) n'autorise `COMBAT_SURPRISE_RESULT` (réponse du joueur) et `COMBAT_SKIP_PLAYER`
(passer le tour côté MJ) que depuis la phase `ANNOUNCEMENT`. Un joueur cliquant sur son bouton de jet
avant que le MJ ait cliqué "Commencer l'annonce" — séquence naturelle puisque le bouton apparaît dès
`COMBAT_START` — se faisait rejeter silencieusement par la FSM (`console.warn` serveur uniquement),
alors que le client avait déjà effacé son interface de façon optimiste (`SessionPage.jsx`, aucun accusé
de réception attendu). Second défaut aggravant : ce prompt n'était qu'un `emit` socket one-shot
(`fetchSockets`), jamais persisté — un joueur non connecté à cet instant précis, ou qui se reconnectait
ensuite, ne le recevait jamais.

**Correctif** — réutilise le patron déjà établi dans le projet pour les prompts de combat durables
(`combat_pending`, déjà utilisé pour `melee_defense`/`damage`/`stun`, restauré à la reconnexion) plutôt
que d'inventer un mécanisme à part :
- Migration `247_combat_pending_surprise.js` — `combat_pending.type` accepte désormais `'surprise'`
  (contrainte CHECK étendue, additif, index unique partiel existant déjà applicable).
- `socketCombatState.js` — le prompt n'est plus émis à `COMBAT_START` ; il est émis à
  `COMBAT_ANNOUNCE_START` (une fois la phase réellement ANNOUNCEMENT), avec une ligne `combat_pending`
  durable en plus de l'émission live ; la ligne est supprimée une fois le jet traité dans
  `COMBAT_SURPRISE_RESULT` (succès ou échec).
- `socket/index.js` — nouveau bloc de resync reconnexion (phase ANNOUNCEMENT, sibling du bloc existant
  RESOLUTION/C3, non modifié) qui réémet le prompt depuis `combat_pending` si le joueur se reconnecte
  avant d'avoir joué son jet.

Le symptôme côté MJ ("Passer" absent) n'a pas été isolé séparément par instrumentation — l'hypothèse
retenue (même défaut de fenêtre : la fenêtre de déclaration MJ peut s'afficher dès `COMBAT_STARTED`,
avant que la FSM n'autorise `COMBAT_SKIP_PLAYER`) est cohérente avec la disparition du symptôme après
correctif, confirmée par Saar en navigateur avec les deux rôles.

**Trouvaille annexe, non traitée** : `CombatGmDeclareWindow.jsx` peut théoriquement s'afficher dès
`COMBAT_STARTED` (phase ROSTER) pour n'importe quel combat, pas seulement un cas de surprise — un
"Passer" cliqué à ce moment-là ne ferait rien (même défaut de fenêtre FSM, générique). Hors périmètre
de ce correctif ; à ouvrir en ticket séparé si observé en jeu.

**Testé** : migration appliquée et vérifiée en base (contrainte `chk_pending_type`), démarrage serveur
propre (aucune erreur d'import/exécution), scénario complet confirmé par Saar en navigateur avec deux
rôles (joueur surpris + MJ) — jet de Réaction accessible au bon moment, "Passer" fonctionnel.
**Non testé** : reconnexion réelle d'un joueur surpris avant d'avoir joué son jet (le bloc de resync
`socket/index.js` n'a pas été exercé en conditions réelles, seulement lu/vérifié statiquement).
**Données** : migration 247 (additive, rétrocompatible).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit ; migration `down()` fournie.

## Session (Saar) — 2026-08-18 — `PLAN_EXOARMURE.md` Lot 2 : dérive documentaire corrigée + routage de la confirmation de défense pour un `type='exo'`

**Contexte** : reprise du Lot 2 à la demande de Saar. `PLAN_EXOARMURE.md` §7 et `EN_COURS.md`
(`EXOARM-COMBATFILE`) décrivaient encore le plafond de Compétence par Manœuvre d'armure et "1 seule
Attaque/Tour" comme bloqués — faux : le commit `7247ebb` (2026-08-15, dans la foulée de la clôture du
Lot G de `PLAN_COMBATANT_CONTEXT.md`) avait déjà codé le plafond de Compétence, sans jamais remettre à
jour ces deux documents. Dérive documentaire pure, corrigée en premier (§7 du plan, ligne
`EXOARM-COMBATFILE`) avant tout code — aucune ligne de code n'a changé pour cette partie.

**"1 seule Attaque/Tour" — vérifié sans code nécessaire.** RAW (`REGLESYSCOMBAT.md:207`) : restriction
sur la règle avancée optionnelle "Effectuer plusieurs Attaques par Tour" (p.218). Vérifié par lecture
(`64_combat_mode.js` : 5 modes normal/offensif/charge/défensif/retraite, aucun "Enchaînement" ;
`socketCombatAnnouncement.js` : aucune déclaration de marqueurs d'Initiative supplémentaires) : cette
règle avancée n'est implémentée pour aucun type de personnage — chaque combattant ne peut déjà
déclarer qu'une seule action par Tour (`combat_roster.has_announced`). Rien à plafonner tant que la
règle de base n'existe pas. Décision documentée (§1.9 CLAUDE.md, pas un raccourci silencieux) : à
rouvrir seulement si "Plusieurs Attaques par Tour" est un jour codée pour les humains.

**Trou réel trouvé en clôturant le Lot 2 : routage de la confirmation de défense pour un `type='exo'`.**
`resolveMeleeAction` (`socketCombatHelpers.js`) ne testait que `defenderCharacter.type ===
'pnj'`/`'drone'` — un défenseur exo retombait sur `resolveMeleeDefensePj`, ciblant `defenderUserId =
defenderCharacter.user_id` (propriétaire brut de la fiche exo), jamais le pilote actif
(`exo_sheet.pilot_character_id`). Deux défauts distincts : (1) pilote PJ — prompt vers le mauvais
utilisateur dès que propriétaire ≠ pilote ; (2) pilote PNJ — attente d'une confirmation qui ne vient
jamais légitimement, alors que `resolveMeleeDefensePnj` auto-résout déjà ce cas pour tout défenseur
PNJ normal, mais n'était jamais atteint pour un exo piloté par un PNJ.

**Correctif** : `resolveCombatantSheetId` (`combatantContextService.js`, seul point d'appel dans
`socketCombatHelpers.js`) étendue en `resolveCombatantIdentity(db, character)` →
`{ sheetId, userId, effectiveType }` — réutilise le fetch `resolvePilot` déjà en place (jamais un
second fetch `exo_sheet→characters`, invariant déjà documenté dans le fichier). `effectiveType` = type
du personnage pour un humain, type du PILOTE pour un exo (repli `'pnj'` si aucun pilote assigné —
auto-résolution, cohérent avec `defenderSkillTotal` qui reste à son défaut 0, jamais un blocage FSM en
attente d'un clic qui ne viendra pas). `resolveMeleeAction` branche désormais sur `defenderEffectiveType`
(pas `defenderCharacter.type`) pour la branche pnj/pj, et passe `defenderEffectiveUserId` (le pilote)
comme `defenderUserId`. Les drones restent sur leur propre `defenderCharacter.type` (jamais pilotés,
aucune indirection). Documentation vivante mise à jour en cohérence : `docs/SYSTEME/COMBAT.md`
(dispatcher `meleeSkillCap`, `resolveCombatantIdentity`, routage défense exo).

**Testé** : `node --check` sur les 3 fichiers modifiés. `combatantContextService.test.mjs` — 25/25
verts contre PostgreSQL réel (dont les 18 tests du plafond de Compétence du 2026-08-15, jamais exécutés
jusqu'ici faute de Postgres accessible dans les sessions précédentes ; 4 tests `resolveCombatantIdentity`
nouveaux/mis à jour, dont un cas propriétaire de l'exo ≠ pilote — les fixtures précédentes utilisaient
le même utilisateur pour les deux et n'auraient jamais pu détecter ce bug). **Non testé** : scénario réel
en jeu (aucune exo-armure en base à ce jour, même limite que tout le chantier Exo-armures depuis le
Lot 1).
**Données** : aucune migration — code + documentation seulement.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

---

## Session (Saar) — 2026-08-19 — Ticket "Illustration fiche personnage"

Deuxième bug traité via `bug_tickets` (ticket `e8946376`, sans `linked_bug_code`). Symptôme rapporté :
impossible de changer l'illustration d'un personnage une fois qu'une première a été définie, échec
silencieux ; placeholder de développement ("Illustration — Phase 3") resté visible en production.

**Cause racine `[VÉRIFIÉ]`** : `POST /characters/:id/portrait` stocke l'image sous un nom d'objet MinIO
fixe (`characters/<id>/illustration`, choix voulu — `putObject` écrase l'ancien, pas d'accumulation
d'orphelins). Conséquence non anticipée : l'URL construite côté client
(`${VITE_API_URL}/api/assets/${portrait_url}`) est donc **identique avant et après un remplacement**.
Avec `Cache-Control: public, max-age=3600` sur la route qui sert l'asset (`assets.js`) et le fait qu'un
`<img src>` React inchangé ne redéclenche même pas de requête réseau, l'ancienne image restait affichée
jusqu'à une heure après un upload pourtant réussi côté serveur — d'où l'illusion d'un échec silencieux.
Repéré aussi sur `TokenStyleEditor.jsx` (aperçu jamais rafraîchi) et `Canvas2D.jsx` (token sur la carte),
même construction d'URL dupliquée aux deux endroits.

**Correctif** — pas de nouveau mécanisme : la route jumelle `POST /characters/:id/glb` (90 lignes plus
bas dans le même fichier) avait déjà résolu exactement ce problème via **P19** (`docs/SYSTEME/
CONVENTIONS.md`, `docs/SYSTEME/ASSETS.md`) — `?v=<timestamp>` stocké directement dans la colonne URL,
`assets.js` ignorant les query params pour résoudre la clé MinIO. `portrait_url` avait simplement été
oublié quand cette convention a été établie (rien dans la doc ne le justifiait comme exception).
`characters.js` aligné sur ce patron ; **aucun changement côté client** — les 3 sites de rendu lisent
déjà `character.portrait_url` tel quel, ils héritent du paramètre automatiquement. Doc P19 et
`ASSETS.md` corrigées pour refléter que la règle couvre aussi `portrait_url`, pas seulement `glb_url`.

Piste explorée puis écartée en cours de route (Saar) : désactiver le cache globalement sur `/api/assets/*`
plutôt que cibler l'URL — rejetée, la route sert aussi les GLB (jusqu'à 20 Mo) et les textures de
battlemap, qui changent rarement ; et un `<img src>` inchangé ne redéclenche de toute façon aucune
requête côté navigateur dans une SPA, indépendamment des en-têtes de cache serveur.

Placeholder `illustrationPlaceholder` (`fr.json`) : `"Illustration — Phase 3"` → `"Aucune illustration"`.

**Testé** : `node --check` sur `characters.js`, JSON valide (`fr.json`), démarrage serveur complet
vérifié (Postgres/MinIO relancés après coupure Docker Desktop entre les deux sessions), confirmé
fonctionnel par Saar en navigateur.
**Non testé** : rien d'identifié restant sur ce ticket précis.
**Données** : aucune migration.
**Retour arrière** : commit isolé sur `dev/Saar` (`da22877`), `git revert` suffit.

---

## Session (Saar) — 2026-08-19 — Audit diffusion live du Wizard + clôture BETA-7

Demande explicite de Saar : après plusieurs sessions/agents ayant touché la granularité de diffusion
live du Wizard (WIZ11, WIZ15, WIZ21...), auditer à charge l'ensemble des steps/sous-étapes — quoi
existe, câblage correct, homogène ? Pas un correctif ponctuel, une revue de code complète (orchestrateur
`WizardCreation.jsx`, transport `useWizardLiveEmit.js`/`WizardLockSync.jsx`, store `creationStore.js`,
route serveur `routes/creation.js#reconcile`, les 8 composants d'étape).

**BETA-7** ("Step 1 diffuse en direct, Step 4 file au récap et y reste") — cause déjà traitée par
**WIZ15 + WIZ21** (2026-08-11), un jour avant l'import en masse de l'ancien `BUGIDENTIFIE.md`
(2026-08-12) qui a créé ce ticket sans recroiser les correctifs déjà landés. Confirmé résolu par Saar
en navigateur (2026-08-19) — ticket passé à `resolved`, `admin_notes` documente le lien vers WIZ15/WIZ21.

**Verdict architecture** : steps 1/2/3/5 partagent un patron `useEffect → onLiveChange` identique mot
pour mot dans les 4 fichiers ; le transport (`useWizardLiveEmit`) et le store (`applyStateSync`/
`applyLiveDraft`) traitent step1..step5 de façon générique, aucun cas spécial par step ; le serveur
diffuse `WIZARD_STATE_SYNC` via un seul handler symétrique. Step 4 est plus sophistiqué (suit en plus
la sous-étape du joueur) mais justifié — seule étape à sous-navigation. Step 6 (Matériel) réutilise à
raison le canal temps réel existant de la fiche (`InventoryPanel.jsx`/`useWizardInventorySync`) plutôt
qu'un canal Wizard dédié. Steps 0/7 n'ont légitimement rien à diffuser. **Pas "le bordel"** — une
architecture réellement unifiée, correctement documentée inline.

**Deux trouvailles réelles, non liées à BETA-7, à corriger séparément (Saar, autorisé 2026-08-19)** :
1. `gmSyncKey`/`liveOr` (`WizardCreation.jsx`) et l'auto-scroll MJ (`creationStore.js#applyStateSync`)
   réutilisent `isGmView` seul pour distinguer "MJ observant le brouillon d'un autre" — même ambiguïté
   documentée que WIZ13 (`isGmView` = rôle de campagne, pas "observe quelqu'un d'autre"), corrigée à
   l'époque sur un seul consommateur (`resetCreation`), jamais balayée sur ces trois autres. Impact réel
   faible (remontage inutile mais sans perte de données pour un MJ créant son propre personnage) mais
   même classe de bug.
2. `computeInitialSubStep` (Step4Experience.jsx) et `getStep3State` (WIZ5B, déjà loggé) devinent chacun
   séparément "cette étape a-t-elle déjà été visitée" faute de marqueur persisté — deux réinventions
   indépendantes de la même béquille, chacune avec ses propres faux positifs déjà documentés comme
   limitation acceptée.

**Non testé** : rien — session d'analyse pure, aucun code modifié. Correctifs des points 1/2 à suivre
dans une session séparée.
**Données** : aucune.
**Retour arrière** : sans objet (aucun code touché).

---

## Session (Saar) — 2026-08-19 — Wizard : correctifs points 1 et 2 de l'audit diffusion live

Suite de la session d'audit précédente. Priorités rappelées par Saar avant de trancher le point 2
(qualité structurelle > vitesse, rework autorisé si ça renforce l'architecture) : choix du correctif
racine (marqueur persisté) plutôt que du statu quo documenté.

**Point 1 — `isGmView` confondait rôle de campagne et "observe le brouillon d'un autre"** (même
ambiguïté que WIZ13, jamais balayée sur ces consommateurs) :
- `WizardCreation.jsx` (`liveOr`, `gmSyncKey`) et `creationStore.js#applyStateSync` (auto-scroll MJ)
  utilisent désormais `isObservingOther` (`ownerUserId` vs utilisateur courant), plus `isGmView` seul.
  `creationStore.js` lit l'utilisateur courant via `useAuthStore.getState()` (première lecture
  cross-store du projet, aucun précédent contraire, seule façon propre de le faire hors composant).
- Usages légitimement liés au rôle (`WizardHeader`, `StepMaterielEtBiens#canEdit`) inchangés — ceux-là
  parlent de permission, pas d'observation.
- Impact réel avant correctif : un MJ créant son propre personnage se faisait remonter inutilement ses
  composants d'étape à chaque écho serveur (pas de perte de données, juste un remontage superflu).

**Point 2 — heuristiques "jamais visité" dupliquées (WIZ5B + Step4)**, résolu par migration plutôt
qu'un simple croisement de commentaires :
- **Migration 248** — `char_sheet.wizard_progress` JSONB (`{}` par défaut, additive), même convention
  que `state_character` (PC39 : clé absente = valeur par défaut, jamais stocker "non atteint" en dur).
- **WIZ5B fermé** : `wizard_progress.step3_visited` posé au premier reconcile Step3
  (`creationService.js`) ; `getStep3State` l'expose (`visited`) ; `Step3Mutations.jsx` n'ouvre plus
  pré-rempli sur "Aucune mutation" pour une étape jamais visitée — entrée retirée de `EN_COURS.md`.
- **Step4** : deux ambiguïtés distinctes, deux traitements différents.
  - `higherEd` (sauté vs jamais visité) : résolu **par chaînage** (`careers.length > 0` implique déjà
    dépassé cette sous-étape, navigation linéaire) — même principe que WIZ5/`computeHighestStep`,
    aucune donnée persistée nécessaire.
  - Avantages & Revers (dernière sous-étape avant Récap, rien après elle à chaîner — irréductible) :
    `wizard_progress.step4_highest_substep`, posé à la soumission réelle de Step4 (`handleSubmit`,
    jamais dans `buildPayload`/`onLiveChange` — même séparation que `subStep` sur WIZ21), avancé
    uniquement côté serveur (jamais régressé sur un resubmit partiel).
- **`shared/wizardStep4SubSteps.js`** (nouveau) — `SUB_STEPS`/`SUB_STEP_ORDER` déplacés du client seul
  vers un fichier partagé, consommé par `Step4Experience.jsx` ET `creationService.js` (validation
  serveur de `highestSubStep` avant persistance — jamais fait confiance au client sans whitelist).

**Testé** : migration appliquée et vérifiée en base, `node --check` (serveur), `eslint` propre sur les
4 fichiers client touchés (seule erreur remontée, `showSetbacks` inutilisée dans Step4Experience.jsx,
préexistante et hors diff), build client complet réussi, serveur de dev (nodemon) rechargé sans erreur
après chaque édition (`/api/health` 200 après coup). **Confirmé par Saar** (scénarios de reprise Step3/
Step4, MJ créant son propre personnage).
**Non testé** : rien d'identifié restant sur ces deux points.
**Données** : migration 248 (additive, rétrocompatible — fiches existantes retombent sur le
comportement précédent tant que `wizard_progress` reste vide).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit ; migration `down()` fournie.

## Session (Saar) — 2026-08-19 — `PLAN_EXOARMURE.md` Lot 2bis : Armure à terre + fondation UI dédiée exo-armure

**Contexte** : reprise du chantier Exo-armures après clôture du Lot 2 (session 2026-08-18). Saar a
demandé une fenêtre dédiée aux actions exo-armure plutôt que d'empiler des branches `isExo` dans
`CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx` (déjà alourdis par le précédent `isDrone`, 16/6
occurrences scattées) — analyse à charge de l'architecture UI (`PLAN_EXOARMURE.md` §8) puis plan
détaillé du mécanisme RAW (§9), amendé sur deux points après clarification Saar : (1) le Test se
résout en phase RÉSOLUTION, jamais en Annonce (« rien ne se résout en phase Annonce, c'est dans le
nom ») — correction d'une proposition initiale erronée ; (2) exclusivité totale de l'action, réussite
et échec (confirmé après recherche BattleTech, déjà une source validée dans ce document, qui traite
le relèvement d'un mech comme consommant toute la Phase de Mouvement quelle que soit l'issue).

**RAW** : `REGLEARMURE.md:381-395` — Test de Manœuvre d'armure pour se redresser depuis `prone`,
malus/bonus par catégorie (`EXO_PRONE_RECOVERY_TABLE`, déjà transcrite Lot 1, jamais consommée avant
cette session).

**Serveur — mécanisme (`resolveExoStandUpAction`, nouveau, `socketCombatHelpers.js`)** :
- Déclaration (`socketCombatAnnouncement.js`) : détection `character.type==='exo' && prone → autre`,
  garde d'exclusivité (`getExoStandUpIneligibilityReasons`, nouveau, `shared/combatExclusiveActions.js`
  — rejet explicite si combiné à une attaque/un déplacement/une action rapide), nouvelle entrée
  `combat_actions.type='exo_stand_up'` (migration `249`, même famille que `melee`/`assault` — entrée
  d'échelle, pas une action simple), `state_position` **non écrit** à l'Annonce pour ce cas précis
  (reste `'prone'` jusqu'à la Résolution — la position visée voyage dans `modifiers.targetPosition`).
- Résolution (`socketCombatResolution.js` → `resolveExoStandUpAction`) : Seuil = Manœuvre d'armure du
  pilote + malus catégorie, noyau `computeAttackRoll` (pas `resolvePolarisTest` — erreur de citation
  trouvée et corrigée en analyse à charge : ce dernier ne produit ni `breakdown` ni bonus de Réussite
  critique, inadapté à un jet visible en chat), bonus Réussite critique + reroll Échec critique +
  Catastrophe automatique (omise puis ajoutée en analyse à charge — même règle que tout Test de
  combat). Succès → écrit `state_position` + diffuse `COMBAT_ROSTER_UPDATED` immédiatement (sinon les
  autres clients ne verraient la position à jour qu'à la prochaine fin de Tour) ; échec → aucune
  écriture, rien d'autre ce Tour (garanti par l'exclusivité de la déclaration, pas par une annulation
  a posteriori).
- **Optimisation d'architecture retenue** (pas juste un fetch dupliqué toléré) : `resolveExoContext`
  (nouveau, exporté, `combatantContextService.js`) extrait le fetch pilote+exoSheet+template commun,
  autrefois inline dans `resolveExoTestContext` — un seul aller-retour DB, réutilisable par les Lots
  4/5 à venir (Intégrité/Avaries auront le même besoin). `resolveManeuverSkillId` exportée (était
  interne, réservée à `meleeSkillCap`).
- **Trou de permission trouvé en câblant le côté MJ** (absent de l'analyse initiale) :
  `socketCombatAnnouncement.js` ne connaissait aucune permission pour `type='exo'` — tombait dans le
  `else` générique (propriétaire brut `characters.user_id` seul), rendant toute déclaration impossible
  pour un pilote ≠ propriétaire. Corrigé par **`isExoActorAuthorized`** (nouveau, exporté,
  `combatantContextService.js`) — GM, propriétaire OU pilote lié, même autorité que la décision Saar
  du 2026-07-30 pour l'édition de fiche (Lot 1 §6.3). `char-sheet.js:exoIsGmOrOwnerOrPilot` refactorée
  pour déléguer à cette même fonction plutôt que de garder sa propre copie (Règle 2 documentaire, une
  seule autorité pour ce prédicat) — comportement strictement inchangé, vérifié par lecture.
- **Deux listes blanches codées en dur trouvées en vérification finale**, après un premier jet
  syntaxiquement propre mais jamais retracé de bout en bout : (1) `buildTimelineEntries`
  (`socketCombatHelpers.js`) ne créait une entrée `combat_timeline_entries` que pour `type IN
  ('melee','assault')` — sans `'exo_stand_up'` ajouté, l'action n'était **jamais** atteinte par
  `step.kind==='entry'` ; (2) le bloc "actions simples" de `socketCombatResolution.js`
  (`whereNotIn('type', ['melee','assault'])`) aurait **en plus** intercepté la même ligne en premier
  et l'aurait marquée `resolved` sans jamais appeler `resolveExoStandUpAction` — silencieusement, sans
  erreur. Les deux corrigées. Trouvé en retraçant explicitement le cycle de vie complet de l'action
  (Annonce → `combat_actions` → `combat_timeline_entries` → dispatcher de Résolution) plutôt qu'en se
  fiant à l'absence d'erreur de syntaxe/import — la classe d'erreur la plus dangereuse ici (silence
  total, pas un crash) aurait été invisible sans cette relecture dédiée.

**Client — fondation UI (`PLAN_EXOARMURE.md` §8)** : `CombatExoActionWindow.jsx` (nouveau,
`client/src/components/`) — fenêtre minimale (bouton "Tenter de se relever" + hint, visible seulement
si `state_position==='prone'`), réutilisée à l'identique côté joueur ET côté MJ (prop `isGm` ajuste
uniquement la vérification de propriétaire côté client — le serveur reste l'autorité,
`isExoActorAuthorized`). Montée par `CombatOverlay.jsx` à la place de `CombatActionWindow`/
`CombatGmDeclareWindow` quand le slot d'Annonce actif est une exo-armure, en phase ANNOUNCEMENT
uniquement (RÉSOLUTION reste hors périmètre de ce Lot — `CombatActionWindow` continue de gérer ce cas
comme avant pour un exo, dette assumée, aucune exo-armure en jeu à ce jour pour l'exercer). Clés i18n
`combat.json:exoActionWindow.*` (namespace déjà existant, patron `stunWindow` suivi).

**Testé** : `node --check` sur tous les fichiers serveur touchés + chargement runtime réel (`import()`
dynamique) confirmant la résolution de tous les nouveaux imports, sans exception. Migration `249`
auto-appliquée par un serveur nodemon tiers actif (P53) dès l'écriture du fichier — vérifiée en base
réelle (`pg_get_constraintdef`, contrainte exacte). `combatantContextService.test.mjs` : 33/33 verts
contre PostgreSQL réel (9 nouveaux tests : `resolveExoContext` ×3, `resolveManeuverSkillId` ×1 direct,
`isExoActorAuthorized` ×4 — dont un cas propriétaire≠pilote qui aurait détecté le trou de permission
si ce test avait existé avant). `combatExclusiveActions.test.mjs` (nouveau fichier) : 6/6 verts sur
`getExoStandUpIneligibilityReasons`. Client : ESLint propre (0 problème) + build production complet
réussi (`vite build`), deux fois (avant et après l'ajout du support MJ).
**Non testé** : scénario réel en jeu (aucune exo-armure en base à ce jour, même limite que tout le
chantier depuis le Lot 1) — `resolveExoStandUpAction` elle-même n'a pas de test DB dédié (même
précédent que `resolveMeleeAction`/`resolveAssaultAction`, jamais testées ainsi dans ce projet, socket
handlers validés en jeu réel par Saar plutôt que par fixture).
**Données** : migration `249` (additive, `chk_action_type` étendu à `'exo_stand_up'`).
**Retour arrière** : rien n'est encore committé à la fin de cette session — commit à faire séparément
après revue.
