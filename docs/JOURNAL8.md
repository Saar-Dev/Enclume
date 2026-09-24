# JOURNAL8 — Décisions et validations durables

> Rôle du fichier (AGENTS.md, § Suivi & documentation) : conserve les décisions et validations durables de chaque session
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

## Session (Saar) — 2026-08-19 — `PLAN_EXOARMURE.md` Lot 3 : Initiative

**Contexte** : suite immédiate du Lot 2bis (même session). RAW (`REGLEARMURE.md:136-158`) : malus
d'Initiative propre à chaque armure (déjà en base, `ref_exo_templates.malus_init_surface`/
`malus_init_underwater`, Lot 1, jamais consommées), doublé hors-milieu ; Initiative = `min(Réaction,
Manœuvre d'armure)` (règle optionnelle, incluse comme Saisie/Armure à terre §2.2) ; seuil différé
(Initiative ≤ 0 → action reportée au Tour suivant). **Décision Saar (2026-08-19) : le seuil différé
n'est pas géré, volontairement** — une Initiative basse/négative se trie simplement en dernier via le
tri existant, aucun mécanisme "report au Tour suivant" à construire.

**Codé** — `socketCombatState.js`, handler `COMBAT_START` : branche `else if (character?.type ===
'exo')` symétrique au précédent déjà existant pour les drones (Initiative fixe, pas de `char_sheet`).
Résout `resolveExoContext` (Lot 2bis, un seul fetch pilote+template), calcule Réaction du pilote
(`calcREA`, même formule qu'un humain) et `skillTotal` de la spécialité Manœuvre d'armure du pilote
(`resolveManeuverSkillId` + `calcSkillTotal`, mêmes fonctions que le plafond de Compétence/Armure à
terre — aucune resélection locale de spécialité), `base_ini = min(réaction, skillTotal) − malus_init`.
Malus doublé pour `environment='submarine'` (hypothèse EAU1 par défaut : aucun signal d'immersion
temps réel, "surface" supposée sauf template sous-marin, même limite déjà acceptée ailleurs) ; pas de
pilote/template assigné → `base_ini` reste à son défaut 0, jamais un crash.

**Trouvaille — troisième occurrence du même bug de routage** (après confirmation de défense Lot 2 et
permission de déclaration Lot 2bis), trouvée **avant** d'écrire le code cette fois (pas après) :
`is_pnj` (`COMBAT_START`) et le ciblage du prompt `COMBAT_SURPRISE_ROLL` (`COMBAT_ANNOUNCE_START`)
lisaient tous deux le type/propriétaire brut de la fiche exo, jamais le pilote. Corrigé :
- `is_pnj` dans `COMBAT_START` — `pilot.type === 'pnj'`, réutilise directement le `pilot` déjà résolu
  par `resolveExoContext` pour l'Initiative (affiné en codant : plus efficace qu'un second appel
  `resolveCombatantIdentity` qui referait le même fetch).
- Ciblage `COMBAT_SURPRISE_ROLL` — `resolveCombatantIdentity(db, character).userId` (fonction
  différente, `pilot` hors de son scope) au lieu de `character?.user_id`.
Sans pilote assigné : `forcedNotSurprised: true` (même traitement que le drone — personne à qui
adresser un jet de Surprise manuel, pas un blocage silencieux).

**Testé** : `node --check` + chargement runtime réel (`import()` dynamique) sur `socketCombatState.js`.
`combatantContextService.test.mjs` : 33/33 toujours verts (non-régression des fonctions partagées
réutilisées ici, `resolveExoContext`/`resolveManeuverSkillId`/`resolveCombatantIdentity`, aucune
modifiée dans ce Lot).
**Non testé** : scénario réel en jeu (aucune exo-armure en base à ce jour) ; pas de test DB dédié pour
`COMBAT_START`/`COMBAT_ANNOUNCE_START` eux-mêmes (même précédent que tout socket handler de ce projet,
jamais testés par fixture).
**Données** : aucune migration — code seul, les colonnes `malus_init_*` existent depuis le Lot 1.
**Retour arrière** : rien n'est encore committé à la fin de cette session — commit à faire séparément
après revue.

## Session (Saar) — 2026-08-19 — Ticket "Inventaire validé"

**Contexte** : badge "Validé" / bouton "Valider" (`validated_by_gm`, `InventoryPanel.jsx#ItemRow`)
visibles partout où le composant est monté — fiche permanente en campagne, Coffre standalone
(`VaultCharacterPage.jsx`), export PDF (`CharacterPrintView.jsx`) — alors que la review MJ du
matériel n'a de sens que pendant le Wizard Step 7 (Matériel). Pas une régression : `docs/Old/
PLAN_WIZARD_MATERIEL_GAUGES.md` prévoyait explicitement le partage Wizard + fiche permanente à la
conception ; décision produit de Saar de restreindre l'exposition au seul Wizard, `validated_by_gm`
reste correct et inchangé en base (POST /inventory continue de dériver `autoValidate` de `req.isGm`,
partout).

**Codé** : nouvelle prop `inWizard` (défaut `false`) sur `InventoryPanel` et `ItemRow`
(`InventoryPanel.jsx`), passée aux deux instanciations d'`ItemRow` (Sac/Ceinture, Coffre). Bouton et
badge gatés par `inWizard && ...` en plus des conditions existantes (`isGm`/`hasCampaign`) — même
idiome de *conditional rendering* déjà en place sur ce bloc (élément jamais monté dans le DOM à
`false`, pas un masquage CSS), confirmé comme la bonne pratique sur question directe de Saar. Seul
`StepMaterielEtBiens.jsx` (Wizard Step 7) passe `inWizard` ; `CharacterWindow.jsx` et
`CharacterPrintView.jsx` inchangés, la valeur par défaut suffit.

**Testé** : confirmé fonctionnel par Saar en navigateur (badge/bouton disparus en fiche de campagne
et en Coffre standalone, toujours visibles en Wizard Step 7 pour le MJ).
**Non testé** : export PDF (aucun changement de code sur ce chemin — `inWizard` non passé, défaut
`false`, même comportement attendu que Coffre/campagne — non revérifié séparément).
**Données** : aucune migration, aucun changement serveur.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit (pas de migration à défaire).

## Session (Saar) — 2026-08-19 — Ticket "Admin - Ticket - Créer un ticket"

**Contexte** : suggestion — permettre la création d'un ticket directement depuis `/admin/tickets`,
sans repasser par le formulaire joueur `/tickets/new`. `POST /api/tickets` (`ticketService.
createTicket`) existait déjà et fonctionne pour tout compte authentifié : `origin` est dérivé
serveur depuis `users.role`/`campaign_members.role` (`resolveOrigin`), donc un admin qui l'appelle
obtient déjà `origin='admin'` sans rien à ajouter côté serveur — vérifié sur les tickets `origin=
'admin'` déjà en base, tous créés par ce chemin. Aucune route ni service serveur créés.

**Codé** : `AdminTicketsPage.jsx` — bouton "+ Nouveau ticket" à côté du titre, ouvrant
`CreateTicketPanel` (nouveau composant local, même patron que `TicketRow` : état local, pas de
remontée de draft). Mêmes 4 champs que `ReportTicketPage.jsx` (catégorie/domaine/titre/description),
mêmes clés i18n `form.*` déjà chargées dans ce namespace et déjà réutilisées par cet écran pour les
badges. `CATEGORY_KEYS`/`DOMAIN_KEYS` dupliqués localement, même convention que `ORIGINS`/`STATUSES`/
`PRIORITIES` déjà en tête de fichier (miroir des CHECK serveur). Soumission → `POST /tickets` (pas
`/admin/tickets`, qui reste lecture/patch only) → `load()` + `loadStats()` + fermeture du panneau.
Pas de `context` envoyé (pas de path/user_agent pertinent pour une création admin, à la différence
du signalement joueur). 2 nouvelles clés i18n (`admin.create.button`/`admin.create.title`).

**Testé** : ESLint propre sur `AdminTicketsPage.jsx`, JSON `tickets.json` valide. Confirmé fonctionnel
par Saar en navigateur (création depuis `/admin/tickets`, ticket apparu dans le groupe "Admin").
**Non testé** : rien d'identifié restant.
**Données** : aucune migration, aucun changement serveur.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-19 — Ticket "COFFRE-INVROOM1"

**Contexte** : ticket écrit le 2026-08-16 (audit de code, `server/src/scripts/ticket_coffre_invroom.js`),
supposant `char_sheet.wizard_locked_at` NULL en permanence pour un personnage Coffre "direct" (construit
hors Wizard), faisant replier `resolveInventoryBroadcastRoom` vers une room `wizard:<sheetId>` jamais
observée. **Prémisse obsolète** : `charSheetService.js#createEmptySheet` pose déjà `wizard_locked_at =
now()` dès la création (même date, chantier Coffre) — cette branche ne se déclenche donc plus jamais
pour ces personnages. La vraie fuite, trouvée en relisant le code plutôt qu'en faisant confiance au
texte du ticket (CLAUDE.md §1) : la fonction retombe sur `return campaignId`, `null` pour un Coffre-
natif, transmis tel quel à `io.to(room).emit(...)` sur 7 routes inventaire — exactement la même classe
de bug déjà trouvée et corrigée sur `PUT /sols` (commentaire déjà présent dans le fichier, 2026-08-16 :
« io.to(null) n'aurait pas planté... mais l'émetteur n'aurait jamais reçu la confirmation de sa propre
action »), jamais répliquée sur `resolveInventoryBroadcastRoom`. Rendu pertinent par le commit
`259d884` (Coffre : construction directe + catalogue équipement, juste avant cette session) qui rend
ces routes désormais atteignables pour un personnage Coffre direct.

**Codé** — `char-sheet.js` : `resolveInventoryBroadcastRoom` retourne explicitement `null` (au lieu de
`campaignId` brut) ; nouvelle fonction `emitInventoryEvent(io, room, event, payload)` (garde `if
(room)`) remplaçant les 10 appels `req.app.get('io').to(room).emit(...)` dispersés sur 7 routes
(quick-equip, POST inventory ×3, PUT inventory, reload ×2, DELETE ×2, gauges) — centralisé une fois
plutôt que le garde-fou dupliqué à chaque appelant.

**Testé** : `node --check` sur le fichier serveur touché, rechargement nodemon sans erreur (`/api/
health` 200 après coup). Confirmé fonctionnel par Saar (ajout d'item sur une fiche de campagne,
chemin non-Coffre inchangé). Pas de scénario Coffre dédié testé : impact nul en pratique aujourd'hui
(`VaultCharacterPage.jsx` ne monte pas `SocketProvider`, personne n'écoute la room de toute façon) —
correctif préventif, même logique que celui déjà validé par Saar sur `/sols` avant que ce soit
observable.
**Non testé** : scénario Coffre réel (aucun listener socket sur cette page à ce jour pour l'exercer).
**Données** : aucune migration, aucun changement client. Pas d'entrée `CHANGELOG.md` — correctif serveur
sans impact visible utilisateur aujourd'hui.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-19 — Ticket "DEP1" — Allure Maximale accessible chargé/encombré

**Contexte** : RAW (`REGLES_LdB.md:286-292`) — l'Allure rapide est déjà "la vitesse d'un personnage
qui court tout en étant chargé et/ou encombré" ; l'Allure maximale exige explicitement d'être "sans
être encombré d'aucune manière". `shared/polarisUtils.js#calcAllures` ne prenait aucun paramètre de
poids — les 4 allures dérivaient uniquement de Coordination/Athlétisme, sans jamais consulter le poids
porté. MUT4 (même session, voir plus haut) a été reporté juste avant celui-ci pour comparaison : ce
ticket-ci restait mécanisable simplement car le projet a déjà une autorité unique pour "ce personnage
est chargé" — `inventoryService.js#getInventory` calcule déjà `ini_penalty` (poids porté > FOR ×
multiplicateur de campagne, 0 si `encumbrance_enabled=false`), consommé jusqu'ici pour le seul malus
d'Initiative porté.

**Codé** — `movementBudgetService.js#getCharacterMovementBudget` : appelle en plus `inventoryService.
getInventory(characterId, character.campaign_id)` ; si `ini_penalty > 0`, `allures.max` est ramené à
`allures.rapide` avant le calcul du budget — l'Allure maximale devient numériquement inaccessible
(`selectMovementBudget`/`selectCombatMovementForCost` ne peuvent plus la sélectionner pour aucun coût).
`calcAllures` lui-même non touché (fonction pure, réutilisée par `CharacterSheet.jsx`/
`CombatActionWindow.jsx` pour un affichage informatif hors périmètre de ce bug — RAW qualifie
d'ailleurs l'Allure maximale de valeur "à titre indicatif"). Ne concerne que les personnages humains
(PJ/PNJ) — `getCharacterMovementBudget` bifurque déjà avant sur `type==='exo'` (Vitesse), et un drone
n'a pas de `char_sheet` du tout (mouvement géré ailleurs, hors branche touchée).

**Testé** : `node --check`, suite existante `movementBudgetService.test.mjs` (2/2 verts, aucune
régression), rechargement nodemon sans erreur (`/api/health` 200 après coup). Confirmé fonctionnel par
Saar en navigateur (personnage chargé au-delà du seuil ne dépasse plus l'Allure rapide en combat).
**Non testé** : rien d'identifié restant.
**Données** : aucune migration, aucun changement client (le budget vient du serveur à la déclaration
du mouvement).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-19 — Ticket "CHARSTORE-NULLISH1"

**Contexte** : `characterStore.js#setMembers` — `members.find(m => m.id === userId)?.role === 'gm' ??
false`. `?.role === 'gm'` retourne déjà un booléen dans tous les cas (`===` ne produit jamais
`undefined`/`null`, même quand `?.role` vaut `undefined`) — le `?? false` qui suit était du code mort,
jamais atteignable (warning ESLint `no-constant-binary-expression`). Cosmétique, confirmé sans impact
fonctionnel avant correctif (ticket lui-même le qualifiait ainsi).

**Codé** : `?? false` retiré. Comportement strictement identique (`isGm` reste `true`/`false` dans
tous les cas).

**Testé** : ESLint propre sur `characterStore.js` (warning disparu). Aucun scénario navigateur
nécessaire — comportement observable inchangé par construction.
**Non testé** : rien d'identifié restant.
**Données** : aucune migration, aucun changement serveur.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-19 — Ticket "DCO1" — déjà résolu

**Contexte** : ticket "onTokenRotate est du code mort dans Canvas3D/Scene", importé en base le
2026-08-12 depuis `BUGIDENTIFIE.md`. Recherche exhaustive : `onTokenRotate` n'existe plus nulle part
dans le code source (client ou serveur), seulement dans des docs archivées. `git log -S` le localise
supprimé dans `def3e59` ("Session 142 (Saar) — Lot 8 PLAN_FUSION : nettoyage Canvas3D + placement
libre MJ", 2026-07-15) — avec 3 autres props mortes (`moveLabels`, `announcementMarker`, import
`yToLevel`) du même nettoyage. Le ticket était donc déjà obsolète au moment de son import (2026-08-12),
un mois après la suppression réelle.

**Codé** : rien — aucune trace à corriger. Ligne DCO1 retirée de `docs/EN_COURS.md` (même dette,
jamais nettoyée après le commit `def3e59`).

**Testé** : recherche exhaustive confirmant l'absence totale de `onTokenRotate` dans le code actuel.
**Non testé** : sans objet.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-19 — Ticket "DARTS-TAGDUP"

**Contexte** : `shared/weaponAmmoDsl.js#parseAmmoEffects`, bloc `TXT=` — chaque sous-tag `clé=valeur`
était écrit dans `result.tags[clé]` sans garde de collision. 10 lignes du catalogue (toutes les
munitions "Darts", perforantes sous-marines) portent `TXT=...|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE`
— deux seuils de profondeur légitimement distincts (RAW : au-delà de 500m portée ÷2, au-delà de 1000m
arme inutilisable), mais la même clé `DEPTH` deux fois. Le second écrasait silencieusement le premier.

**Question posée par Saar avant de coder** : sans aucun consommateur de `tags.DEPTH` (vérifié —
`damageService.js` ne lit que `tags.FX`), comment "résoudre" ce ticket sans deviner une forme de
données pour une mécanique de profondeur qui n'existe pas ? Reformulé et tranché avec Saar : impossible
de corriger un *comportement* (aucun n'existe), possible de corriger la *robustesse du parseur* (ne
plus perdre silencieusement une donnée présente dans la chaîne brute) sans y ajouter de mécanique de
jeu. Décision Saar : option retenue.

**Codé** : dans le bloc `TXT=`, une clé déjà vue accumule désormais en tableau
(`tags.DEPTH = ['>500M_X0.5', '>=1000M_DISABLE']`) au lieu d'écraser — générique, pas spécifique à
`DEPTH`. Le seul tag réellement consommé aujourd'hui (`tags.FX`, jamais dupliqué en pratique) reste une
string simple, non affecté. Nouveau test dans `weaponAmmoDsl.test.mjs` couvrant le cas de double clé.

**Testé** : `node --test shared/weaponAmmoDsl.test.mjs` — 17/17 verts (fonction pure, aucune dépendance
DB/réseau), y compris le test `FX` existant (non-régression sur le seul consommateur réel).
**Non testé** : sans objet — aucun consommateur à exercer en jeu.
**Données** : aucune migration, catalogue `ref_equipment` inchangé (c'est le parseur qui était en
cause, pas la donnée source).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-19 — `PLAN_EXOARMURE.md` Lot 4 : Pipeline de dégâts

**Contexte** : câblage de l'onglet Avaries de `ExoSheetWindow.jsx` (fenêtre fiche exo, même session) —
le compteur reste vide sans ce lot, donc prérequis plutôt que sous-produit. RAW
(`REGLEARMURE.md:317-407`) : seuils de Dommages 5/10/15/20/25/30 (Blindage retranché avant seuillage),
compteur d'Avaries même principe que les Blessures (ligne pleine → case au niveau supérieur, ligne
effacée), perte définitive d'ITG Structure sur transition 0→1 uniquement (pas à chaque coup). Table de
cases/modificateurs transcrite depuis une capture Saar de la page 326, confirmée par Saar. Détail
complet du raisonnement RAW, de l'analyse à charge et de la cartographie des sites de code :
`docs/PLANS/PLAN_EXOARMURE.md` §11 (rédigé en amont, pas réécrit ici pour éviter la duplication).

**2 décisions RAW tranchées par Saar avant code (§11.6)** : débordement de Catastrophique (2/2 pleines)
→ Lot 4 s'arrête à la perte d'ITG + `destroyed: true`, protocole complet en Lot 6 ; ambiguïté
Destruction (tableau "-2 ITG" vs texte narratif "vous pouvez considérer... tombe à 0") → le -2 chiffré
fait foi, la phrase narrative reste une simplification optionnelle MJ, jamais appliquée par défaut.

**Cartographie exhaustive avant code** : lecture personnelle intégrale de `socketCombatHelpers.js`,
`socketCombatResolution.js`, `damageService.js` (doublée d'une première passe par agent, puis vérifiée
site par site moi-même) — **10 sites**, pas les ~6 estimés au départ. 6 nouvelles branches
`cibleType === 'exo'` (5 en miroir direct d'une branche drone déjà existante, 1 sans précédent). 4
corrections de filature préexistantes, indépendantes du Lot 4 mais bloquantes pour lui : `cibleType`
absent de la déstructuration `pending` et du `ctx` reconstruit dans `confirmMeleeDefense`, absent du
payload `armAwaitingDamage` dans `resolveMeleeDefenseHitAttackerPj`, et carrément codé en dur à `'pj'`
dans `resolveMeleeDefenseHitAttackerPnj` (garde `hitResult===null` structurellement morte jusqu'ici).
Sans ces 4 corrections, une exo pilotée par un PJ serait restée cassée en CaC même après tout le reste.

**Codé** :
- `shared/exoConstants.js` — `EXO_AVARIE_TABLE`, `EXO_AVARIE_SEVERITY_ORDER`.
- `shared/events.js` — `EXO_AVARIE_UPDATED`.
- `server/src/lib/charStats.js` — `calcExoDegatsNets` (réutilise `stats.rd` déjà calculé par
  `computeExoStats`, jamais une deuxième lecture de la table RD).
- `server/src/lib/exoAvarieService.js` (nouveau) — `severityForExoDamage` (seuils propres, volontairement
  pas un partage de `_severityForDamage` humain malgré des seuils numériquement identiques — deux
  tables RAW indépendantes, coïncidence pas couplage) ; `applyExoAvarie` (transactionnel, `.forUpdate()`
  même patron que `coldExposureService.js`/`fatigueService.js`, cascade de promotion récursive,
  perte d'ITG sur transition 0→1) ; `resolveExoDamage` (orchestrateur `resolveExoContext` →
  `calcExoDegatsNets` → `severityForExoDamage` → `applyExoAvarie`, point de couture unique réutilisé
  par les 6 sites A plutôt que dupliqué).
- `server/src/lib/damageService.js:310` — early-return `cibleType === 'exo'`, miroir du drone.
- `server/src/socket/socketCombatHelpers.js` — les 10 sites (catégories A/B, détail `PLAN_EXOARMURE.md`
  §11.4/§11.7). Commentaire du stub neutralisant (`resolveMeleeAction`) mis à jour, **le stub lui-même
  n'est pas retiré** — décision prise en cours de code (pas dans le plan initial) : le nouveau pipeline
  ne lit jamais `char_sheet_id_cible`/`for_na_cible` (passe par `characterIdCible`/`resolveExoContext`),
  les laisser passer aurait changé un comportement hors périmètre (bonus terrain instable défenseur)
  sans décision explicite.

**Trouvaille en cours de relecture (pas dans le plan initial)** : ma première formulation du plan
disait "perte d'ITG une fois par coup qualifiant" — faux, corrigé en analyse à charge avant tout code
(le RAW dit explicitement que seul le *premier* franchissement d'un seuil coûte un point, pas chaque
coup à ce palier). Autre trouvaille, distincte, en cartographiant les sites : `resolveAssaultAction:2974`
— un tireur exo n'est jamais dispatché comme `'pj'` même piloté par un joueur (toujours auto-résolu
comme PNJ pour le Tir, contrairement au CaC qui gère correctement le pilote) — anomalie côté attaquant,
hors périmètre de ce lot (défenseur), signalée dans `PLAN_EXOARMURE.md` §11.4 pour ne pas être reperdue.

**Testé** : `node --check` sur tous les fichiers modifiés ; chargement runtime réel (import direct des
3 modules touchés, détecte les cycles) ; 15/15 tests `exoAvarieService.test.mjs` (seuils, cascade/
promotion sur 3 paliers, transition 0→1 de la perte d'ITG, débordement Catastrophique→Destruction,
Destruction directe inconditionnelle, plancher ITG à 0, orchestrateur complet avec BLD/RD réels contre
un vrai template) ; 192/192 tests `server/src/lib/*.test.mjs`+`socket/*.test.mjs`+`shared/*.test.mjs`
(aucune régression sur la suite existante).
**Non testé** : scénario réel navigateur — `ref_exo_templates` toujours à 0 ligne (aucun modèle seedé,
blocage indépendant du code), aucun des 10 sites de branchement n'a donc jamais vu passer un vrai
combat exo. Seule la logique pure (`exoAvarieService`) est vérifiée contre PostgreSQL réel.
**Données** : aucune migration — les colonnes `avaries_*`/`itg_structure_current` existent depuis le
Lot 1 (migration 233).
**Retour arrière** : rien n'est encore committé à la fin de cette session — commit à faire séparément
après revue.

## Session (Saar) — 2026-08-19 — Ticket "I18N-LINT2" — faux positif ESLint, rien à corriger

**Contexte** : ticket "Variables/props inutilisées (ESLint) dans plusieurs fichiers Combat. Traité
partiellement." Sur les 3 fichiers Combat remontant encore un souci ESLint (`CombatGmDeclareWindow.jsx`,
`CombatModifiersWindow.jsx`, `CombatTimeline.jsx` — scan complet `npx eslint src`), les deux premiers
n'ont plus que des erreurs `react-hooks/set-state-in-effect` (hors périmètre, voir I18N-LINT3). Seul
`no-unused-vars` restant : `motion` (import `motion/react`) dans `CombatTimeline.jsx:3`.

**Faux positif confirmé** : `motion.div` est utilisé 4 fois dans le fichier (lignes 172-232, animation
des cartes de timeline) — le supprimer casserait le composant. `AnimatePresence`/`LayoutGroup`, importés
à côté et utilisés en JSX direct (`<AnimatePresence>`), sont eux correctement reconnus par ESLint ;
seul l'usage via accès membre (`<motion.div>`) semble échapper à l'analyse `no-unused-vars` de cette
configuration — limitation d'outillage, pas du code mort.

**Codé** : rien — aucune trace réelle à corriger sans casser le composant.

**Testé** : `npx eslint src` (scan complet client), lecture directe du fichier confirmant les 4 usages
de `motion.div`.
**Non testé** : sans objet.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-19 — Ticket "HORLOGE-TEST1" — déjà résolu

**Contexte** : ticket "adjustGameTime (gameTimeService.js) n'a aucun test automatisé — seule la
projection pure shared/gameTime.js est testée." `server/src/lib/gameTimeService.test.mjs` existe
depuis le commit "Blessures/Guérison Lot 2 (moteur d'échéances)" du 2026-07-30 — 13 jours **avant**
l'import de ce ticket (2026-08-12). `adjustGameTime` y a 5 tests dédiés (4 cas resolved/displayed +
delta=0 rejeté, débordement integer Postgres positif et négatif, garde avance en attente déjà posée,
balayage automatique des échéances dans la même transaction) ; `requestGameTimeAdvance`/
`confirmPendingAdvance`/`cancelPendingAdvance` sont couvertes aussi (14 tests au total). Ticket déjà
obsolète au moment de son import, même schéma que DCO1 (2026-07-15) et BETA-7 (2026-08-11) plus tôt
cette session.

**Codé** : rien — la couverture demandée existe déjà.

**Testé** : `node --test server/src/lib/gameTimeService.test.mjs` contre PostgreSQL réel — 14/14 verts.
**Non testé** : sans objet.
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Saar) — 2026-08-19 — Ticket "SCHEMADRIFT-BATTLEMAPSVOXEL1"

**Contexte** : `battlemaps.voxel_data` n'a aucun défaut en base réelle (vérifié : `column_default`
NULL), alors que la migration d'origine (`20260330_13_battlemaps_voxel_data.js`) posait
`defaultTo('[]')` — un défaut **tableau**, alors que `routes/battlemaps.js:872` traite `voxel_data`
strictement comme un **objet** et rejette explicitement un tableau (`Array.isArray` → 400) ; la
création d'un battlemap (`routes/battlemaps.js:184`) ne fournit d'ailleurs jamais `voxel_data`
explicitement, dépendant entièrement de ce défaut, faux dès l'origine. Quelqu'un l'a corrigé
directement en base (`DROP DEFAULT`) sans jamais l'écrire en migration — dérive constatée entre
l'historique versionné et le schéma réel. Aucun impact fonctionnel aujourd'hui : le code de lecture
(`current.voxel_data || {}`) tolère déjà `NULL`.

**Codé** — même patron déjà établi pour `SCHEMADRIFT-EXOTEMPLATES1` (2026-08-12) :
- `testHelpers/schemaAssertions.mjs` — nouveau helper `assertColumnDefault(db, table, column,
  expectedDefault)`, même style que les 3 helpers existants (lit `information_schema.columns` en
  base réelle, jamais via `up()`/`down()` — détecte une dérive même si la migration a déjà tourné).
- Migration `250_battlemaps_voxel_data_drop_default.js` (numéro vérifié contre `knex_migrations`,
  249 = dernière appliquée) — `up` : `ALTER TABLE battlemaps ALTER COLUMN voxel_data DROP DEFAULT`
  (même syntaxe déjà utilisée dans `137b_ref_equipment_archive_side_effects.js`) ; `down` : restaure
  `DEFAULT '[]'::jsonb` (état d'origine exact). Additif et idempotent — no-op sur une base qui a déjà
  ce défaut retiré.
- Test dédié : test "schéma réel" toujours actif + test transactionnel up/down classique (`assert.
  rejects` sur un rollback volontaire, même patron que `242_char_gauges.test.mjs`).

**Testé** : migration appliquée en base réelle via `db.migrate.latest()` (vérifié `knex_migrations`
avant, P54 — batch 167, seule cette migration en attente). `node --test` sur le nouveau fichier (2/2
verts) et sur `242_char_gauges.test.mjs` (non-régression du helper partagé, 3/3 verts). Serveur de dev
relancé par Saar, confirmé fonctionnel.
**Non testé** : rien d'identifié restant — correctif purement schéma, aucun comportement applicatif
changé.
**Données** : migration 250 (additive, idempotente, `down()` fourni).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit ; `down()` restaure l'état
d'origine si besoin.

## Session (Saar) — 2026-08-19/20 — `PLAN_EXOARMURE.md` §12 : catalogue `ref_exo_equipment` + seed des 16 armures RAW

**Contexte** : Saar a extrait `docs/REGLES/SEEDEXO.md` (RAW complet, 1709 lignes) — le catalogue des
systèmes/armes montables sur une exo-armure et les ~16 armures prémade avec leur loadout par défaut.
`ref_exo_templates` était à 0 ligne depuis sa création (migration 233, Lot 1) : aucune exo-armure
réelle n'avait jamais existé en base, bloquant tout test navigateur des Lots 1-4. Deux passes
d'analyse à charge (§12.1bis) ont d'abord verrouillé la taxonomie/le format de prix avant tout code
("on ne suppose pas, jamais", exigé explicitement par Saar après une première passe déjà faite) : en-tête
de tableau source faux trouvé (SEEDEXO.md:789, "SYSTÈMES FURTIFS" dupliqué contenant en réalité les
Systèmes divers), Systèmes défensifs reclassés `family='arme'` (RAW explicite), prix non-flat repris
en `price`+`price_modifier` (patron `ref_equipment` déjà résolu, pas réinventé).

**Codé** — passe systématique complète des 1709 lignes en une session (pas seulement les en-têtes,
contrairement à la première ébauche) :
- Migration `251_ref_exo_equipment.js` — nouvelle table (schéma calqué `ref_equipment` : `family`
  CHECK arme/systeme, `category`, `price`+`price_modifier`, `rarity`, `init_mod`/`fire_mode` avec les
  mêmes CHECK). Deux colonnes propres au catalogue exo, chacune justifiée par plusieurs lignes RAW
  réelles : `max_level` (plafonds "X/niv.") et `duration` (colonne Capacité, Supports vitaux).
- Migration `252_seed_ref_exo_templates.js` — les 16 armures RAW (Explora, Typhon, Nymph 1-A, Série A,
  Vanguard, Sylph 56, Vauban, Condor, Cougar, Mentor, Heimdall-Pyrelia, Ouraken, Odin, Vulcain, Moloch,
  Orka), aucune colonne ajoutée (233+243 suffisaient déjà — `speeds_extra`/`underwater_movement_mode`/
  `surface_movement_mode` couvrent déjà les cas Explora "vitesse du pilote" et Vulcain "bloqué à terre").
- Migration `253_seed_ref_exo_equipment.js` — 84 lignes (arme=17, systeme=67), plus que l'estimation
  initiale "~34 systèmes + ~10 armes" du §12.3 (chaque variante nommée compte séparément, comme le fait
  le RAW lui-même). Une incohérence source de plus trouvée en transcrivant les données (pas seulement
  les en-têtes) : Générateurs défensifs micro-ondes affichait une Disponibilité "210 (15)" (chiffre
  parasite), corrigée en "10 (15)", documentée en tête de fichier de migration plutôt que corrigée
  silencieusement.
- 3 fichiers `.test.mjs` dédiés (patron `schemaAssertions.mjs`, même style que 233/243/250) : schéma
  réel toujours vérifié, up/down transactionnel, CHECK constraints, et pour les seeds un test data qui
  recontrôle des valeurs réelles en base (pas seulement "la migration a dû tourner sans erreur").

**Vérifications indépendantes faites avant/après coup** : cross-check `computeExoStats` à Intégrité
pleine contre les 16 fiches RAW (EXF/Blindage recalculés = valeurs de fiche, 16/16, pas une simple
relecture du texte) ; RD par catégorie déjà confirmé contre `EXO_RD_TABLE` en amont (§12.1bis).

**Testé** : 3 migrations testées up→down→up en CLI knex + suite serveur complète (`node --test`, 55
fichiers, PostgreSQL réel) rejouée après coup — 348/348 verts, 0 régression. 7 tests dédiés
251/252 + 2 dédiés 253.
**Non testé** : navigateur réel — `ExoIdentityPanel.jsx` lit déjà `ref_exo_templates` pour son
sélecteur Modèle, donc testable pour la première fois, mais pas piloté par Claude (pas de navigateur
côté agent). `ref_exo_equipment` n'a aucun consommateur UI aujourd'hui (seed pur, en attente Lot 5e).
**Non tranché, documenté §12.2/§12.4** : lien template↔loadout par défaut (penche "copie narrative",
pas vérifié sur les 16 loadouts), pipeline de dégâts d'une exo qui tire (`resolveExoDamage` ne couvre
que l'exo défenseur), formule de dégâts à escalade (`3D10 (+3/Tr)`, texte stocké tel quel), mécaniques
secondaires (auto-réparation, malus d'Initiative par interface — pas encore posées à Saar).
**Données** : migrations 251 (schéma) + 252/253 (100 lignes de données neuves au total), aucune table
existante modifiée.
**Retour arrière** : `down()` testé et propre sur les 3 migrations ; commit isolé sur `dev/Saar`
(`8e9bb8f`), `git revert` suffit.

---

## Session (Saar) — 2026-08-22 — INV7 (slot d'équipement silencieusement absent) + INV1 (Sac à dos/Ceinture jamais réellement équipables)

**Contexte** : signalé par Saar comme "armures humanoïdes n'ont pas de slot ouvert pour être
équipées" sur le distant fraîchement resynchronisé, immédiatement soupçonné (par Saar) d'être une
dérive de migration — écarté après lecture : le gate fautif est du code client identique en local et
distant, aucun rapport avec le chantier migrations en parallèle.

**INV7** — `InventoryPanel.jsx:564` (`ItemRow`) et `LocationPanel.jsx:58` (`availableItems`)
n'affichaient un contrôle d'équipement que si l'item était déjà dans le container "Sac" — jamais s'il
restait au Coffre (défaut de tout nouvel ajout), sans aucun message. **Premier correctif rejeté par
Saar** : retirer purement la condition (le serveur relocalise déjà `container → 'Sac'` en équipant)
cassait un invariant non négocié — porter doit rester un geste explicite du joueur (poids porté),
jamais un effet de bord silencieux d'équiper. Correctif retenu : la condition reste, `LocationPanel.jsx`
calcule en plus `storedCandidates` (items compatibles au Coffre) et affiche nom + bouton "Sac" dédié
(réutilise `setItemContainer`) au lieu d'un menu silencieusement vide ; `InventoryPanel.jsx` avait déjà
ce bouton, seul `handleEquip` ne remontait qu'un `console.error` — branché sur `equipError`/
`isOfflineQueuedError` (même mécanisme que `LocationPanel.jsx`).

**INV1** — diagnostic précédent ("aucun moyen d'équiper un sac") incomplet : `ContainerPanel.jsx`
existait déjà et était déjà câblé (`WeaponPanel.jsx`, section "Conteneurs portés", slots `D`/`Ce`),
non trouvé par l'analyse antérieure. Deux vrais manques dans `inventoryService.js` : (1)
`isContainerAvailable`/`getDefaultContainer` testaient la simple possession d'un item
`ref_location==='D'` n'importe où (Coffre inclus), pas son équipement réel — corrigé, lisent
désormais `char_inventory_slots` directement ; (2) équiper le Sac à dos/la Ceinture (`slot='D'`/`'Ce'`)
ne forçait jamais son propre `container` — seule exception parmi toutes les branches équipement du
fichier — corrigé dans `addItem` et `updateItem`, symétrique confirmé par Saar pour Ceinture. Cascade
au déséquipement (bac non vide) tranchée par Saar après analyse à charge UX proposée : avertissement
puis confirmation explicite, jamais silencieux — `updateItem` refuse (409, décompte exact) sans
`confirmEmptyContainer`, exécute la relocalisation en Coffre atomiquement dans la même transaction si
confirmé ; `ContainerPanel.jsx` déclenche `window.confirm` sur ce refus précis. Diffusion multi-client
des objets cascadés : réutilise l'event `INVENTORY_UPDATED` existant (un par objet), aucun nouveau
mécanisme — `io.to(room)` inclut déjà l'émetteur, donc pas de refetch client à ajouter.

**Piège trouvé et corrigé en cours de route** : forcer `container` sur `slot='D'`/`'Ce'` redéclenchait
la validation générale `isContainerAvailable` juste après coup — aurait bloqué le tout premier
équipement d'un sac (poule/œuf : "Sac" pas encore disponible au moment même où on le rend disponible).
Contourné explicitement (`skipContainerAvailabilityCheck` dans `updateItem`, `containerSelfGranted`
dans `addItem`).

**Découvert en clôturant, sans rapport avec INV1/INV7** : `errorHandler.js` renvoie
`{ error: { status, message, i18nKey } }` (un objet) — `err.response?.data?.error` seul (sans
`.message`) affiche `[object Object]`. Pattern déjà correct ailleurs dans le projet (`WeaponPanel.jsx`
et une majorité d'autres fichiers), mais copié en mauvais depuis du code déjà buggé
(`LocationPanel.jsx`, pré-existant) dans les 3 fichiers touchés ici — corrigé. 7 autres fichiers du
projet portent le même bug, non corrigés (hors périmètre), listés en pitfall `EN_COURS.md` (PC48).

**Testé** : lint ciblé (`eslint`) sur les 6 fichiers client touchés — propre à chaque étape ;
`node --check` sur les 2 fichiers serveur touchés — propre. Confirmé fonctionnel en jeu par Saar
(équiper/déséquiper armure depuis le Coffre, Sac à dos et Ceinture, cascade avec objets dedans,
messages d'erreur lisibles).
**Non testé** : suite serveur `node --test` (pas d'accès DB locale dans cette session) — comportement
vérifié uniquement par lecture croisée + confirmation en jeu de Saar, pas par un test automatisé
dédié à `isContainerAvailable`/la cascade. Reste une dette : ajouter des tests Node pour ce chemin
avant la prochaine session touchant `inventoryService.js`.
**Données** : aucune migration.
**Retour arrière** : diff isolé sur 8 fichiers (`inventoryService.js`, `char-sheet.js`,
`inventoryMutations.js`, `InventoryPanel.jsx`, `LocationPanel.jsx`, `ContainerPanel.jsx`), pas encore
committé au moment de la rédaction de cette entrée.

## Session (Saar) — 2026-08-22 — `PLAN_MIGRATIONS_REFONTE.md` Phase 2 : refonte complète du système
de migrations (~260 → 310 fichiers, une création + un seed par table) + clôture `PLAN_EXOEQ_FUSION.md`

**Contexte et décision** : Saar reformule l'objectif en cours de session — pas seulement le cluster
`ref_equipment` (Phase 1, déjà close), mais la totalité du projet : chaque table devient une migration
de création + (si besoin) une migration de seed, plus aucun patch empilé dans le temps. Nouvelle base,
`vtt` jamais touchée ni reclonée, aucune donnée jouée reprise (comptes, personnages, parties) sauf le
compte admin. Priorités explicites de Saar tenues tout du long : qualité avant vitesse, vérifier même
quand ça ne trouve rien, aucune limite de temps.

**Méthode** : `migradiff` (fork maintenu de `migra`, pas l'original déprécié — corrigé après une
première installation erronée) pour générer le schéma complet en une seule passe (99 tables, une
seule fois, pas table par table) depuis un rejeu neuf des ~275 migrations existantes sur base jetable
(`enclume_squash_check`, jamais `vtt`). Script de découpage maison (paren/quote-aware) pour répartir
la sortie en fichiers par table, en 3 vagues strictement séparées : structure (colonnes seules),
contraintes non-FK (index, PK, UNIQUE, CHECK), puis clés étrangères — nécessaire après avoir trouvé
une vraie dépendance circulaire (`campaigns` ↔ `battlemaps`, chacune référence l'autre) qui aurait
rendu impossible un fichier unique "table + ses propres FK" quel que soit l'ordre.

**Audit avant confiance (pas supposé)** : comparaison systématique, table de référence par table de
référence, entre `vtt` (vivante) et un rejeu neuf des migrations, en résolvant les FK vers des clés
stables (`code`/`name`, jamais les `id` UUID aléatoires) pour ne pas se faire piéger par
`SEED-ID-DETERM`. Résultat : la grande majorité déjà identique (confirme que Phase 1 et
`PLAN_EXOEQ_FUSION.md` étaient bien complets) ; dérive réelle trouvée et tranchée avec Saar sur
`ref_skills` (6 catégories ajoutées à la main sur `vtt`, jamais migrées ; ~20 corrections
d'orthographe ; `ARTS_MARTIAUX.marker` tranché à `null`) et `ref_skill_requirements` (une faute de
frappe d'origine corrigée à la main, jamais migrée, + 1 ligne ajoutée à la main) — version `vtt` fait
foi dans tous les cas. Catalogue de textures (`texture_packs`/`texture_pack_categories`/
`voxel_textures`) : Saar a tranché de ne pas l'importer du tout (tables créées vides, pour ne pas
casser les 2 FK réelles qui pointent dessus — `battlemap_texture_usage`, `entity_blueprints`).

**Bugs réels trouvés en testant, aucun deviné** :
- Tri alphabétique par défaut de Knex casse l'ordre au-delà de 9 fichiers — confirme la nécessité du
  `NaturalMigrationSource` déjà en place, pas un défaut à corriger.
- Séquences Postgres non marquées `OWNED BY` dans les fichiers générés — un rollback laissait la
  séquence orpheline, empêchant de rejouer la migration.
- `knex('table').insert([])` lève une exception — les 2 tables de référence vides à ce jour
  (`ref_career_prerequisites`, `ref_equipment_ammo_compat`) faisaient échouer leur propre seed.
- Colonnes `jsonb` corrompues par un aller-retour driver `pg` (tableau JS réinjecté tel quel au lieu
  d'être re-sérialisé en texte JSON).
- `ref_exo_templates` devait être sourcée depuis la base de rejeu neuf, pas `vtt` : son `id` est un
  UUID aléatoire (contrairement à `ref_equipment`, figé depuis la Phase 1/l'EXOEQ), le sourcer
  différemment de ses tables filles (`ref_exo_template_equipment`/`computers`) cassait leurs FK.

**Bascule réelle (accord explicite de Saar à chaque étape)** : ~250 fichiers actifs archivés (`git mv`,
historique préservé — une collision de nom résolue, `48_ref_equipment.js` renommé
`48_ref_equipment_phase1_consolidated.js` en l'archivant) ; 10 fichiers `PLAN_EXOEQ_FUSION.md`
jamais committés supprimés (aucun historique Git à perdre, entièrement remplacés) ; 310 nouveaux
fichiers déposés dans `server/src/db/migrations/`. Base réelle `enclumeBD` créée et migrée depuis le
vrai dossier du dépôt (309/309 puis +1). Suite serveur complète relancée : 393/422 passent, les 29
échecs vérifiés un par un — tous dans `migrations_archive/` (ancien cluster exo testant une table
volontairement supprimée), zéro échec nouveau, zéro échec dans le code actif. Effet de bord positif
non cherché : le test `PC49` (`id` de `ref_careers` codé en dur) passe désormais, `ref_careers` étant
semée avec les données et `id` réels de `vtt`.

Compte admin recréé (inscription normale par Saar via `/register`, serveur démarré temporairement
avec `DATABASE_URL` sur `enclumeBD`) puis promu au redémarrage (`bootstrapAdminFromEnv`, vérifié en
base : `role='admin'`). **Validé par Saar en usage réel.** `.env` repointé durablement sur `enclumeBD`.
Mot de passe admin réinitialisé sur demande explicite de Saar (`AZERTY`, bcrypt/12 rounds — même
mécanisme que l'inscription — à changer par Saar dans la foulée).

**Ajout post-bascule (demande explicite de Saar)** : les 57 lignes de `bug_tickets` (hors périmètre
initial des tables de référence) importées séparément (migration `310_bug_tickets_seed.js`, source
`vtt`) — `reporter_id`/`reviewed_by` remappés de l'ancien `id` `vtt` vers le nouvel `id` admin
`enclumeBD` (un seul auteur trouvé sur les 57 tickets : Saar lui-même).

**Testé** : rejeu complet 1→310 sur base jetable (`enclume_full_test`) puis sur `enclumeBD` réelle,
cycle up/rollback/re-up sur échantillon représentatif (dépendance circulaire + séquence), suite
serveur complète (393/422, détail ci-dessus), démarrage serveur réel contre `enclumeBD` (MinIO,
catalogue 3D, migrations, bootstrap admin), usage réel confirmé par Saar (connexion, changement de mot
de passe en cours).
**Non testé** : déploiement distant (Kiwi) — reste sur l'ancien jeu de migrations, hors périmètre de
cette session, à traiter au prochain déploiement (`docs/SERVEURDISTANTKIWI.md`).
**Données** : ~260 anciens fichiers de migration archivés (`server/src/db/migrations_archive/`), 310
nouveaux fichiers actifs (`server/src/db/migrations/`), nouvelle base `enclumeBD` créée et peuplée,
`vtt` conservée intacte et non supprimée, `.env` repointé sur `enclumeBD`.
**Retour arrière** : `vtt` disponible intacte (jamais modifiée pendant tout ce chantier) — reste la
base de repli immédiate en cas de problème, il suffit de repointer `DATABASE_URL` dessus. Les ~260
anciens fichiers de migration restent archivés (pas supprimés) si une comparaison ligne à ligne est
nécessaire plus tard.

**Reste ouvert, hors périmètre de ce chantier** : `node --test` (sans argument) parcourt aussi
`migrations_archive/` par défaut et exécute ses `.test.mjs` obsolètes — une exclusion de
configuration reste à écrire, décision actée avec Saar de ne pas supprimer les fichiers.

---

## Session (Saar) — 2026-08-22 — `ADMIN-LOGS1` : écran admin de consultation des logs serveur

**Contexte** : ticket déjà posé dans `EN_COURS.md` (`ADMIN-LOGS1`, motivé par `COM-RESO1` — bug combat
critique resté sans diagnostic faute d'accès SSH au serveur distant pendant un test avec le
beta-testeur). Saar propose de commencer une session de correction de bugs par cet outil de suivi.

**Constat avant code** : aucun logger structuré côté serveur (317 `console.*` bruts, pas de
winston/pino) — la seule source de logs est le stdout du process. En local le serveur tourne via
`nodemon` dans un terminal déjà visible, sans intérêt pour un viewer. Sur le serveur distant
(`docs/SERVEURDISTANTKIWI.md`, en réalité l'instance `dev/Saar`, ports 8193/8194 — le nom du document
date de la collaboration Kiwi, close depuis), le serveur tourne sous systemd (`enclume-server`) et les
logs se consultent aujourd'hui via `journalctl -u enclume-server -f` en SSH manuel.

**Décision d'architecture** : journald reste l'autorité des logs en prod (rotation/persistance déjà
gérées par systemd) — construire un stockage de logs parallèle côté Node aurait dupliqué cette
autorité (CLAUDE.md §1.4) pour un bénéfice nul. Précédent direct déjà en place et réutilisé :
`server/src/routes/health.js` fait déjà de l'introspection système (`ps aux`/`df`/`systemctl
is-active`) via `child_process.exec`, gated `requireAuth+requireAdmin`. Durcissement volontaire par
rapport à ce précédent : `service`/`lines` viennent de `req.query` (entrée utilisateur), donc
`execFile` (tableau d'arguments, aucun shell invoqué) plutôt que `exec` (chaîne) — une whitelist seule
n'aurait pas suffi à écarter toute injection. Sortie demandée en `-o json` (un objet structuré par
ligne) plutôt que du texte à parser. `console.error`/`console.warn` (stderr) vs `console.log` (stdout)
donnent déjà à journald une distinction de priorité par défaut — pas besoin de migrer les 317 appels
`console.*` vers un vrai logger pour avoir un minimum de sévérité affichée.

**Vérification avant de coder, pas supposée** : la question de savoir si l'utilisateur `didier`
(celui qui fait tourner `enclume-server`) peut lire son propre journal sans `sudo` était un
[INCONNU] réel — la connexion SSH directe au serveur distant a été refusée par le mode auto (action
jugée à risque plus large, raisonnablement bloquée). Saar a lancé la commande lui-même
(`journalctl -u enclume-server -n 3 --no-pager`) : lecture réussie sans droit spécial, architecture
validée avant tout code.

**Codé** : `server/src/routes/adminLogs.js` (nouveau, `GET /api/admin/logs`, whitelist stricte
`enclume-server`/`enclume-client`, `lines` clampé 20-2000, `execFile('journalctl', [...])`, réponse
`{available:false}` explicite si `journalctl` absent ou plateforme non-Linux — jamais une erreur
avalée) ; montage dans `server/src/index.js` ; `client/src/pages/AdminLogsPage.jsx` (nouveau, miroir
`AdminUsersPage.jsx`/`AdminTicketsPage.jsx`) ; tuile dans `AdminPage.jsx` ; route `/admin/logs` dans
`App.jsx` ; clés `admin.tileLogs`/`adminLogs.*` dans `fr.json` (`en.json` non touché, gelé).

**Défaut trouvé et corrigé en cours de code** : le premier jet (`load` en `useCallback` invoqué par un
`useEffect([load])`, patron identique à `AdminTicketsPage.jsx`) déclenchait
`react-hooks/set-state-in-effect` (règle récente d'`eslint-plugin-react-hooks` v7, déjà présente sur
10 fichiers pré-existants du projet, non liée à cette tâche). Plutôt que supprimer l'avertissement,
effet réécrit selon le patron officiel React ("You Might Not Need An Effect", fetch basé sur des
props/state) : fetch inliné dans l'effet + drapeau `ignore` en cleanup, qui écarte une réponse
devenue obsolète si `service`/`lines` changent avant qu'elle revienne — corrige au passage une
condition de course réelle que le premier jet et `AdminTicketsPage.jsx` n'avaient pas. Bouton
"Rafraîchir" redéclenche le même effet via un `refreshToken` incrémenté au clic.

**Testé** : `journalctl` lu avec succès par `didier` sur le serveur distant (ci-dessus). `npm run
build` (client) : OK. `node --check` sur les fichiers serveur touchés : OK. `fr.json` : JSON valide.
Serveur dev déjà lancé par Saar (non redémarré) : `nodemon` a rechargé après les édits,
`GET /api/admin/logs` répond `401` sans crash (auth exigée, comme attendu), `/api/health` toujours
`200` (pas de régression). Lint ciblé propre hors la note ci-dessus.
**Non testé** : rendu réel dans le navigateur (tuile Admin, écran `/admin/logs`, affichage effectif
des lignes) — pas de test navigateur par Claude (protocole). Comportement réel sur le serveur distant
(retour effectif de `journalctl -o json`) non exercé au-delà de la vérification de permission.
**Données** : aucune migration, aucun effet sur les données existantes.
**Retour arrière** : aucun risque de perte — lecture seule côté serveur (`journalctl`), route
entièrement nouvelle, aucune route/fichier existant modifié en profondeur (seuls des ajouts de
montage/tuile/route).

**Effet de bord positif, hors périmètre initial** : débloque potentiellement le diagnostic de
`COM-RESO1` (double résolution combat critique, resté sans piste faute de logs accessibles) — prochaine
occurrence en jeu, consulter `/admin/logs` (service `enclume-server`) au lieu de dépendre d'un accès
SSH.

**Reste ouvert** : mojibake déjà présent dans journald sur les caractères accentués (`ConnectÃ©` au
lieu de `Connecté`, observé en vérifiant la permission ci-dessus) — pas causé par cet écran, existe déjà
dans le flux capturé par systemd, non traité (hors périmètre, à signaler à Saar s'il gêne la lecture).

---

## Session (Saar) — 2026-08-22 — `INV4` : diagnostic périmé + ajout du contrôle de quantité à la revente

**Contexte** : Saar demande de reprendre la correction de bugs, sélection libre d'un ticket. Écarté
d'abord 3 tickets de `bug_tickets` nécessitant chacun un chantier dédié ou une décision produit
préalable (`setState-in-effect` : 16 fichiers, collision réelle avec le chantier exo-armure en cours,
déjà noté "hors session de triage" dans ses propres `admin_notes` ; `ArmorWindow` : composant entier à
construire ; catalogue marchand ignorant `ref_exo_equipment` : décision produit à trancher d'abord).
Choix retenu : **INV4** (`docs/EN_COURS.md`), décrit comme perte réelle de données à la revente,
priorité Haute, root cause déjà verifiée par une session antérieure.

**Vérification avant code (le code prime sur la mémoire/la doc, CLAUDE.md §1.1)** : lecture de
`tradeService.js#executeSell` — le code réel (ligne 319) appelle déjà
`removeItem(offer.from_char_id, item.char_inventory_id, item.qty ?? 1, trx)`, pas le `.delete()` brut
que le ticket décrivait. **Le bug de perte totale du stack n'existe plus** — corrigé par une session
antérieure sans mise à jour du ticket. Le serveur revalide aussi la quantité disponible à l'acceptation
de l'offre (`inv.quantity < (item.qty ?? 1)` → rejet). Reste réel, confirmé en lisant `TradeWindow.jsx` :
`toggleSellItem` (ligne 407-421) figeait `qty:1` sans aucun moyen de le changer — contrairement au
côté achat (`cart`/`addToCart`/`removeFromCart`, même fichier, lignes ~183-198), qui a déjà un
contrôle +/-. Le récap d'offre de vente n'affichait même pas la quantité.

**Reformulation du scope actée avec Saar avant de coder** (le diagnostic initial ne tenait plus, donc
pas une simple exécution du ticket tel quel) : au lieu d'un correctif de perte de données urgent, ajout
d'une capacité UI manquante en réutilisant le patron déjà existant dans le même fichier.

**Codé** : `changeSellQty(itemId, delta, maxQty)` (nouveau, `TradeWindow.jsx`, plafonné par
`item.quantity` — revalidé de toute façon côté serveur à l'acceptation) ; contrôle +/- affiché sous
chaque ligne d'inventaire sélectionnée pour la revente (`stopPropagation` pour ne pas redéclencher la
désélection du clic sur la ligne) ; quantité affichée dans le récap d'offre (`×{qty}` si > 1, même
convention que les affichages en lecture seule ailleurs dans le fichier).

**Testé** : `npm run build` (client) OK. Lint ciblé sur `TradeWindow.jsx` : 6 erreurs pré-existantes
(`no-unused-vars`, variables/fonctions de l'échange PJ↔PJ non liées à la revente) confirmées
identiques avant/après mon changement par comparaison `git stash`/lint/`git stash pop` — aucune
nouvelle erreur introduite.
**Non testé** : scénario réel navigateur (sélectionner un stack, ajuster la quantité, proposer l'offre,
confirmer côté MJ) — pas de test navigateur par Claude (protocole).
**Données** : aucune migration, aucun effet sur les données existantes.
**Retour arrière** : aucun risque — ajout pur côté client (nouvelle fonction + JSX conditionnel),
aucune route/service serveur modifiée.

---

## Session (Saar) — 2026-08-22 — `WIZ43` : affichage du prix des objets (inventaire + catalogue)

**Contexte** : "Bug suivant" (confirme implicitement INV4 sans le re-tester explicitement, cf.
[[feedback_bug_suivant_means_tested]] en mémoire). Ticket suivant sélectionné : **WIZ43**, décrit
comme "pur ajout d'affichage, donnée déjà là".

**Vérification avant code** : partiellement confirmé, partiellement corrigé. `ItemRow`
(objets possédés) : `ref_price` déjà renvoyé par `getInventory()` (`inventoryService.js:231`, ajout
fait pour l'export Excel abandonné) — pur affichage à ajouter, comme annoncé. Catalogue + panneau de
confirmation d'ajout (`refItem`/`selectedRef`, alimentés par `GET /api/equipment`) : **`price` n'était
PAS sélectionné** par cette route (`equipment.js:68` ne listait que `id/family/category/name/
description/tech_level/rarity/location/weight`) — contrairement à l'hypothèse du ticket, un ajout
serveur était nécessaire ici, pas seulement du câblage client.

**Aparté signalé, non traité (un problème à la fois)** : `selectedRef.caliber` (même panneau de
confirmation) ne peut jamais s'afficher non plus, `caliber` n'étant pas sélectionné par cette même
route — repéré en marge, distinct de WIZ43. **Saar a corrigé cette lecture** : le calibre s'affiche
correctement dans `ItemRow` (objet déjà possédé, via `getInventory()` qui sélectionne bien `ref_caliber`)
— le trou que j'avais vu ne concerne que le panneau de confirmation AVANT ajout (route différente),
pas l'affichage général. Toujours hors périmètre de ce ticket, laissé de côté tel quel.

**Codé** : `server/src/routes/equipment.js:68` — `price` ajouté au `.select()` (ajout pur). Client
(`InventoryPanel.jsx`) — prix affiché sur `ItemRow` (même style que le badge poids), sur la ligne de
catalogue (regroupé avec la catégorie pour ne pas casser le `space-between` à 2 colonnes existant), et
dans le panneau de confirmation d'ajout. Format `${prix} S` non traduit — même convention déjà utilisée
telle quelle pour "kg"/"S" ailleurs dans ce fichier et dans `TradeWindow.jsx` (unité de jeu, pas une
phrase i18n).

**Testé** : `node --check` sur `equipment.js` OK. Lint ciblé `InventoryPanel.jsx` : 0 erreur. `npm run
build` (client) OK. Serveur dev déjà lancé par Saar (non redémarré) : `nodemon` a rechargé après
l'édit, `GET /api/equipment` répond `401` sans crash (auth exigée, attendu), `/api/health` toujours
`200` (pas de régression).
**Non testé** : scénario réel navigateur (ouvrir l'inventaire, le catalogue, le panneau d'ajout —
confirmer visuellement les 3 affichages).
**Données** : aucune migration, aucun effet sur les données existantes.
**Retour arrière** : aucun risque — ajouts purs (colonne en plus dans un `.select()`, JSX
conditionnel), aucun champ retiré ni comportement existant modifié.

---

## Session (Saar) — 2026-08-22 — Migration complète des dettes `EN_COURS.md` vers `bug_tickets`

**Contexte** : Saar recadre après plusieurs tickets de la table "Dettes actives" trouvés déjà résolus
en vérifiant — le vrai problème signalé : la table s'était accumulée sans jamais migrer vers le
système de tickets réel (`/admin/tickets`), contrairement à l'intention documentée dans son propre
en-tête. Demande explicite : "go les transformer en ticket."

**Méthode** : même patron que `importBugIdentifie.js` (script à usage unique, idempotent par
`linked_bug_code`, réexécutable sans doublon) — nouveau `server/src/scripts/importEnCoursDettes.js`.
75 entrées transcrites depuis `EN_COURS.md` (toutes les dettes encore ouvertes ou "clos partiel" en
attente de validation, hors 3 exclusions délibérées : décision assumée "logs debug conservés",
`WIZLOCK1`/historique révolu sans risque actif, `DOC1`/tâche d'enrichissement continu — aucune des
trois n'est un bug à tracker).

**Vérifications faites en chemin, pas suite à l'import mais avant** (le code prime sur la doc) :
- `COM20`/`COM21` : marqués ✅ dans d'anciens journaux (Session 148/127) mais jamais nettoyés
  d'`EN_COURS.md` — confirmés réellement résolus par lecture du code actuel
  (`CombatGmDeclareWindow.jsx` affiche déjà munitions/type ; occupation de case gérée par
  `worldSpatialQueryService.js`/`spatialIndex.js` après la refonte du moteur monde).
- Ticket `221f493a` (migrations désynchronisées 233/243+244-246) : confirmé résolu par la refonte
  complète des migrations de la session précédente — les anciens fichiers exacts sont dans
  `migrations_archive/`. Écriture directe en base pour le clore refusée par le mode auto (mutation
  hors code applicatif) — laissé à clore par Saar dans `/admin/tickets`.
- `INV7-MIGRATION-LINK` mis à jour en conséquence (piste migration écartée pour INV7).

**Résultat** : 131 tickets au total en base (57 avant + 74). Table "Dettes actives" d'`EN_COURS.md`
réduite de ~75 lignes à 19 (historique déjà résolu + 3 exclusions assumées) — plus aucune dette
ouverte dupliquée entre les deux systèmes. En-tête du tableau mis à jour : tout nouveau bug va
directement dans `/admin/tickets`.

**Testé** : script exécuté deux fois (74 puis +1 pour une ligne oubliée, `WNDMORT-HORSCOMBAT`) —
idempotence confirmée (0 doublon au 2e run). Comptage final en base vérifié (131).
**Non testé** : validation visuelle de l'écran `/admin/tickets` avec ce volume (pagination, filtres) —
pas de test navigateur par Claude.
**Données** : 75 lignes insérées dans `bug_tickets` (aucune modification de lignes existantes hors le
script lui-même, aucune suppression).
**Retour arrière** : suppression des lignes par `linked_bug_code` si nécessaire (aucune contrainte ne
les lie à autre chose) — aucun risque, script purement additif.

---

## Session (Saar) — 2026-08-22 — `CHAT-SCROLL1` : câblage du scroll infini chat

**Contexte** : après plusieurs tickets déjà résolus/clarifiés (INV5 constaté résolu en passant, COM26,
TC1, DCO1, CSPLAYERSTAB, VX1 clarifié), sélection d'un ticket plus substantiel : `useChatSocket.js`
exposait déjà `loadOlderMessages`/`hasMore`/`loadingOlder` (Phase 3e `PLAN_CHAT.md`) mais rien ne les
consommait — `Sidebar.jsx:61` appelait le hook et jetait son retour, commentaire explicite "pas encore
câblé, suivi séparé".

**Diagnostic confirmé encore ouvert** (contrairement aux tickets précédents) : `grep` sur
`Sidebar.jsx`/`useChatSocket.js` confirme le commentaire toujours exact, rien n'a bougé depuis.

**Piège trouvé en concevant le câblage, pas juste en l'écrivant** : `SidebarChatTab.jsx` (où vit la
vraie liste de messages scrollable, pas `Sidebar.jsx`) a déjà un effet `messagesEndRef.current
?.scrollIntoView()` keyé sur `[messages]` — sans garde, cet effet aurait ramené la vue tout en bas à
CHAQUE préfixage d'historique, rendant le scroll infini inutilisable dès la première utilisation
(l'utilisateur scroll vers le haut pour lire l'historique, la vue saute aussitôt en bas). Corrigé en
ne déclenchant l'auto-scroll que si le DERNIER message de `messages` change (vraie arrivée temps réel)
— un préfixage en tête ne change jamais le dernier élément, donc ne déclenche plus le saut.

**Décision d'architecture** : ne jamais rappeler `useChatSocket(campaignId)` une 2e fois dans
`SidebarChatTab.jsx` pour obtenir `loadOlderMessages` localement — le hook a ses propres effets de
fetch initial + listeners socket, un second appel aurait dupliqué les deux (messages en double,
double abonnement). Threading par props depuis `Sidebar.jsx` (seul appelant du hook) à la place, même
patron que `socket`/`breakdownPopover` déjà passés à ce composant.

**Repositionnement visuel au préfixage** : pas de recalcul manuel de `scrollTop` (diff de
`scrollHeight` avant/après) — appui sur le scroll anchoring natif du navigateur (actif par défaut
Chrome/Firefox/Edge depuis des années), documenté en commentaire comme hypothèse à revérifier si Saar
constate un saut visuel en test réel, plutôt que d'ajouter une mécanique de recalcul non demandée par
avance (proportionné au risque réel, pas un renfort préventif non confirmé nécessaire).

**Codé** : `Sidebar.jsx` — retour du hook capturé (`loadOlderMessages`/`hasMoreMessages`/
`loadingOlder`), threadé en props vers `SidebarChatTab.jsx`. `SidebarChatTab.jsx` — sentinelle
(`<div ref={topSentinelRef} />`, rendue seulement si `hasMoreMessages`) observée par un
`IntersectionObserver` avec pour `root` le conteneur scrollable lui-même (`styles.messages`, déjà
`overflowY:auto`) ; effet nettoyé (`observer.disconnect()`) au démontage/changement de deps ; message
"Chargement..." pendant `loadingOlder` (nouvelle clé i18n `chat.loadingOlder`, `fr.json`). Auto-scroll
corrigé (ci-dessus).

**Testé** : lint ciblé (`Sidebar.jsx`/`SidebarChatTab.jsx`) : 0 erreur. `npm run build` (client) : OK.
**Non testé** : scénario réel navigateur (charger >50 messages, scroller vers le haut, confirmer le
chargement et l'absence de saut visuel/de retour intempestif en bas).
**Données** : aucune migration, aucun effet sur les données existantes.
**Retour arrière** : aucun risque — ajout d'un effet + props threadées, aucun comportement de chat
existant retiré (envoi, temps réel, suppression douce inchangés).

## Session (Saar) — 2026-08-22 — Tri des tickets migrés en clusters + `WIZ45` : perte de données au Wizard sur navigation sans "Suivant"

**Tri demandé par Saar** ("Tri des bugs en cluster... puis sélection d'un cluster/bug dans l'ordre
décroissant de criticité") sur les 131 tickets `bug_tickets` (79 sans cluster après la migration de la
session précédente). Regroupement réel (mécanique racine commune, pas juste même domaine) via
`server/src/scripts/clusterEnCoursTickets.js` : Blessure mortelle (WNDMORT/-UI/-HORSCOMBAT), Initiative
(INI1/2/4/5), Marqueur compétence (X)/(-3) (WIZ38+WIZ39), Step6 Matériel (WIZ40/41/42/44), Diffusion
live MJ→PJ (WIZ11/32/33/34) — 17 tickets rattachés, le reste des 79 n'a pas de famille naturelle.

**Sélection** : parmi les tickets `high`, `COM-RESO1` (critique) reste bloqué sans repro instrumentée ;
`INV2` et `WIZ39` (dont `WIZ38` dépend) sont bloqués sur une décision produit de Saar (débit à
l'ajout/validation MJ ; portée de la correction — seed seul ou personnages déjà créés) ; `WIZ13` et
`EXOARM-COMBATFILE` sont déjà `in_progress`, en attente de validation jeu réel, pas de code. Seul
`WIZ45` était immédiatement actionnable (cause déjà localisée, aucune décision produit en attente).

**Cause racine (relecture complète du code, pas de la mémoire)** : plus large que le ticket ne le
décrivait. `WizardCreation.jsx` ne committe chaque `stepNData` dans le store qu'au clic "Suivant"
(`advanceStep`) ; "Précédent" et le stepper (`navigateToStep`) ne font qu'un `setStep(n)`, sans jamais
toucher le store. `WizardReview` (Step7), `handleTerminate` (finalisation) et `openPeek` lisent tous le
store, jamais l'état local du composant affiché — toute navigation hors "Suivant" abandonnait donc
silencieusement l'édition en cours. Violation directe de `react.md` ("Les stores contiennent l'état
partagé; éviter une seconde copie locale divergente").

**Infrastructure de fix déjà à moitié en place** : chaque `StepN` calcule déjà, à chaque frappe, un
payload complet via `onLiveChange` (pour la diffusion live MJ) — Step1 committait déjà `pcSpent` en
direct (`onPcChange`) et Step4 committait déjà `liveYears` en direct (import store, précédent identique
pour le seul compteur PC header), sans jamais avoir été généralisé aux autres champs.

**Analyse à charge avant correctif** : vérification (pas supposition) que chaque payload `onLiveChange`
correspond bien au payload `onNext` avant de les réutiliser tels quels. Deux écarts réels trouvés :
Step3 omettait `mutationsMeta` (présent dans `onNext`) ; Step5 omettait `pcNet`/`advantagesMeta`, et son
setter (`setStep5Data`) remplace intégralement (pas un merge) — câbler l'ancien payload partiel aurait
effacé ces champs du store à chaque frappe (régression de budget). Corrigés avant câblage, pas après.

**Codé** (5 fichiers, `client/src/components/creation/`) :
- `Step1Attributes.jsx` : payload dédupliqué (`buildPayload`, mémoïsé) entre l'effet live et
  `handleNextClick`, ce dernier appelait auparavant une copie quasi identique non trimée.
- `Step2Genotype.jsx` : effet live committe désormais aussi dans `step2Data`.
- `Step3Mutations.jsx` : `buildMutationsMeta` mémoïsé (`useCallback`, dépend de `mutations` seul),
  ajouté au payload live des deux méthodes (`chosen`/`random`), commit dans `step3Data`.
- `Step4Experience.jsx` : ancien effet `liveYears` (partiel, un seul champ) supprimé, généralisé — le
  commit continu se fait désormais via le `buildPayload()` déjà complet de l'effet `onLiveChange`
  existant.
- `Step5Advantages.jsx` : `advantagesMeta` mémoïsé (`useMemo`, dépend de `selected`+`refData` — un
  tableau recréé à chaque rendu aurait rebouclé l'effet, même incident "Maximum update depth exceeded"
  déjà rencontré ailleurs dans le Wizard), `pcNet` calculé une fois et réutilisé par `handleNext`.

**Effet de bord assumé** : le compteur PC du header (`getPcDispo`), auparavant figé pendant l'édition de
Step2/3/5 (seuls Step1/4 étaient déjà live), se met désormais à jour en direct sur les 5 étapes — pas un
correctif silencieux, changement de comportement visible à signaler à Saar.

**Robustesse** : le serveur (`creationService.js#reconcileCreation`) revalide déjà `validateStep1` en
transaction et rejette (400, rollback complet) toute soumission invalide à la réconciliation/
finalisation — un brouillon transitoirement incomplet committé localement ne peut donc jamais être
persisté de travers, le serveur reste l'autorité finale.

**Testé** : lecture complète du code (WizardCreation.jsx, creationStore.js, les 5 Step*.jsx,
creationService.js#reconcileCreation côté serveur) avant tout correctif. Lint ciblé sur les 5 fichiers
modifiés : 0 erreur introduite (3 erreurs pré-existantes confirmées par `git stash`/lint/`git stash pop`
sur `Step1Attributes.jsx#poolBase`, `Step2Genotype.jsx` avertissement React Compiler sur `modPCAttrs`,
`Step4Experience.jsx#showSetbacks` — non liées à ce chantier, non traitées ici). `npx vite build` : OK.
**Non testé** : scénario réel navigateur (éditer une étape, revenir en arrière via Précédent ou le
stepper sans cliquer "Suivant", confirmer que Step7/finalisation reflètent bien l'édition) — c'est
précisément le scénario que Saar avait signalé en beta-test, à revalider par lui.
**Données** : aucune migration. `server/src/scripts/clusterEnCoursTickets.js` (nouveau, usage unique) a
posé `cluster_label` sur 17 tickets existants, aucune autre écriture.
**Retour arrière** : aucun risque de perte — le changement rend le store plus à jour, jamais moins ; en
cas de régression comportementale (ex. header PC "instable" perçu comme gênant), revert ciblé des 5
fichiers sans dépendance croisée avec d'autres chantiers en cours.

## Session (Saar) — 2026-08-22 — `INV2` : le bouton Ajouter ne débitait jamais de Sols

**Décision Saar** : débit à la validation MJ pour un personnage en campagne, débit à l'ajout pour un
personnage Coffre-native (aucun MJ n'existe jamais pour valider — sans ce cas, le débit ne se
produirait jamais pour ces personnages). Un ajout fait par le MJ lui-même reste gratuit dans les deux
cas (geste privilégié, comportement préexistant préservé).

**Vérifié avant de coder** : `inventoryService.js#addItem` ne lisait jamais `ref_equipment.price` ;
seule différence MJ/joueur était `validated_by_gm`. `tradeService.js#executeBuy` débite déjà des Sols
ailleurs (achat marchand) — repris comme référence de patron (verrou `forUpdate`, vérif AVANT
décrément, jamais de décrément optimiste suivi d'un rollback).

**Cause de l'ambiguïté apparente de la décision** : `autoValidate` (paramètre existant d'`addItem`)
est vrai pour DEUX raisons distinctes — le MJ ajoute (geste privilégié) OU le personnage est
Coffre-native (aucun MJ ne rejoindra jamais pour valider, `char-sheet.js`). Un nouveau paramètre
`isGm` distinct d'`autoValidate` permet de ne facturer que le second cas à l'ajout, jamais le premier.

**Codé** :
- `inventoryService.js` : nouveau helper `_chargeSols(trx, characterId, amount)` (verrou `forUpdate`,
  vérif puis décrément, `AppError(400)` si insuffisant). `addItem` sélectionne désormais `price`,
  calcule `chargeAtAdd = autoValidate && !isGm` et facture dans la même transaction que l'insertion
  (les 3 chemins : stack, multi, single). `updateItem` facture lors de la transition
  `validated_by_gm` false→true (la seule façon dont un item peut porter `false` est un ajout joueur en
  campagne — jamais un double débit d'un item déjà facturé à l'ajout).
- `char-sheet.js` : route POST transmet désormais `req.isGm` à `addItem` en plus d'`autoValidate`.
- `InventoryPanel.jsx` : `handleConfirmAdd` et `handleValidate` affichaient l'erreur serveur en
  `console.error` silencieux — un refus (Sols insuffisants) laissait le joueur/MJ sans aucune
  explication visible sur un clic sans effet. Basculés sur la bannière `equipError` déjà existante
  (même patron que `handleEquip`). Nouvelle clé i18n `containerPanel.validateError`.

**Testé** : `server/src/services/inventoryService.test.mjs` étendu de 9 à 15 tests (les 6 nouveaux
contre PostgreSQL réel, pas de mock) : Coffre-native sols suffisants/insuffisants, ajout MJ jamais
facturé, ajout joueur en campagne jamais facturé à l'ajout, validation MJ sols suffisants/insuffisants
(rollback confirmé — aucun débit, item reste en attente). 15/15 vertes. Lint (`InventoryPanel.jsx`) :
0 erreur. `npx vite build` (client) : OK. Aucun autre appelant d'`addItem` dans le code applicatif
(vérifié par grep) — signature étendue sans casser de site d'appel existant.
**Non testé** : scénario réel navigateur (ajout/validation en situation réelle, les deux contextes
Coffre-native et campagne).
**Données** : aucune migration — `ref_equipment.price` existait déjà, `char_sheet.sols` déjà en place
(déjà utilisée par `tradeService.js`).
**Retour arrière** : aucun risque de perte de personnage existant (aucun personnage réel actuellement,
phase de développement, confirmé par Saar) — revert ciblé des 3 fichiers si nécessaire.

## Session (Saar) — 2026-08-22 — `WIZ31` : header du Wizard emporté par le scroll sur une étape longue

**Vérifié avant de coder** (toujours valide, pas périmé) : `.wiz-shell` (`index.css`) utilise
`min-height: 100vh` — un plancher, jamais un plafond — et `st.body` (`WizardCreation.jsx`, conteneur
du contenu de chaque étape) n'avait que `overflow: 'hidden'`, sans `minHeight: 0`. Un enfant flex sans
`minHeight: 0` grandit avec son contenu au lieu de se contraindre : sur une étape longue, `st.body`
poussait `.wiz-shell` au-delà du viewport, et c'est la page entière qui scrollait — emportant le
header. L'Étape 7 (Récap) n'a jamais ce problème : elle a déjà le bon patron (`step6Sheet: { flex:1,
overflowY:'auto', minHeight:0 }`), jamais généralisé aux étapes 1-6.

**Codé** : `WizardCreation.jsx#st` — `body` : `overflow:'hidden'` → `overflowY:'auto', minHeight:0`
(même patron que `step6Sheet`). `step6` : ajout de `minHeight:0` par précaution, pour que le scroll
imbriqué de l'Étape 7 (`step6Sheet` à l'intérieur) continue de fonctionner correctement maintenant que
son parent (`st.body`) scrolle lui aussi.

**Testé** : lint (`WizardCreation.jsx`) : 0 erreur. `npx vite build` : OK.
**Non testé** : scénario réel navigateur (étape longue — ex. Step4 Carrières avec plusieurs choix —
confirmer que le header reste fixe pendant le scroll, et que l'Étape 7 scroll toujours correctement
sans double barre de défilement).
**Données** : aucune.
**Retour arrière** : aucun risque — changement de style pur, 2 propriétés dans un seul fichier.

## Session (Saar) — 2026-08-22 — `WIZ32` (clarifié, pas un bug) + `WIZ4` : mini-stepper Étape 4

**WIZ32** — vérifié en profondeur avant tout code (`WizardCreation.jsx` + `docs/Old/PLAN_WIZARDCOLLAB.md`,
le plan d'origine). Pas un bug : le plan documente explicitement (§2.5) "Réception — asymétrique,
assumée" — seul le MJ observant un joueur voit son brouillon en direct, l'inverse volontairement non
câblé en V1 pour éviter le risque de "double écrivain" (deux personnes tapant sur le même champ
s'écraseraient sans mécanisme de fusion). L'"exigence Saar : IMMÉDIATEMENT visible" citée dans le code
concerne autre chose (le commit "Suivant" vu par l'observateur, déjà symétrique et fonctionnel via
`gmSyncKey`/`applyStateSync`) — pas la frappe en direct avant commit. Note ajoutée au ticket (statut
inchangé, `new`) : voir le MJ taper en direct sur la fiche d'un joueur est une vraie fonctionnalité à
concevoir, pas un correctif — décision produit nécessaire avant tout code si Saar la souhaite un jour.

**WIZ4** — vérifié (`isReachable`/`isClickable`, mini-stepper Étape 4) : ne dépendait que de
`highestSubStep` (position la plus loin jamais atteinte), jamais revalidé après coup. Retirer sa seule
carrière laissait "Récap" cliquable directement alors que CAREERS redevient la sous-étape la plus loin
réellement valide — même règle déjà utilisée par `computeInitialSubStep` (`noCareerYet` → `CAREERS`),
pas une nouvelle règle inventée. Portée volontairement limitée au cas démontré par le ticket (retrait
de carrière), pas une revalidation générale de tous les champs — le filet serveur
(`reconcileCreation`) empêchait déjà toute persistance invalide, seul le blocage passait d'immédiat à
tardif.

**Codé** : `Step4Experience.jsx#handleRemoveCareer` — clampe `highestSubStep` à `SUB_STEPS.CAREERS`
quand `careers` devient vide.

**Testé** : lint (`Step4Experience.jsx`) : 0 erreur introduite (1 erreur pré-existante confirmée non
liée). `npx vite build` : OK.
**Non testé** : scénario réel navigateur (retirer sa seule carrière, vérifier que "Récap" redevient
non cliquable dans le mini-stepper).
**Données** : aucune.
**Retour arrière** : aucun risque — un seul handler, 3 lignes ajoutées.

## Session (Saar) — 2026-08-22 — Passe de vérification tickets `medium/new` + `CAR2`

Vérification systématique des tickets `medium/new` restants avant tout code (5 des 6 précédents
s'étant révélés périmés) : **CS4** et **CS5** déjà implémentés (clos), **OPT-W1** diagnostic corrigé
(seuls `skill_natural_prog`/`celebrity` réellement sans câblage, "revers" déjà câblé), reporté par
Saar (nécessite une brique passage du temps de campagne inexistante). **WIZ-3** confirmé corrigé par
Saar hors session.

**CAR2** — `ref_background_skills.skill_id` sans FK vers `ref_skills.id`, vérifié encore valide
(aucune protection en base, contrairement à ce qui a été trouvé pour `background_id`). Migration 311
ajoute la contrainte manquante, même patron que `ref_career_skills`/migration 252 (`ON DELETE
RESTRICT`). Aucune ligne orpheline trouvée avant application.

**Testé** : migration 311 appliquée et vérifiée (`pg_constraint`) en local. Aucune ligne orpheline.
**Non testé** : aucun scénario applicatif à tester (contrainte préventive pure, aucun code
consommateur ne dépendait de son absence).
**Données** : migration 311 (schéma seul, aucune donnée modifiée).
**Retour arrière** : `down()` fourni, aucun risque.

---

## Session (Saar) — 2026-08-22 — `COM-MOVEUI1` (panneau déplacement) + `WIZ38`/`WIZ38-UNDOFREE1` (coût compétence (X))

**COM-MOVEUI1** — panneau de déplacement combat "toujours visible, réapparaît sans cesse". Root
cause réelle (après une 1re tentative de refonte de la légende rejetée en jeu réel par Saar — moins
d'info jugé moins ergonomique, entièrement revert) : le bouton "Annuler" ne désarmait rien —
`useAutoMoveMode.js` réarmait inconditionnellement le survol dès que `combatMoveMode` redevenait
faux tant que `enabled` restait vrai, sans distinguer une validation (réarmement voulu) d'une
annulation explicite. Ajout d'un `dismissedRef` + `rearm()` exposé : "Annuler" désarme pour le reste
de l'activation, levé par un nouveau tour ou un clic explicite sur la tuile "Déplacement" (qui
réarme désormais, en plus d'effacer une sélection posée) — 3 sites d'appel (`CombatActionWindow` PJ,
`CombatGmDeclareWindow` PNJ, `useDroneDeclare` drone). Effet de bord découvert en jeu réel par Saar :
le clic-attaque ambiant sur un adversaire s'est retrouvé coupé aussi, car `Canvas3D.jsx` ne détectait
"case occupée" (source du déclenchement clic-attaque) que sous la garde `combatMoveHasPriority()`,
qui exigeait `combatMoveMode` truthy — sans lien métier avec le clic-attaque. Remplacé par
`ambientMapClickActive()` (déplacement OU clic-attaque armé), `combatMoveHasPriority()` devenu mort
supprimé.

**WIZ38** — `CareersAllocator.jsx` (Étape 4, allocation de compétences) utilisait
`baseMastery[skillId] ?? 0` comme point de départ des boutons +/- : pour une compétence réservée
`(X)` jamais entraînée par une origine, la vraie base RAW est `-3` (`docs/SYSTEME/CHARACTER.md`
PC11), pas 0 — un clic "+" sautait donc directement à la cible cliquée, facturant d'un coup toute la
montée -3→cible au lieu de niveau par niveau. Ajout de `baseFor(skillId)` (origine si présente,
sinon -3 pour un marker `(X)`, sinon 0). `shared/careerSkills.js#computeSkillAllocation` était déjà
correct (bug confiné à l'UI de pas-à-pas).

**WIZ38-UNDOFREE1** — trouvaille secondaire pendant WIZ38, ticketée puis confirmée à corriger par
Saar dans la foulée : redescendre exactement à -3 supprimait l'allocation (coût 0) au lieu de
facturer le point de déblocage (`calcSkillCost` facture 1 pt pour `target=-3` explicite). Ajout de
`isReservedUnlearned(skillId)` + `floorIsPaid` sur l'action `ALLOC_SKILL` : le reducer ne supprime
l'entrée que si le plancher n'est pas payant (compétence normale revenant à sa base réelle) ; sinon
l'entrée à -3 est conservée.

**Testé** : eslint + build client propres sur chaque fichier touché (comparaison stash HEAD pour
`Canvas3D.jsx`, 17 problèmes préexistants identiques avant/après — aucune régression introduite).
Traçage manuel complet des deux flux (COM-MOVEUI1 : annulation/réarmement/clic-attaque ; WIZ38 :
montée pas-à-pas + coût cumulé ; WIZ38-UNDOFREE1 : descente au plancher payant).
**Non testé** : scénario réel navigateur pour les trois (combat réel pour COM-MOVEUI1, achat d'une
compétence (X) au wizard pour WIZ38/WIZ38-UNDOFREE1).
**Données** : aucune migration, aucun effet runtime hors ces fichiers client.
**Retour arrière** : commit isolé, `git revert` suffit — aucune donnée persistée concernée.

---

## Session (Saar) — 2026-08-22 — `AMMO-STD-MISMATCH1` : 5 munitions Darts 7.62/5.56mm ST avec un FX= erroné

Ticket initial ne signalait que 2 lignes ("Projectile standard" 5.56/7.62mm ST). Vérification via
`shared/weaponAmmoDsl.js` (Lot C1) + `damageService.js` : dès que `tags.FX` correspond à une des 6
familles mécaniques (`APHC`/`SAP`/`SLAP`/`HP`/`EXPLOSIVE`/`SHRAPNEL`), ce tag devient la **seule**
autorité de dégâts/armure/Choc — les clauses `DMG=`/`CHOC=` catalogue deviennent cosmétiques pour
cette ligne. `RANGE=AIR_X.../TXT=DEPTH=...` ne sont reconnus par aucune clé du parseur
(`parseAmmoEffects` ne traite que `DMG`/`CHOC`/`TXT`) : purement décoratifs, aucun consommateur
(cohérent avec `migrations_archive/209`, même conclusion déjà posée pour un cas voisin).

## Session (Saar) — 2026-08-22 — Régression crash Step4 Profession (`WIZ38`) + `WIZ45` (jets de mutation non mémorisés au retour), validation navigateur complète

**Contexte** : point de situation + tests de validation groupés (COM-MOVEUI1, WIZ13, CHAT-SCROLL1,
WIZ38, WIZ45). Deux dettes documentaires trouvées en passant : `TEST_CRITIQUE-LOT3` (codé 2026-08-04,
jamais migré dans `bug_tickets` lors de la migration du 2026-08-22, absent de la liste d'exclusion
volontaire d'`importEnCoursDettes.js`) et `CHAT-SCROLL1` (même oubli) — les deux migrés en tickets,
`CHAT-SCROLL1` directement `resolved` (validé par Saar : scroll au-delà de 50 messages sans saut
visuel). `EN_COURS.md` : pointeur "PROCHAINE ÉTAPE EXACTE" périmé (datait du 2026-08-04, jamais
retouché depuis) retiré.

**Régression WIZ38 — Step4 Profession plante en boucle** (`Maximum update depth exceeded`,
`WizardStepErrorBoundary`, stack `[DBG-WIZCRASH]` récupérée en navigateur par Saar) : préexistante,
pas une régression du jour, juste jamais déclenchée avant. Cause confirmée par la stack — pas une
hypothèse : `Step4Experience.jsx` recalculait `enrichedGeoOrigins`/`filteredSocialOrigins`/
`filteredTrainings`/`filteredHigherEds` et les 4 `selectedXItem` qui en découlent à **chaque rendu**
(aucun `useMemo`), produisant de nouveaux objets même sans changement d'origine/formation. Ces objets
alimentent `baseMastery` puis `boardSkillIds` (`CareersAllocator.jsx`), donc eux aussi instables à
chaque rendu → l'effet `PRUNE_ALLOCATIONS` (deps `[boardSkillIds]`) se redéclenchait à chaque rendu →
`dispatch` → nouvel objet `skillAllocations` → `onSkillAllocationsChange` remonte ce nouvel objet au
parent (`setSkillAllocations`) → re-render → nouveaux objets recréés → boucle. Corrigé : les 8
valeurs mémoïsées (`useMemo`) dans `Step4Experience.jsx`. Confirmé fonctionnel par Saar en navigateur.
Mécanique de coût des compétences réservées (X), objet initial du ticket `WIZ38`, non re-testée
explicitement au-delà de cette confirmation — ticket laissé `in_progress`.

**WIZ45 (suite) — jets de mutation aléatoire non mémorisés au retour sur Step3** : 3 causes
distinctes trouvées, dans l'ordre où le test navigateur de Saar les a fait apparaître (un plan
n'aurait pas pu les prédire toutes d'un coup — chacune corrigée avant de découvrir la suivante) :

1. `rollResults` (mutations tirées, encore en attente de Garder/Défausser) n'était ni inclus dans le
   commit continu (WIZ45 d'origine ne couvrait que `kept`/`removed`/`d20Result`) ni restauré depuis
   `initialData` — un retour avant d'avoir tout décidé l'effaçait silencieusement. Corrigé.
2. `method` (chosen/random) ne se restaurait jamais depuis un brouillon local (avant toute
   soumission serveur) : gardé derrière `initialData.visited`, lui-même posé uniquement par un vrai
   reconcile serveur (WIZ5B), jamais inclus dans le commit continu. Or `chosen`/`random` ne sont
   jamais ambigus (contrairement à `none`, seule raison d'être de `visited`) — restaurés directement.
3. **Cause réelle de la repro exacte de Saar** (aléatoire → Garder → Step4 → retour Step3, mutations
   déjà gardées et déjà en base) : `getStep3State` (serveur, `creationService.js`) ne renvoie jamais
   `d20Result` — aucune colonne en base, jamais persisté par conception (information purement
   cosmétique, la donnée mécanique réelle est `kept`). Après la vraie soumission, l'écho
   `WIZARD_STATE_SYNC` remplace `step3Data` par cette reconstruction serveur incomplète — `d20Result`
   redevient `null`, et l'écran se fiait uniquement à lui pour savoir s'il fallait reproposer un
   tirage, ignorant que `kept`/`removed` étaient déjà peuplés. Corrigé : nouvelle condition
   `hasRandomResult = d20Result != null || kept.length > 0 || removed.length > 0`, utilisée aux 3
   endroits concernés (écran tirage vs résultats, bouton Suivant) ; badge "D20 = X" masqué proprement
   quand la valeur est inconnue plutôt que de forcer un nouveau jet.

**Fichiers touchés** : `client/src/components/creation/Step4Experience.jsx` (mémoïsation, régression
WIZ38), `client/src/components/creation/Step3Mutations.jsx` (3 correctifs WIZ45), `docs/EN_COURS.md`
(pointeur périmé retiré, `CHAT-SCROLL1` clôturé).

**Testé** : lint + build client propres à chaque étape ; scénario réel navigateur confirmé
fonctionnel par Saar pour les deux régressions (Step4 Profession sans crash ; aléatoire → Garder →
Step4 → retour Step3 sans redemande de jet).
**Non testé** : mécanique de coût des compétences réservées (X) elle-même (objet initial `WIZ38`,
au-delà du crash) ; méthode "achat manuel" (`chosen`) de Step3 avec retour arrière après soumission
réelle (même classe de bug que le point 3 ci-dessus, jamais reproduite ni testée sur ce chemin —
`mutationsMeta`/`selected` s'appuient sur `mutations`/`method` qui sont eux bien renvoyés par
`getStep3State`, donc probablement épargnés, mais non vérifié).
**Données** : aucune migration — les 2 tickets migrés (`TEST_CRITIQUE-LOT3`, `CHAT-SCROLL1`) et les
mises à jour de statut (`WIZ13`/`COM-MOVEUI1`/`WIZ45` → `resolved`) vivent dans `bug_tickets`, pas en
migration de schéma.
**Retour arrière** : commits isolés sur `dev/Saar`, `git revert` suffit (aucun changement serveur ni
migration).

En recroisant sur ce critère précis (pas la description, le code), 5 lignes avaient un `FX=` manquant
ou emprunté à une autre munition, avec un vrai impact combat :
- Darts 5.56mm ST **standard** : `FX=EXPLOSIVE` emprunté — explosait au lieu d'un dégât normal.
- Darts 7.62mm ST **APHC** : `FX=` absent — ne perçait aucune armure.
- Darts 7.62mm ST **assommant** : `FX=EXPLOSIVE` emprunté — explosait au lieu d'assommer.
- Darts 7.62mm ST **explosif** : `FX=` absent — aucun effet, `DMG=BASE` nu.
- Darts 7.62mm ST **standard** : `FX=IEM` emprunté — -50% dégâts + panne électronique parasite.

Darts 7.62mm ST SAP/IEM déjà corrects (SAP réparé par la migration 209 archivée) — non touchés.
Migration 312 (`ref_equipment`, matché par `name`, jamais par `id` — seed non déterministe entre
instances) corrige les 5 lignes, assertion de la valeur `ammo_effects` attendue avant écriture,
`down()` symétrique fourni.

**Testé** : requête DB post-migration confirmant les 5 nouvelles valeurs ; `parseAmmoEffects` +
`resolveAmmoMechanic` exécutés en isolation sur les valeurs corrigées (APHC résout bien
`armorMulFactor`, "standard" ne résout plus aucun mécanisme).
**Non testé** : scénario de tir réel en combat avec ces munitions.
**Données** : migration 312 appliquée en local (`db.migrate.latest()`), 5 lignes `ref_equipment`
modifiées (`ammo_effects` uniquement, aucune autre colonne).
**Retour arrière** : `down()` fourni, restaure les valeurs d'origine exactes.

## Session (Saar) — 2026-08-23 — `WIZ46` : STEP3 effaçait les mutations Revers de STEP4

**Contexte** : discussion sur la collaboration temps réel MJ/joueur dans le Wizard (double-écriture
sur un même champ). Détour volontaire vers la question de fond posée par Saar (« l'architecture
n'est-elle pas adaptée ? ») avant tout code sur le sujet initial, conformément à la clarification
posée dans cette même session (qualité structurelle avant vitesse — voir mémoire
`feedback_quality_over_speed_no_repeat_patches`) : audit complet des 7 étapes du Wizard
(`reconcileCreation`/`getStepNState`, `creationService.js` lu intégralement) plutôt qu'une réponse
d'intuition.

**Résultat de l'audit** : l'architecture n'est globalement pas « bancale » — Steps 0/1/2/5/6/Récap
saines, et les 2 bugs de resync déjà connus (`base_age`/`age`, `skill_allocations`/
`autodidacte_allocations`) sont bien corrigés de façon durable (colonnes brutes dédiées), pas des
rustines fragiles. Deux trous réels trouvés, non documentés avant cette session :

1. **`WIZ46` (corrigé cette session)** : `reconcileCreation` §STEP3 (`creationService.js` ~L821)
   supprimait `char_mutations` sans filtrer par `source` — efface au passage les mutations
   `source='revers'` (propriété exclusive de STEP4), jamais réinsérées par STEP3 (qui ne réinsère que
   `chosen`/`random`). Perte silencieuse si le joueur resoumet Step3 seul (« Changer de méthode » →
   Suivant sans repasser par l'Étape 4). STEP4 fait déjà l'opération symétrique correctement filtrée
   depuis l'origine (commentaire explicite déjà présent dans le code, ligne ~1019-1023) — STEP3
   n'appliquait simplement pas la réciproque. Correctif : `.whereIn('source', ['chosen', 'random'])`
   ajouté au `.del()`. Test ajouté `creationRoundTrip.test.mjs` (mutation `revers` posée directement
   via `mutationService.addMutation`, resubmit Step3 seul, vérifie la survie de la ligne).
2. **Step4 `openedSkills` non reconstructible (non corrigé, `bug_tickets` à créer si besoin)** : une
   compétence « ouverte » via un groupe de choix sans allocation de points n'a pas de colonne brute
   dédiée contrairement à `skillAllocations` — perdue au prochain resync. Même schéma causal que le
   bug déjà corrigé, solution déjà connue, juste pas encore appliquée à ce champ. `[HYPOTHÈSE]`
   code-tracée, non instrumentée en conditions réelles — laissé de côté, pas encore tiqueté.

**Analyse à charge faite avant codage** (demandée explicitement par Saar) : le filtre proposé pour
WIZ46 réintroduit un chemin vers un trou préexistant et distinct — les contraintes uniques
`uq_char_mut_no_sub`/`uq_char_mut_with_sub` (`char_mutations`, migration
`115_char_mutations_constraints.js`) ne sont pas partitionnées par `source`. Une mutation `revers`
préservée par le nouveau filtre peut entrer en collision avec une mutation `chosen` du même
`mutation_id` soumise ensuite (fusion silencieuse via `ON CONFLICT`, ou erreur 500 brute pour une
mutation à sous-type). Vérifié que ce trou existe déjà aujourd'hui dans le sens inverse
(`mutationService.js#addMutation`, appelé par STEP4 ligne ~1384, même `ON CONFLICT` non filtré) — pas
une régression introduite par ce correctif, mais un trou qui mérite son propre arbitrage produit
(sémantique de `count` : total toutes sources, ou par source ?). Tracé séparément, hors périmètre
volontaire de ce lot : ticket `MUT-SRC-UNIQ1`.

**Fichiers touchés** : `server/src/services/creationService.js` (le fix, 1 ligne + commentaire),
`server/src/services/creationRoundTrip.test.mjs` (nouveau test), `server/src/scripts/
create_ticket_wiz46_step3_wipes_revers.js` et `server/src/scripts/
create_ticket_mutation_source_unicity.js` (scripts à usage unique, déjà exécutés).

**Testé** : `node --env-file=.env --test server/src/services/creationRoundTrip.test.mjs` → 3/3 verts,
dont le nouveau test.
**Non testé** : ⚠️ clos partiel — scénario réel navigateur (MJ + joueur) non fait. Ticket `WIZ46`
laissé `in_progress`, pas `resolved`, jusqu'à confirmation.
**Données** : aucune migration, correctif de code pur. Aucune réparation rétroactive des mutations
Revers déjà perdues avant ce correctif sur des fiches encore en brouillon (`wizard_locked_at IS
NULL` — portée nécessairement limitée aux créations en cours, un personnage verrouillé n'appelle
plus jamais `reconcile`).
**Retour arrière** : aucune migration, `git revert` du commit suffit.

Sujet initial (présence temps réel MJ/joueur sur un champ, double-écriture) resté en discussion,
non implémenté cette session — voir `docs/EN_COURS.md` si repris plus tard.

---

## Session (Claude) — 2026-08-28 — Chantier RW fenêtres de déclaration de combat — CLOS

`PLAN_RW_DECLARE_WINDOWS.md` (v2), archivé `docs/Old/`. « Finir REWORK-05 » : sortir les morceaux de
châssis encore dupliqués entre les 3 fenêtres de déclaration (`CombatActionWindow`,
`CombatGmDeclareWindow`, `CombatExoActionWindow`) en briques partagées, un module à la fois, chacun
plan → analyse à charge → code → validation navigateur. **Les 3 orchestrateurs restent séparés**
(fusion GM+Joueur rejetée, REWORK-05).

**Livré (tous validés navigateur)** :
- **Module 1** — `StateSelector` (défini dans `CombatActionWindow.jsx`, importé de là par le MJ =
  import croisé à l'envers) → `client/src/components/CombatDeclareStateSelector.jsx`. Convention de
  famille `CombatDeclare*` fixée (D7).
- **§5bis** — bug de jeu : Tir visé humain rejeté à tort au tour N+1 après un changement d'état au
  tour N. `endTurn` remet `state_position/cover/vitesse/combat_mode` aux défauts serveur mais le
  client ne re-synchronisait `decl`/`initialStates` qu'au changement de token. `RESET_NEW_TURN`
  supprimé du reducer (`RESET` sert les 2 cas), effets de reset consolidés dans les 2 fenêtres,
  `snapFromRosterEntry` exporté. + sous-bug : champ d'état absent du payload = inchangé
  (`shared/combatExclusiveActions.js`, `(state?.X ?? entry?.state_X) !== entry?.state_X`).
- **Module 2** (périmètre « robuste », D9) — **`shared/combatIniCost.js`** : autorité **unique** du
  coût d'Initiative d'une déclaration, **client + serveur**. `iniDeltaBreakdown` (primitif, détail
  poste par poste) → `computeIniDelta` (somme) → `projectedInitiative`. Le serveur
  (`socketCombatAnnouncement.js`) supprime sa matrice `STATE_COSTS` + sa boucle, appelle
  `computeIniDelta` ; iso-comportement (vérifié contre les gardes du handler), zéro changement de
  payload/règle. C'était la **dernière maths de combat dupliquée client/serveur** (les autres —
  `combatRange`, `combatMovement`, `ammoRules`, `combatExclusiveActions`, `combatStatePositionCost`
  — étaient déjà partagées). Pastille « Initiative projetée » (`CombatDeclareIniWidget`, rouge si
  projeté ≤ 0, tooltip du détail) branchée dans les 3 pieds — clôt l'item 2 de la dette exo.
  Bug d'aperçu Charge/Retraite MJ corrigé au passage. `combatSections.js` déduplique ses matrices
  (référencent `STATE_TRANSITION_COST` partagé), `calc*` délèguent.
- **Module 3** — `COMBAT_DECLARE_ERROR` avait **4 listeners** (3 `socket.on` en composant feuille =
  violation P57 + `useCombatSocket`). Patron `sessionStore.criticalEffect` / `CriticalEffectOverlay`
  copié : `sessionStore.declareError` posé par `useCombatSocket#onDeclareError` (aucun nouvel
  abonnement), auto-effacé 4 s (timer centralisé dans le hook), affiché par `CombatDeclareErrorBanner`
  (dumb, lit le store). Les 3 fenêtres perdent leur `useEffect` d'écoute local. 1 classe CSS
  `.combat-declare-error-banner` remplace 3 copies inline-style.
- **Module 7** — `InlineChip` (composant local à `CombatGmDeclareWindow`) → `CombatDeclareStateChip.jsx`.
  `nextKey` → `combatSections.js` + **premier fichier de test du modèle** (`combatSections.test.mjs`,
  5 cas). API `CombatDeclareState*` **unifiée** : `stateKey` (string) partout — le `stateKey` mort +
  `def={STATE_DEFS.X}` redondant retirés des 5 sites ; les 2 fenêtres n'importent plus `STATE_DEFS`.

**Non livré, décidé** :
- **Module 5** (`CombatDeclareFrame`, chrome partagé) — **annulé** (B5) : les familles CSS
  `combat-float-*` (joueur/exo) et `combat-win-*` (MJ) diffèrent réellement (poignée basse,
  habillage de section, layout de header). Un frame partagé forcerait une régression visuelle ou une
  prop `variant` qui réintroduit le branchement. À reprendre seulement après une passe design qui
  unifie les 2 familles.
- **Module 6** (`useHumanDeclare`, extraction des 26 `useState` de `CombatActionWindow`) — **différé**
  jusqu'à ce qu'une infra de test composant (vitest/RTL) existe. Sans tests de caractérisation,
  l'extraction du cœur de combat le plus joué = bug subtil garanti (INFRA-4). Le bug qui la motivait
  (Tir visé) a été corrigé sans extraire (§5bis).
- **Module 4** (`CombatDeclareRoster` / `usePersistedToggle`) — **non fait**. Après recherche : le
  pattern « toggle persisté » n'est recopié qu'à 2 endroits (`pj-roster-open` / `gm-roster-open`),
  pas ~6. Un `usePersistedToggle` à 2 consommateurs + une garde `try/catch` sur `localStorage`
  théorique pour un VTT de table — n'aggrade sur aucun des axes qui justifiaient le module 7.
  `<CombatDeclareRoster>` unique = piège B4 (rosters MJ/joueur réellement différents).

**Devient définitif dans** : `docs/SYSTEME/REACT.md` **P58** (briques `CombatDeclare*`, règles) ;
`docs/SYSTEME/COMBAT_FLUX.md` § « Calcul delta initiative » (`shared/combatIniCost.js`, postes réels —
matrice `STATE_COSTS` stale + `cover_shot` + forfait CaC retirés du doc) ; `docs/SYSTEME/COMBAT.md`
§ « Fenêtres de déclaration » ; index `CONVENTIONS.md` §19 P58.

**Fichiers neufs** : `shared/combatIniCost.js` (+`.test.mjs`), `client/src/components/` →
`CombatDeclareIniWidget.jsx`, `CombatDeclareErrorBanner.jsx`, `CombatDeclareStateSelector.jsx`
(module 1), `CombatDeclareStateChip.jsx`, `combatSections.test.mjs`. `sessionStore.declareError`.

**Non fait** : `docs/ASBUILT.md` (arbre de fichiers, annotations `Modifié <sprint>`) non mis à jour —
artefact manuel, convention de numérotation propre à Saar.

**Testé** (à chaque module) : `node --test shared/*` (335), `node --test` des `.test.mjs` neufs,
`vite build`, `eslint` vs baseline. Validation navigateur Saar module par module (combats réels).

---

## Session (Claude) — 2026-08-29 — Ticket `DECL-CURSOR-HIDDEN` : curseur invisible après un clic sur une action de déclaration

**Symptôme** (signalé par Saar, test navigateur du chantier RW déclaration) : armer un mode ciblage/
déplacement en cliquant une action dans une fenêtre de déclaration (Tir → cible, Déplacement → zone)
rendait le pointeur invisible tant qu'on ne bougeait pas la souris.

**Cause racine** (`client/src/components/SceneCursorOverlay.jsx`) — l'existence de l'overlay `<img>`
CASE/CIBLE était dérivée d'un **état implicite** : « un `pointermove` canvas reçu sans `pointerleave`
depuis ». La variable `pos` mélangeait deux rôles (position pointeur + « l'overlay doit-il être
monté »). Au changement de mode, le 1er `useEffect` posait `canvasEl.style.cursor = 'none'`
immédiatement, mais l'overlay n'était monté qu'au 1er `pointermove` **canvas** — or le clic
d'armement part de la fenêtre de déclaration (qui passe aussitôt `pointer-events:none`), pas du
canvas, donc aucun `pointermove` canvas ne suivait. Entre les deux : curseur natif masqué + overlay
absent = aucun curseur.

**Correctif** (refonte du composant, 1 fichier, `index.css` inchangé) :
- `pos` (rôle double) → `pointer` (position brute seule) + `overlayVisible` (état explicite).
- Écoute `pointermove`/`pointerleave` scopée canvas → un seul suivi au niveau `document`
  (+ `pointerleave` sur `documentElement` pour la sortie de page).
- Visibilité dérivée d'un hit-test `document.elementFromPoint(pointer.x, pointer.y)` recalculé **au
  déplacement ET au changement de mode** (`useEffect` sur `[canvasEl, pointer, resolvedMode]`) — le
  changement de mode ne produit aucun événement pointeur, c'est ce recalcul qui monte l'overlay sans
  attendre un mouvement. `elementFromPoint` ignore nativement les éléments `pointer-events:none` (la
  fenêtre de déclaration masquée) et respecte l'occlusion par un panneau réel (dés, fiche).
- `resolveCursorStyle` gagne le paramètre `overlayVisible` : `cursor:'none'` n'est renvoyé que
  lorsque l'overlay est réellement monté — le composant et la fonction consomment la même valeur.
  **Invariant : curseur natif masqué ⟺ overlay `<img>` monté.** Le curseur invisible devient
  structurellement impossible.
- `resolveMode` : 1 appel par render (contre 2 avant — render + `onMove`), unique source de vérité.

**Fichier touché** : `client/src/components/SceneCursorOverlay.jsx` (refonte). Props inchangées,
aucun impact sur `Canvas3D.jsx`.

**Testé** : `vite build` (client) propre ; `eslint SceneCursorOverlay.jsx` → 1 erreur
`react-hooks/immutability` sur `canvasEl.style.cursor =`, **strictement identique à la version
d'origine** (vérifié `git stash`) — règle RC récente, dette pré-existante à l'échelle du repo, le
masquage du curseur natif impose cette mutation DOM en `useEffect`. Validation navigateur par Saar :
curseur CASE/CIBLE visible immédiatement à l'armement depuis une fenêtre de déclaration, sans bouger
la souris (« Fonctionnel »).

**Non testé** : occlusion par un panneau réel pendant le ciblage et perf `elementFromPoint` par frame
sur scène chargée — non isolés spécifiquement dans la validation, mais couverts par le combat réel
joué.

**Données** : aucune. Client pur. Ticket `DECL-CURSOR-HIDDEN` (`bug_tickets`) passé `resolved` via
`server/src/scripts/resolve_ticket_decl_cursor_hidden.js` (à lancer en local par Saar). Le script
d'insertion `server/src/scripts/ticket_decl_cursor_hidden.js` (commit c9c6c50) portait un en-tête
« pas de correctif codé » désormais périmé.

**Retour arrière** : `git checkout client/src/components/SceneCursorOverlay.jsx`.

---

## Session (Claude) — 2026-08-30 — RW déclaration : M0.4 (a→g) + module 4 « l'arme EST l'action » (PJ / MJ / Exo) — CHANTIER CLOS

Suite de `PLAN_RW_DECLARE_DESIGN.md`. Chantier repris après constat Saar : les « modules 2v/3/5
codés » de la session du 2026-08-29 n'étaient qu'un remap de tokens sur le châssis — **le corps des
fenêtres n'avait jamais été touché**, donc « rien ne ressemble à la maquette ». Les 2 artifacts
claude.ai ont été **matérialisés dans le dépôt** (`docs/PLANS/maquette-declare/` — 4 artboards +
`preview.html` + `pcb.svg`), lecture via l'outil Artifact. Décision Saar : faire le module 4 + M0.4
directement contre `CombatActionWindow` (PJ) puis `CombatGmDeclareWindow` (MJ), sans attendre le
frame ni M-E2E — filet = golden master `buildDeclarePayload` + validation navigateur.

**M0.4 (a→e)** — le sous-état de sélection Tir / CaC (recopié ~90 % entre PJ et MJ) extrait en
**reducers purs par domaine** :
- `client/src/lib/assaultDeclaration.js` + `useAssaultDeclaration.js` (15 tests) — `SELECT_WEAPON`
  resette la config (P8, changement de comportement MJ documenté) ; `setTarget` self-terminant pour
  la chaîne récursive `selectNext` du MJ (supprime `effectiveAssaultCountRef`).
- `client/src/lib/meleeDeclaration.js` + `useMeleeDeclaration.js` (11 tests) — `weaponId`
  undefined/null/id + `naturalWeaponId` exclusif ; `SET_COUNT` = troncature seule.
- Câblage PJ (`CombatActionWindow`) puis MJ (`CombatGmDeclareWindow`) : les ~13 `useState` du
  sous-état → 2 hooks + alias en lecture (sites de lecture inchangés). Écarts iso documentés :
  reset d'`isDualWield` / d'`aimedLocation` / de l'arme naturelle au changement d'action —
  corrections de fuites latentes, alignées PJ ↔ MJ.

**Module 4** — `CombatDeclareActionList.jsx` (partagé PJ + MJ) :
- `client/src/lib/weaponList.js` — `buildWeaponList` (10 tests) : normalise armes équipées +
  naturelles + mains nues permanente. **Bug corrigé** : `displayName` ne testait que
  `custom_name`/`ref_name` (forme PJ) — les items MJ portent `name`, toutes les armes du MJ
  s'affichaient « Mains nues ».
- move-line cumulable (glyphe `movement.svg`) + liste groupée Distance / Contact. Choisir une arme
  arme l'attaque + auto-dégaine ; re-clic annule ; Tir ⊕ CaC exclusif. `selectedRangedWeaponId`
  (neuf) fixe l'arme de tir quand 2+ armes à feu équipées.
- Colonne 2 (`AssaultRangedPanel`) : sélecteur **Mode de tir** CC/RC/RL intégré (props
  `availableFireModes`/`onFireModeChange`), rappel d'arme retiré (D5), « Cible » compacte + glyphe
  `target.svg`, silhouette « viser une localisation » → `BodySilhouetteSvg` sur la géométrie
  `docs/PLANS/human.svg` (2 sous-colonnes, D11).
- **Recharger** (option B, Saar) : ↻ sur la ligne de l'arme de tir sélectionnée (à droite du
  compteur de munition), plus de segment `Tir │ Recharger`. `buildGmDeclarePayload` : `attack` et
  `reload` jamais ensemble (D7) + test dédié.
- Le MJ **gagne l'état « arme sélectionnée » intermédiaire** qu'il n'avait pas (avant : saut direct
  au ciblage carte) — `attackStarted` inclut `weaponId != null`.
- Bug « énorme trou vide » en col. 2 corrigé : `flex: 0 0 360px` (largeur fixe) devenait une
  **hauteur** fixe dans le wrapper `.decl-col2` en colonne → `flex: 1; minHeight: 0`.

**Fichiers touchés** : `client/src/lib/{weaponList,assaultDeclaration,useAssaultDeclaration,meleeDeclaration,useMeleeDeclaration}.js` (+ `.test.mjs`), `client/src/lib/buildDeclarePayload.js` (+ test), `client/src/components/{CombatDeclareActionList,CombatActionWindow,CombatGmDeclareWindow,AssaultRangedPanel,AimedLocationPicker,BodySilhouetteSvg,CombatDeclareStatePanel}.jsx`, `client/src/index.css`, `client/src/locales/combat.json`, `client/public/assets/status/{contact,distance,movement,target}.svg`, `docs/PLANS/maquette-declare/*`, `docs/PLANS/PLAN_RW_DECLARE_DESIGN.md`, `docs/SYSTEME/{COMBAT,REACT}.md`, `docs/ROADMAP.md`. ~20 commits `dev/Saar` (non poussés).

**Testé** : `npm test` 1111/812/0 (golden masters `buildHumanDeclarePayload` 52 / `buildGmDeclarePayload` 16 verts, reducers 26) ; `vite build` client propre ; `eslint` iso-baseline (1 erreur pré-existante `react-hooks/set-state-in-effect` sur le reset effect du MJ) ; **validation navigateur Saar** : fenêtre MJ conforme maquette, liste d'armes fonctionnelle, Recharger, silhouette (« Parfait »).

**Non testé** : le mode Recharger PJ de bout en bout (sélection munition + serveur).

**Suite immédiate (même session, 2026-08-30)** — les 3 points « queued » traités :
- `CombatExoActionWindow` migré sur `CombatDeclareActionList` (`ec9b10e`) — col. 2 minimale
  (exo = 1 attaque/Tour, pas de mode de tir, pas de dual-wield). `weaponList.js` : `displayName`
  accepte `display_name` + grisage « chargeur vide » généralisé (`ammo_remaining ≤ 0` sans calibre).
- `MeleeCombatPanel` : sélecteur d'arme retiré (`c37486d`, ~80 l.) — redondant avec la col. 1.
- D4b (`cbf41de`) : couleurs de sélection d'`AssaultRangedPanel` (rouge) / `MeleeCombatPanel` (vert)
  / `AimedLocationPicker` (doré) → `--decl-acc` + tokens neutres, fallbacks hex conservés.
- **M0.4-g** (`495cec2`) : unification de la Charge. `meleeDeclarationReducer` gagne un champ
  `charge: { move, targetTokenId } | null` + `SET_CHARGE`. Le MJ perd son `useState chargeSelection`,
  le PJ arrête de détourner `moveSelection` + `meleeDecl.targets` — les deux lisent
  `meleeDecl.state.charge`. `buildHumanDeclarePayload` gagne une branche Charge (miroir
  `buildGmDeclarePayload`). Golden master : test « Déplacement en Charge » réécrit sur la nouvelle
  forme. `mapActionsObj.melee` était de toute façon ignoré par `toIniParams` (aucun impact INI).
  **M0.4 est complet (a→g).**

**CHANTIER CLOS** — `PLAN_RW_DECLARE_DESIGN.md` + son journal + `maquette-declare/` archivés
`docs/Old/` (`495cec2`+). Les 3 fenêtres (PJ / MJ / Exo) partagent `CombatDeclareActionList` +
`useAssaultDeclaration` / `useMeleeDeclaration` + `CombatDeclareFooter` + satellite + tokens `--decl-*`.
Invariants durables : `REACT.md` P58 + `COMBAT.md` § Fenêtres de déclaration. Non faits, jugés non
prioritaires (Saar) : `CombatDeclareFrame` (châssis commun, P58 le juge secondaire), harness E2E.

**Données** : aucune. Client + un module partagé pur. Aucune migration.

**Retour arrière** : `git revert` par sous-commit (chaque module retire son ancien code dans le même
commit ; pas de feature flag).

---

## Session (Claude) — 2026-08-30 — Ticket `DRONE-CC-MELEE-MISCLASS` : mode de tir « CC » confondu avec le corps à corps

**Symptôme** (Saar, combat réel) : « Armement drone — programme armement_contact manquant même en cas
de tir à distance ». Drone AX, arme « Fusil Gauss » → à la Résolution, jet remplacé par « programme
"armement_contact" manquant », aucun dé.

**Cause racine — établie sur les données réelles (accès direct `bug_tickets`/schéma, aucun ticket
n'existait d'ailleurs, celui-ci créé dans la foulée)** : le code drone lisait `fire_mode === 'cc'`
comme « corps à corps », à 4 endroits. Or `CC` = **Coup par Coup**, un mode de tir
(`shared/fireModes.js` : `FIRE_MODE_ORDER = ['CC','RC','RL']`) — une arme de contact n'a **aucun**
`fire_mode` (vérifié : les 39 « Arme de contact » du catalogue ont toutes `fire_mode` NULL ; `CC` est
le mode de tir le plus répandu). Le Fusil Gauss (`ref_equipment` category « Arme lourde »,
`fire_mode` « CC », portée 1400 m — donnée correcte) était donc classé CaC →
`resolveDroneAssaultAction` exigeait `armement_contact` alors que Drone AX a `armement_distance`
(Balistique niv. 8).

**Correctif (périmètre A, validé avec Saar — miroir de l'exo, `PLAN_EXOARMURE.md §16.4`)** :
discriminant = `ref_equipment.category === 'Arme de contact'` (autorité déjà utilisée par l'exo et
l'humanoïde `getOwnedHandWeapon`), aux 4 sites. Le repli mort `!ref_fire_mode` (jamais atteignable —
`drone_weapons.fire_mode` est `NOT NULL DEFAULT 'rc'`) est supprimé. Arme drone « maison » sans
`equipment_id` (`ref_category` NULL) → distance, même choix assumé que l'exo.

**Fichiers touchés** :
- `server/src/socket/socketCombatHelpers.js` — `resolveDroneAssaultAction` : `isCaCWeapon` sur
  `ref_category` ; `+ ref_equipment.category` dans la requête arme, `- explicit_fire_mode`,
  `- ref_fire_mode` (devenus morts).
- `client/src/lib/buildDeclarePayload.js` — `buildDroneMapActions` : `isCaC` sur `ref_category`
  (garde `fire_mode` pour `stateFireMode`).
- `client/src/lib/useDroneDeclare.js` — `resolveDroneClickAttackMode` + `handleChooseTarget`.
- `server/src/routes/character/char-sheet.js` — `+ ref_equipment.category as ref_category` dans
  `GET /:characterId/drone/weapons` et les réponses POST/PUT.
- `client/src/lib/buildDeclarePayload.test.mjs` — 3 cas golden master qui encodaient la mauvaise
  règle réécrits (« arme sans ref_fire_mode → CaC », « fire_mode cc → CaC », « arme introuvable →
  CaC »), + 1 test de régression ajouté (mode CC sur arme à distance → Tir).

**Hors périmètre — ticket `DRONE-ARMEMENT-PROGRAM-SPLIT` créé** (`suggestion`, low) : le split strict
`armement_contact` / `armement_distance` sans repli vs le RAW (un seul « programme de contrôle
armement » par arme, Livre de Base p.281 ; seed « Contact » = « générique contact ou distance »).
Décision produit à trancher par Saar.

**Testé** : `node --test` — `shared` 335, client `lib` 183 (dont golden master
`buildDeclarePayload` 52), serveur `socket`+`lib` 79 (140 skip DB) — tous verts. `vite build` client
propre. `eslint` iso-baseline (1 erreur `react-hooks/set-state-in-effect` pré-existante ligne 39 de
`useDroneDeclare.js`, confirmée par `git stash`). Query de contrôle : Drone AX / Fusil Gauss →
`ref_category` « Arme lourde » → `isCaCWeapon` false → `armement_distance` → Balistique niv. 8
présent.

**Non testé** : validation navigateur Saar (attaque drone à distance résolue de bout en bout ; un
drone avec arme de contact réelle → toujours `armement_contact`). ⚠️ **clos partiel**.

**Données** : aucune migration. Tickets `DRONE-CC-MELEE-MISCLASS` (créé `in_progress`) et
`DRONE-ARMEMENT-PROGRAM-SPLIT` (créé `new`) à insérer via
`server/src/scripts/create_ticket_drone_*.js` (lancés en local par Saar).

**Retour arrière** : `git revert` du commit (5 fichiers, aucun effet runtime).

---

## Session (Claude) — 2026-09-01 — Refonte du corpus d'instructions (noyau `AGENTS.md` + enforcement)

Chantier de maintenance méta demandé par Saar (analyse à charge du corpus de règles → refonte).
Conception, décisions et table de correspondance : `docs/Old/PLAN_CLAUDEMD_REFONTE.md`.

**Décisions structurantes** : D1 `bug_tickets` = autorité du suivi bug + prochaine étape (le
contrat rattrape `EN_COURS`/`TICKETS.md`, déjà alignés) · D6 **noyau mince** · D7 `AGENTS.md`
devient le contrat tool-agnostique, `CLAUDE.md` = stub `@AGENTS.md` (pattern Anthropic pour un
dépôt qui a déjà un `AGENTS.md` ; import vérifié via `/context`).

**Fait** :
- `AGENTS.md` réécrit = le noyau (125 l.) : invariants, méthode, commandes, autorités, git,
  suivi, clôture. `CLAUDE.md` réduit à 8 l. (`@AGENTS.md` + note chargement `.claude/rules/`).
- Contenu domaine descendu dans les règles routées : **NEW `.claude/rules/migrations.md`**
  (pointeur vers `docs/SYSTEME/CORE.md §Migrations` + invariants courts), `react.md` (+inventaire
  UI), `core.md` (+pointeur i18n serveur). `.claude/rules/conventions.md` supprimé (contenu
  migré ; il chargeait sur `**/*`).
- Enforcement : **NEW `.claude/hooks/guard-git-push.js`** (+ `.test.sh`, 23 cas) — `PreToolUse`
  Bash, bloque tout `git push` vers `master`/`main` y compris formes implicites. Enregistré
  dans `.claude/settings.json` ; `Bash(git push|add|commit *)` retirés de l'`allow`.
- `.claude/settings.local.json` **dé-suivi** (`git rm --cached`) + `.gitignore` ; `deny:
  [AskUserQuestion]` remonté dans `settings.json` ; 3 entrées `allow` à credentials (JWT
  expirés, `vttpass`) purgées de `settings.json`. 0 secret dans les fichiers suivis (JWT
  expirés restent dans l'historique — risque accepté, localhost).
- `README_INSTALLATION.md` archivé `docs/Old/` (paquet installé, collab Codex finie).
- Sweep ciblé des réfs `CLAUDE.md §N` : 7 en-têtes/instructions vivants → `AGENTS.md § …`
  (`JOURNAL8`/`EN_COURS`/`INDEX`/`METHODO_PLAN`/`PLAN_LOCALISATION`) ; ~56 annotations datées
  (code, plans, entrées de session) laissées, récupérables via la table du plan archivé ;
  scratch d'autres chantiers non touchés.
- Empreinte always-on : ~5-6k → ~3.6k tokens ; 0 règle `rules/` chargée en permanence.

**Testé** : `/context` (import `@AGENTS.md` résolu — `AGENTS.md` sous *Memory files*) ;
`.claude/hooks/guard-git-push.test.sh` 23/23 + intégration réelle (`git push --dry-run origin
master` bloqué avant exécution) ; `git diff --check` OK ; JSON `settings.json` valide ;
`git grep` `JOURNAL6`/`conventions.md`/ports dans le noyau → 0 ; 15/15 fichiers référencés par
`AGENTS.md` présents.

**Non testé** : adhérence LLM au nouveau noyau sur des tâches réelles (non mesurable) ; le hook
depuis un autre worktree (`Enclume-fk2-worktree`) ; rechargement `deny`/hook au prochain
démarrage de session. Pas un `⚠️ clos partiel` : refonte documentaire, aucun comportement de
jeu ni runtime en jeu.

**Données** : aucune migration, aucun effet runtime. `settings.local.json` reste sur disque
(seulement dé-suivi).

**Retour arrière** : `git revert` du commit. Le contrat pré-refonte est dans l'historique de
`CLAUDE.md` ; `docs/Old/PLAN_CLAUDEMD_REFONTE.md` §7 porte la table de correspondance.

---

## Session (Claude) — 2026-09-02 — Portes (connecteurs) : interaction joueur/MJ — CHANTIER FONCTIONNELLEMENT CLOS

Plan réel écrit (`docs/PLANS/PLAN_INTERACTIONS_CONNECTEURS.md`, remplace la « base de travail »
du 2026-08-25) puis suivi au fil du code (`ROADMAP.md` §1, prochain dans l'ordre de priorité
après l'AOE). Porte : ouvrir/fermer libres (aucun Test RAW ne l'exige), crocheter une porte
verrouillée via un Test **Systèmes de sécurité** arbitré par le MJ — `lockDifficultyDc` autoré
par porte, fallback **-5** (malus, pas une DC classique — `defaultDifficulty` est un modificateur
signé ajouté au Seuil, `REGLE_MUTATION.md` "Très difficile, -7") si non renseigné. Override MJ :
tout clic MJ sur ce panneau est instantané (mirroir `ENTITY_ACTION_GM_DIRECT`, deux allers-retours
de conception avant de retrouver ce précédent — détail en tête du plan §4).

**Extraction notable** : `server/src/services/gmArbitratedTestService.js` (nouveau) — le calcul
d'un Test arbitré par le MJ (total compétence/attribut, malus santé/encombrement, jet + critique,
breakdown, `DICE_RESULT`, déclenchement Catastrophe) était dupliqué en substance entre
`ENTITY_ACTION_RESOLVE` et ce que `CONNECTOR_ACTION_RESOLVE` aurait dû recoder — extrait en
service partagé plutôt que dupliqué (~150 lignes), décision explicitement demandée par Saar
("la qualité du correctif compte plus que le fix", "si on doit rework pour stabiliser, on le
fait"). Refactor pur de `socketEntity.js`, comportement vérifié identique par lecture du diff —
**pas revalidé en session réelle sur une interaction d'entité** (aucun blueprint avec
interaction+compétence disponible pour tester).

**Bug pré-existant trouvé et corrigé, partagé avec l'ascenseur** : le panneau connecteur
(`SurfaceConnectorPanel`) se refermait instantanément au relâchement de la souris —
`ConnectorSegment.handlePointerDown` ouvre le panneau sur *pointerdown*, `stopPropagation()`
n'empêche jamais le "click" natif suivant sur le `<Canvas>` DOM (événement séparé) ;
`handleCanvasClick` refermait donc systématiquement, faute du même garde `justSelectedRef` déjà
posé pour la sélection de token. Jamais remarqué avant faute d'un test aussi poussé du clic
connecteur — corrigé une fois dans `handleSurfaceConnectorSelect`, bénéficie donc aussi à
l'ascenseur.

**Fichiers touchés** : `shared/events.js`, `shared/world/{surfaceDocument,worldMetrics,
connectorActions}.js` (+ tests), `server/src/services/{worldSpatialQueryService,
gmArbitratedTestService}.js` (+ test), `server/src/socket/{socketConnector,index,socketEntity}.js`,
`client/src/components/{SurfaceConnectorPanel,Canvas3D,MessageRendererRegistry,Sidebar,
SidebarChatTab}.jsx`, `client/src/{stores/sessionStore,lib/useConnectorSocket,locales/{builder,
fr}.json}`, `docs/PLANS/PLAN_INTERACTIONS_CONNECTEURS.md`. Commit `10cde1e`, `dev/Saar` (poussé :
non — en attente).

**Testé** : `node --test` 27/27, `node --check` + imports réels sur tous les fichiers serveur,
`npx eslint` propre (baselines `Canvas3D.jsx`/`SessionPage.jsx` comparées à HEAD, identiques avant/
après), `npm run build` client propre. **Session réelle Saar** : déclarer, portée, branche libre,
Test réussi/échoué/auto/refusé, override MJ, portes déjà implantées dans une carte existante.

**Non testé** : non-régression entité (`gmArbitratedTestService.js`, voir ci-dessus) ; échelle
(explicitement hors périmètre, `[INCONNU]` si `navigation.js` couvre déjà la traversée verticale).
**⚠️ clos partiel** au sens strict (2 tickets ouverts, non bloquants, domaine `monde`) :
cadre de sélection jaune déformé sur une porte (`ConnectorSelectionOutline`, cause non confirmée —
données de la porte vérifiées saines, calcul `connectorDoorBox()` sain sur le papier pour son
`axis`, investigation visuelle nécessaire) ; aucune représentation visuelle ouverte/fermée du
modèle GLB (`DoorConnectorModel` ignore l'état, statique — collision/LOS corrects, seul le rendu
3D ne suit pas ; chantier de modélisation/animation à part, pas cadré).

**Données** : aucune migration — `lockDifficultyDc` est une nouvelle clé JSON dans le schéma v12
`connectors` existant (`surface_data`), rétrocompatible.

**Retour arrière** : `git revert` du commit `10cde1e` (aucun autre commit dessus à ce jour).

## Session (Claude) — 2026-09-03 — AOE (fusil à pompe) : étape 9, UI de ciblage — CHANTIER FONCTIONNELLEMENT CLOS

Suite de `docs/PLANS/PLAN_AOE.md` (étapes 1-8 des sessions précédentes, résolution serveur déjà
codée et confirmée). Cette session couvrait l'étape 9 : déclaration côté client (direction du tir
en zone) jusqu'au rendu 3D de visée.

**Chaîne validée en session réelle par Saar, de bout en bout** (Klauss/fusil à pompe, tireur PNJ) :
armement du mode de visée → aperçu 3D suivant la souris → clic pour figer → Valider/Changer →
déclaration (`assaultDeclaration.js#aoeDirection` → `buildDeclarePayload.js` →
`socketCombatAnnouncement.js`) → résolution (`resolveAoeAssaultAction`) → dégâts transmis. Log
serveur final : `PRECHECK assault ... ok:true`, résolution sans erreur, combat terminé normalement.

**Trois bugs de données/logique trouvés et corrigés en cours de route** (root cause à chaque fois,
détail complet dans `docs/PLANS/PLAN_AOE.md` §12 ligne étape 9) :
1. `/combat-equipment` (fenêtre MJ) ne sélectionnait jamais `ref_name`/`ref_range` (colonnes SQL non
   aliasées) — "Viser une zone" n'apparaissait jamais pour un PNJ. Effet de bord positif : répare
   aussi la détection de palier de portée du clic-attaque ambiant PNJ, qui lisait la même donnée.
2. `CombatModifiersWindow.jsx` bloquait "Lancer" pour une action de zone (case Portée sans cible
   unique) — la condition de gate était en fait dupliquée 3× (`handleLancer`, `disabled`, style
   `opacity`/`cursor`) ; un premier correctif partiel n'avait touché qu'une des trois. Unifié en une
   seule variable `canRoll`, équivalence avec l'ancien comportement vérifiée par De Morgan.
3. Prémisse fausse de la v9 du plan : traiter Zone d'effet comme un raffinement optionnel du tir
   normal (exclusivité à arbitrer avec Tir Multi/Tir visé). Le Klauss n'a RAW aucun mode de tir
   normal — retiré (pas laissé en dead code) le mécanisme d'exclusivité correspondant,
   `AssaultRangedPanel.jsx` bascule entièrement sur la section Zone d'effet pour cette arme.

**Aperçu 3D de visée — 4 itérations avant la bonne, cause racine finale hors de toute logique
métier** : trois modèles d'interaction essayés et rejetés (survol passif, clic-glisser-relâcher à la
Foundry VTT, survol continu avec `pointermove` DOM géré à la main) avant d'adopter le patron
officiel React Three Fiber (`useFrame` + `state.raycaster`, cf. r3f.docs.pmnd.rs/tutorials/how-it-works
et la discussion pmndrs/react-three-fiber#3321). Un bug résiduel après ce patron ("l'AOE est posée
dès le clic, Changer sans effet") a nécessité des logs `[DBG]` temporaires pour confirmer que l'état
React se mettait bien à jour en continu — le vrai bug était dans le rendu Three.js : réaffecter la
prop `array` d'un `<bufferAttribute>` déjà monté ne pose jamais `.needsUpdate = true` (confirmé en
lisant `applyProps` dans le code source installé de `@react-three/fiber`), donc le tampon envoyé au
GPU restait celui du tout premier rendu. Corrigé en incluant l'angle dans la `key` du mesh, forçant
un remontage complet de la géométrie à chaque mise à jour réelle (coût négligeable, cadence déjà
limitée par un garde-fou perf existant).

**Fichiers touchés** : `client/src/components/{Canvas3D,AssaultRangedPanel,CombatActionWindow,
CombatGmDeclareWindow,CombatModifiersWindow,CombatOverlay}.jsx`, `client/src/lib/{assaultDeclaration,
buildDeclarePayload,useAssaultDeclaration,useCombatUIState,useSceneCursor,aoePreviewShape}.js`
(+ tests), `client/src/locales/combat.json`, `client/src/pages/SessionPage.jsx`,
`server/src/routes/battlemaps.js`, `server/src/socket/{socketCombatAnnouncement,
socketCombatHelpers}.js`, `shared/{combatExclusiveActions,combatRange}.js` (+ tests),
`docs/PLANS/PLAN_AOE.md`.

**Testé** : `node --test` 117/117 (domaine AOE/déclaration), `npx eslint` (baseline inchangée sur
tous les fichiers touchés), `npm run build` client propre, `node --check` serveur propre,
`git diff --check` propre. **Session réelle Saar** : combat complet au Klauss, tireur PNJ, 3 cibles
touchées puis reconfirmé après le correctif du rendu 3D — dégâts transmis, combat terminé
normalement côté serveur.

**Non testé** : tireur PJ en résolution (séquencé après le rework de séparation des fenêtres
DRONE/HUMAN/EXO-ARMURE, hors périmètre de cette session — cf. bannière de tête du plan) ; Test de
Chance (longue/extrême portée) ignoré en v1, aucune colonne Chance dans le schéma ; fusil à pompe en
rafale (Tir Multi) hors scope, aucune donnée catalogue ne permet de l'identifier.

**Données** : aucune migration nouvelle cette session (le schéma `combat_action_targets` et la
colonne JSONB `modifiers.aoe` existaient déjà depuis les étapes 6a/6b).

**Retour arrière** : `git revert` du commit `dev/Saar` correspondant (voir `git log`).

---

## Session (Claude) — 2026-09-03 — AOE (fusil à pompe) : tireur PJ — CHANTIER CLOS

Suite immédiate de l'étape 9. Objectif : un PJ peut résoudre un Tir en zone au Klauss, pas seulement
un PNJ.

**Trois plans successifs, deux écartés après conception complète** (méthode : plan → analyse à
charge → conception détaillée → écarté si le code le contredit) :
1. *« Le tireur PJ attend un rework de séparation des fenêtres DRONE/HUMAN/EXO »* (bannière du plan
   v9-v11) — **dépendance inexistante**, vérifié dans le code : le dispatch de résolution est déjà
   séparé par type (`socketCombatResolution.js:402-406`), `CombatDamageWindow` est déjà PJ-only et
   agnostique. Aucun « rework de fenêtres » n'a jamais été planifié ni écrit.
2. *« Tireur PJ = armer N `armAwaitingDamage` FIFO + champ `spreadDamageDice` additif dans
   `confirmDamage` »* — **conçu pour de bon puis écarté** : `confirmDamage` émet
   `COMBAT_DAMAGE_PROMPT(k+1)` avant `COMBAT_DAMAGE_RESULT(k)` et le hook client (`useCombatSocket.js`)
   n'a qu'un slot `damagePayload` + un `damageResults` — pour N cibles la fenêtre affiche le nom de
   k+1 avec les dégâts de k et un « Fermer » qui jette le reste. Bug latent identique au CaC
   multi-attaques sur défenseurs PJ distincts, jamais exercé.
3. **Retenu (Saar)** — pour une arme de zone, le seul jet joueur qui a du sens est le Test de tir
   (Phase A, le « Lancer » déjà cliqué). **Résolution immédiate** : `resolveAoeAssaultAction` traite
   désormais tous les types de tireur par la même boucle ; un tireur PJ reçoit en plus un
   `COMBAT_ATTACK_PLAYER_RESULT { targets: [...] }` agrégé (fenêtre-reçu non bloquante, `suspend:false`),
   affiché en liste par cible dans `CombatModifiersWindow`. Aucune touche au pipeline différé
   (`confirmDamage`/`armAwaitingDamage`/FSM `AWAITING_DAMAGE`/`resolveAssaultHitPj`). Les 4 helpers
   d'aggradation envisagés à l'analyse à charge tombent : plus de 4ᵉ chemin de résolution.

Le collapse du dispatch par type de cible (3 exemplaires : boucle AOE-immédiate, `resolveAssaultHitPnj*`,
`confirmDamage`) reste une dette distincte — `ROADMAP.md` §5, hors périmètre (décision Saar 2026-08-26 :
pas mélangé à l'ajout de fonctionnalité).

**Fichiers touchés** : `server/src/socket/socketCombatHelpers.js` (`resolveAoeAssaultAction` :
early-return `pj` retiré, `isPnjResult` paramètre `isPnj` ×4, agrégat `playerTargetResults` +
`COMBAT_ATTACK_PLAYER_RESULT`, cas 0 cible séparé) ; `client/src/lib/combatResultLabels.js` (nouveau —
`LOC`/`SEVERITY` extraits de `CombatResultPanels.jsx`, la règle `react-refresh/only-export-components`
interdisant de les exporter depuis un `.jsx`) ; `client/src/components/CombatResultPanels.jsx` (importe
le nouveau module) ; `client/src/components/CombatModifiersWindow.jsx` (liste par cible + bannière
« aucune cible » + bouton Fermer élargi) ; `client/src/locales/combat.json` ;
`docs/PLANS/PLAN_AOE.md` (§5.1 réécrit, §8 étape 10, §12) ; `docs/ROADMAP.md` ; `docs/SYSTEME/COUVERTURE_RAW.md`.

**Testé** : `node --check` serveur, `node --test 'shared/**/*.test.mjs'` 490/490,
`socketCombatHelpers.test.mjs` 5/5, `npx eslint` (mes hunks propres — 2 warnings pré-existants
subsistent sur `CombatModifiersWindow` lignes 132/152), `npm run build` client, `git diff --check`
propres. **Session réelle Saar** : validation OK.

**Non testé** : aucun test automatisé sur le nouveau chemin serveur (DB requise, comme l'étape 8) ;
tir de suppression, lance-flammes, grenades, tireur exo/drone au fusil à pompe — chacun reste un
blocage documenté (§12).

**Données** : aucune migration.

**Retour arrière** : `git revert` du commit `dev/Saar` correspondant.

---

## Session (Claude) — 2026-09-03 — Suivi d'activité de campagne (temps de connexion + combats)

Onglet Joueurs de la Configuration : ajout des statistiques par joueur (temps de connexion, dernière
connexion, visites) et par campagne (nombre de combats, durée totale). Lot C du chantier « refonte
onglet Joueurs » (B0 = nav Configuration + Zone dangereuse rouge ; B2 = roster ; C = stats).

**Décision durable — le serveur suit désormais le temps de connexion des utilisateurs par campagne.**
Deux tables append-only (migration 319), agrégats dérivés par requête (jamais un compteur muté :
lost updates en concurrence, pas auditable, pas recalculable) :
- `campaign_presence_sessions` : une ligne par période de connexion (`context` = `session` |
  `wizard`). `ended_at` NULL = connecté. `last_seen_at` bumpé toutes les **5 min** par un heartbeat
  serveur (`setInterval(...).unref()`) ; si le process meurt sans `disconnect`, l'agrégat prend
  `COALESCE(ended_at, last_seen_at)` (perte ≤ 5 min). **Sweep au boot** (`sweepStalePresence`,
  `ended_at = last_seen_at` sur les lignes ouvertes) **avant** `httpServer.listen` — un serveur qui
  démarre n'a aucun socket vivant, sinon course avec un nouvel `INSERT`.
- `campaign_combat_log` : une ligne par combat (`COMBAT_START` → INSERT, `COMBAT_END` → UPDATE).
  **Pas de sweep** : le garde FSM interdit un 2ᵉ START sans END (au plus une ligne ouverte), et une
  ligne ouverte contribue 0 s à la durée (`COALESCE(ended_at, started_at)`).

**Choix assumés** :
- `context` transmis par le client dans le payload `SESSION_JOIN` (prop `context` de `SocketProvider` :
  `session` par défaut, `wizard` depuis `WizardCreation`). Le wizard Coffre (`/vault/creation`,
  `campaignId` absent) n'est pas suivi — `socket/index.js` early-return avant la vérif membre.
- « Temps de jeu » = temps en session, **jeu + édition de carte + combat confondus** (un seul socket).
  Le split édition/jeu (`mode` client `play`/`edit`/`combat`) nécessiterait que le client signale ses
  changements de mode au serveur — **différé**, ROI faible.
- Fusion d'intervalles à l'agrégation : gère le multi-onglets (chevauchement compté une fois) et
  regroupe les reconnexions socket.io rapprochées (< 10 min) en une seule « visite ».
- `startPresence`/`endPresence`/`logCombat*` en `try/catch` interne : une écriture de métrique ratée
  ne casse jamais une connexion ni un combat.
- Écriture non transactionnelle (`COMBAT_START`/`END` ne le sont pas non plus).
- Rien de rétroactif : le décompte démarre au déploiement. Multi-instance (Kiwi futur) : le sweep au
  boot fermerait des lignes d'une autre instance vivante — limitation documentée, non traitée
  (mono-instance aujourd'hui).
- Disclosure utilisateur : `client/public/CHANGELOG.md` v225, comme le reste (demande Saar).

**Fichiers touchés** : `server/src/db/migrations/319_campaign_activity.js` (nouveau) ;
`server/src/lib/campaignActivityService.js` (+ test, nouveau) ;
`server/src/lib/campaignRosterService.js` (compose `getCampaignActivity` → `player.stats` +
`campaignStats`, + test) ; `server/src/routes/campaigns.js` (`GET /:id/roster` renvoie
`{ roster, campaignStats }`) ; `server/src/socket/index.js` (`startPresence`/`endPresence`,
`context`) ; `server/src/socket/socketCombatState.js` (`logCombatStart`/`End`) ;
`server/src/index.js` (sweep + heartbeat au boot) ; `client/src/lib/SocketContext.jsx` (prop
`context`) ; `client/src/components/creation/WizardCreation.jsx` (`context="wizard"`) ;
`client/src/components/campaignSettings/SectionPlayers.jsx` (bloc Activité par carte + ligne combats)
; `client/src/locales/fr.json` (12 clés `settings.roster*`, `rosterGmStatsSoon` retirée) ;
`client/public/CHANGELOG.md`.

**Testé** : `node --test` `campaignActivityService.test.mjs` 5/5 + `campaignRosterService.test.mjs`
2/2 contre la base locale (fusion d'intervalles, split session/wizard, visites, sweep, combat
compté/ouvert, merge stats dans le roster) ; `node --check` ×6 serveur ; import ESM des modules
socket modifiés ; `npm run build` client ; eslint `SectionPlayers` propre (3 erreurs préexistantes
sur `SocketContext.jsx` confirmées hors périmètre par `git stash`) ; `git diff --check`.
**Session réelle Saar** : validation OK (présence session/wizard, combat, bloc Activité).

**Non testé** : aucun test automatisé du câblage socket de bout en bout (DB + navigateur, domaine
Saar) ; le split édition/jeu (différé) ; comportement multi-instance (non pertinent aujourd'hui).

**Données** : migration `319_campaign_activity.js` — deux tables neuves, `down` propre (DROP CASCADE).
Appliquée à la base locale partagée pendant le développement (batch 11).

**Retour arrière** : `git revert` du commit `dev/Saar` correspondant + `db.migrate.down()` (une
migration en arrière). Les tables sont additives, aucune donnée existante touchée.

**Suivi (même jour)** : deux correctifs après première mise en service —
(1) TDZ : `startPresence(..., context)` en tête du handler `SESSION_JOIN` alors qu'un
`const context` plus bas dans la fonction shadow le paramètre sur tout le scope → `startPresence`
échouait à chaque connexion, aucune ligne écrite. Paramètre renommé `context: joinContext`.
Loupé à la vérif « 100 % » : la ligne `const context` avait été lue mais le shadowing pas repéré.
(2) `getCampaignActivity` : une session encore ouverte comptait jusqu'à `last_seen_at` (0 min tant
que le heartbeat 5 min n'avait pas tiqué) → désormais jusqu'à `now()` si `last_seen_at` récent
(< 11 min), sinon `last_seen_at` (crash : pas de temps mort compté).

## Session (Claude) — 2026-09-04 — Déclaration combat : dérivation unique (PLAN_RW_DECLARE_DERIVATION) — CHANTIER CLOS

Reste différé de `PLAN_RW_DECLARE_DESIGN` (clos 2026-08-30) : PO-M5-a (neutralisation zone d'effet
recopiée entre `assaultCheck`/`meleeCheck` PJ et MJ), la branche AOE dupliquée verbatim entre
`buildHumanDeclarePayload`/`buildGmDeclarePayload`, et M0.4-f (reset consolidé — état supposé,
jamais revérifié).

**Analyse à charge (avant code)** : le périmètre proposé (10 sous-commits, exo/drone inclus,
couche `payloadSel` séparée) était sur-dimensionné. Resserré à 3 constats vérifiés :
1. **Exo/drone SORTENT du périmètre** `[VÉRIFIÉ]` — `PLAN_ARMES_SPECIALES.md` §1.4bis Segment 2
   possède déjà la refonte de la déclaration exo (`CombatExoActionWindow`/`useExoDeclare`, adaptateur
   de résolution d'arme agnostique au type de tireur), séquencée après son Segment 1.5. Y toucher ici
   aurait doublonné/pré-empté ce travail. La réconciliation `assaultCheck` exo/drone + un `blockReason`
   drone (absent aujourd'hui — ajout serait un changement de comportement, pas un refactor)
   rejoignent ce Segment 2.
2. **Pas de couche `assaultPayloadSel` séparée** — le contexte requis (~9 champs) était à peine plus
   petit que le `sel` existant (~15) ; l'indirection ne se justifiait pas. Le cœur commun vit
   directement dans `buildAttackEntries`/`buildMeleeEntries`, consommées par les wrappers existants
   (signature `buildHumanDeclarePayload(sel)` inchangée, golden master intact).
3. **M0.4-f (reset ~15 setters) était une prémisse héritée non revérifiée** — au 2026-09-04 les 2
   effets de reset sont **déjà** consolidés (un seul effet par fenêtre, `[token_id, has_announced]`)
   et appellent déjà `assaultDecl.clear()`/`meleeDecl.clear()`. Le résiduel (reducer `decl`, Set
   `mapSelected`/`mapAction`, flags de ciblage carte locaux) n'est pas du sous-état Tir/CaC — le
   collapser exigerait Module 6 (`useHumanDeclare`, ~26 `useState`), explicitement différé. **Étape C
   du plan abandonnée sans code.**

**Codé** (`docs/PLANS/PLAN_RW_DECLARE_DERIVATION.md` §6 détail par étape, 5 commits `dev/Saar`
non poussés) :
- **Étape A** — `buildAttackEntries`/`buildMeleeEntries` (`buildDeclarePayload.js`) : cœur commun
  des entrées `attack[]`/`melee[]`, branche zone d'effet et neutralisation dual-wield/Tir visé en
  mode zone **une seule fois** (avant : recopiées entre PJ et MJ). Divergences légitimes via
  contexte (`weaponInvId`, `offhandWeaponId`, `targets`, `emptyBonus` = `null` PJ / `0` MJ). Entrée
  Charge reste inline par wrapper (formes divergentes 5/3 clés, testées). `buildDroneMapActions`/
  `buildExoMapActions` inchangés.
- **Étape B1/B4** — `assaultCheckInputs`/`meleeCheckInputs` (`assaultDeclaration.js`/
  `meleeDeclaration.js`) : autorité unique de la neutralisation zone d'effet et de la dérivation
  Charge (`isCharge`/`chargeHasMove`/`chargeHasTarget` depuis `state.charge`) côté validité.
- **Étape B2/B3/B5** — `CombatActionWindow.jsx` (PJ) et `CombatGmDeclareWindow.jsx` (MJ) consomment
  les 2 sélecteurs ; les appels inline `assaultCheck({...})`/`meleeCheck({...})` disparaissent.

**Testé** : `node --test client/src/lib` **230/230** (golden master 55 tests bout-en-bout PJ/MJ/
drone/exo **vert sans modification** — iso-comportement confirmé, +26 tests neufs des sélecteurs/
helpers isolés) ; `node --check` ; `vite build` propre ; `eslint` iso-baseline (MJ garde son unique
erreur pré-existante `set-state-in-effect` sur l'effet de reset, ligne inchangée). **Tests
préliminaires navigateur OK** (Saar, 2026-09-04).

**Non testé** : passe navigateur consolidée complète (checklist dans le PLAN §3 Étape B — PJ/MJ Tir
simple/Multi/RC-RL/visé/dual-wield/AOE, CaC simple/Multi/Défensif/Retraite/Charge, chaque raison de
blocage). ⚠️ **clos partiel** tant que cette passe n'est pas faite.

**Données** : aucune. Client + modules partagés purs, zéro migration.

**Retour arrière** : `git revert` par commit (5 commits indépendants, `A` puis `B1`→`B5`, chacun
son invariant).

**Suite** : réconciliation exo/drone → `PLAN_ARMES_SPECIALES.md` Segment 2 (déclaration exo déjà
ouverte là-bas). `PLAN_RW_DECLARE_DERIVATION.md` à archiver `docs/Old/` une fois la passe complète
validée par Saar.

---

## Session (Claude) — 2026-09-04 — Lance-flammes (main) — CHANTIER FONCTIONNELLEMENT CLOS

**Contexte** : Segment 1 de `docs/PLANS/PLAN_ARMES_SPECIALES.md` — le lance-flammes porté en main
(PJ/PNJ), au-dessus du socle AOE (Segment 0, clos le 2026-09-03). Décisions A-G détaillées dans le
plan §1.5 (angle 30°, portée = extrême catalogue, auto-éclaboussure < 3 m, Choc 2D6 impact initial,
protections simples ÷2 hors exo/drone, forme `results` 1..N Loc unifiée, re-brûlure = `max()`).

**Codé** : `aoe_profile` cône + `shock_mechanism='pure'` (migrations 322/323) ; `exposeToHazard
({ durationDice })` (feu continu fini, `max(existant, currentTurn+roll+1)` contre le `.merge()`
aveugle d'`applyModStatus`) ; aperçu cône client (`aoePreviewShape.js`, `Canvas3D.jsx`) ; branche
mécanisme `flamethrower` dans `resolveAoeAssaultAction` (`filterFlamethrowerHitTargets` pure,
1D3 Localisations, `armorReductionFactor:0.5`, feu continu + notice, auto-éclaboussure).

**3 bugs réels trouvés en session de validation Saar** (aucun dans le plan initial — le lance-flammes
est la première arme AOE `fire_mode` RC/RL, ce que le socle fusil à pompe (CC) n'avait jamais exercé) :

1. **`hasVariant`/`aimActive` jamais neutralisés en mode zone d'effet** (`assaultCheckInputs`,
   extrait la veille par un autre agent — `PLAN_RW_DECLARE_DERIVATION.md`) : une arme `RC`/`RL`
   sans volume choisi bloquait toute déclaration AOE (« Configurer le mode de tir »), alors que le
   panneau masque justement ce sélecteur pour une arme AOE. Fix additif (`aoe || …`, `!aoe && …`),
   non-régression prouvée par construction (aucun changement quand `aoe` est faux).
2. **PC23 (Tir Automatique) exigé à tort pour une arme « spéciale »** : `REGLESYSCOMBAT.md:1498`
   scope cette limite aux armes automatiques (Armes de poing/Fusils), pas aux armes à maniement
   dédié. `weaponUsesSpecialSkill` exempte les armes dont la Compétence a
   `ref_skills.parent LIKE 'ARME_SPECIALE_%'`.
3. **`getAoeExclusiveIneligibilityReasons`/`getAimIneligibilityReasons` : « changement de mode de
   tir » faussement détecté** pour une arme à mode unique (RL seul) — `entry.state_fire_mode` vaut
   `'cc'` par défaut, sélectionner le lance-flammes force `'rl'` automatiquement (aucun choix du
   joueur). Extraction `getStateTransitionReasons({ state, entry, weaponFireModes })` — une arme
   n'offrant qu'un seul mode (`shared/fireModes.js#parseFireModes`) ne peut jamais produire un
   « vrai » changement de mode de tir. Dette dupliquée trouvée entre les deux fonctions, corrigée
   aux deux (dont une occurrence dormante côté Tir visé).
4. **Choc d'arme (2D6) évalué une fois par Localisation au lieu d'une fois par cible** —
   `resolveTargetHit` résout une Localisation et ré-évalue `chocDsl` à chaque appel ; la boucle
   `1D3 Localisations` du lance-flammes relançait donc 1 à 3 Tests de Choc indépendants sur la
   même cible (observé en session : 2 `applyStunWithDuration` identiques). **Décision Saar** : un
   seul Choc par tir, « déjà largement assez punitif ». Fix : `chocDsl` seulement à `i === 0` dans
   `resolveAoeTargetDamage` (générique, le fusil à pompe n'est pas concerné par construction).
5. **Catastrophe ×4 en rafale — investigué, PAS un bug.** Mécanisme vérifié (`mr <= -15`, un seul
   jet par tir déclaré, aucune boucle) : confirmé causé par un Seuil de Compétence bas du PNJ
   testé (non entraîné à l'arme spéciale) — Saar a augmenté ses stats, résolu. Lot 1 Catastrophe
   reste `mechanized:false` partout (aucun effet automatique, file d'attente MJ seulement).

**Exo/drone** : confirmé sans aucune UI de déclaration AOE (`useExoDeclare`/`useDroneDeclare`,
`CombatExoActionWindow`/`DroneWeaponPanel` — zéro référence à `aoeDirection`/`isAoeWeapon`). Attendu,
reporté au Segment 2 (« AOE tireur exo/drone »), qui a aussi besoin d'un adaptateur de résolution
d'arme agnostique au type de tireur côté `resolveAoeAssaultAction` (fetch arme/dégâts/munitions —
le contexte de Test, lui, est déjà agnostique via `resolveCombatantTestContext`).

**Dette structurelle identifiée pour le Segment 1.5** (avant grenades et Segment 2) :
`resolveAoeAssaultAction` porte 6 branches `mechanic === 'flamethrower'` dispersées — à refondre
en registre de mécanismes (objet stratégie par mécanisme, modèle Foundry VTT dnd5e Activities),
détail `PLAN_ARMES_SPECIALES.md` §1.4bis.

**Fichiers touchés** (au-delà du socle Segment 0, déjà clos) : migrations `322`/`323` ;
`server/src/lib/environmentalHazardService.js` ; `client/src/lib/aoePreviewShape.js`
(+ `.test.mjs`) ; `client/src/lib/useCombatUIState.js` ; `client/src/components/Canvas3D.jsx`,
`CombatActionWindow.jsx`, `CombatGmDeclareWindow.jsx` ; `server/src/socket/socketCombatAoe.js`
(+ `.test.mjs`) ; `server/src/socket/socketCombatAnnouncement.js` ; `client/src/lib/
assaultDeclaration.js` (+ `.test.mjs`) ; `shared/combatExclusiveActions.js` (+ `.test.mjs`) ;
`client/src/locales/fr.json` ; `docs/PLANS/PLAN_ARMES_SPECIALES.md`.

**Testé** : `node --test` sur chaque module touché (shared complet 509/509, client complet 238/238
au moment des derniers correctifs) ; `eslint` (0 régression vs baseline vérifiée par `git stash`) ;
`npm run build` à chaque étape client. **Session réelle Saar** : déclaration, cône affiché, 1D3
Localisations, Choc unique, armure ÷2, feu continu qui ticke, auto-éclaboussure, cas 0 cible —
tous confirmés OK après les 4 correctifs ci-dessus.

**Non testé** : Segment 1.5 (registre de mécanismes, refactor pur) et Segment 2 (AOE tireur
exo/drone) — chantiers suivants, pas des manques de ce lot.

**Données** : migrations 322/323 (`ref_equipment.aoe_profile`/`shock_mechanism` pour la ligne
Lance-flammes), additives, `down()` propre.

**Retour arrière** : `git revert` des commits `dev/Saar` du segment (liste complète
`PLAN_ARMES_SPECIALES.md` §1.4bis) + `db.migrate.down()` ×2 (322, 323) si nécessaire — additif,
aucune donnée de personnage existante touchée.

## Session (Claude) — 2026-09-04 — AOE Segment 1.5 (registre de mécanismes) — CHANTIER FONCTIONNELLEMENT CLOS

**Contexte** : dette structurelle identifiée à la clôture du Segment 1 (lance-flammes, ci-dessus) —
`resolveAoeAssaultAction` portait 6 branches `mechanic === 'flamethrower'` dispersées, jugée
insoutenable avant grenades (Segment 3) et tireur exo/drone (Segment 2, qui touche le même tronc).

**Codé** : `server/src/lib/aoeMechanisms/` — `shotgunSpread.js`/`flamethrower.js` (objet stratégie
`{ buildShape, filterTargets, extraTargets, targetRowModifier, computeTargetDamage, postResolve }`,
même patron que `shared/weaponModRegistry.js`) + `registry.js` (`findAoeMechanismEntry`, lookup par
`mechanic`). Le tronc (`socketCombatAoe.js`) dispatche exclusivement via le registre, plus aucun
mécanisme nommé en dur. `filterShotgunHitTargets`/`filterFlamethrowerHitTargets`/
`applyFlamethrowerContinuousFire` déplacées verbatim (déplacement obligatoire, pas cosmétique — évite
un import circulaire registry↔socketCombatAoe).

**Décision prise avant code, avec Saar** (question : « est-ce que ça couvre les grenades, ou on
refactor à chaque nouvel item ? ») : `buildShape(ctx)` décide sa propre origine (position tireur pour
cône/rayon aujourd'hui) plutôt que de la recevoir imposée par le tronc — élargissement du contrat pour
qu'un futur mécanisme `circle` lancé (grenade) s'ajoute comme une simple entrée de registre, via
`shared/world/aoeShapes.js#resolveScatter` (primitive déjà écrite pour ça, jamais câblée nulle part —
vérifié par grep). Le reste des blocages grenades (migration catalogue, plomberie `intendedOrigin`,
action différée inter-tours, 2 pages RAW) reste hors périmètre, inchangé.

**Analyse à charge (avant code)** a trouvé et corrigé 3 points : `ctx` immuable (spread à chaque étape
du tronc, jamais muté en place — évite qu'un hook appelé avant qu'un champ existe reçoive `undefined`
silencieusement) ; le déplacement des fonctions pures était nécessaire, pas optionnel (import
circulaire sinon) ; `turnsFromNow` (dette annexe, `+1` de purge dupliqué `exposeToHazard`/
`clearHazard`) est une cause racine différente → commit séparé (`9256e01`), pas fondu dans le
refactor du tronc (`1999ab4`).

**Exo/drone reconfirmé non fonctionnel** après clôture — attendu, c'est le Segment 2 (non touché ici),
pas une régression.

**Fichiers touchés** : `server/src/lib/aoeMechanisms/{shotgunSpread,flamethrower,registry}.js`
(nouveaux) + `registry.test.mjs` (nouveau, 7 tests) ; `server/src/socket/socketCombatAoe.js`
(+ `.test.mjs`, imports mis à jour) ; `server/src/lib/environmentalHazardService.js`
(`turnsFromNow`) ; `docs/PLANS/PLAN_ARMES_SPECIALES.md` §1.4bis/§6.

**Testé** : `node --check` sur les 5 fichiers serveur touchés/créés ; `node --test` sur
`socketCombatAoe.test.mjs` + `registry.test.mjs` ensemble → 27/27 (20 inchangés + 7 nouveaux) ;
`git diff --check` propre. **Session réelle Saar** : fusil à pompe + lance-flammes retestés après le
rebranchement complet du tronc, « toujours fonctionnel » — non-régression confirmée sur les deux armes.

**Non testé** : le rebranchement du tronc lui-même n'est pas unitairement testable
(`resolveAoeAssaultAction` non exportée, DB-dépendante — même limite que le fix Choc du Segment 1) ;
seule la session réelle ci-dessus en fait foi. Segment 2 (AOE tireur exo/drone) — chantier suivant.

**Données** : aucune migration, aucun changement de schéma.

**Retour arrière** : `git revert 1999ab4 9256e01` — refactor pur, aucune donnée touchée.

## Session (Claude) — 2026-09-04 — AOE Segment 2a (tireur exo) — CHANTIER FONCTIONNELLEMENT CLOS

**Contexte** : Segment 2 de `docs/PLANS/PLAN_ARMES_SPECIALES.md`, découpé en 2a (exo, ce lot) et 2b
(drone, différé — branche entièrement séparée, pas de réutilisation gratuite, vérifié en session :
`CombatActionWindow.jsx:1243` gate tout le bloc AOE humanoïde sur `!isDrone`).

**Codé** : adaptateur serveur agnostique au type de tireur dans le tronc AOE (`fetchAoeShooterWeapon`/
`decrementAoeShooterAmmo`, `socketCombatAoe.js`) — dispatch pj/pnj/exo (drone → `null` explicite,
Segment 2b), même patron guard-clauses que `resolveCombatantTestContext`. `fetchExoWeapon` extraite/
exportée depuis `socketCombatExo.js`, partagée avec le Tir/CaC exo non-AOE existant (zéro changement
de comportement dessus). `getEffectiveWeaponDamage` (ammo/mods-aware) réservé à pj/pnj — vérifié
`char_inventory`-only par construction, exo n'a ni munitions ni mods dans ce sens. Client :
`useExoDeclare.js` (état `aoeDirection`, pas de reducer — exclusivité avec la cible maintenue
manuellement) + `CombatExoActionWindow.jsx` (section « Zone d'effet ») + `buildExoMapActions` (branche
`aoe.direction`, 3 tests) + `CombatOverlay.jsx` (relais `onEnterAoeTargetMode`).

**Une erreur de conception trouvée et corrigée avant tout commit** : premier jet de l'adaptateur placé
dans `server/src/lib/`, important `fetchExoWeapon`/`fetchAssaultWeaponAndMods` depuis
`server/src/socket/` — inversion du sens de dépendance que ce projet respecte partout ailleurs
(vérifié par grep : aucun autre fichier `lib/*.js` n'importe `socket/*.js`). Refait directement dans
`socketCombatAoe.js` (socket→socket, sans cycle, même pattern que `socketCombatResolution.js`).

**3 bugs réels trouvés en session de validation Saar** (aucun dans le plan initial) :
1. `GET /:characterId/exo/weapons` (`char-sheet.js#selectExoWeaponFields`) ne sélectionnait pas
   `ref_equipment.aoe_profile` — trouvé en traçant la chaîne de données jusqu'au bout avant de coder
   l'UI cliente, pas en session. Colonne ajoutée.
2. `combat.json#aimAoeButton` codait en dur « Viser une zone (fusil à pompe) » — déjà faux pour le
   lance-flammes humanoïde depuis le Segment 1 (jamais remarqué jusqu'ici), allait être réutilisé tel
   quel pour l'exo. Généralisé en « Viser une zone ».
3. **`useAutoMoveMode` (survol de déplacement ambiant) jamais désarmé pendant la visée** — trouvé en
   session réelle : bouton « VISER UNE ZONE » affiché correctement (donc `ref_aoe_profile` bien
   remonté), mais clic au sol sans effet, la fenêtre attendait une cible d'entité. Diagnostic écarté
   d'abord la piste données (vérifiée directement en base : la requête corrigée renvoie bien le profil
   AOE du lance-flammes exo), puis la piste PWA/service worker (écartée après confirmation Saar :
   comportement identique après redémarrage serveur + F5) avant de trouver la cause réelle —
   `CombatExoActionWindow.jsx` violait le contrat documenté par `useAutoMoveMode.js` lui-même
   (« `enabled` doit être faux tant qu'un autre mode exclusif utilise la carte »), jamais respecté
   pour ce hook. Resté invisible pour le ciblage d'entité normal (surfaces de clic différentes — le
   survol déplacement n'écoute que le sol, jamais un token) mais en collision directe avec la visée de
   zone, qui répond elle aussi au clic au sol. Fix : `exoDeclare.isSelectingTarget` exposé, hook
   `useAutoMoveMode` gaté dessus (ordre d'appel des 2 hooks du composant inversé pour permettre la
   dépendance — toujours inconditionnel, règle des Hooks respectée). Intuition de la cause donnée par
   Saar lui-même (« surcouche avec le déplacement »), confirmée par la lecture du code.

**Fichiers touchés** : `server/src/socket/socketCombatExo.js` (`fetchExoWeapon` extraite/exportée) ;
`server/src/socket/socketCombatAoe.js` (adaptateur + branche `getEffectiveWeaponDamage`) ;
`server/src/routes/character/char-sheet.js` (`ref_aoe_profile`) ; `client/src/lib/
buildDeclarePayload.js` (+ `.test.mjs`) ; `client/src/lib/useExoDeclare.js` ; `client/src/components/
CombatExoActionWindow.jsx` ; `client/src/components/CombatOverlay.jsx` ; `client/src/locales/
combat.json` ; `docs/PLANS/PLAN_ARMES_SPECIALES.md`.

**Testé** : `node --check`/`node --test` côté serveur (27/27 inchangés) ; `eslint` sur les fichiers
client touchés (3 erreurs préexistantes hors-scope, vérifiées identiques sur le commit de base via
`git stash`) ; `npm run build` ×3 (à chaque correctif) ; JSON de locale validé. **Session réelle
Saar** : Tir/CaC exo classique non-régressé, visée de zone fonctionnelle après le fix `useAutoMoveMode`.

**Non testé** : Segment 2b (drone) — chantier suivant, pas un manque de ce lot. Le rebranchement du
tronc côté résolution n'est pas unitairement testable (fonction non exportée, DB-dépendante) — la
session réelle ci-dessus en fait foi.

**Données** : aucune migration, aucun changement de schéma (colonne `aoe_profile` déjà existante,
seule la requête de lecture change).

**Retour arrière** : `git revert f9484f3 e5dbd9e a9cf858 183177e` — dans cet ordre (du plus récent au
plus ancien), aucune donnée touchée.

---

## Session (Claude) — 2026-09-05 — Chat : commandes /heal, /t, persistance /r — CHANTIER CLOS

Quatre sujets planifiés puis codés un par un (`docs/Old/PLAN_CHAT_COMMANDES.md`, archivé — contenu
durable transféré dans `docs/SYSTEME/CHAT.md` v2.1, Règle 10) :

1. **Fix i18n `/help`** — namespace `chat.commands.*` jamais traduit depuis la Phase 3 du chat
   persisté ; clés ajoutées, cas spécial pour la liste dynamique (`useChatSocket.js`).
2. **`/heal` / `/heal all`** — MJ uniquement, jamais de repli `users.role==='admin'`. Portée
   volontairement large (PJ+PNJ+exo+drone, décision Saar). Nouvelle colonne
   `campaigns.current_battlemap_id` (migration 324) : `MAP_SWITCH` était un relais stateless, ne
   permettait pas de savoir "quelle est la carte actuelle" — corrige au passage un bug latent
   (reconnexion après changement de carte, `SessionPage.jsx`).
3. **Persistance `/r`/`/roll`** (non secret) — écriture directe (`senderUserId: null`, patron
   Message Builder), jamais de rediffusion `CHAT_MESSAGE_CREATED` (aurait dupliqué le jet chez un
   client déjà connecté). Nouveau `normalizeChatMessage.js` (aplatit la forme persistée vers la
   forme attendue par `renderDice`).
4. **`/t <compétence> [difficulté] [@personnage]`** — Test immédiat, sans validation MJ (décision
   Saar, écarte `gmArbitratedTestService.js`). Extraction `characterTestContext.js` (contexte de
   stats, réutilisé par `MACRO_ROLL` sans changement de comportement) + `skillTestService.js`.
   Catastrophe automatique obligatoire (7ᵉ site RAW).

**Deux corrections faites après retour de test navigateur de Saar**, les deux vraies leçons de ce
chantier : (a) `/t` envoyait d'abord un `DICE_RESULT` de forme "jet brut" improvisée au lieu de
reprendre celle déjà établie pour un Test compétence-vs-Seuil (`gmArbitratedTestService.js`) — ni
Seuil ni Réussite/Échec affichés, dé 3D erroné (d6 au lieu de d20) ; corrigé en reprenant cette forme
à l'identique (`skillLabel`/`mechanicalTotal`/`chancesDeReussite`/`diffLabel`/`mr`/`breakdown`).
(b) Une fois corrigé, plus aucune animation de dé 3D — j'ai proposé un "chantier séparé", Saar a
fait remarquer à raison que le mécanisme existait déjà et qu'il suffisait de l'appeler
correctement : `useSessionSocket.js:onDiceResult` déduit `dieType` depuis `formula`, qui pour un
payload skillcheck porte un libellé de compétence, pas une notation de dé — fix ciblé (`dieType:
'd20'`, constante RAW). Portée assumée : les actions d'entité/connecteur (même payload skillcheck)
bénéficient aussi de l'animation désormais.

**Testé** : `node --check` sur tous les fichiers serveur touchés à chaque lot, `eslint` + `npm run
build` client (0 erreur), suite `chatCommands.test.mjs` 19/19 (dont 11 nouveaux tests `/heal`/`/t`),
4 tests unitaires `normalizeChatMessage.test.mjs`. Chaque lot validé fonctionnellement par Saar en
navigateur avant le suivant.

**Non testé** : rendu multi-utilisateurs simultané (plusieurs joueurs testant `/t`/`/heal` en même
temps) — scénario de session réelle, pas un manque de ce lot.

**Données** : migration 324 (`campaigns.current_battlemap_id`) appliquée en local (nodemon actif
pendant le codage). Aucune donnée existante modifiée.

**Retour arrière** : 5 commits successifs sur `dev/Saar` (§3 à §7 ci-dessus), chacun isolé —
`git revert` un par un dans l'ordre inverse si besoin, aucun n'a de dépendance de schéma sur un
suivant sauf la migration 324 (§2), qui n'a pas de `down()` destructeur (colonne nullable, drop
simple).

## Session (Claude) — 2026-09-05 — Combat : Choc d'arme exo/drone — CHANTIER FONCTIONNELLEMENT CLOS

`docs/Old/PLAN_CHOC_EXO_DRONE.md` (archivé, Règle 10 — contenu durable transféré dans
`docs/SYSTEME/EXOARMURE.md` §5 et `docs/SYSTEME/COMBAT.md` §Armement drone). Issu d'un audit demandé
par Saar sur la projection des colonnes `ref_equipment` en combat (« existe-t-il une autorité unique
listant les colonnes qu'une capacité de combat peut nécessiter ? ») — l'audit a confirmé l'hypothèse
partiellement : pas d'autorité unique, mais le seul manque réel trouvé était le Choc d'arme (LdB
p.243, CHOC1) jamais câblé pour un tireur/attaquant exo-armure ou drone, silencieusement absent depuis
l'introduction du combat exo/drone (aucune des 3 colonnes `shock`/`shock_mechanism`/
`shock_reduced_by_armor` n'était jamais sélectionnée pour ces deux types).

**Analyse à charge du plan initial** (avant tout code) a débusqué un bug indépendant, plus grave :
`confirmDamage` (branche assault) interrogeait `char_inventory` avec un `weaponInvId` non défini pour
tout tireur exo/drone visant un PJ — Knex lève une exception à la construction de la requête, avalée
par le `try/catch` de la fonction : le PJ visé ne prenait alors **jamais** de dégât, sans aucune
erreur visible, résolution "réussie" en apparence. Reproduit et confirmé en session réelle par Saar
avant correctif (méthodologie `docs/SYSTEME/TICKETS.md` §4).

**Codé en 5 paliers** (un problème à la fois, chaque palier vérifié — `node --check` + tests +
session réelle — avant le suivant) :
- **Palier 0** — garde `weaponInvId` dans `confirmDamage`, repli sur la formule stockée. Corrige le
  crash, indépendamment du Choc.
- **Palier A** — `damageService.js#_weaponShockDsl` (interne) exportée en `buildWeaponShockDsl`,
  signature normalisée (`{shock, shockMechanism, reducedByArmor}` plutôt qu'une "row" à noms de
  colonnes figés — évite qu'un futur appelant mal-aliasé reçoive un `null` silencieux au lieu d'une
  erreur visible). Seule autorité de dérivation du Choc, désormais partagée par tous les appelants.
- **Palier B** — Tir/CaC drone + Tir exo + AOE tireur exo (`socketCombatExo.js`, `socketCombatHelpers.js`,
  `socketCombatAoe.js`) : les 3 colonnes sélectionnées, `chocDsl` construit et transmis jusqu'à
  `resolveTargetHit`, y compris pour la cible PJ différée (`pending.chocDsl` en repli dans
  `confirmDamage`, nécessaire en plus du Palier 0).
- **Palier D** — CaC exo (`damageService.js#getEffectiveMeleeDamage` gagne `weaponRefId`, pour une
  arme hors `char_inventory`) : le Choc CaC exo doit traverser 6 fonctions relais (round-trip défense
  active PJ) — le plan initial en listait 7 (dont une branche `confirmDamage` en fait jamais atteinte
  par un attaquant exo, retirée en relisant le code plutôt qu'en suivant le plan écrit à l'aveugle).
  Corrige au passage un cas latent trouvé en base (« Dague neurale Brain », arme Choc pur, aurait
  retombé à tort sur `1D4` mains nues au lieu de 0).

**Un 2ᵉ bug indépendant trouvé en validant l'AOE** : le lance-flammes exo en zone, piloté en MJ,
n'offrait aucune sélection de zone (« Viser une zone » affiché mais clic traité comme un ciblage
normal). Diagnostic par instrumentation temporaire (3 `console.log`, retirés après coup) plutôt que
par hypothèse — a montré `hasOnEnterAoeTargetMode:false` au moment du clic. Cause : `CombatOverlay.jsx`
affiche `CombatExoActionWindow` à deux endroits selon qui pilote l'exo (joueur vs MJ) ; le rendu MJ
ne recevait jamais la prop `onEnterAoeTargetMode` (présente côté joueur depuis Segment 2a,
`PLAN_ARMES_SPECIALES.md`). Corrigé (1 ligne + commentaire).

**Un 3ᵉ bug trouvé en revalidant l'AOE après ce correctif** (pas corrigé, ticketé) : le Test de Choc
s'affiche dans le chat sous le nom du tireur au lieu de la cible — mécaniquement correct (les stats
utilisées sont bien celles de la cible), seule l'étiquette `DICE_RESULT` est fausse. Confirmé présent
à 7 endroits distincts du système de combat, tous antérieurs à ce chantier, aucun spécifique à
l'exo/au drone — hors périmètre, cause et portée différentes.

**Fichiers touchés** : `server/src/lib/damageService.js`, `server/src/socket/{socketCombatExo,
socketCombatHelpers,socketCombatAoe}.js`, `client/src/components/CombatOverlay.jsx`,
`docs/SYSTEME/{EXOARMURE,COMBAT}.md`, `docs/Old/PLAN_CHOC_EXO_DRONE.md` (archivé depuis
`docs/PLANS/`).

**Testé** : `node --check` après chaque fichier serveur ; `socketCombatAoe.test.mjs` 20/20 à chaque
étape (non-régression) ; test manuel `getEffectiveMeleeDamage`/`buildWeaponShockDsl` sur cas réels du
catalogue (Lance-flammes, Hache, Dague neurale Brain, mains nues) ; `eslint`/`npm run build` client
propres sur les fichiers client touchés. **Session réelle Saar**, chaque palier validé avant le
suivant : crash corrigé (drone + Fusil Gauss → PJ) ; Choc Tir/CaC exo et drone (PNJ + PJ) ; Choc CaC
exo contre PJ à défense active ; Choc lance-flammes exo en zone (3 cibles touchées, `burning`
appliqué, 2 Tests de Choc déclenchés et visibles au chat).

**Non testé** : AOE tireur drone (Segment 2b `PLAN_ARMES_SPECIALES.md`, jamais construit — pas un
manque de ce chantier, note ajoutée dans `docs/SYSTEME/COMBAT.md` pour ne pas répéter l'oubli des 3
colonnes le jour où ce segment sera fait).

**Données** : aucune migration — les 3 colonnes `shock`/`shock_mechanism`/`shock_reduced_by_armor`
existaient déjà sur `ref_equipment` (CHOC1, migration 190), seules les requêtes de lecture changent.

**Tickets ouverts pendant ce chantier** (tous hors périmètre, cause/portée différentes) :
`EXODRONE-CONFIRMDAMAGE-CRASH` (résolu, corrigé en Palier 0) ; `NATWEAPON-CHOC-DEFENSE-GAP` (triaged
— Choc de mutation à arme naturelle perdu dans le même genre de round-trip défense active, humanoïde,
non lié à l'exo/au drone) ; `CHOC-TEST-WRONG-ATTRIBUTION` (triaged — étiquette de chat du Test de
Choc, 7 sites, voir ci-dessus).

**Retour arrière** : 4 commits `dev/Saar`, chacun isolé et sans dépendance de schéma —
`9a981b0` (Palier 0), `073a148` (Paliers A/B/D), `9a4d4b3` (correctif AOE MJ), et le commit de
clôture documentaire de cette entrée. `git revert` un par un dans l'ordre inverse si besoin.

## Session (Claude) — 2026-09-05 — Combat : Test de Choc attribué à la cible, plus au tireur — CHANTIER FONCTIONNELLEMENT CLOS

`docs/Old/PLAN_CHOC_TEST_ATTRIBUTION.md` (archivé, Règle 10 — contenu durable transféré dans
`docs/SYSTEME/SERVICES_COMBAT.md` §`emitShockDiceResult` et `docs/SYSTEME/COMBAT.md`
§`resolveCombatantDisplayIdentity`). Ticket `CHOC-TEST-WRONG-ATTRIBUTION`, trouvé par Saar en
validant le chantier Choc exo/drone ci-dessus (lance-flammes exo en zone — « Armure Alpha », le
tireur, affiché faisant le Test de Choc au lieu de la cible touchée).

**Diagnostic** : `statusService.emitShockDiceResult` — pur affichage chat, `DICE_RESULT` avec
`skillLabel: 'Test de Choc'` — recevait partout l'identité de l'**attaquant** (`userId`/`username`/
`color`). La résolution mécanique elle-même (`statusService.resolveShockTest`, appelée par
`damageService.js#resolveTargetHit`) était déjà correcte (stats de la **cible**) — seule
l'étiquette de chat était fausse. **7 sites concernés** (`socketCombatAoe.js` +
`socketCombatHelpers.js`), tous antérieurs à ce ticket, aucun spécifique à l'exo/au drone — confirmé
présent aussi côté Tir/CaC humain classique.

**Analyse à charge avant tout code** — le premier jet de la fonction correctrice
(`resolveShockTestDisplayIdentity`) était scopée au seul Test de Choc. Vérification faite avant de
coder : le même calcul (« PJ avec compte → identité `users`, sinon nom + gris `#808080` ») était déjà
recopié **6 fois** ailleurs pour l'identité du **tireur** (`socketCombatExo.js` ×2,
`socketCombatAoe.js`, `socketCombatHelpers.js` ×3). Une 7ᵉ copie aurait recréé exactement le défaut
que l'audit à l'origine de tout ce chantier (Choc exo/drone) dénonçait. Remplacée par
`resolveCombatantDisplayIdentity`, fonction générale dans `combatantContextService.js` (sœur
d'affichage de `resolveCombatantIdentity` déjà présente) — les 6 sites tireur existants pourront
l'adopter plus tard (refactor pur, non fait ici, pas mélangé avec ce correctif ponctuel).

**7 sites corrigés, en 2 groupes** : 4 sites où la cible peut être PJ ou PNJ
(`resolveAoeTargetDamage`, `resolveMeleeDefenseHitAttackerPnj`, `resolveDamageConfirmNormalTarget`,
`resolveDefenselessTarget`) appellent `resolveCombatantDisplayIdentity` ; 3 sites où la cible est
garantie PNJ/décor par leur propre dispatch (`resolveMeleeDefensePnj`, `resolveAttackHitPnj`,
`resolveAssaultHitPnjNormal`) réutilisent directement un nom déjà en scope, sans requête
supplémentaire. Vérifié avant de coder (pas supposé) : les valeurs `characterIdCible` transportées
sont toujours `null` explicite ou un vrai id, jamais `undefined` — aucun risque du même genre que le
crash `EXODRONE-CONFIRMDAMAGE-CRASH` du chantier précédent.

**Bug annexe trouvé en session de validation, PAS corrigé (règle appliquée correctement, juste peu
visible)** : une déclaration de tir en zone a été refusée par le serveur (« Action exclusive :
... changement d'arme ») — vérifié : le personnage n'avait pas encore son arme au clair, un vrai
changement d'état, la règle d'exclusivité s'applique correctement (RAW). Proposition de Saar,
ticketée en suggestion (`WEAPON-STATE-CHANGE-VISIBILITY`, non cadrée, non codée) : surligner le
bouton d'état concerné quand il change automatiquement (sans clic explicite du joueur), pour que le
refus soit compris avant d'être reçu.

**Fichiers touchés** : `server/src/lib/combatantContextService.js`, `server/src/socket/
{socketCombatAoe,socketCombatHelpers}.js`, `docs/SYSTEME/{COMBAT,SERVICES_COMBAT}.md`,
`docs/Old/PLAN_CHOC_TEST_ATTRIBUTION.md` (archivé depuis `docs/PLANS/`).

**Testé** : `node --check` sur chaque fichier serveur ; `socketCombatAoe.test.mjs` 20/20 et
`combatantContextService.test.mjs` 39/39 (non-régression) ; test manuel de
`resolveCombatantDisplayIdentity` sur 3 cas réels (PJ avec compte, PNJ, personnage `null`).
**Session réelle Saar** : lance-flammes exo en zone (tireur PJ) et CaC (attaquant PNJ), même cible
PNJ (« Baboulinet ») — le Test de Choc affiche bien le nom de la cible dans les deux cas, jamais
celui du tireur.

**Non testé** : les 6 sites tireur existants n'ont pas été migrés vers `resolveCombatantDisplayIdentity`
(refactor pur, hors périmètre, noté dans `docs/SYSTEME/COMBAT.md` pour ne pas y ajouter un 8ᵉ site
dupliqué) ; le ticket `WEAPON-STATE-CHANGE-VISIBILITY` reste à cadrer séparément si Saar le souhaite.

**Données** : aucune migration, aucun changement de schéma.

**Tickets** : `CHOC-TEST-WRONG-ATTRIBUTION` résolu (ce chantier) ; `WEAPON-STATE-CHANGE-VISIBILITY`
créé (`new`, suggestion, non cadrée).

**Retour arrière** : 1 commit `dev/Saar` (`cafb0cd`) pour le correctif + 1 commit pour cette clôture
documentaire, aucune dépendance de schéma. `git revert` dans l'ordre inverse si besoin.

## Session (Claude) — 2026-09-05 — AOE Segment 2b (tireur drone) + exclusivité 3 plateformes — CHANTIER FONCTIONNELLEMENT CLOS

**Contexte** : Segment 2b de `docs/PLANS/PLAN_ARMES_SPECIALES.md` §1.4bis — réplique du patron 2a
(exo) pour un tireur drone d'arme de zone (lance-flammes, fusil à pompe montés). Plan détaillé +
analyse à charge menés avant tout code (4 runs : analyse → plan → analyse critique → code). L'analyse
critique a corrigé 2 points sous-spécifiés : le câblage client touche **DEUX** fenêtres hôtes
(`CombatActionWindow` joueur + `CombatGmDeclareWindow` MJ, toutes deux via `useDroneDeclare`), et
l'exclusivité d'une Action de zone était câblée à **un seul** des trois sites de l'ANNONCE.

**Codé — 4 commits isolés :**
- **C1** (`socketCombatHelpers.js`) : `fetchDroneWeapon(droneWeaponInvId)` extraite de
  `resolveDroneAssaultAction` (mirror `fetchExoWeapon`), exportée, partagée avec le tronc AOE — une
  seule copie de la jointure `drone_weapons ⋈ ref_equipment`. `+equipment_id`/`+ref_aoe_profile`/
  `+ref_name` au SELECT (additifs, jamais lus par le Tir/CaC drone). 0 changement de comportement.
- **C2** (`socketCombatAoe.js`, `char-sheet.js`) : branche `character.type === 'drone'` de
  `fetchAoeShooterWeapon` (renvoyait `null`) ; `ammo_remaining: null` explicite — `decrementAoeShooterAmmo`
  drone reste no-op, **cohérent** avec le Tir/CaC drone qui ne décrémente pas non plus `ammo_restant`
  (grep exhaustif : aucun `drone_weapons … update` munitions nulle part). `ref_aoe_profile` ajouté aux
  3 SELECT `drone_weapons` (GET/POST/PUT — réponse cohérente, précédent bug exo/drone).
- **C3** (client, 5 fichiers) : `useDroneDeclare` gagne `onEnterAoeTargetMode` + état `aoeDirection` +
  `handleStartAoeDirection` (mirror `useExoDeclare`) + `selectDroneWeapon` (efface cible/direction
  périmée au changement d'arme — latent avant l'AOE). `buildDroneMapActions` branche
  `aoe: { direction }` (4 tests golden master). `DroneWeaponPanel` bascule la section cible sur
  « Viser une zone » si `isAoeWeapon(ref_aoe_profile)` — style local du panneau, clés i18n partagées
  (`assaultPanel.*`). `DroneDeclareSection` propage. Les 2 fenêtres hôtes threadent
  `onEnterAoeTargetMode` + les nouveaux props. Le nettoyage du mode de visée résiduel au changement de
  slot est déjà fait par chaque fenêtre (`combatAoeTargetMode?.onCancel()`, agnostique au type).
- **C4** (`socketCombatAnnouncement.js`) : le garde d'Action exclusive AOE
  (`isExclusiveDeclaration`/`getAoeExclusiveIneligibilityReasons`, `shared/combatExclusiveActions.js`
  — autorité pure **déjà** agnostique au type de tireur) était appelé uniquement dans la branche
  humanoïde. Hoisté APRÈS le dispatch `if (isDrone) … else if (isExo) … else …` : chaque branche
  renseigne `assaultWeaponAoeProfile`/`assaultWeaponFireModeRaw`, un seul appel du garde ensuite pour
  les 3 plateformes. Requêtes d'arme drone/exo de l'ANNONCE : `+aoe_profile` (`+fire_mode` pour le
  drone).

**Écart RAW (invariant AGENTS.md #5) — décision `PLAN_ARMES_SPECIALES.md` §1.4bis, jugement délégué
par Saar (« le plus robuste / pérenne / adaptatif »)** : le RAW lie « Action exclusive » d'un
lance-flammes au *tir continu* (zone élargie) ; l'implémentation traite **toute** gerbe lance-flammes
comme exclusive pour l'humanoïde depuis le Segment 1 (simplification produit tranchée Saar
2026-08-26). C4 étend cette même simplification, cohérente, à drone + exo plutôt que d'introduire une
3ᵉ lecture, et parce qu'une mécanique d'arme = une autorité unique qui ne doit pas dépendre du châssis
porteur. Conséquence de jeu : un drone (ou une exo) perd son déplacement le Tour où il tire au
lance-flammes — identique à l'humanoïde. Impact étroit : armes de zone seulement, rares sur ces
plateformes ; arme drone/exo normale inchangée.

**Testé** : `node --check` sur les 4 fichiers serveur + import ESM ; `node --test 'shared/**'`
509/509 ; `socketCombatAoe.test.mjs` 20/20 ; `buildDeclarePayload.test.mjs` 118/118 (dont 4 nouveaux
drone AOE) ; `eslint` sur les 6 fichiers client — baseline **inchangée** (7 problèmes préexistants,
diff vide vs `git stash`) ; `npm run build` OK ; `git diff --check` propre.

**Session réelle Saar (2026-09-05)** : combat complet, drone au lance-flammes en zone —
`resolveAoeAssaultAction … type_perso:drone` atteint (avant C2 il bâillait), cible touchée, Choc
`pure` appliqué (`applyStunWithDuration … etourdi`), combat terminé proprement (`FIN COMBAT`, zéro
blocage). Non-régression tireur exo confirmée dans le même combat. Feu continu correctement absent
(cibles exo/drone — décision D). Exclusivité (C4), dégâts par palier, cas 0 cible : « tout vérifié et
attendu » (Saar).

**Non testé (automatique uniquement)** : aucun test unitaire DB sur le chemin serveur drone
(`resolveAoeAssaultAction` non exportée, DB-dépendante — même limite que 2a). Fait foi : la session
ci-dessus.

**Données** : aucune migration, aucun changement de schéma (`aoe_profile` est une colonne
`ref_equipment` existante depuis le Segment 1).

**Retour arrière** : 4 commits `dev/Saar` isolés (C1→C4) + 1 doc plan + 1 doc clôture. `git revert`
dans l'ordre inverse — C4 puis C3 puis C2 puis C1 ; C1 seul est sans risque (refactor pur).

---

## Session (Claude) — 2026-09-07 — Moteur de tour : extraction + file roulante `resolve_on_turn` + report d'Initiative ≤ 0 — M1/M2/M3 CLOS (validé jeu réel 2026-09-08)

**Contexte** : préalable serveur aux grenades (`PLAN_GRENADES.md` §10.3, `PLAN_ARMES_SPECIALES.md` §2)
— l'explosion « au Tour de combat suivant » exige une résolution différée inter-tours. Découverte :
`combat_timeline_entries` était **par-Tour** (reconstruite par `buildTimelineEntries`, balayée par
`endTurn` sans filtre), aucune infra de différé. Sert aussi un **bug RAW** indépendant.

### Décision d'architecture — `combat_timeline_entries` = file roulante

Pas de nouvelle table (option écartée après analyse) : **colonne `resolve_on_turn`** (migration 326,
`INTEGER NOT NULL DEFAULT 0`, backfill `= turn_number`). Toutes les requêtes d'échelle filtrent
`resolve_on_turn = <Tour>` ; `turn_number` conservé = provenance (Tour de création). `endTurn`
n'épargne du wipe que `resolve_on_turn > <Tour qui se termine>` (idem pour le skip `combat_actions`).
Une entrée insérée au Tour N pour `resolve_on_turn = N+k` survit et se résout au bon Tour.

**M1** (`e0af745`) : 16 fonctions du cycle de tour extraites de `socketCombatHelpers.js` (3531 l.,
god-file) vers `server/src/socket/combatTurnEngine.js` — module feuille (résolveurs → moteur, sens
unique). `forceAdvanceResolution` reste côté résolveurs (appelle `confirmMeleeDefense`/`confirmDamage`
→ cycle sinon). Déplacement PUR (byte-identité vérifiée vs `HEAD` fonction par fonction ; seule modif :
`export` sur 6 fonctions jadis internes — 3 pour un appel depuis helpers, 3 pour la testabilité M2a).

**M2a** (`9bc8956`) : `combatTurnEngine.test.mjs` — 1ʳᵉ couverture du moteur (fixture DB,
`skip = !DATABASE_URL`, `test.after(db.destroy)`). **M2b** (`a7008e5`) : migration 326 + bascule des
9 requêtes + `endTurn`.

### Écart RAW (invariant AGENTS.md #5) — M3 : Initiative ≤ 0 → Action reportée

`REGLESYSCOMBAT.md:354` : « si une Préparation réduit l'Initiative à **0 ou moins**, l'Action est
**reportée au Tour suivant. Le personnage agit en premier** et son Action bénéficie de la
Préparation. » L'implémentation (Lot B, `docs/Old/PLAN_COMBAT_TIMELINE.md` §6bis pt 7 / §6sexies pt 1)
faisait `phase_position ≤ 0 → status:'lost'` : **l'Action était jetée** — violation RAW, signalée par
Saar. M3 corrige.

- `buildTimelineEntries` : `positions[0] ≤ 0` (la phase de base de la série, `initiative × 100`) →
  toute la série est **reportée** : `resolve_on_turn = turnNumber + 1`, `phase_position =
  CARRY_OVER_BASE (1 000 000) + base_ini × 100 - idx × 500` (sentinelle « agit en premier » sans
  toucher au tri de `pickNextTimelineStep`), `status:'scheduled'`, `resolution_snapshot: { carriedFrom
  }`. `declaration_group_id` conservé → `computeMultiAttackMalus` recompte -5/-7 au Tour+1.
- **Sous-décision (jugement délégué)** : l'overflow d'une attaque *supplémentaire* d'une série
  (`positions[idx>0] ≤ 0` mais `positions[0] > 0` : personnage assez rapide pour agir, trop lent pour
  autant d'attaques) **reste `lost`**. Le RAW reporte « l'Action » (la série), pas une attaque bonus —
  carrier la 3ᵉ attaque seule gonflerait l'économie d'action au Tour+1. Deux notices distinctes :
  `session.initiativeLost` (overflow) vs `session.actionCarriedOver` (report).
- `endTurn` : le token reporté est marqué `has_announced = true` (son Action est déjà déterminée, il
  ne redéclare pas ; la phase ANNONCE le saute). L'action reportée (`turn_number` bumpé à T+1) reste
  `pending` → survit au wipe **et** trouvée par le PRECHECK du Tour+1 → fenêtre de modificateurs PJ OK.
- `CombatTimeline.jsx` : une entrée `carriedFrom` affiche l'Initiative réelle du roster
  (= `base_ini`), jamais la sentinelle ÷ 100. Idempotence `buildTimelineEntries` (une action déjà
  porteuse d'entrée n'en recrée pas) — inerte hors cas report.

**Testé** : `node --check` + import ESM des 6 modules socket ; `combatTurnEngine.test.mjs` 16/16
(`.env`) dont 5 M3 (report simple, série de 3 reportée, overflow reste `lost`, idempotence, `endTurn`
→ `pickNextTimelineStep(T+1)`) ; `node --test 'shared/**'` 519/519 ; `eslint` `CombatTimeline.jsx` /
`combatStore.js` — baseline inchangée (2 problèmes préexistants) ; `npm run build` OK ;
`git diff --check` propre. **Run Saar M1+M2** (2026-09-07) : 2 combats complets — échelle, ordre, exo
assault+melee, drone AOE, PNJ, défense (AWAITING_DEFENSE), STUN2, Tir Multi `multiAtk:-5`
(`computeMultiAttackMalus` déplacé), 2 Tours. « ça a l'air bon ».

**Validé jeu réel** (Saar, 2026-09-08, batch groupé M3 + grenades 3d/3d-3) : combat complet, report
d'Initiative ≤ 0 → Action reportée au Tour suivant, agit en premier. Aucune régression sur l'échelle
normale.

**Données** : migration 326 (`resolve_on_turn` sur `combat_timeline_entries` + backfill + index
`idx_timeline_entries_resolve`). Appliquée par nodemon, round-trip `up`/`down` vérifié.

**Retour arrière** : `git revert` dans l'ordre inverse — M3 (à venir) puis `a7008e5` `9bc8956`
`e0af745`. La migration 326 `down()` retire la colonne sans conséquence (backfill = copie de
`turn_number`).

**Bug pré-existant trouvé ici → corrigé `8b0dccc`** : `socket/index.js` — resynchro du token joueur
à la reconnexion en combat cherchait par `tokens.campaign_id` (colonne inexistante ; `tokens` porte
`battlemap_id`). La requête levait à chaque reconnexion → toute la restauration des prompts en attente
(surprise / damage / melee_defense / stun) était morte. Voir l'entrée dédiée 2026-09-08 ci-dessous.

---

## Session (Claude) — 2026-09-07 — Grenades : Segment 3d (lancer + explosion différée) — CLOS (validé jeu réel 2026-09-08)

**Chantier** `PLAN_GRENADES.md` §3d. La grenade à fragmentation devient jouable de bout en bout :
déclaration « viser un point » (3c, déjà clos) → **lancer** (Test de Coordination + dispersion, Tour T)
→ **explosion** au rang d'Initiative normal du lanceur, Tour T+1. S'appuie sur le moteur de différé
inter-tours (`resolve_on_turn`, chantier moteur de tour M1-M3, même session).

### Décisions durables

- **3d-0** — `resolveHumanoidTestContext` gagne l'option `attributeId` : un **Test d'ATTRIBUT**
  (Seuil = attribut net + malus, palier complet). RAW littéral « Test de Coordination », pas une
  Compétence. Générique — resservira (Chance, sauvegardes).
- **3d-1** — Le lancer (`resolveAoeAssaultAction`, garde `aoe.intendedOrigin && !aoe.resolvedOrigin`) :
  périmètre humanoïde (`pj`/`pnj`) ; Test de Coordination sur l'attribut **COO** via
  `resolveAoeAttackRoll` (noyau de jet partagé — crit, Catastrophe `site: 'grenade_throw'`) ;
  `failureMarginM = -mr` (`mr = seuil - roll` < 0 sur échec) + `d6Roll` → `resolveScatter` →
  point d'impact réel figé maintenant ; `jsonb_set` de `modifiers.aoe.resolvedOrigin` **+
  `weaponSnapshot`** ; `turn_number` de l'action bumpé à T+1 ; entrée `combat_timeline_entries`
  `resolve_on_turn = T+1`, `phase_position = base_ini × 100 + 1`, `resolution_snapshot.autoResolve` ;
  **la grenade quitte `char_inventory`** (`quantity - 1`, `DELETE` si 0).
- **3d-2** — Capacité `rollsPhaseA` (défaut `true`, `grenade_frag` = `false`) : l'explosion ne
  relance aucun jet (le Test a eu lieu au lancer). **Résolution autonome** (patron registre :
  `combatTurnEngine.js` ne peut pas importer `resolveAoeAssaultAction` — cycle) : `advanceTimeline`
  détecte `resolution_snapshot.autoResolve` et appelle un résolveur injecté au chargement par
  `socketCombatResolution.js` → l'explosion se résout **sans clic humain** (resservira : mines,
  pièges). Extensible : toute entrée d'échelle peut désormais être autonome.

### Écarts RAW (invariant AGENTS.md #5)

- **Difficulté « selon la zone visée »** (RAW : modificateurs de taille des Tests de tir) →
  **aucun modificateur en v1**. On vise un **point au sol**, pas une partie du corps ; le raffinement
  « viser les pieds d'une cible » (malus de taille) est différé.
- **Le lanceur PJ ne reçoit pas de fenêtre « résultats » privée** au Tour+1 (`COMBAT_ATTACK_PLAYER_RESULT`
  filtré) — une explosion autonome n'est pas « le résultat de ton action ». Les cibles voient les
  dégâts via `COMBAT_ATTACK_RESULT` (room) + notice `session.grenadeExploded`.
- **L'explosion différée ne dépend pas de l'inventaire** (grenade consommée au lancer) : les données
  d'arme voyagent dans `modifiers.aoe.weaponSnapshot`. Décision d'architecture — la résolution
  différée ne demande rien à un état qu'elle ne possède plus.

### Hors périmètre (segments suivants)

Lanceur **exo/drone** (VIT ≠ COO — message clair) ; mode **PER** (percussion — explosion immédiate
Tour T, Segment 3f) ; **autres grenades** (concussion, sonique, incendiaire, capsules — Segment 3-bis,
un mécanisme = une entrée de registre) ; malus de taille « viser une cible ».

**Testé** : `node --check` + import ESM (7 modules socket) ;
`combatantContextService.test.mjs` 41 (+2 `attributeId`) ; `combatTurnEngine.test.mjs` 17 (+1
`advanceTimeline autoResolve`) ; `registry.test.mjs` (`rollsPhaseA`) ; `grenadeFrag.test.mjs` ;
`node --test 'shared/**'` 519 ; `npm run build` client OK ; `git diff --check` propre.

**Validé jeu réel** (Saar, 2026-09-08, batch groupé) : PJ équipé grenade à fragmentation → « viser un
point » → Test de Coordination → explosion au Tour suivant, dégression par palier, grenade retirée de
l'inventaire. Marqueur 3D (Segment 3d-3) affiché entre les deux.

**Données** : aucune migration (la migration 325 `aoe_profile` grenade date du Segment 3c). Effet
runtime : une grenade lancée décrémente/supprime sa ligne `char_inventory`.

**Retour arrière** : `git revert` dans l'ordre inverse — `2c7cf57` (3d-2) `4eef102` (3d-1)
`15c0ec7` (3d-0). 3d-0 seul est inerte (option non consommée sans 3d-1).

## Session (Claude) — 2026-09-08 — Grenades : Segment 3d-3 — marqueur 3D de grenade armée — CLOS (validé jeu réel 2026-09-08)

**Chantier** `PLAN_GRENADES.md` §3d-3. Retour Saar après le run 3d : « il manque un token 3D (ou a
minima un symbole /!\\) pour la position de la grenade ». Le client ne connaît l'échelle que du Tour
courant ; une grenade lancée au Tour T explose au Tour T+1 — aucune trace visuelle du point d'impact
réel entre les deux (surtout sur dispersion).

### Décisions durables

- **Canal dédié, pas de détournement de `COMBAT_TIMELINE_UPDATED`** : events
  `COMBAT_GRENADE_ARMED { entryId, tokenId, resolvedOrigin:{x,y,z}, explodesOnTurn, scattered }` et
  `COMBAT_GRENADE_EXPLODED { entryId }` (`shared/events.js`). Réutilisables pour tout futur mécanisme
  `autoResolve` (mines, pièges).
- **`COMBAT_GRENADE_EXPLODED` émis en TÊTE de `resolveAutonomousStep`**, juste après avoir marqué
  l'entrée `resolved` — avant les `return` anticipés (`!action`, `!character`) et avant l'appel de
  résolution AOE qui peut lever. Le marqueur = « entrée encore en vol » ; dès qu'elle est résolue il
  est périmé, quoi qu'il advienne ensuite.
- **Reconnexion** (`socket/index.js`, phase RESOLUTION) : ré-émet `COMBAT_GRENADE_ARMED` pour chaque
  `combat_timeline_entries` `status:'scheduled' AND resolve_on_turn >= current_turn AND
  resolution_snapshot->>'autoResolve' = 'true'`. La borne `resolve_on_turn` empêche une entrée
  orpheline (crash) de ressusciter un marqueur à chaque reconnexion. Client : `onStateSync` purge
  d'abord `grenadeMarkers` (ardoise vierge), le serveur repeuple.
- **Client** : `combatStore.grenadeMarkers` (tableau, dédup par `entryId`, purge `resetCombat` +
  `onStateSync`) ; `useCombatSocket` handlers ; `Canvas3D` rend `/models/grenade.glb` (asset client
  fixe, servi comme les dés ; bounding-box normalisée à `GRENADE_MARKER_SIZE_U` = 0.4 u → robuste à
  l'échelle intrinsèque du modèle) + un triangle d'avertissement `<Billboard>` (toujours face caméra,
  géométrie pure — aucun glyphe texte, aucune clé i18n) + les 5 anneaux de dégression RAW.
- **Aggradation** : le rendu des anneaux `grenade_frag` est extrait de l'IIFE d'aperçu de visée en
  composant `GrenadeBlastRings`, partagé aperçu (§10.2) ↔ marqueur armé. `Suspense fallback={null}`
  **local** obligatoire autour du GLB (pas de boundary locale sinon — la Suspense implicite du
  `<Canvas>` blanchirait tout le champ de bataille pendant le chargement). Pas de `useGLTF.preload`
  (ne pas payer 358 Ko hors combat). Mini `GrenadeMarkerErrorBoundary` → `null` sur échec GLB (le
  triangle + les anneaux portent déjà la position ; jamais de fallback capsule ici).

### Murs — aucun code

Déjà géré par `grenade_frag` `losSource:'origin'` → `evaluateAoeVisibility` mode origin →
`evaluateWorldVisibility` (LOS canonique murs/occludeurs) → cible hors LOS exclue. = « couverture
totale » RAW. Écart connu (3a §7.6) : couverture PARTIELLE (−1 à −2D10) non consommée par aucun
mécanisme AOE.

### Observations hors périmètre (non codées — candidats tickets / durcissement 3d-2)

- `advanceTimeline` avale une exception du résolveur autonome puis **stalle** (n'enchaîne pas
  l'échelle). Pré-existant 3d-2 ; 3d-3 ne l'aggrave pas (EXPLODED en tête = plus robuste).
- L'explosion est liée au lookup `character` : token du lanceur disparu au Tour+1 → `!character
  return`, la grenade n'explose jamais (RAW : elle explose quand même). Pré-existant 3d-2.
- `resolveScatter` garde le `y` du point visé sur dispersion → le marqueur peut flotter/s'enfoncer
  légèrement si la dispersion traverse un changement de hauteur. Pré-existant 3d-1, cohérent avec
  l'origine LOS de l'explosion elle-même.

### Différé

**3d-4** — animation de jet (token → `resolvedOrigin`, arcs strictement décroissants, `scale:0` au
départ). Client pur, zéro autorité ; repli reconnexion = marqueur statique 3d-3. Son propre plan.

**Testé** : `node --check` ×4 (`shared/events.js`, `socketCombatAoe.js`, `socketCombatResolution.js`,
`socket/index.js`) ; `combatTurnEngine.test.mjs` 17/17 (moteur non touché — non-régression) ;
`npm run lint` client (110 err / 47 warn — **identique au HEAD, 0 nouvelle**) ; `npm run build` client
OK (20 s).

**Validé jeu réel** (Saar, 2026-09-08) : jet de grenade → marqueur (GLB + triangle + anneaux) au point
d'impact réel entre T et T+1 → explosion Tour+1 retire le marqueur. Le vrai `resolveAutonomousStep`
n'a pas de test unitaire (le test moteur le stube) — couvert par la session.

**Données** : aucune migration. Aucun effet runtime nouveau (l'entrée `autoResolve` est déjà créée
par 3d-1). Ajout de l'asset `client/public/models/grenade.glb`.

**Retour arrière** : `git revert` du commit 3d-3 — tout est additif (2 events, 1 champ de store, 1
branche de rendu, `.returning('id')` + 2 émissions serveur). `grenade.glb` inoffensif si le code est
retiré.

## Session (Claude) — 2026-09-08 — Fix : reconnexion en combat — restauration des prompts en attente

**Trouvé en branchant le resync des marqueurs de grenade (§3d-3).** `socket/index.js`, bloc
« combat state sync » de `session:join` : la recherche du token du joueur reconnecté se faisait par
`db('tokens').where({ 'tokens.campaign_id': … })` — **colonne inexistante** (un token porte
`battlemap_id` ; c'est `characters` qui porte `campaign_id`). La requête **levait à chaque
reconnexion en combat**, attrapée par le `try/catch` du bloc comme « non bloquant » → tout le code
de restauration des `combat_pending` qui suit ne s'exécutait jamais : jet de surprise en ANNONCE,
prompts `damage` / `melee_defense` / `stun` en RÉSOLUTION. Mort depuis l'introduction
(`795eac3`/`f344450`). Le client se rattrape partiellement par d'autres canaux (`COMBAT_STATE_SYNC` +
retry piloté par `subPhase` pour la *déclaration* d'action), mais pas pour un prompt de jet de
dégâts / de défense déjà armé.

### Décision durable — requête d'autorité canonique

Pas le simple renommage de colonne. Une requête unique **`combat_roster ⋈ tokens ⋈ characters`
filtrée sur `characters.user_id`** (même chaîne d'autorité que `socketCombatResolution.js:271`,
`token.character_id → characters.user_id`), scellée au roster du combat, **calculée une fois** et
partagée par les deux branches de phase. `.pluck('combat_roster.token_id')` → **tableau, pas
`.first()`** : un joueur peut aligner plusieurs tokens dans une rencontre (son PJ **et** son drone) —
le `.first()` en perdait un, bug latent réel pour le chantier exo/drone déjà livré. Les boucles
d'émission passent à `.whereIn('token_id', myCombatTokenIds)` ; leur corps utilisait déjà
`row.token_id`, inchangé. Le bloc drone (`payload->>'targetUserId'`, prompt routé vers le
propriétaire de la *cible*) est un mécanisme distinct — non touché.

### Écart connu (noté, hors périmètre)

Un **MJ** qui se reconnecte ne récupère pas les prompts en attente de ses **PNJ** : le MJ ne
possède aucune ligne `characters.user_id`, donc `myCombatTokenIds` est vide pour lui. Pré-existant
(le `.first()` cassé ne trouvait rien non plus). Corriger demanderait d'indexer les `combat_pending`
par « handler = MJ » (comme le bloc drone le fait déjà via `targetUserId`) — chantier séparé.

**Testé** : `node --check` ; plan SQL validé contre la base locale ; colonnes vérifiées (`tokens`
sans `campaign_id`, `characters` avec `campaign_id` + `user_id`, `combat_pending` =
`campaign_id/token_id/type/payload/created_at/id`).

**Non testé** : reconnexion réelle mid-combat en devant un jet de dégâts / une défense CaC, + le cas
PJ + drone du même joueur. Pas de harnais de test pour `socket/index.js` (module d'enregistrement de
handlers) → validation session.

**Données** : aucune migration, aucun effet runtime (lecture seule).

**Retour arrière** : `git revert 8b0dccc` — 1 fichier, purement une correction de requête.

## Session (Claude) — 2026-09-08 — Taille de cible ⇄ dimensions — S1 socle partagé

Chantier `docs/PLANS/PLAN_TAILLE.md` : lier le modificateur RAW « Taille de la cible »
(LdB p.218) aux dimensions des combattants. Architecture déléguée à Claude par Saar,
tranchée après deux analyses à charge. Ce segment ne livre que le socle `shared/`, sans
effet runtime.

### Décisions durables

**Taille = propriété stockée de première classe**, pas dérivée live à chaque jet. Cascade
`characters.size_category` (explicite) → dérivée par type de corps → `'moyenne'`. Le RAW
donne la taille des drones (`REGLEDRONE.md`) et des exo-armures (`REGLEARMURE.md:18-42`)
**comme catégorie / gabarit**, jamais un centimétrage à reconstruire. Pattern VTT pro
(Foundry `traits.size`, PF2e).

**Breakpoints cm = moyennes géométriques des repères RAW** (30·50·100·170 humain·300·500·
700·1000), pas arithmétiques : les modificateurs Polaris (−10…+15) sont compressés près de
l'humain et dilatés aux extrêmes, comme le *Size Modifier* logarithmique de GURPS. Valeurs :
39 / 71 / 130 / 226 / 387 / 592 / 837. Le RAW lui-même dit « un guide, pas une loi gravée
dans le marbre » — la frontière exacte est une house rule assumée.

**Clamp humanoïde 120–300 cm** sur la dérivation auto depuis `char_identity.height` (champ
narratif libre : protège des saisies absurdes). Ne borne jamais une `size_category`
explicite (un PNJ colossal reçoit `'enorme'` posé à la main). « Petite » reste atteignable
pour un humanoïde (120–130 cm).

**L'AOE (zone) n'applique aucun modificateur de taille** — un jet unique pour tout le cône
est incompatible avec une taille par cible, et une gerbe / un cône n'est pas un tir ajusté
au sens p.218. Aligné sur la décision grenades déjà actée (« pas de modificateur de taille
pour une zone visée »).

**Modificateur attaquant → cible uniquement.** L'opposition CaC reste à moitié câblée (le
jet opposé du défenseur ne reçoit pas « taille de l'attaquant ») — état pré-existant,
symétriser serait une décision séparée.

### Séparation de trois axes RAW voisins (à ne jamais fusionner)

**Taille de la cible** (modificateur −10…+15 pour toucher) ≠ **Échelle** (`H`/`V`, pilote la
mise à l'échelle des dégâts, `drone_sheet.echelle`) ≠ **Gabarit** (note de calibre drone).
Ce chantier ne touche que le premier.

### Livré (S1)

- `shared/sizeCategory.js` neuf : `SIZE_CATEGORIES`, `TAILLE_CM_BREAKPOINTS`,
  `HUMANOID_SIZE_CLAMP_CM`, `EXO_CATEGORY_HEIGHT_CM`, `sizeCategoryFromCm()`,
  `resolveSizeCategoryFrom()` (cascade pure).
- `shared/combatSituationMods.js` : `TAILLE_MODS` gardé, + garde au chargement du module
  qui casse si l'énumération diverge de `SIZE_CATEGORIES`.
- `shared/droneConstants.js` : suppression du doublon `TAILLE_CIBLE_MODS` + `getTailleCible`
  (importé nulle part côté serveur ; 2 appels client redirigés).
- `CombatModifiersWindow.jsx` / `CombatCacModifiersWindow.jsx` : préselect drone via
  `sizeCategoryFromCm` (comportement quasi identique — les breakpoints changent aux
  frontières, correction voulue).

**Testé** : `node --check` (3 fichiers shared) ; `node --test 'shared/**/*.test.mjs'` →
533/533 (dont 14 neufs `sizeCategory.test.mjs` : repères RAW, frontières exactes, clamp,
entrée non finie, 4 branches de cascade) ; `npx eslint` sur les 2 fenêtres → aucun problème
nouveau (les 2 avertissements/erreur restants pré-existent, effets non touchés) ;
`cd client && npm run build` → OK (22 s, exit 0).

**Non testé** : comportement en combat réel (relève de S3/S4 — S1 n'a aucun effet runtime).

**Données** : aucune migration, aucun effet runtime.

**Retour arrière** : `git revert` du commit S1 — purement additif côté `shared/` + 2
redirections d'import triviales.

## Session (Claude) — 2026-09-08 — Taille de cible ⇄ dimensions — S2 colonne + service

Suite de S1. Ce segment livre le stockage et l'autorité serveur, toujours sans branchement
(le combat lira ça en S3).

- **Migration `327_characters_size_category.js`** : `characters.size_category text` nullable
  + `CHECK (IS NULL OR IN (<8 valeurs>))`. NULL = « dériver » (défaut universel). Additive,
  rétrocompatible — aucun code déployé ne la lit encore.
- **`server/src/lib/characterSizeService.js`** : `resolveSizeCategory(db, character, preloaded?)`
  — couche d'accès mince (lit `char_identity.height` / `drone_sheet.taille` /
  `exo_sheet.category` selon `characters.type`) qui délègue toute la logique à
  `resolveSizeCategoryFrom` (`shared/sizeCategory.js`). Accepte des lignes de fiche
  préchargées (`undefined` → fetch, `null` → « pas de fiche »).

**Testé** : `node --check` (2 fichiers) ; round-trip migration en transaction rollback contre
la base locale — up() ajoute colonne + contrainte, valeur valide acceptée, `'colossale'`
refusée par la contrainte nommée, NULL accepté par défaut, down() retire proprement les deux,
base finale intacte ; service testé contre la base (cascade explicite / dérivée pj-pnj-drone-exo
/ défaut, + fetch réel `characters ⋈ char_sheet ⋈ char_identity` pour un PNJ de 2,6 m → grande,
+ explicite `minuscule` qui l'emporte).

**Non testé** : application réelle de la migration (se fera au prochain démarrage serveur de
Saar via `migrate.latest`) ; comportement combat (S3).

**Données** : migration `327` en attente d'application. Aucun backfill (colonne NULL partout).

**Retour arrière** : `git revert` du commit S2 + `down()` de la `327` si déjà appliquée.

## Session (Claude) — 2026-09-08 — Taille de cible ⇄ dimensions — S3 branchement combat

Suite de S1/S2. La taille de la cible retenue pour un jet d'attaque devient **dérivée de la
fiche de la cible** (`resolveSizeCategory`, S2) ; le choix de la fenêtre de modificateurs
n'est retenu que **du MJ**.

### Gate centralisé (raffinement vs plan)

Plutôt que threader un `isGm` dans 5 signatures de résolveurs, le filtrage est **unique**, à
la réception du payload : `socketCombatResolution.js` calcule
`gatedModifiers = isGm ? confirmedModifiers : stripGmOnlyModifiers(confirmedModifiers)` et le
passe à toutes les branches. `stripGmOnlyModifiers` + `GM_ONLY_CONFIRMED_MODIFIER_KEYS =
['taille']` vivent dans `shared/combatSituationMods.js` (le client S4 lira la liste pour
verrouiller le contrôle hors MJ). `confirmedModifiers` d'origine reste consulté pour le seul
garde « fenêtre ouverte ou non ».

### Sites branchés

`characterSizeService.js` gagne `resolveAttackTargetSize(db, cibleCharacterId, confirmedModifiers)`
→ `confirmedModifiers.taille` s'il est présent (donc MJ), sinon `resolveSizeCategory(cible).category`.
Appelé par les **5 résolveurs à cible unique** :
- `resolveMeleeAction` (CaC humanoïde) — `measurement.targetToken.character_id`
- `resolveAssaultAction` (Tir humanoïde) — idem, `measurement.status==='ok'` garanti
- `resolveDroneAssaultAction` (Tir/CaC drone) — re-fetch minimal du token cible
- `resolveExoAssaultAction` (Tir exo) — re-fetch minimal
- `resolveExoMeleeAction` (CaC exo) — re-fetch minimal

Les labels de breakdown (`TAILLE_LABELS[...]`) suivent la catégorie résolue.

### Reste à faire

- **D7 (AOE sans modificateur de taille)** : `socketCombatAoe.js` est en cours d'édition par
  un chantier parallèle (extraction `resolveGrenadeThrow`) — le retrait du read
  `confirmedModifiers?.taille` de `runAoePhaseA` est **différé** pour ne pas entrer en
  collision. Effet actuel sans D7 : un joueur → `taille` filtrée → contribue 0 (inoffensif) ;
  un MJ → sa valeur de fenêtre s'applique au cône entier (comportement pré-S3 inchangé).
- **S4** : fenêtres de combat (préselect générique + `<select>` verrouillé hors MJ).

**Testé** : `node --check` (5 fichiers serveur + shared) ; `node --test 'shared/**/*.test.mjs'`
→ 539/539 (`stripGmOnlyModifiers` : retire taille, préserve le reste, null/undefined sans throw,
pas de mutation) ; `resolveAttackTargetSize` contre la base locale en transaction rollback
(dérivé sans override, override MJ retenu, `taille:undefined` → dérivé, cible décor → moyenne).

**Non testé** : combat réel (Saar) — Tir + CaC, cibles pj/pnj/drone/exo, joueur vs MJ résolvant,
avec et sans override MJ ; build client (aucun fichier client touché en S3, mais
`shared/combatSituationMods.js` modifié → à revalider en S4).

**Données** : aucune. `confirmedModifiers` n'est jamais persisté (vérifié) — resserrer la
sémantique de `taille` n'a aucun impact rejeu.

**Retour arrière** : `git revert` du commit S3 (6 fichiers, aucune migration).

## Session (Claude) — 2026-09-08 — Taille de cible ⇄ dimensions — S4 fenêtres de combat

Suite de S1-S3. Les fenêtres de modificateurs affichent désormais la taille **dérivée
de la cible** ; le `<select>` 8 paliers est réservé au MJ.

### Canal — le PRECHECK, pas un endpoint REST

Le plan prévoyait `GET /char-sheet/:id/combat-size`. Bloqué : le `router.param` de
`/char-sheet` refuse (403) qu'un joueur lise la fiche d'un PNJ adverse qu'il ne possède
pas (c'est pourquoi le préselect historique était « drone seulement » — bypass drone).
À la place, `COMBAT_ACTION_PRECHECK` (déjà émis avant l'ouverture de la fenêtre) **renvoie
`targetSizeCategory` dans son callback** : le serveur calcule (`resolveSizeCategory`), n'expose
jamais la fiche, marche pour joueur ET MJ.

### Fenêtres — state `tailleOverride` (null), pas `taille`

`CombatModifiersWindow` / `CombatCacModifiersWindow` : `taille` devient une valeur calculée
`tailleOverride ?? targetSizeCategory ?? 'moyenne'` — même pattern que `porteeOverride` /
`tireurAllureOverride` déjà en place. `tailleOverride` = choix manuel du MJ, `null` tant qu'il
n'y touche pas. Effets de préselect `drone`-only supprimés (import `sizeCategoryFromCm` retiré
des deux fenêtres). Section « Taille cible » : `<select>` si `isGm`, sinon ligne lecture seule
« <palier> (<mod>) · déterminée automatiquement ».

`CombatOverlay` : 2 états (`assaultPrecheckTargetSize`, `meleePrecheckTargetSize`) alimentés
par les callbacks PRECHECK, passés en props `targetSizeCategory` + `isGm` aux 4 sites de rendu.

### Effet net (S1→S4)

- **Joueur** résout son attaque : taille affichée en lecture seule = valeur dérivée de la
  cible (fiche `size_category` explicite, sinon dimensions, sinon « moyenne »). Ne peut pas
  la changer ; son `confirmedModifiers.taille` est de toute façon filtré serveur (S3).
- **MJ** résout : `<select>` pré-rempli sur la valeur dérivée, modifiable pour ce jet.
- Zone d'effet (AOE) : `targetSizeCategory` null (pas de cible scalaire) → « moyenne » ;
  D7 (retrait complet du modificateur AOE) toujours différé.

### Reste

- **D7** — `socketCombatAoe.js` (chantier grenades parallèle).
- **S5** — UI fiches (`<select>` « Taille » 8 paliers + « auto » sur perso/drone/exo,
  `PUT /char-sheet/:id/size` MJ-only).

**Testé** : `node --check` (serveur) ; `node -e JSON.parse` (combat.json) ;
`node --test 'shared/**/*.test.mjs'` 539/539 ; `cd client && npx eslint` sur les 3 fenêtres
→ aucun problème nouveau (les 3 restants — 1 erreur + 2 warnings — pré-existent, effets non
touchés) ; `cd client && npm run build` → OK.

**Non testé** : combat réel (Saar) — préselect visible côté MJ, lecture seule côté joueur,
override MJ, cibles pj/pnj/drone/exo, Tir + CaC + zone.

**Données** : aucune. Le payload du callback `COMBAT_ACTION_PRECHECK` gagne un champ
optionnel `targetSizeCategory` (ignoré par un client non mis à jour).

**Retour arrière** : `git revert` du commit S4 (5 fichiers, aucune migration).

## Session (Claude) — 2026-09-08 — Taille de cible ⇄ dimensions — S5 UI fiches

Dernier segment du plan (hors D7). Le MJ peut désormais **poser une taille explicite** sur
une fiche (perso / drone / exo) au lieu de l'override par jet — utile pour une créature hors
gabarit (`characters.size_category` gagne enfin son UI).

- **`characterSizeService.js`** : `resolveSizeCategory` gagne l'option `{ ignoreExplicit }` ;
  `describeCharacterSize(db, id)` → `{ explicit, resolved, derived, derivedCm, source }` pour
  l'UI (montre la valeur explicite ET ce que la dérivation donnerait — R4).
- **`char-sheet.js`** : `GET /:id/size` (tout membre autorisé) + `PUT /:id/size` (MJ ou
  propriétaire d'un perso Coffre) — écrit `characters.size_category` (8 valeurs ou null).
- **`SizeCategoryField.jsx`** (neuf) : composant partagé — `<select>` « Auto » + 8 paliers si
  MJ, sinon lecture seule ; libellés des paliers réutilisés du namespace `combat`
  (`cacModifiers.tailles.*`, jamais recopiés — Règle 2). Monté dans `CharacterSheet` (bloc
  identité), `DroneSheet` (stats), `ExoInfoPanel` (infos).
- `fr.json` : `charSheet.sizeField.*` (label / auto / autoResolved / autoTag).

### Écarts vs plan

- Pas de `min`/`max` sur l'input `height` de `CharacterSheet` : un plafond dur bloquerait une
  saisie descriptive légitime (enfant < 1,20 m, géant de lore). Le clamp 120–300 cm reste
  côté serveur (dérivation seule) + `source: 'derived-clamped'` disponible pour un futur
  avertissement UI.
- Préselect via **le callback de `COMBAT_ACTION_PRECHECK`** (S4), pas l'endpoint REST
  `GET /combat-size` prévu — le `router.param` de `/char-sheet` refuse à un joueur la fiche
  d'un PNJ adverse.

**Testé** : `node --check` (route + service) ; `describeCharacterSize` contre la base locale
(pnj 2,6 m sans explicite → grande/derived ; + explicite gigantesque → resolved gigantesque,
derived toujours grande ; exo-4 → grande) ; `node -e JSON.parse` (fr.json) ;
`node --test 'shared/**/*.test.mjs'` 539/539 ; `cd client && npx eslint` sur les 4 fichiers
fiche + le composant neuf → aucun problème nouveau ; `cd client && npm run build` → OK.

**Non testé** : rendu réel des 3 fiches (Saar) — `<select>` MJ, lecture seule joueur, écriture
`PUT /size`, cohérence avec l'override de combat.

**Données** : aucune migration (colonne `327` déjà appliquée au démarrage serveur de Saar).
`characters.size_category` NULL partout jusqu'à saisie MJ.

**Retour arrière** : `git revert` du commit S5 (7 fichiers, 1 composant neuf).

### Chantier Taille — état

S1→S5 codés et committés sur `dev/Saar`. **Reste D7** (retrait du modificateur de taille en
zone d'effet, `socketCombatAoe.js`) — différé tant que le chantier grenades parallèle édite
ce fichier. `docs/SYSTEME/TAILLE.md` (doc SYSTEM définitive) à écrire à la clôture complète.

## Session (Claude) — 2026-09-09 — Grenades : Segment 3f — mode de détonation (percussion) + visuel

`PLAN_GRENADES.md §3 pt 2 / §6 3f`. Une grenade se lance désormais en **minuterie** (défaut,
explose au Tour+1 au rang d'Initiative du lanceur — comportement 3d inchangé) ou en **percussion**
(explose au contact, ce Tour). Option **drone** réservée structurellement (enum), rejetée à la
résolution. Commits `0f42d30` (cœur 3f) + celui-ci (marqueur percussion + révision durée + doc).

### Ce qui a été fait

**Autorité de l'enum** : `shared/combatAoe.js#{GRENADE_DETONATION_MODES, GRENADE_DETONATION_DEFAULT
('minuterie'), normalizeGrenadeDetonation}` — lue client (toggle de déclaration) ET serveur
(annonce + résolution). Champ `aoe.detonation`, frère de `aoe.mode`/`aoe.intendedOrigin`.

**Serveur** (`socketCombatAoe.js`) :
- **Extraction `resolveGrenadeThrow`** — « le lancer » (Test de Coordination COO + dispersion
  `resolveScatter` + snapshot d'arme), **aucun effet de bord**. Le bloc de ~95 l. inline devient un
  seam nommé + helper `consumeThrownGrenade`. Behavior-preserving (3f/3, refactor pur).
- `switch (normalizeGrenadeDetonation(aoe.detonation))` : `minuterie` = entrée d'échelle T+1
  inchangée ; `percussion` = pose `resolvedOrigin` en mémoire + `jsonb_set`, **pas de return**,
  fall-through vers le bloc explosion (Tour T) ; `drone` = `COMBAT_DECLARE_ERROR` clair.
- **Catch du tronc AOE durci** : `const emissions` hoisté hors du `try` ; le catch renvoie les
  émissions accumulées + pousse un `COMBAT_DECLARE_ERROR` au lieu de `emissions: []`. Bénéficie au
  fusil à pompe / lance-flammes : une exception en cours de résolution AOE n'est plus un silence
  total (jet déjà lancé perdu). Vérifié bout en bout, y compris chemin différé (`flushEmissions`
  gère `to:'room'` avec `socket=null`).
- `socketCombatAnnouncement.js` : `aoe.detonation` normalisé avant persistance (branche `isPointAoe`
  seulement — cône/rayon non touché).

**Client** :
- `assaultDeclaration.js` : champ `aoeDetonation` (défaut minuterie) + `SET_AOE_DETONATION`
  (modifieur indépendant) ; `useAssaultDeclaration.js` : `setAoeDetonation`.
- `AssaultRangedPanel.jsx` : section « Détonation » (Minuterie | Percussion), **visible uniquement**
  pour une arme `shape: 'circle'` (grenade). Câblée dans les 2 fenêtres (`CombatActionWindow`,
  `CombatGmDeclareWindow`).
- `buildDeclarePayload.js` : `buildAoeField`/`buildAttackEntries` prennent `aoeDetonation` ; chemin
  `intendedOrigin` → `{ intendedOrigin, detonation }`, **`detonation` TOUJOURS présent** (défaut
  `minuterie`) — le serveur le lit inconditionnellement, un champ toujours consommé est toujours
  émis. Chemin `direction` **byte-identique** (golden master).
- `combat.json` / `fr.json` : clés i18n (toggle + notice `session.grenadeThrownPercussion`).

**Marqueur 3D percussion** (§3f visuel — Architecture A, délégation Saar) : la résolution serveur
percussion reste **synchrone/immédiate** (RAW « au contact »), acté. La branche percussion émet
`COMBAT_GRENADE_ARMED { entryId: action.id, ephemeral: true }` avant le fall-through → le client
affiche `grenade.glb` + ⚠ + anneaux de dégression à `resolvedOrigin`, **concomitant** à l'explosion
(jet + dégâts + marqueur en même temps). **Durée = jusqu'à la fin du Tour** : `combatStore.
clearEphemeralGrenadeMarkers` (filtre `!g.ephemeral`), appelé dans `useCombatSocket.onPhaseChanged`
sur `phase === 'ANNOUNCEMENT'`. Un timer 5 s (« trop court ») et un clic (« fragile — 3 déclencheurs
selon type de client PJ/MJ/spectateur ») écartés au profit du bord de Tour : déterministe, identique
tous clients, aucun timer. Minuterie inchangé (`ephemeral` absent → survit T→T+1, effacé sur
`COMBAT_GRENADE_EXPLODED`).

### Écarts RAW (actés)

- **Percussion = explosion immédiate Tour T** : le RAW (« n'explose que si elle heurte quelque
  chose ») ne précise pas le timing — lecture retenue « au contact = ce Tour ».
- **Détonation = choix au lancer**, universel (RAW « toute grenade peut être dotée de l'une des
  options »), rien à seed par ligne de catalogue. Pas de variante d'objet.
- **Explosion différée (minuterie) qui lève une exception** : affiche désormais un
  `COMBAT_DECLARE_ERROR` en room (catch durci) au lieu d'un silence — changement de comportement
  assumé, « mieux qu'un silence ».

### Satellites → tickets `bug_tickets`

Script `server/src/scripts/create_tickets_grenade_satellites.js` (à lancer par Saar) :
- **`GRENADE-COORD-MODS`** : le Test de Coordination du lancer (`resolveGrenadeThrow`) ignore
  `confirmedModifiers` (taille / situation). RAW : la Difficulté du lancer dépend de la taille de la
  zone visée. Confirmé par une carte de jet réelle affichant `Dif. : —`. Écart déjà noté v1.
- **`GRENADE-THROW-ALLURE-GATE`** : `isImpossibleRangedSituation` bloque **tout** lancer de grenade
  (Allure max / obscurité totale) — pré-existant depuis 3d, `[INCONNU]` à trancher (défendable RAW :
  « lancer prend un Tour de combat » = Action pleine).

Item « personne dans la zone à travers une porte » (test Saar 2026-09-09) : **conforme RAW**, pas de
ticket — le Test de Coordination a échoué (jet 16 > Seuil 12, marge −4) → dispersion de 4 m, qui
dans deux salles minuscules pousse le point d'impact dans un mur / la porte / la salle du lanceur →
plus de LOS vers l'adversaire depuis là. Le moteur fait ce qu'il doit ; il faut juste une carte de
test avec de la marge.

### Testé

`node --check` (tous fichiers touchés) ; `node --test` : `shared/**` 539/0 · `assaultDeclaration`
39/39 · `buildDeclarePayload` 80/80 (golden master : 4 assertions grenade + `detonation: 'minuterie'`,
+ 1 test percussion) · mécanismes AOE 44/44 ; `npx eslint` (0 nouvelle issue) ; `npm run build` OK.
**Jeu réel (Saar)** : déclaration grenade OK ; **percussion : jet + marqueur + AOE + dégâts
concomitants confirmés**. Le « no window » vu une fois = HMR périmé (résolu au hard refresh).

### Non testé

Session de non-régression complète encore à faire (le tronc AOE a bougé — extraction 3f/3, branche
3f/4, payload 3f/9) : grenade **minuterie**, **fusil à pompe**, **lance-flammes**. Marqueur
percussion : disparition en fin de Tour (implémentée après la dernière session Saar).

### Données

Les déclarations de grenade portent `aoe.detonation` dans `combat_actions.modifiers`. Aucune
migration.

### Retour arrière

`git revert` de la série 3f (`0f42d30` + ce commit). Refactor pur pour 3f/3 ; aucune migration.

### Reste du chantier grenades

3-bis (autres types : concussion / sonique / incendiaire / étourdissante / assommante / énergie /
capsules) · 3d-4 (anim de jet, client pur) · 3e (harnais d'intégration, optionnel — 3d/3f validés
sans). Détail `PLAN_GRENADES.md §6`.

## Session (Claude) — 2026-09-09 — Allure tireur / cible ⇄ mouvement déclaré (A1–A3)

`PLAN_ALLURE.md`. Le malus RAW « Cible / Tireur en déplacement » (`REGLESYSCOMBAT.md:1439-1448`
+ Écran du MJ, Tir seul) devient **dérivé du mouvement réellement déclaré** ce Tour
(`combat_actions.movement_gait`), plus une clé libre envoyée par le client dans
`confirmedModifiers.situation`. Même patron que la Taille (`PLAN_TAILLE.md`).

### Décision — `cible immobile : +3` est RAW

Absent de la table du Livre de Base (`p.226-227` ne liste que « Cible en déplacement »), mais
**présent sur l'Écran du MJ Polaris** (produit officiel) — confirmé par Saar 2026-09-09. Donc
règle RAW, pas une house rule : la dérivation applique `cible_immobile` (+3) dès qu'une cible
unique ne s'est pas déplacée ce Tour. Distinct de « pas de cible » (zone d'effet → aucune clé).

### Autorité serveur

- **A1** `shared/combatSituationMods.js` : `rangedAllureKeyForGait(gait, role)` (pur),
  `MOVEMENT_DERIVED_SITUATION_KEYS` (8 clés), `applyDerivedAllureToSituation` (retire l'allure
  client, réinjecte l'allure serveur). Garde de chargement miroir de `TAILLE_MODS`. Découplé de
  `combatMovement.js` (pas de `shared/world/` dans le bundle client) ; la dérive des 4 gaits est
  couverte par un test.
- **A2** `server/src/lib/combatAllureService.js` : `resolveMovementGait(db, campaignId, tokenId,
  turnNumber)` (dernière ligne `move_short`/`move_long` non `skipped` du Tour) et
  `resolveRangedAllureKeys(...)`. `targetTokenId == null` ⇒ `targetAllureKey: null` (jamais
  `cible_immobile`).
- **A3** `socketCombatResolution.js` : `COMBAT_ACTION_PRECHECK` (assault non-AOE) renvoie
  `shooterAllureKey` / `targetAllureKey` (préselect UI). À la résolution, pour
  `!isGm ∧ type 'assault' ∧ !aoe` : `confirmedModifiers.situation` est réécrit — clés d'allure
  du client retirées, clés serveur injectées — **avant** les 3 résolveurs de Tir
  (`resolveAssaultAction`, `resolveDroneAssaultAction`, `resolveExoAssaultAction`, tous
  consomment `situation` de la même façon). Le MJ n'est jamais réécrit. Effet gratuit :
  `isImpossibleRangedSituation` voit enfin le vrai `tireur_allure_maximale` → *Tir impossible*
  opposable. Label `tireur_allure_maximale` ajouté à `SITUATION_LABELS`
  (`socketCombatHelpers.js`).

### Redirection Saar — option de campagne LIBRE / AUTO (A4/A5 reportés)

Saar ne veut pas le champ « Taille (combat) » sur la fiche (retrait de `PLAN_TAILLE.md` S5).
À la place : réglage de campagne `combat_modifiers_mode` (défaut **AUTO**) — AUTO = dérivé +
préselect + joueur lecture seule ; LIBRE = tout manuel, `PRECHECK` renvoie `null`, fenêtres
`<select>` fallback 0. Nouveau chantier `PLAN_MODE_MODIFICATEURS_COMBAT.md` : retire S5, ajoute
le réglage, garde `PRECHECK`/résolution (taille + allure) selon le mode, finit A4, écrit A5.

### Testé

`node --check` (3 fichiers serveur + shared) ; `node --test` : `shared/**` 550/550 (`+23`
`combatSituationMods`, dont 11 neufs) · `combatAllureService` 11/11 (base locale, fixture
cleanup vérifié) · `combatTurnEngine` 17/17 · `socketCombatAoe` + `combatantContextService`
72/72 — aucune régression. `git diff --check` propre.
**Jeu réel (Saar) 2026-09-09** : `PRECHECK … allure:tireur_allure_lente/cible_allure_rapide` →
`CONFIRM … situation:["tireur_allure_lente","cible_allure_rapide"]` au résolveur. « Sinon
fonctionnel ».

### Non testé

Tir joueur (non-MJ) résolu de bout en bout : refus réel sur `move_max` + tir ; breakdown avec
allure tireur ET cible. Fenêtres client (A4). AOE : `cible_immobile` (+3) en dur reste envoyé
par le client (`target_token_id` null) — **pré-existant**, ticket à ouvrir, résolu avec D7.

### Données

Aucune. `confirmedModifiers` n'est jamais persisté.

### Retour arrière

`git revert` du commit A1–A3 (6 fichiers, aucune migration). `combatAllureService.js` +
`combatSituationMods.js` nouveaux exports : aucun autre consommateur.

## Session (Claude) — 2026-09-09 — Mode modificateurs de combat LIBRE / AUTO (option de campagne)

`PLAN_MODE_MODIFICATEURS_COMBAT.md`. Redirection Saar : il ne veut pas de champ « Taille (combat) »
sur la fiche de personnage ([[PLAN_TAILLE.md]] S5, livré la veille). À la place, une **option de
campagne** `settings.combat_modifiers_mode ∈ { libre, auto }` (défaut `auto`) qui pilote toute
l'automatisation des modificateurs dérivables : **taille de la cible** + **allure** tireur/cible.
Absorbe [[PLAN_ALLURE.md]] A4/A5.

### Décisions

- **2 modes** (pas 3). `auto` = dérivé + préselect + joueur lecture seule, MJ garde la main.
  `libre` = `<select>` neutre (fallback 0) pour joueur ET MJ, aucune dérivation.
- **`libre` = aucun verrou caché** : `tireur_allure_maximale` = Tir impossible n'est PAS forcé
  quand personne ne le sélectionne ; seul un choix explicite de l'option dans le menu déclenche
  le refus (comme `obscurite_totale`). Décision Saar explicite.
- **Portée hors périmètre** : `authoritativeRangeBand` est déjà seul juge côté serveur
  (`confirmedModifiers.portee` mort). « Portée libre » serait cosmétique ou franchirait
  l'invariant 3 → `PLAN_PORTEE_NARRATIVE.md` si un jour. `[VÉRIFIÉ]` : tous les usages serveur
  pointent sur `authoritativeRangeBand`.
- Défaut `auto` : « le fonctionnement souhaité d'Enclume est l'automatisation, on prévoit juste
  pour ceux à qui ça ne convient pas » (Saar).
- Colonne `characters.size_category` + CHECK 327 **conservées** (1er cran cascade
  `explicit ?? derived`, patron canonique Foundry/PF2e). Migration `328` a remis les valeurs à
  NULL (0 ligne sur la base de dev — le `<select>` S5 n'a jamais servi).

### Implémentation

- **M1** (`6552716`, inerte) : `SETTINGS_SCHEMA` +`combat_modifiers_mode` ; `SectionGameRules.jsx`
  bascule 2 boutons. Propagation live confirmée (`WS.CAMPAIGN_SETTINGS_UPDATED`).
- **M2** (`e95c9d4`) : retrait `SizeCategoryField.jsx` + 3 montages, routes `GET|PUT
  /char-sheet/:id/size`, `describeCharacterSize` + option `ignoreExplicit`. Migration `328`
  NULL-out. Piège : supprimer un fichier du graphe Vite dev → écran blanc « no default export »
  → `Remove-Item -Recurse client\node_modules\.vite` + restart + hard refresh.
- **M3+M4** : `socketCombatResolution.js` — `getCampaignSettings` hoisté par handler, PRECHECK +
  CONFIRM gatés sur `combatModifiersAuto` (en `libre` : PRECHECK renvoie `null`, pas de
  `stripGmOnlyModifiers`, pas de réécriture allure). `SessionPage`→`CombatOverlay`
  (`combatModifiersMode` + `assaultPrecheckAllure`) → 4 fenêtres. `CombatModifiersWindow` /
  `CombatCacModifiersWindow` : `modifiersEditable = isGm || !autoMode` gouverne taille ET allure.
- Correctif post-test : `allureEditable = modifiersEditable || isAoeAction` retiré — un tir de
  zone en cible unique porte `modifiers.aoe` (profil AOE) truthy → l'allure restait éditable pour
  le joueur en `auto`. En `auto` le joueur ne touche à rien, zone comprise.

### Testé

`node --check` ; `node --test` : `campaignSettingsService` 6/6 · `combatAllureService` 11/11 ·
combat serveur (`combatTurnEngine` + `socketCombatAoe`) sans régression · `shared/**` 550/550.
`npx eslint` (0 nouvelle erreur — 1 `set-state-in-effect` préexiste dans `CombatModifiersWindow`).
`npm run build`. **Jeu réel (Saar)** : M2 (fiches OK, 0 régression) ; M3+M4 « fonctionnel »,
puis correctif allure éditable validé.

### Non testé

Combat réel en mode `libre` de bout en bout (Tir + CaC, joueur choisit ses malus) — la
non-régression `auto` est validée, `libre` reste à éprouver en session.

### Données

Migration `328` (`characters.size_category` → NULL). Réglage `combat_modifiers_mode` : clé JSONB,
défaut `auto` appliqué à la lecture — campagnes existantes inchangées.

### Retour arrière

`git revert` de la série M1→M5. Migration `328.down` = no-op (valeurs effacées non restaurables,
sans consommateur). Colonne 327 conservée dans tous les cas.

### Reste

- **D7** (`PLAN_TAILLE.md`) : retrait du modif de taille en AOE — `socketCombatAoe.js` n'est plus
  contended (grenades 3f poussé).
- **Ticket AOE** : `cible_immobile` (+3) en dur pour un tir de zone (`target_token_id` null) ;
  `isAoeAction` truthy pour un tir de zone en cible unique. À nettoyer avec D7 / refacto
  `socketCombatAoe.js`.

## Session (Claude) — 2026-09-09 — Grenades 3-bis (fondation cercle + énergie) + gel du chantier + trouvaille « zones dangereuses »

Suite du chantier grenades après 3f (percussion). Poussé : `7f3e9f7` (3-bis/0 + `circleGrenade.js`
+ `grenadeEnergy.js` + migration 328) + `0a7eac4` (refonte `grenadeFrag.js` sur le squelette).

### 3-bis — ce qui est fait

- **3-bis/0** — retrait du garde `getAoeMechanic(...) !== 'grenade_frag'` dans `resolveGrenadeThrow`.
  Redondant : `findAoeMechanismEntry` a déjà validé le mécanisme en amont ; `aoe.intendedOrigin` en
  base ⟹ l'annonce a validé `shape:'circle'`. Le lancer est désormais commun à tout mécanisme cercle.
- **`aoeMechanisms/circleGrenade.js`** (neuf) — squelette partagé : `buildCircleShape` ·
  `filterCircleHitTargets` (LOS + in-zone, sans enrichissement) · `CIRCLE_GRENADE_FLOW` (4 capacités
  gelées) · `noExtraTargets`/`noTargetRowModifier`/`noPostResolve`. **Décision d'archi (analyse à
  charge)** : extraire à N=2 (6 consommateurs nommés dans le plan, la géométrie a déjà bougé une fois
  en 3f) plutôt que copier — pas proactif au sens `feedback_aggradation_criterion`. Ne casse pas la
  philosophie du registre (le tronc dispatche toujours via `findAoeMechanismEntry`).
- **`grenadeEnergy.js`** — mécanisme `grenade_energy` : dégât UNIFORME (`baseRaw` = jet de 6D10 tel
  quel), 1 Localisation, armure normale. Migration 328 (`radiusM: 2.5`). Écart RAW acté : « diamètre
  5 m » → rayon 2,5 m. `[INCONNU]` : champ d'énergie ↔ armure physique — `armorReductionFactor: 1`
  par défaut (RAW silencieux), à confirmer.
- **`grenadeFrag.js`** refondu pour consommer `circleGrenade.js` — behavior-preserving, 17 tests
  fixtures inchangés + session frag comme filet.
- Client : **zéro code** (éligibilité + aperçu disque automatiques via `AOE_MECHANICS` / `mechanic !==
  'grenade_frag'`).

**Validé jeu réel Saar** : grenade à énergie (minuterie + percussion) + non-régression frag.

### Décision Saar — chantier grenades GELÉ

Point de pause propre. Reprise (`PLAN_GRENADES.md` §6) : 4 types « à statut » prêts sur le squelette
(`grenade_stun` → `flashbang` → `concussion` → `sonic`) ; les types « à zone » (incendiaire, gaz,
capsules) attendent la fondation ci-dessous. Suite de la séquence principale = **Usure & Intégrité**
(agent parallèle lancé, plan doc bouclé).

### Trouvaille — la mécanique « zones dangereuses » est un échafaudage

Exploration menée sur demande de Saar (« pourquoi ne pas réutiliser la mécanique de zone dangereuse
pour l'incendiaire, se rapprocher du RAW ? »). Verdict [VÉRIFIÉ lecture code] :
`world_effect_instances` + `shared/world/worldEffects.js` **fonctionnent** pour : le modèle de données
volumique, les définitions builtin (`fire`/`gas`/`flooded`/`oil`/`unstable` — `fire` a même un hook
`turnStart` `damage`), le coût de déplacement à travers une zone, l'occlusion LOS (fumée).
**Ne fonctionnent PAS** : aucune application de dégâts (le mouvement calcule/persiste les events
`enter`/`traverse`/`exit` mais n'appelle jamais `resolveTargetHit` ; aucune boucle `turnStart`),
`duration_rounds` jamais décrémenté, rien ne crée d'instance depuis la résolution de combat.

→ Construire cette couche = **chantier de fondation** (`PLAN_ZONES_DANGER.md` à écrire, ROADMAP §2).
Débloque : grenade incendiaire, `PLAN_NUAGE` (fumigène + 6 gaz), capsules, **tir de suppression**
(la « zone persistante inter-tours » est 1 de ses 2 bloqueurs), zones dangereuses MJ (posables mais
inertes aujourd'hui). Décision Saar : cadrer en parallèle (basse urgence), prêt quand les armes
spéciales reprendront.

### Cleanup — collision migration 328

`328_characters_clear_size_category.js` (chantier Mode modificateurs, `e95c9d4`) et
`328_ref_equipment_grenade_energy_aoe_profile.js` (celle-ci, `7f3e9f7`) coexistent sur `dev/Saar`,
toutes deux poussées + appliquées. Fonctionnellement OK (tables distinctes, idempotentes, knex les
traite comme 2 migrations par nom complet). **Ne pas renommer** (poussées + appliquées, P54).
Prochaine migration = 329+, vérifier `knex_migrations` avant. Ticket léger `MIGRATION-328-COLLISION`.

**Testé** : `node --check` ; `node --test` mécanismes AOE 46/0, sweep `shared/**` + tronc + moteur de
tour 587 (572 pass / 15 skip DB / 0 fail) ; migration vérifiée contre le seed.
**Non testé** : les 4 types 3-bis « à statut » (pas commencés).
**Données** : migration 328 (`grenade_energy` `aoe_profile`, idempotente).
**Retour arrière** : `git revert` de `7f3e9f7` + `0a7eac4` ; `down` migration 328.

---

## Session (Claude) — 2026-09-10 — Usure & Intégrité du matériel — V1 lots L0→L5 (validés jeu réel)

Chantier `PLAN_USURE&INTEGRITE.md` (ROADMAP §2), phase V1. Autorité de jeu : `MANUELS/MANUEL_USURE.md`
v1.5. Une pièce d'équipement porte une **Intégrité** (ITG, courante / max), dégradée par l'usage, qui
module le combat et peut tomber en panne. ~18 commits sur `dev/Saar` (`597fe53` → `2f85200`), non
poussés au moment de l'écriture.

**L0 — schéma** (migrations 329-333). `ref_equipment.has_integrity` (bool, défaut OFF) + `quality`
(CHECK 5 valeurs) ; `char_inventory.integrity_current` / `_max` / `malfunction_severity` (+ 3 CHECK de
cohérence) ; `merchants.is_black_market`. Backfill `has_integrity` par famille + NT (210 lignes après
curation) : armes/protections NT II+, ordinateurs, objets NT IV+ ; **retirés** : pharma (332), armes de
jet & grenades (333, décision Saar « pas d'usure pour les consommables »). L'informatique est gatée sur
`category = 'Ordinateur'` — `tech_level` vaut 1 pour toute la famille dans le seed (ne PAS s'en servir
comme NT ailleurs). Script one-shot `wipe_inventories_for_integrity.js` (découplé, lancé par Saar).

**L1 — non-stacking.** `inventoryRules.canStack(ref)` = `!isEquippableLocation && !has_integrity`.
4 sites (`addItem`, garde `PUT quantity!=1`, `tradeService`, `modingService.returnModToInventory` —
4ᵉ trouvé à l'exploration). Un objet suivi en ITG = toujours `quantity 1`.

**L2 — primitives.** `shared/integrityRules.js` (pur, importable client) : `INTEGRITY_TIERS` (6 paliers
MANUEL §3.3), `getIntegrityModifier` (+2/0/-3/-5/**null** hors d'usage), `QUALITY_TABLE`,
`applyTemporaryLoss` (perte définitive de max = **la plus grande** des deux pénalités, jamais la somme),
`getWeaponIntegrityBlock`, `interpretPanneOutcome`. `server/src/services/integrityService.js` = autorité
d'écriture unique de `char_inventory.integrity_*` (verrou `.forUpdate()` + relecture à frais ;
`runPanneTest` = `resolvePolarisTest(integrity_current)`, aucun moteur maison).

**L3 — acquisition.** Achat Marchand : `computeAcquisitionIntegrity` — marché noir → neuf, marché légal
→ jet d'occasion par exemplaire (formule de la qualité). Don MJ (`addItem` GM / `quickEquip`) → 15/15.
Ajout joueur → ITG NULL (le MJ fixe). Bouton MJ « Lancer ITG occasion ».

**L4 — inventaire.** `IntegrityIcon.jsx` (pictogramme bouclier, `docs/PLANS/integrite.svg`) coloré par
palier (`INTEGRITY_TIER_COLORS`, tokens `--itg-*` miroir `--wound-*`), chiffres courante/max, badge
« ! » (rouge atelier / ambre simple), blanc si non défini. Éditeur inline (courante/max + état) gaté
propriétaire-ou-MJ. `getItemWithRef`/`getInventory` portent les 4 champs ; `updateItem` route vers
`adjustIntegrity`, jamais d'écriture directe. **Validé « parfait » par Saar.**

**L5 — combat** (humanoïde PJ+PNJ ; exo/drone hors scope, armes de jet exclues).
- **L5a modificateur d'état** : `getIntegrityModifier(integrity_current)` poussé dans `contributions`
  de `resolveMeleeAction` + `resolveAssaultAction` (`socketCombatHelpers.js`) sur l'arme qui frappe
  réellement. Client (pré-jet) : `/weapon-skill/:id` renvoie `hasIntegrity`/`integrityCurrent`/
  `malfunctionSeverity`, pastille « État de l'arme » dans `CombatModifiersWindow` + `CombatCacModifiersWindow`.
- **L5b porte de panne** : `getWeaponIntegrityBlock` aux 4 sites (déclaration + résolution × Tir + CaC)
  → arme enrayée (`malfunction_severity`) ou hors d'usage (ITG 0) → action refusée,
  `COMBAT_DECLARE_ERROR`, aucune ressource consommée. Grisage du sélecteur d'arme **abandonné**
  (Saar : « aucun intérêt »).
- **L5c test de panne** : une arme suivie à ITG ∈ [1,5] qui **rate son jet d'attaque sans Catastrophe**
  subit un Test de panne (1D20 sous l'ITG, `runPanneTest`), sans annuler l'attaque. Helper
  `runCombatWeaponPanne` (1 site melee + 1 assault, après `maybeTriggerCatastrophe`) → carte
  `DICE_RESULT` d20 + (sur panne critique) carte 1d6 de la perte + message chat `COMBAT_SYSTEM_NOTICE`
  (`combat:integrityPanne.*`) + `INVENTORY_UPDATED` (item complet). Dual-wield → primaire seul (miroir
  L5a). Le Test reste **automatique** (conséquence, pas un choix — décision Saar).
- Correctifs en cours de validation jeu réel : la carte du Test s'animait en **d6** (`formula`
  parenthésé sans `skillLabel` → `useSessionSocket.js:85` / `DiceMesh.js` replie sur d6) → `formula:
  '1d20'` nu ; logs `[DBG]`/`[WS]` ajoutés aux portes de panne (déclaration + résolution).

**L7 — usage manuel.** Bouton MJ « Usage intensif » : `POST …/panne-test` → `applyPanneSystematic`
(ITG ≤ 5, sans jet) ou `runPanneTest`.

**Décisions RAW / écarts** (tous dans `MANUEL_USURE.md`) : test de panne = moteur de Test complet
(`resolvePolarisTest`, Catastrophe = marge d'échec ≥ 15) ; perte définitive = max des deux pénalités ;
marché noir = neuf ; édition ITG = MJ **et** propriétaire (raccourci assumé, la réparation validée
reste la voie normale) ; events WS réutilisés (`INVENTORY_UPDATED` / `DICE_RESULT` / `COMBAT_SYSTEM_NOTICE`).

**Reste (non journalisé ici — chantier non clos)** : **L6** (réparation complète — sous-système
d'échéance `equipment_repair`, panneau de revue MJ généralisé), puis **validation V1 en jeu par Saar**,
puis **Lot 2** (L8 « MAIS TU VAS MARCHER » + pièces détachées via `resolveChanceTest` ; L9 entrées #2/#8
de la table CATASTROPHES EN COMBAT). Dette i18n assumée : messages combat Usure en FR dur
(`COMBAT_DECLARE_ERROR`), cohérent avec le reste des sockets combat.

**Testé** : `node --check` + smoke import (aucun cycle) ; `shared/**` 574/574 ;
`integrityService` 15/15 ; `combatAttackRoll` 29/29 ; `combatTurnEngine` + `socketCombatAoe` 37/37 ;
`inventoryService` / `tradeService` / `modingService` / `inventoryRules` verts ; `build client` OK.
Jeu réel Saar : L4 « parfait » ; L5a « ça m'a l'air OK » ; L5b arme enrayée → déclaration refusée
avec message ; L5c arme à ITG 2 rate → Test de panne (roll 10/2) → −1 ITG + `malfunction_severity`.
**Non testé** : L6 (pas commencé) ; cycle de vie complet d'une arme cassée sur une longue session ;
`DeprecationWarning` pg vue une fois au niveau `resolveExoMeleeAction` (pas L5, `[INCONNU]`, à
instrumenter si ça persiste).
**Données** : migrations 329-333 (additives, idempotentes, backfill par clé métier). Script
`wipe_inventories_for_integrity.js` à lancer par Saar quand il veut des inventaires propres (non
bloquant).
**Retour arrière** : `git revert` par commit (chacun atomique) ; `down` des migrations 329-333.

---

## Session (Claude) — 2026-09-10 — Usure & Intégrité — L6 réparation (échéances + carte chat + pop-up ITG)

Suite du chantier `PLAN_USURE&INTEGRITE.md` §8. La réparation complète : le joueur déclare l'intention,
le MJ approuve/refuse, le joueur lance un Test de compétence, l'ITG remonte (ou baisse sur Catastrophe).
Aucune gestion du temps par le système (le MJ bouge l'horloge s'il veut). Non poussé au moment de l'écriture.

**L6a — socle serveur.** Migration **334** `game_echeances.advance_driven` (bool, défaut true,
dénormalisé à la création comme `interactive`). Cause : 3 requêtes de `gameTimeService` /
`echeanceService` balayaient TOUTES les échéances interactives sans filtrer — correct par accident tant
que les blessures étaient le seul type interactif. Une échéance **à la demande** (`equipment_repair`,
`advanceDriven: false`) ne bloque plus l'avance de temps, n'est plus clobbée par une annulation, ne
pollue plus le journal d'undo. `shared/integrityRules.js` : `getRepairSkillId` (table famille→compétence
[INFÉRÉ] — le RAW ne donne que des exemples), `computeRepairNtMalus` (NT VI −7 / NT V −5),
`isRepairable`, `interpretRepairOutcome`. `integrityService.applyRepairOutcome` (issue déjà tirée →
`applyRepair` + lève panne `simple` / rien / Catastrophe : `integrity_max -= 1`, malfunction inchangé).
Handler `equipmentRepairService.equipmentRepairHandler`. **Révision D3** : le joueur PERD l'édition brute
d'ITG (`PUT inventory` refuse les 3 champs à un non-MJ) — il passe par « Demander une réparation ».

**L6b — jet + lectures.** Socket `EQUIPMENT_REPAIR_ROLL` (gabarit `WOUND_INFECTION_ROLL`) : Seuil =
`calcSkillTotal + ntMalus + activeMalus` (autorité unique `computeRepairThreshold`, partagée avec la
route d'aperçu), `resolvePolarisTest`, `resolveEcheanceNow`. `equipmentRepairReviewService.js` :
`getRepairRequestsForGm` + `getRepairRollsForPlayer` (chaque domaine sa requête — `woundReviewService`
PAS généralisé). Route `repair-preview` (Seuil prévisionnel = Seuil lancé).

**L6c-A — carte d'action dans le chat du MJ** (validé jeu réel). Après une 1ʳᵉ implémentation rejetée
(panneau flottant maison), bascule sur le **patron établi du projet** : `sidebar-msg-action` (cf.
`entity_action` / `sell_request`). `repair-request` émet `EQUIPMENT_REPAIR_REQUESTED` enrichi aux
sockets MJ ; `RepairRequestCard.jsx` (composant : `<select>` compétence + `[Approuver]` / `[Refuser]`
→ route `repair-decision`) ; `useRepairRequestSocket.js` (hook MJ toujours monté : re-dérive les cartes
au montage via `GET repair-requests`, les **retire** à la résolution via `removeMessage` — aggradation
vs `entity_action` / `sell_request` qui laissent une carte morte). Badge `pendingActionCount`.
`EquipmentRepairReviewPanel.jsx` supprimé.

**L6c-B — pop-up ITG à deux visages** (validé jeu réel). Clic sur l'icône d'Intégrité (MJ **ou** joueur)
→ `IntegrityPopover.jsx` (patron `SkillInfoPopover` : composant « dumb », état + clic-dehors dans
`InventoryPanel`, item re-dérivé du store). **MJ** : « État initial » (presets = paliers RAW :
Neuf / Occasion / Moyen 13 / Endommagé 3 / Hors d'usage 0+atelier, bornés au max) + champs bruts
courante/max ; « Statut » (3 boutons) ; « Usage intensif » (corrigé — hors de la ligne draggable, le
clic passe enfin). **Joueur** : Seuil prévisionnel (`repair-preview`) + `[Réparer soi-même]` /
`[Annuler ma demande]` (route `repair-cancel`, patron revente) selon `repair_request_status`
(sous-requête `game_echeances` ajoutée aux SELECT `getItemWithRef` / `getInventory`). L'ancien éditeur
inline (« enfilade de boutons ») et le bouton « 🔧 Réparer » adjacent sont **supprimés**.

**Décisions / écarts** (dans `MANUEL_USURE.md` / PLAN §13) : compétence de réparation = mapping
famille→compétence [INFÉRÉ] surchargeable par le MJ à l'approbation ; annulation joueur = logique revente ;
Catastrophe de réparation → l'objet reste en panne (RAW) ; pas de pièces détachées en V1 ;
`repair-request` refusé pendant un combat (MANUEL §5.1 : geste hors combat).

**Testé** : `node --check` serveur ; `node --test shared/**` 578/578 ; serveur réparation + inventaire
+ échéances 35/35 ; smoke import routes (aucun cycle) ; SQL de la sous-requête `repair_request_status`
testé live contre `enclumeBD` ; eslint client 0 erreur ; `vite build` OK. Jeu réel Saar : L6c-A « la
carte est ok » ; L6c-B « test concluant, parfait » (presets, statut, Usage intensif, circuit joueur
demande → attente → annulation).
**Non testé** : cycle complet demande → approbation → jet → ITG remontée sur une vraie session ;
reconnexion MJ avec demande en attente (re-dérivation de carte) éprouvée en isolé, pas en session longue.
**Données** : migration **334** (additive, idempotente, round-trip validé, 59 lignes existantes → `true`).
Aucun backfill d'inventaire.
**Retour arrière** : `git revert` du commit ; `down` de la migration 334.
**Reste** : L6c-C (liseré bleu sur l'icône ITG quand une demande est en cours + index partiel sur
`game_echeances`), puis **validation V1 complète en jeu**, puis **Lot 2** (L8 / L9).

---

## Session (Claude) — 2026-09-12 — Chance : câblage combat L3e-4 + fusion fenêtre Catastrophe/Chance — CLOS (validé jeu réel)

Suite de `PLAN_CHANCE.md` (RAW `REGLE_CHANCE.md`/`MANUEL_CHANCE.md`, v2.0). L1-L3a (primitive,
`spendChancePoints`/`grantChancePoint`/`handleCatastropheRegen`) et L3e-1 à L3e-4b (machinerie
générique `pending_chance_choices`, `exo_stand_up`, `exo_assault`) déjà poussés une session
précédente. Cette session clôt **L3e-4** : les 7 sites Catastrophe combat identifiés sont câblés
(`exo_stand_up`, `exo_assault`, `exo_melee`, `assault` Tir humanoïde, `melee_defense`,
`melee_attack` ; `drone_attack` **exclu à raison** — un drone n'a aucun `char_sheet`,
`combatantContextService.js:283-287`).

**Patron « deux phases »**, appliqué aux 6 sites : le jet + `DICE_RESULT` + `maybeTriggerCatastrophe`
+ effets immédiats (munitions, panne d'arme) restent synchrones ; tout ce qui suit
(identité/dispatch défenseur, dégâts) est extrait dans une fonction `finalize*` unique, appelée
immédiate (pas de Catastrophe) ou différée depuis `SITE_HANDLERS.<site>` (Catastrophe → choix Chance
posé avant toute résolution, RAW « refaire son Test » = un second jet complet qui remplace le
premier). Choix Chance : pj/pnj direct au personnage, **exo → au pilote** (pas de `char_sheet`
propre), drone → aucun choix.

**Trois bugs réels trouvés et corrigés en auto-relecture, avant tout test navigateur** :
1. `finishExoAssaultChoice`/`finishExoMeleeChoice` ignoraient le `suspend` retourné par la
   finalisation — `advanceTimeline()` aurait pu écraser un `AWAITING_DAMAGE` juste armé.
2. `exo_assault`/`exo_melee` (déjà poussés) créditaient `character.id` (l'exo, sans `char_sheet`)
   au lieu du **pilote** — « Gagner 1 point » n'a jamais rien crédité depuis leur mise en ligne
   jusqu'au correctif (lookup `char_sheet.where({id: ctx.sheetId}).first('character_id')`).
3. `drone_attack` faillit être câblé avec le même mécanisme Chance — retiré avant tout push.

**Fusion UI (retour Saar, jeu réel)** : deux corrections successives.
- D'abord fusion de `CatastropheReviewQueue.jsx` + un `ChanceGmChoiceQueue.jsx` éphémère en
  `CatastropheChoiceQueue.jsx` (MJ uniquement), corrélés par `linked_catastrophe_id`
  (migration 339, FK → `pending_catastrophes` `ON DELETE SET NULL`) — un seul événement combat
  (PNJ) ne montre plus deux fenêtres MJ séparées.
- Puis (2026-09-12) `ChancePlayerChoiceCard.jsx` (carte joueur, positionnée à un autre coin de
  l'écran) **supprimé et fusionné dans le même composant** : Saar a fait remarquer qu'un
  découpage par audience (MJ vs joueur) ne justifiait pas un second composant à une seconde
  position — le mécanisme redevenait visible à deux endroits différents selon le type de
  personnage concerné, exactement le problème que la première fusion avait réglé côté MJ/PNJ.
  `CatastropheChoiceQueue.jsx` est désormais l'unique fenêtre, une seule position à l'écran,
  filtrée par audience en interne (MJ : Catastrophe + Chance PNJ ; joueur : Chance de son propre
  PJ, jamais la moitié Catastrophe — garde structurelle, `catastropheEntries` n'est jamais
  peuplée côté joueur).

**Fausse piste écartée** : un `linked_catastrophe_id` retrouvé `null` en base après la fin d'un
combat ne signifie PAS que le lien n'a jamais été posé — `purgePendingCatastrophes` (code
préexistant, `COMBAT_END`) supprime toute `pending_catastrophes` de la campagne (résolues
comprises), et la contrainte `ON DELETE SET NULL` efface rétroactivement la référence côté
`pending_chance_choices`. Un log de diagnostic temporaire (retiré) a confirmé que
`isCombatActive` était vrai à chaque jet en Catastrophe testé en session — le mécanisme
fonctionnait déjà correctement, l'inspection après-coup était trompeuse.

**Testé** : `node --check` sur tous les fichiers serveur touchés ; suite DB
`chanceService`/`chanceCatastropheChoiceService`/`catastropheService`/`combatTurnEngine`
43/43 ; `eslint` client 0 erreur ; `vite build` OK. Jeu réel Saar, plusieurs combats : les 7 sites
(dont les 3 impliquant un PJ/pilote réel) déclenchent la fenêtre Chance au bon moment, le MJ
reçoit la Catastrophe liée pour un PNJ, « Relancer » retire la Catastrophe liée, une seule fenêtre
à l'écran quel que soit le type de personnage — confirmé par Saar (« Test all ok »).
**Non testé** : `socketEntity.js` (poussée/traction, L3e-2, déjà poussé une session précédente)
reste bloqué par une régression externe (world builder) empêchant de placer des Entités
interactives — hors périmètre de ce chantier.
**Données** : migrations 336-340 (déjà appliquées et validées la session précédente), aucune
nouvelle migration cette session.
**Retour arrière** : `git revert` du commit ; les migrations restent additives, `down` disponible
si nécessaire.
**Reste** : L4 (forçage combat AOE — Événement favorable), L5 (réduction de gravité Blessures),
L6 (UI générique `<ChanceSpendButton>`) — non commencés, détail `PLAN_CHANCE.md` §6-8.

---

## Session (Claude) — 2026-09-12 — Chance L4 : forçage / Test de Chance AOE longue-extrême portée — VALIDÉ JEU RÉEL

Suite de `PLAN_CHANCE.md` §6. Comble l'écart RAW déjà documenté dans `socketCombatAoe.js` : à
portée longue/extrême, le fusil à pompe et la grenade à fragmentation accordent à chaque cible
touchée un Test de Chance pour éviter complètement d'être atteinte (+5 à portée extrême,
`REGLES_ARMES_SPECIALES.md:34-40/99-104`), ou le RAW « Événement favorable »
(`REGLE_CHANCE.md:75-77`) pour dépenser 1 point de Chance à la place du jet.

**Décision d'architecture (analyse à charge demandée par Saar avant de coder)** : ne PAS créer un
second service/table parallèle à `chanceCatastropheChoiceService.js` pour cette seconde mécanique
RAW (déclencheur, vocabulaire de choix et cardinalité différents de la régénération sur
Catastrophe de L3e). Recherche de patrons pro (Enterprise Integration Patterns) : le problème réel
— une action AOE peut toucher PLUSIEURS cibles simultanément, il faut attendre TOUTES leurs
décisions avant de résoudre les dégâts — est un **Aggregator/Scatter-Gather** classique, à
construire sur l'infrastructure déjà validée de L3e (même table `pending_chance_choices`, même
patron DB-row + event + résolution idempotente) plutôt qu'à dupliquer. `resolveChanceChoice`
élargie à un second vocabulaire de choix (`force`/`attempt`, distinct de `gain_point`/`reroll`)
sans aucun effet central pour ces valeurs — laissé à l'unique consommateur.

**Implémentation** : migrations 341-342 (`action_id`/`target_token_id`/`outcome` sur
`pending_chance_choices`, additives — `action_id` sert d'identifiant de corrélation, index partiel
sur les lignes non résolues). `socketCombatAoe.js` : `finalizeAoeResolution` extrait fidèlement de
la queue de `resolveAoeAssaultAction` (persistance + dégât + finalisation + effets post-résolution),
appelable immédiate (aucune cible éligible, cas courant inchangé) ou différée. Nouveau site
`aoe_avoidance` : `finishAoeAvoidanceChoice` applique l'effet individuel (`spendChancePoints` pour
« Forcer », `resolveChanceTest` + jet 1D20 pour « Tenter »), puis vérifie la condition de
complétion du groupe sous un verrou `pg_advisory_xact_lock` scopé à `action_id` — un simple
comptage sans exclusion mutuelle aurait laissé une fenêtre de course où deux résolutions quasi
simultanées se croient chacune « la dernière » (constaté a posteriori : le test réel a justement
produit ce cas, deux timeouts à 13ms d'écart, sans le verrou ça aurait pu doubler ou perdre la
résolution). Éligibilité : `ht.band ∈ {longue, extreme}` — couvre fusil à pompe et grenade à
fragmentation, exclut structurellement le lance-flammes (`band` toujours `null`, RAW confirmé : ses
dommages ne décroissent pas avec la portée, aucune clause de Test de Chance pour lui).

**Bug client trouvé et corrigé avant tout clic manuel** : `CatastropheChoiceQueue.jsx` envoyait
toujours `reroll`/`gain_point` (vocabulaire L3e) quel que soit le site — un clic sur une carte
`aoe_avoidance` n'aurait rien fait d'utile (ni `force` ni `attempt` reconnus par le serveur,
silencieusement traité comme "reste touché"). Le composant bascule désormais sur
`chance.site === 'aoe_avoidance'` pour afficher les bons boutons (« Forcer »/« Tenter »).

**Fausse alerte écartée en test réel** : un premier tir (lance-flammes) suivi d'une Catastrophe
« mais le tir a lieu quand même » a semblé être un bug — RAW du lance-flammes vérifié
(`REGLES_ARMES_SPECIALES.md:53-66`) : « en cas d'échec au Test de tir, les cibles sont touchées
quand même » est le texte RAW littéral, pas un défaut. Un second doute (aucune cible éligible sur
un tir au fusil à pompe) s'est résolu par un log de diagnostic temporaire montrant les bandes
réelles (`moyenne`/`courte`, aucune `longue`/`extreme`) — géométrie du test, pas un bug ; log retiré
une fois la cause confirmée.

**RAW « Forcer » revérifié en session** (question de Saar) : `REGLE_CHANCE.md:75-77` définit
« Événement favorable » comme substituable à tout Test de Chance par une dépense directe de 1
point — c'est l'exemple même donné par le texte, pas une extrapolation. Confirmé par Saar après
relecture.

**Testé** : `node --check` sur les fichiers serveur touchés ; suite DB
`chanceCatastropheChoiceService` (dont un nouveau test verrouillant que `force`/`attempt`
n'interfèrent jamais avec les effets centraux `gain_point`/`reroll`) + suite pure `socketCombatAoe`,
toutes vertes ; `eslint` + `vite build` client OK. Jeu réel Saar : fusil à pompe (Klauss) tiré par
un drone, 2 cibles (1 PJ, 1 PNJ) à portée extrême — deux fenêtres ouvertes simultanément avec le
bon `+5`, résolues par timeout à 13ms d'écart (le cas le plus dangereux pour la jonction), combat
repris normalement sans double résolution ni blocage.
**Non testé** : le clic manuel sur « Forcer »/« Tenter » (seul le chemin timeout a été éprouvé en
jeu réel jusqu'ici, après correction du bug de libellé de bouton ci-dessus).
**Données** : migrations 341-342 (additives, colonnes nullables), déjà appliquées.
**Retour arrière** : `git revert` du commit ; `down` des migrations 341-342.
**Reste** : L5 (réduction de gravité Blessures), L6 (UI générique `<ChanceSpendButton>`) — non
commencés, détail `PLAN_CHANCE.md` §7-8.

---

## Session (Claude) — 2026-09-12 — Fix : le MJ ne démarre plus de création au nom d'un joueur (onglet Joueurs)

Bug remonté par Saar : dans Configuration de campagne → onglet Joueurs, le bouton « Démarrer une
création » (`SectionPlayers.jsx`) laissait le MJ créer lui-même le `character`/`char_sheet` d'un
joueur ciblé (`POST /creation/start` avec `targetUserId`, `routes/creation.js`) — fonctionnalité
volontaire à l'origine (`docs/Old/PLAN_WIZARDCOLLAB.md` §4.2, « création guidée »), mais contraire à
l'usage voulu ici : le joueur crée sa fiche lui-même, le MJ ne fait que la rejoindre. Le chemin
« rejoindre » existait déjà et restait correct (bouton « Reprendre » sur un brouillon déjà démarré
par le joueur, même route `GET /creation/:sheetId`) — seul le chemin « créer pour autrui » posait
problème. `targetUserId` n'avait qu'un seul appelant dans tout le client (vérifié par grep), donc
retrait complet plutôt qu'un correctif partiel.

**Décision d'architecture (recherche demandée par Saar avant de coder)** : le rafraîchissement
automatique souhaité (« idéalement, actualisation automatique ») a été étudié avant tout ajout —
un agent d'exploration a confirmé que la page Configuration est un îlot 100% REST : aucun socket
ouvert (contrairement à SessionPage/WizardCreation), et la fonctionnalité sœur du même composant
(demandes de transfert du Coffre) utilise déjà exclusivement le rechargement REST, sans push
(confirmé par un commentaire explicite dans `routes/vault.js`). Ajouter un événement Socket.IO
dédié à ce seul signal aurait fragmenté la vue (un champ poussé, les autres en snapshot) — rejeté.
Retenu à la place : rafraîchissement périodique (20 s) + au retour de focus de l'onglet, réplique du
comportement par défaut de React Query/SWR (absents du projet, aucune dépendance ajoutée) — pattern
documenté pour un panneau d'admin sans canal poussé dédié.

**Implémentation** : `SectionPlayers.jsx` — bouton « Démarrer une création », `handleStartCreation`
et le style associé retirés ; `load()` accepte `{ silent }` pour que le poll ne fasse pas clignoter
la liste vers l'état "Chargement..." ; nouvel effet interval + listener `visibilitychange`, nettoyés
au démontage. `routes/creation.js` — branche `targetUserId` de `POST /start` supprimée
intégralement (plus aucun chemin serveur ne permet au MJ d'agir au nom d'un joueur). Clés i18n
orphelines `rosterStartCreation`/`rosterStartError` retirées de `fr.json`. Commentaire de la garde
d'idempotence dans `creationService.js#startCreation` corrigé (référençait le chemin `targetUserId`
supprimé comme raison d'être — la garde reste utile pour un double-clic/deux onglets, juste la
justification était devenue fausse).

**Trouvaille notée, pas corrigée en base** : le ticket `bug_tickets` `DBG-C1` (« character.user_id
null quand le MJ crée pour un joueur absent ») porte précisément sur le chemin `targetUserId`
supprimé ici — désormais caduc, ne peut plus se reproduire. Écriture DB non faite (convention :
script lancé par Saar), signalé à Saar pour clôture.

**Testé** : `node --check` sur `routes/creation.js` et `services/creationService.js` ; JSON de
`fr.json` validé ; `eslint` ciblé sur `SectionPlayers.jsx` (0 erreur). Aucun test automatisé
n'existait sur ces chemins (vérifié, aucune régression à surveiller de ce côté).
**Non testé** : scénario réel navigateur (le joueur démarre sa création, la carte MJ bascule seule
sur « Reprendre » sans reload manuel) — à la charge de Saar.
**Données** : aucune migration.
**Retour arrière** : additif de suppression pure — `git revert` du commit suffit, aucune donnée
persistée à restaurer.

---

## Session (Claude) — 2026-09-15 — Fix rechargement MJ : verrou circulaire + mauvaise arme + retour muet

Bug remonté par Saar après le fix icône ↻ permanente (`8b9bd6f`) : le MJ pouvait sélectionner
Recharger sur une arme de PNJ vide, mais « Déclarer » restait bloqué — puis, une fois débloqué,
l'arme rechargée n'était pas forcément la bonne, et aucun retour ne confirmait succès ou échec.

**Cause 1 (verrou circulaire)** : `assaultCheck` (`declareChecks.js`) refusait tout Tir sur arme
vide (`weaponEmpty`), mais son `started` côté MJ (`attackStarted = assaultDecl.state.weaponId !=
null`) restait vrai même quand Recharger était l'action active — l'arme qu'on vient de
sélectionner pour la recharger déclenche donc le refus destiné au Tir. Côté PJ, `attackActive`
excluait déjà Recharger ; l'exclusion n'existait nulle part côté MJ. Fix structurel : `isReloading`
devient un paramètre explicite de l'autorité unique `assaultCheck`/`assaultCheckInputs` — PJ et MJ
le transmettent désormais tel quel au lieu de le recalculer localement (source de la duplication
qui a permis au bug de passer inaperçu côté MJ).

**Cause 2 (mauvaise arme)** : `buildGmDeclarePayload` envoyait `reload: true` (booléen nu, sans
identité d'arme) — `socketCombatAnnouncement.js` insérait alors `weapon_inv_id: null`, et
`resolveReloadAction` rechargeait à l'aveugle tout ce qui traînait dans les emplacements MG/MD au
lieu de l'arme ciblée par le bouton ↻. Fix : `{ weapon_inv_id }`, mêmes rails que le PJ (munition
laissée à l'auto-sélection serveur déjà existante — le MJ n'a jamais eu de sélecteur dédié).

**Cause 3 (retour muet)** : `resolveReloadAction#emitResult` ne notifiait jamais un PNJ (`if
(!character.user_id) return`) — succès comme échec restaient invisibles côté MJ. Fix : broadcast
room + `isPnj`, même patron que `COMBAT_ATTACK_RESULT`/`onAttackResult`/`gmAttackResult` déjà
établi (`useCombatSocket.js`) ; nouveau `gmReloadResult` côté client, purge synchronisée avec les
autres résultats de fenêtre à `COMBAT_ENDED`.

**Analyse à charge gamedesign (retour Saar)** : « une popup de succès pour un seul personnage, ce
n'est pas cohérent — soit tout le monde, soit personne ». Plutôt qu'étendre la popup à toutes les
audiences (bruit inutile sur une action logistique fréquente), la bannière de **succès** est
retirée entièrement (PJ et MJ) — le compteur de munitions déjà affiché sur la ligne d'arme (mis à
jour en direct via `INVENTORY_UPDATED`) EST la confirmation. Seul l'**échec** (aucune trace
ailleurs, sinon ambigu) garde une bannière, règle unique portée par `CombatResultReload` lui-même
(pas dupliquée aux deux sites d'appel `CombatOverlay.jsx`). Clés i18n mortes (`success`,
`clipDisplay`) retirées.

**Testé** : `node --test` (137/137, tests golden master `buildGmDeclarePayload`/`assaultCheck`
mis à jour + 2 nouveaux verrouillant `isReloading`) ; `eslint` ciblé 0 erreur ; `vite build`
propre ; **validé jeu réel** (log serveur confirmant l'arme exacte rechargée à son plein chargeur,
plus aucune popup visible sur un rechargement réussi).
**Non testé** : rechargement en échec (aucune munition compatible) — bannière rouge attendue, pas
encore éprouvée en jeu.
**Données** : aucune migration.
**Retour arrière** : `git revert` du commit `8c47558`.

---

## Session (Claude) — 2026-09-15 — Chance L5 (réduction de gravité) : clôture, VALIDÉ JEU RÉEL

`PLAN_CHANCE.md` §7 — mécanique codée et testée en base (6/6) depuis le 2026-09-12, restait « en
attente de validation jeu réel » : un PJ (Joueur Test) a bien pris une Blessure critique, la carte
de réduction s'est ouverte, `reduce_N` a réduit la gravité et débité `chc` correctement — confirmé
également côté PNJ (Baboulinet) dans une session précédente. **L1→L5 sont désormais tous clos et
validés jeu réel.**

**Fusion Tir → `CombatDamageWindow.jsx` (Étape 1, retour Saar : un seul bouton, jamais une fenêtre
à part) — investigation close.** Codée le 2026-09-12, elle restait visuellement non confirmée
plusieurs jours : Saar constatait la fenêtre séparée (patron `CatastropheChoiceQueue.jsx`) malgré
deux relectures complètes du code (serveur + client, `woundId` tracé de bout en bout) ne trouvant
aucune anomalie. Une pause explicite a été demandée (« STOP, run à vide sur toi ») plutôt que
d'empiler une 3ᵉ hypothèse non vérifiée. Un vrai bug de dispatch serveur a été trouvé et corrigé
au passage (`finalizeAssaultHitOutcome` : un PNJ tirant sur un PJ tombait dans la branche
auto-résolution 100% serveur `resolveAssaultHitPnjNormal`, aucune fenêtre victime, malgré un
commentaire affirmant à tort le contraire) — corrigé en réutilisant `resolveAttackHitPj` (déjà
l'autorité correcte, jusqu'ici atteinte seulement via le tireur drone/exo). **Ce correctif était
nécessaire mais pas suffisant** : la fusion visuelle restait absente après.

**Cause réelle, confirmée à la reprise (2026-09-15) : stack dev périmée.** Un simple `Get-CimInstance
Win32_Process -Filter Name='node.exe'` en début de reprise a montré **aucun processus node en
cours** — le test précédent tournait donc forcément sur un bundle Vite/nodemon obsolète par
rapport au code lu. Aucune modification de code supplémentaire n'a été nécessaire : un redémarrage
propre de la stack a suffi. Confirme l'hypothèse n°1 posée à la pause et la leçon déjà actée dans
la mémoire (`feedback_no_window_is_stale_tooling`, arrivée 3× sur ce projet) : **vérifier la
fraîcheur de la stack AVANT une 3ᵉ relecture de code** sur un comportement qui semble correct à la
lecture mais ne se manifeste pas en pratique — une instrumentation `console.log` temporaire avait
été préparée en filet de sécurité pour ce cas précis, posée puis retirée sans avoir servi.

**Testé** : `node --check` sur tous les fichiers serveur du lot (`woundService.js`,
`chanceCatastropheChoiceService.js`, `combatantContextService.js`, `damageService.js`,
`socketCombatHelpers.js`, `socket/index.js`, `socketCombatAoe.js`, `exoPilotService.js`,
`woundUtils.js` + tests) ; `eslint` client 0 erreur ; JSON `combat.json` valide ; `vite build`
propre. Suite DB complète (155/155, dont les 6+4 nouveaux tests L5) déjà verte depuis le
2026-09-12 (non relancée cette session, aucun fichier serveur modifié depuis). **Validé jeu réel**
PJ + PNJ (ci-dessus).
**Non testé** : L6 (`<ChanceSpendButton>`, UI générique + fenêtre narrative) — non commencé,
canal de notification narrative à identifier au moment du lot (`PLAN_CHANCE.md` §8).
**Données** : aucune migration (réutilise `pending_chance_choices`).
**Retour arrière** : `git revert` du commit.

---

## Session (Dev) — 2026-09-15 — Décision RAW assumée : ciblage IEM sur un personnage porteur de plusieurs objets électroniques (chantier Informatique, `PLAN_INFORMATIQUE.md` Lot 2)

**Contexte** : en cadrant le déclencheur de Test de panne par IEM (Lot 2), la RAW précise le
ciblage pour un ordinateur seul (un appareil, singulier) et pour une exo-armure (`REGLEARMURE.md`,
« Attaque IEM » : tirage entre 4 catégories — Exosquelette/Générateur/Systèmes auxiliaires en
bloc/Armement). Elle ne dit rien du cas d'un personnage qui porte, hors exo-armure, plusieurs objets
électroniques distincts en même temps (ordinateur personnel + arme à accessoire électronique +
contrôleur de drone…).

**Recherche menée avant de trancher** : le mot « accessoire » cherché dans toutes les règles RAW
disponibles (armure, munitions, drones, compétences) — aucune occurrence traitant un accessoire
d'arme comme une cible électronique distincte de l'arme elle-même. Même le détail RAW de la
catégorie Armement d'une exo-armure ne touche jamais qu'« un seul et unique système d'attaque ou de
défense » — jamais « l'arme ou un accessoire ». Confirmé : ce cas n'a pas de réponse RAW.

**Décision retenue (Saar, validée après cette vérification)** : tirage au hasard équipondéré parmi
les objets `is_electronic=true` réellement portés par le personnage au moment du hit. Cohérent avec
le principe « déterminé au hasard » que la RAW applique systématiquement dans les cas voisins
(exo-armure, incidents d'Avarie), mais ce n'est **pas** une règle RAW retrouvée — extension assumée,
pas un raccourci silencieux (AGENTS.md invariant 5).

**Non fait, volontairement** : aucun code, aucune migration. Cette entrée journalise la décision de
règle ; l'implémentation (fonction de tirage, primitive d'énumération `char_inventory` filtrée
`is_electronic=true`) reste à faire au Lot 2, cf. `docs/PLANS/PLAN_INFORMATIQUE.md` §4.
**Testé** : n/a (documentation uniquement).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Dev) — 2026-09-15 — Décisions RAW assumées : Survie I.E.M. et pilote humain, exo-armure vs drone (chantier Informatique, `MANUEL_INFORMATIQUE.md` §4.7/§6, `PLAN_INFORMATIQUE.md` Lot 3b)

**Contexte** : la séquence RAW de Survie I.E.M. (`REGLEDRONE.md`) décrit un robot/androïde
**autonome** qui s'immobilise puis retente seul son redémarrage. Le même texte confirme que le
dispositif « peut équiper des exo-armures ou les systèmes d'un véhicule », sans préciser ce que
devient un humain aux commandes pendant cette fenêtre — question restée `[INCONNU]` au §6 du MANUEL
depuis la correction du même jour (séquence complète en 4 étapes).

**Décision 1 (exo-armure portée)** : le pilote est **entièrement gelé** pendant toute
l'immobilisation — aucune action de combat possible via l'exo-armure. Justification : contrairement
à un opérateur de drone (décision 2), le pilote d'une exo-armure est fusionné au dispositif, sans
« ailleurs » où se replier — il n'a mécaniquement rien d'autre à faire que ce que fait l'armure
elle-même. Seule option laissée : sortir de l'armure, un geste **purement narratif**, sans action de
jeu ni conséquence mécanique associée (aucune mécanique de ce type n'existe dans le projet à ce
jour — pas un oubli, une absence de besoin identifié).

**Décision 2 (drone téléopéré)** : l'opérateur n'est **jamais gelé** — il n'est jamais fusionné à la
machine immobilisée, il continue de jouer son propre Tour normalement (son jet de Télépilotage ce
Tour-là n'a simplement aucun effet, le drone restant hors service). Décision de jeu associée, elle
aussi RAW-silencieuse (`docs/REGLES/REGLEDRONE.md` pose la Télépilotage comme une Compétence
limitative sur le niveau des programmes du drone, jamais comme une règle de coût d'action) :
piloter activement un drone consomme l'action du Tour de l'opérateur, qui peut néanmoins se
déplacer lui-même ce Tour-là contre le même malus qu'un Tireur en mouvement — extension par analogie
de `shared/combatSituationMods.js#RANGED_SITUATION_MODS.tireur_allure_*`, vérifié strictement
réservé au Tir dans le code actuel (la table CaC équivalente, `CAC_SITUATION_MODS`, n'a aucune
entrée d'allure).

**Non fait, volontairement** : aucun code, aucune migration. La Décision 1 est directement
consommée par le Lot 3b (`PLAN_INFORMATIQUE.md`, blocage de déclaration à câbler sur le token de
l'exo, même famille que `isTestBlockingWound`/`shared/woundConstants.js`). La Décision 2 ne
déclenche aucun travail pour ce chantier (Survie I.E.M. reste hors périmètre pour les drones,
`PLAN_INFORMATIQUE.md` §4 Lot 3 « [À TRANCHER] ») — elle ne fait que lever le doute qui aurait
bloqué une extension future ; la mécanisation de la Compétence Télépilotage elle-même est un
chantier séparé, non commencé, non cadré.
**Testé** : n/a (documentation uniquement).
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit.

## Session (Dev) — 2026-09-15 — Fix : retrait du modificateur de taille en AOE (D7, `PLAN_TAILLE.md`), chantier Taille CLOS

Dernier point ouvert du chantier Taille (§`ROADMAP.md` — « D7 uniquement »). Décision déjà actée
(ci-dessus, session M1→M5, et `PLAN_TAILLE.md` D7) : un jet unique pour tout le cône/gerbe est
incompatible avec un modificateur de taille par cible, une zone n'étant de toute façon pas un tir
ajusté au sens RAW p.218 — aligné sur la décision grenades (« pas de modificateur de taille pour une
zone visée »). Différé jusqu'ici uniquement parce que `socketCombatAoe.js` était encore édité en
parallèle par le chantier grenades ; ce chantier est gelé depuis le 2026-09-09, plus aucune collision.

**Fait** : `server/src/socket/socketCombatAoe.js#runAoePhaseA` — retrait des deux lectures de
`confirmedModifiers.taille` (le calcul du modificateur et la contribution poussée dans le jet de
Phase A). Le champ `confirmedModifiers.taille` reste lu normalement par les 5 sites de résolution à
cible unique (`socketCombatHelpers.js`/`socketCombatExo.js`, inchangés) — seul le tronc AOE l'ignore
désormais. `TAILLE_MODS` (import `shared/combatSituationMods.js`) et `TAILLE_LABELS` (import
`socketCombatHelpers.js`) retirés des imports du fichier, devenus morts après le retrait (aucun autre
usage dans ce module, vérifié par grep).

Chantier Taille de cible entièrement clos (S1→S4 + D7). `docs/PLANS/PLAN_TAILLE.md` archivé vers
`docs/Old/` (Règle 10, `RegleDocumentaire.md` — doc durable déjà dans `docs/SYSTEME/TAILLE.md` depuis
S1) ; retiré de `docs/SYSTEME/INDEX.md` §6 (PLANS actifs) et de `docs/ROADMAP.md` §1.

**Testé** : `node --check server/src/socket/socketCombatAoe.js` ; `node --test 'shared/**/*.test.mjs'`
→ 587/587 (aucune régression, ce module n'a pas de test unitaire pur touchant `TAILLE_MODS`/AOE —
`socketCombatAoe.test.mjs` ne référence pas `taille`, vérifié par grep avant modification).
**Non testé** : scénario réel (tir de zone en jeu, vérifier l'absence de ligne « Taille » dans le
breakdown du jet) — à la charge de Saar, pas rejouable sans base/serveur démarré.
**Données** : aucune migration.
**Retour arrière** : commit isolé sur `dev/Saar`, `git revert` suffit (additif inverse trivial — les
deux lignes retirées + les deux imports).

## Session (Dev) — 2026-09-16 — Rangement catalogue 3D builtin + premier contenu réel du moteur d'entités interactives (caisses/coffres)

Déclencheur Saar : avant de câbler des entités interactives, ranger `output/` (mélange FR/EN,
doublons accent/non-accent, artefacts Blender committés, chemins absolus morts). Deux chantiers
séquentiels, plans détaillés dans `docs/Old/PLAN_ASSETS_3D_BUILTIN.md` et
`docs/Old/PLAN_CAISSES_INTERACTIVES.md` (archivés après clôture, Règle 10).

**Fait — rangement (`a1581ec`)** : 72 GLB renommés vers leur slug ASCII stable (`asset.name`,
déjà validé par `tools/validate-3d-manifest.mjs`), `catalog_file`/`glb` retirés (fallback natif
suffit). 27 fichiers pipeline (`.blend`, preview/diagnostic, `README.md`, `validation.json`) + 7
GLB combinés déplacés vers `docs/AssetsSource/<pack>/`. **17 fichiers non catalogués mis en
quarantaine** `docs/AssetsSource/<pack>/non-catalogues/` — vérifiés par taille+hash contre leur
homologue référencé (tous différents : ce sont de vrais modèles distincts, pas des doublons),
donc jamais supprimés, jamais encore revus par Saar. Racine `output/` et noms de dossier de pack
inchangés (identifiants stables `builtin_key`, documentés et outillés — un renommage aurait
cassé la doc et le validateur sans bénéfice réel). Doc de fabrication mise à jour en conséquence
(`a7d405c` : `docs/SYSTEME/CREATION_OBJETS_3D.md`, `MANIFESTE_OBJETS_3D.example.json`).

**Fait — caisses interactives (`eece01e`)** : les 10 assets de `futuristic_crates_chests`
déclarent désormais `states` (fermé/ouvert, `visual_override.animationProgress` 0|1) et
`interactions` (Ouvrir/Fermer, `required_state_ids`, sans compétence — action directe).
`builtinModelCatalog.js` propage `states`/`interactions` du manifest vers `entity_blueprints`
(`readBuiltinModels()` + `syncBuiltinModels()` insert et merge — jusque-là toujours écrasés à
`[]` pour tout modèle intégré, quel que soit le manifest ; bloqueur d'autorisation identifié en
route : `created_by: null` empêche toute édition via l'Atelier, d'où le choix manifest-only).
`EntityMesh.jsx` lit le premier clip d'animation du GLB (`animations[0]`, un seul par asset) et
interpole vers la progression cible de l'état courant (refs impératives, pas de mutation d'une
valeur `useMemo` — règle de lint react-compiler). Portée volontairement limitée : pas de verrou
électronique (`docs/REGLES/REGLE_SERRURE.md`, dépend du chantier Informatique en cours), pas de
Test de compétence à l'ouverture.

**Incidents de mise au point réels** (détail complet dans le plan archivé) : (1) manifest
resynchronisé en base seulement via redémarrage serveur ou bouton « Rafraîchir » de l'éditeur —
pas automatique, a cassé l'éditeur le temps du premier test ; (2) interaction manquant
`required_state_ids` (champ que je ne connaissais pas, garanti par l'Atelier mais absent d'un
manifest écrit à la main) → clic sans effet en jeu, crash silencieux dans `SessionPage.jsx` ;
(3) régression introduite en corrigeant l'animation elle-même : `mixer.setTime()` sur une action
en pause ne fait jamais avancer le temps (le flag `paused` force le delta à 0) — repassé sur
`action.time = X` direct + `mixer.update(0)`.

**Trouvaille non traitée dans ce chantier** : les 8 GLB de `futuristic_doors` ont déjà des clips
d'animation nommés (contrairement aux caisses, un seul clip générique) — mais les portes sont des
connecteurs (`surface_data.connectors`), pas des `entity_blueprints`, et certaines ont plusieurs
clips à synchroniser (coulissantes, porte triangulaire). Pas un copier-coller du contrôleur
caisses. Noté dans `docs/ROADMAP.md` §2, aucun ticket ouvert (vérifié `bug_tickets`).

**Testé** : `tools/validate-3d-manifest.mjs` sur les 7 packs (0 erreur) ; `node --check` sur les
fichiers serveur modifiés ; lint client ciblé (0 erreur) ; ouverture/fermeture d'une caisse en
session réelle par Saar, y compris le menu radial hors éditeur.
**Non testé** : les 17 fichiers en quarantaine (aucune décision prise) ; les 62 autres assets
builtin sans états/interactions (aucune régression attendue, `states` reste `[]` pour eux, non
revérifié en jeu au-delà de la validation du validateur).
**Données** : aucune migration. `entity_blueprints.states`/`.interactions` des 10 blueprints
caisses/coffres se remplissent au prochain `syncBuiltinModels()` (redémarrage ou rafraîchissement
éditeur), sans effet sur les autres lignes.
**Retour arrière** : deux commits isolés sur `dev/Saar` (`a7d405c`, `eece01e`), `git revert`
suffit pour chacun indépendamment. Non poussé.

## Session (Dev) — 2026-09-16 — Informatique Lot 2bis : ciblage IEM sur exo-armure

Suite du Lot 2 (déclencheur IEM PJ/PNJ, validé jeu réel la même session). Lot 3b (Survie I.E.M.)
ne peut jamais se déclencher sans un chemin IEM touchant une exo-armure — ce lot comble ce
chaînon. Corrige en cours de route une erreur du PLAN lui-même (`exo_systems`/`exo_weapons`
avaient bien des colonnes d'Intégrité depuis longtemps, migrations 44/45, juste jamais branchées
à un Test de panne — pas le schéma absent qu'affirmait le document).

**Décisions maison (RAW non chiffrée pour ce cas précis, `REGLEARMURE.md:434-441` dit juste
« déterminé au hasard »)**, tranchées avec Saar avant de coder :
- **Tirage entre les 4 catégories (Exosquelette/Générateur/Systèmes auxiliaires/Armement) :
  équipondéré (1/4 chacune).** Option écartée : reprendre les poids relatifs de la table 1D10 de
  l'incident générique de dommages (2:1:2:2/7, en ignorant Structure/Pilote) — extrapolation, pas
  une citation RAW, alors que le texte dit littéralement « hasard » sans pondération.
- **Exosquelette et Générateur reçoivent aussi un `malfunction_severity`** (état de panne
  persistant jusqu'à réparation), symétrique aux 2 autres catégories — la RAW dit uniformément
  « soumis à un Test de panne » pour les 4, donc la même mécanique complète s'applique aux 4.

**Trouvaille en écrivant les tests** (avant tout code de production touché par cette trouvaille) :
`exo_sheet.itg_exosquelette_current`/`itg_generator_current` sont `NOT NULL` (défaut 20,
migration 44) — Exosquelette et Générateur sont des composants **obligatoires** de toute
exo-armure, jamais un dispositif optionnel réglé à la main comme un ordinateur. Les adaptateurs
`EXO_EXOSQUELETTE_ADAPTER`/`EXO_GENERATOR_ADAPTER` n'ont donc aucune branche `eligible:false`
(toujours éligibles si la ligne existe), contrairement aux 3 autres adaptateurs de ce lot
(`EXO_COMPUTER_ADAPTER`/`EXO_SYSTEM_ADAPTER`/`EXO_WEAPON_ADAPTER`, dispositifs facultatifs).

**Gap satellite trouvé, non traité (hors périmètre)** : un exo-armure/drone **tireur** ne peut
charger aucune munition typée aujourd'hui, IEM ou autre — `exo_weapons.ammo_remaining` n'est
qu'un compteur de coups, `finalizeAssaultOutcome`/`resolveExoAssaultAction`
(`socketCombatExo.js`) ne portent aucun `ammoFx`. Manque d'infrastructure Exo-armures plus large
que l'IEM seul, jamais construit, pas propre à ce chantier — noté dans `PLAN_INFORMATIQUE.md` §4
Lot 2bis, aucun ticket ouvert (pas un bug, une capacité jamais construite).

**Code** : migrations 350/351/352 (`malfunction_severity` sur `exo_systems`/`exo_weapons`/
`exo_sheet`) ; 4 adaptateurs Repository dans `integrityService.js` ; `runIemPanneTrigger`
(`socketCombatHelpers.js`) élargi via `runIemPanneTriggerExo` — routé aux 2 sites qui portaient
déjà `cibleType === 'exo'` (`resolveDamageConfirmExoTarget`, `resolveAssaultHitPnjNormal`), en
plus du routage `exoAvarieService.resolveExoDamage` existant (dualité dégâts+panne, même principe
que le ciblage PJ/PNJ). Détail complet dans `PLAN_INFORMATIQUE.md` §4 Lot 2bis (Règle 10 — pas
recopié ici).

**Testé** : `integrityService.test.mjs` étendu (4 nouveaux adaptateurs), 33/33 verts
(`node --env-file=../.env --test server/src/services/integrityService.test.mjs`) ; `node --check`
sur tous les fichiers modifiés ; migrations vérifiées en base après application (auto par
`nodemon`, colonnes/contraintes conformes aux fichiers).
**Non testé : ⚠️ clos partiel** — le dispatch socket (tirage de catégorie, boucle Systèmes
auxiliaires, dualité dégâts+panne aux 2 sites) n'a aucun test automatisé (aucun test n'existe pour
`socketCombatHelpers.js` dans le projet) et n'a pas encore été rejoué en combat réel par Saar.
**Données** : migrations 350/351/352, additives pures, auto-appliquées par `nodemon` en cours de
session (piège connu, sans casse). `down()` retire les colonnes ajoutées, pas de perte de données
préexistante (colonnes neuves, jamais peuplées avant ce lot).
**Retour arrière** : un seul commit à prévoir sur `dev/Saar` une fois validé en jeu ; `git revert`
suffit (additif pur, aucune modification de comportement existant pour les cibles PJ/PNJ/décor ou
pour le routage exo non-IEM). Non committé à ce stade — en attente de validation Saar.

## Session (Dev) — 2026-09-16 — Entités interactives Lot A1 : 6 fichiers en quarantaine `futuristic_crates_chests`

Suite du chantier caisses/coffres (`docs/Old/PLAN_CAISSES_INTERACTIVES.md`, entrée ci-dessus) —
`PLANS/PLAN_ENTITES_INTERACTIVES_ROADMAP.md` Lot A1. Décision Saar : les 5 premiers fichiers
rejoignent le catalogue avec le même patron ouverture/fermeture déjà validé (assets 11-15) ; le 6e
(« Lot de caisses assorties », 9 sous-caisses assemblées dans un seul GLB) reste **purement
décoratif** — pas de `states`/`interactions`, pas déplaçable (patron déjà existant pour du décor
sans interaction : `output/futuristic_furniture/manifest.json`).

Zéro changement de code — `builtinModelCatalog.js` lit déjà `states`/`interactions` du manifest
de façon générique depuis le chantier caisses/coffres, aucune adaptation nécessaire pour ce lot.
Uniquement du contenu : `git mv` des 6 GLB (accentués/espacés) vers `output/futuristic_crates_chests/
glb/` sous slug ASCII stable, + 6 entrées ajoutées à `manifest.json`.

**Vérifications faites avant d'écrire une seule ligne** (consigne explicite de Saar : zéro
approximation, zéro découverte en cours de code) :
- dimensions mesurées par bounding box réelle (parsing des accessors glTF + matrices de
  transformation des nœuds), pas estimées ;
- matériaux de `color_slots` copiés depuis la liste réelle des matériaux du GLB, puis
  recontrôlés après déplacement (script dédié, 0 écart sur les 6 fichiers) ;
- convention « temps 0 du clip = fermé » vérifiée canal par canal (comparaison valeur au premier
  keyframe vs transform de base du nœud) pour les 6 fichiers, plutôt que supposée héritée des 10
  premiers assets ;
- absence de doublon avec le catalogue existant reconfirmée par comparaison de taille de fichier
  (les 6 partagent parfois le même nom de scène Blender/`ROOT_XX` que des assets déjà catalogués —
  ex. `ROOT_06_chest_compact_lockbox` — mais taille distincte à chaque fois : variantes de design
  proches, pas des doublons) ;
- champs dépréciés (`animation`, `animation_frame_closed/open`) explicitement non reconduits sur
  le contenu neuf (`docs/SYSTEME/CREATION_OBJETS_3D.md`, note du 2026-09-16) ; aucun champ
  numérique non vérifiable (ex. `capacity_liters`) inventé pour les nouvelles entrées.

**Testé** : `node tools/validate-3d-manifest.mjs output/futuristic_crates_chests/manifest.json`
(0 erreur, 16 avertissements — le même avertissement stylistique préexistant sur les 10 entrées
d'origine, rien de nouveau) ; `node --check server/src/lib/builtinModelCatalog.js` ; JSON du
manifest reparsé sans erreur ; script de contrôle croisé matériaux déclarés ↔ matériaux réels du
GLB déplacé (0 écart sur les 6).
**Non testé : ⚠️ clos partiel** — refresh du catalogue par Saar (redémarrage serveur ou bouton
« Rafraîchir » de l'éditeur) puis test réel : poser/ouvrir/fermer les 5 nouvelles caisses/coffres,
vérifier que le lot décoratif n'affiche aucune option d'interaction.
**Données** : aucune migration. `entity_blueprints` recevra 6 nouvelles lignes (`builtin_key`
`futuristic_crates_chests/11_...` à `.../16_...`) au prochain `syncBuiltinModels()`, sans effet sur
les lignes existantes.
**Retour arrière** : un seul commit à prévoir (déplacements + manifest), `git revert` suffit
(additif pur). Non committé à ce stade — en attente de confirmation de Saar après test réel.

## Session (Dev) — 2026-09-16 — Informatique Lot 3b (Survie I.E.M.) — décision maison en cours de route

Chantier en cours (pas encore clos, pas encore committé) — décision maison isolée, journalisée
immédiatement plutôt qu'en fin de lot (précédent de fin de session déjà tenu pour le Lot 2bis, mais
mieux vaut ne pas attendre pour celle-ci).

**Taille du dé du jet de séquelle (MANUEL_INFORMATIQUE.md §4.7 étape 3, `REGLEDRONE.md:638`)** :
RAW dit littéralement « en lançant 1 dé » sans préciser sa taille — seule la parité (pair/impair)
compte pour le résultat, RAW confirmé mot à mot, aucune taille n'est donnée nulle part dans le
texte source. **Décision : 1D6**, dé générique le plus courant du reste de la RAW Polaris — la
taille n'a aucun effet sur le résultat mécanique (parité seule), seulement sur l'affichage du jet
dans le chat. `server/src/lib/iemSurvivalService.js#resolveIemSurvivalTicks`.

## Session (Dev) — 2026-09-16 — Informatique Lot 3b (Survie I.E.M.) — clôture code

Suite immédiate du Lot 2bis (même session). Avant de coder, Saar a explicitement demandé une
analyse critique plutôt qu'un « je suis sûr » de principe (« Sur de toi à 100% ou analyse
critique avant de coder ? On a le temps »). Bonne décision : l'analyse a trouvé une vraie faille
avant tout code.

**Faille trouvée en stress-testant le plan (pas en l'écrivant)** : `token_statuses` a
`UNIQUE(token_id, status_code)` — une seule ligne `iem_survival` possible par token. Une exo peut
porter 2 ordinateurs (principal + secours). Le plan initial proposait les deux comme candidats du
tirage « Systèmes auxiliaires » — deux immobilisations indépendantes sur le même token se
seraient donc écrasées silencieusement (`applyModStatus` fait `.onConflict().merge()` sans
condition). **Fix, touche le Lot 2bis déjà livré** : seul l'ordinateur **actif**
(`resolveActiveComputer`) est candidat, jamais les deux — un secours inactif n'est de toute façon
pas « en service » au sens où la Survie I.E.M. aurait un sens à s'y déclencher. Corrige aussi, au
passage, une trouvaille distincte : `runIemPanneTriggerExo` (Lot 2bis) ne pouvait auparavant
JAMAIS atteindre `exo_computers` du tout (aucune de ses 4 branches ne l'incluait) — la Survie
I.E.M. n'avait donc aucun chemin de déclenchement réel avant ce fix, malgré tout le Lot 3b déjà
écrit autour.

**Code** (7 fichiers, un par un avec vérification syntaxe/tests à chaque étape, aucune pause
demandée à Saar — code serveur dense, patron « je suis sûr » de
`feedback-segment-by-file` déjà validé) :
- Migration 353 — `exo_computers.sequelle_malus` (NOT NULL DEFAULT 0, cumulatif, jamais effacé).
- `server/src/lib/iemSurvivalService.js` (nouveau) — `exposeToIemSurvival`/`resolveIemSurvivalTicks`,
  même patron qu'`environmentalHazardService.js` (pose+tick d'un domaine dans un seul fichier),
  jamais dans `integrityService.js` qui n'émet aucun événement par contrat documenté.
- `socketCombatHelpers.js` — pool `systemes_auxiliaires` fusionné (`exo_systems` + ordinateur
  actif), `runIemPanneTrigger`/`runIemPanneTriggerExo`/`runExoCategoryPanneTest` étendus
  (`io`/`campaignId`/`tokenId`, `res` retourné) pour pouvoir appeler `exposeToIemSurvival` sur un
  échec de Test de panne de l'ordinateur. **Bug attrapé en vérifiant le mapping tokenId/
  targetTokenId avant d'écrire l'appel** (pas après) : dans `resolveDamageConfirmExoTarget`,
  `tokenId` du `ctx` désigne l'ATTAQUANT, pas la cible — `targetTokenId` était le bon champ.
- `combatTurnEngine.js` — tick `resolveIemSurvivalTicks` juste après la boucle des dangers
  environnementaux dans `startResolutionPhase`, même jointure `combat_roster`.
- `activeMalusRegistry.js` — 4ᵉ source `iemSurvival`.
- `combatantContextService.js` — `resolveHumanoidTestContext`/`resolveExoTestContext` étendus de
  façon purement additive (aucun appelant existant modifié, 41/41 tests préexistants toujours verts).
- `socketCombatAnnouncement.js` — garde de blocage totale (aucune exception, contrairement au
  stun guard/à la garde blessure mortelle voisins) sur le token d'une exo tant que `iem_survival`
  est active — décision Saar 2026-09-15 (« entièrement gelé »).

**Dette i18n pré-existante suivie sciemment, pas corrigée** : `COMBAT_DECLARE_ERROR` (mécanisme
utilisé par la nouvelle garde) envoie du texte FR figé, pas un `i18nKey` — dette systémique de tout
ce fichier (stun guard, garde blessure mortelle idem), pas quelque chose que ce lot a introduit ni
à corriger isolément ici (chantier séparé, plus large).

**Testé** : `iemSurvivalService.test.mjs` (nouveau, 11 tests) + `activeMalusRegistry.test.mjs`
étendu + non-régression `combatantContextService.test.mjs`/`integrityService.test.mjs`/
`combatTurnEngine.test.mjs` — 112/112 verts au total. `node --check` sur les 9 fichiers touchés.
**Non testé : ⚠️ clos partiel** — le dispatch socket bout en bout (pas de test pour
`socketCombatHelpers.js`/`socketCombatAnnouncement.js` dans ce projet) et la garde de blocage en
combat réel : validation Saar à venir avant tout commit.
**Données** : migration 353, additive pure.
**Retour arrière** : rien committé à ce stade (en attente de validation jeu réel), un seul commit
prévu une fois validé.

**Complément UI trouvé nécessaire pour tester** : la route serveur `survie_iem_max`/
`survie_iem_current` existait déjà (Lot 3a, avant cette session) mais `ExoComputerPanel.jsx`
n'avait jamais reçu de champ pour l'éditer — sans lui, le dispositif restait inatteignable en jeu
normal (aucun script ponctuel accepté, décision explicite Saar : « solution technique la plus
robuste, pérenne et adaptative »). Ajouté en suivant exactement le patron déjà en place pour
Blindage IEM/Intégrité (même fonction `field()`, même style, `PUT /:characterId/exo/computers/:id`
déjà prêt à recevoir ces deux champs) — nouvelle clé i18n `exo.computerSurvieIem`
(`client/src/locales/fr.json`). Lint client ciblé propre.

## Session (Dev) — 2026-09-16 — Éditeur d'entités : durcissement (pose répétée, empilement, rotation, ménage)

Suite de l'audit du monde de l'éditeur déclenché par une remarque de Saar sur la qualité UX de
l'outil (repoussé à quatre fils distincts : éditeur d'entités, UI/UX des panneaux, forme des
salles, décorations murales — seul le premier est traité ici). **Nom de commit trompeur** : les 5
commits de ce fil portent le message "Lot A" par réutilisation abusive du nom de
`PLANS/PLAN_ENTITES_INTERACTIVES_ROADMAP.md` — **ce n'est pas le même Lot A** que celui du plan
(quarantaine `futuristic_crates_chests` + preuve `move_type`, toujours ouvert par ailleurs). Cinq
points fermés dans `Editor3D.jsx`/`SessionPage.jsx`, chacun validé en jeu réel par Saar avant
commit (`7d6600d`, `357adab`, `ff4c856`, `1d04a54` + le commit de ce point 5) :

1. **Pose répétée** — le blueprint actif restait désélectionné après chaque pose
   (`onBlueprintPlaced`), obligeant à recliquer la palette à chaque exemplaire. Retiré ; Échap
   annule explicitement (garde champ-texte ajoutée, absente ailleurs dans ce fichier).
2. **Empilement** — `calcPreciseEntityPos` ne regardait que le sol/voxel pour la hauteur de pose,
   jamais les entités déjà posées. Nouvelle table `entityTopSupportsByCell` (même patron que
   `columnTops`/`displayedFloorSupports`, footprint ajusté rotation+échelle, entité en cours de
   déplacement exclue). Patron pro confirmé (Unity/Unreal : raycast vers le bas, sol ou objet sans
   distinction). **Bug de granularité trouvé en jeu réel après la première validation** : la
   recherche tournait sur la case entière, pas la case fine (`SURFACE_FINE`) du placement lui-même
   — déclenchait l'empilement jusqu'à ~1 unité du bord réel d'un objet. Corrigé pour aligner les
   deux précisions.
3. **Priorité rotation (touche R)** — le handler vérifiait toujours en premier une entité sous le
   curseur, même pendant une pose active : si le curseur survolait par hasard un élément existant,
   R le tournait au lieu du fantôme. Confirmé par les logs de Saar (3 rotations successives sur la
   même entité déjà posée). Priorité inversée : une pose en cours capte toujours R.
4. **Ménage** — `EntityEditor.jsx` (325 lignes, jamais importé nulle part, reste de la fusion
   Kiwi) supprimé. Confirmé sans risque (`npm run build`/`npm run lint` sans erreur de résolution).
5. **Snap grille (touche G, toggle)** — mode optionnel (défaut off) qui aimante la pose au sol sur
   le centre de la grande case visible au lieu du quart de case habituel ; highlight vert de la
   case ciblée sous le fantôme (seule affordance, pas de bouton toolbar — cohérent avec le reste du
   fichier). Portée limitée au sol, les objets muraux gardent leur snap fin.

**Testé** : `eslint` ciblé + `npm run build` complet après chaque point (0 erreur à chaque fois),
et validation en jeu réel par Saar avant chaque commit.
**Non testé** : rien en suspens — chaque point a été validé avant de passer au suivant.
**Données** : aucune migration sur ce fil.
**Retour arrière** : 5 commits atomiques sur `dev/Saar` (un par point), chacun `git revert`-able
indépendamment. Non poussé à ce stade.

**Idée notée pour plus tard, non actionnée** (Saar) : un mode rotation miroir pourrait être
pertinent en complément de la rotation par quart de tour — non urgent, rien cadré, juste consigné
ici pour ne pas la perdre.

## Session (Dev) — 2026-09-16 — Lot A1 : quarantaine `futuristic_crates_chests` cataloguée, clos

Suite de `PLANS/PLAN_ENTITES_INTERACTIVES_ROADMAP.md` (Lot A). Consigne explicite de Saar avant
tout code : « Go A1 si et seulement si tu es sûr à 100%. Pas de zone d'ombre, pas d'approximation,
pas de découverte en cours de code. » Les 6 fichiers en quarantaine du pack (issus du rangement
`docs/PLANS/PLAN_ASSETS_3D_BUILTIN.md`, jamais revus depuis) triés un par un :

- **5 fichiers catalogués avec le patron ouverture/fermeture déjà validé** (chantier caisses
  interactives, `docs/Old/PLAN_CAISSES_INTERACTIVES.md`) : `11_crate_shallow_dual_bifold_bin`,
  `12_crate_deep_dual_gullwing_maglock`, `13_chest_compact_riveted_lockbox`,
  `14_chest_domed_tool_case`, `15_chest_long_dual_gullwing_trunk`. Dimensions mesurées sur la
  bounding box réelle du GLB (pas d'estimation), matériaux vérifiés un par un contre le GLB déplacé
  (`color_slots`), convention « premier keyframe = fermé » confirmée canal d'animation par canal
  d'animation pour chacun des 5 — zéro donnée du manifest devinée.
- **1 fichier laissé purement décoratif** (décision produit de Saar) : `16_crate_pack_tarped_stack_decor`
  (« Lot de caisses assorties », plusieurs sous-caisses assemblées dans un seul GLB, pas de
  découpage propre en sous-objets ouvrables) — aucun `states`/`interactions`, non déplaçable.
- **Zéro changement de code** : `builtinModelCatalog.js` lisait déjà `states`/`interactions` du
  manifest de façon générique depuis le chantier caisses interactives ; seul du contenu manifest a
  été ajouté. `node tools/validate-3d-manifest.mjs` : 0 erreur.
- Fichiers déplacés/renommés par `git mv` (slug ASCII stable) de
  `docs/AssetsSource/futuristic_crates_chests/non-catalogues/` vers
  `output/futuristic_crates_chests/glb/`.

**Testé** : `node tools/validate-3d-manifest.mjs` (0 erreur) avant validation en jeu ; puis
validation en jeu réel par Saar après redémarrage serveur (`syncBuiltinModels()`) — les 5 caisses
posées, ouvertes, fermées sans anomalie ; le lot décoratif confirmé sans option d'interaction.
**Non testé** : rien en suspens sur ce lot.
**Données** : aucune migration — contenu manifest uniquement, `builtinModelCatalog.js` resynchronise
les `entity_blueprints` builtin au démarrage serveur (mécanisme déjà existant, pas nouveau).
**Retour arrière** : un seul commit, `git revert` direct si besoin.

**Reste ouvert** (hors périmètre de ce lot) : 11 fichiers en quarantaine restants
(`futuristic_kitchen` 9, `futuristic_hydroponics` 2 — Lot B, décision produit à prendre d'abord) ;
Lot A2 (preuve `move_type`, aucun code, juste un blueprint de test à créer via l'Atelier et tester
en jeu) ; verrou électronique (après le chantier Informatique) ; push de ce commit et des
précédents vers `dev/Saar` toujours en attente.

## Session (Dev) — 2026-09-16 — Informatique Lot 4 : auto-désactivation Gestion systèmes, clos

Suite de `PLANS/PLAN_INFORMATIQUE.md` §4 Lot 4 — dernier lot du chantier Informatique. Plan présenté
avant code (fichiers, invariants, hors périmètre) ; une question ouverte tranchée par Saar avant
d'écrire la première ligne : un système déjà auto-déconnecté par manque de capacité "Gestion
systèmes" doit-il rester une cible valide du tirage IEM (Lot 2bis) ? Réponse : « hors service, rien
à griller » — exclu du tirage.

**Correction trouvée avant code** : le plan précédent citait un patron de réordonnancement par
drag&drop « déjà existant » dans `InventoryPanel.jsx`/`ContainerPanel.jsx`/`WeaponPanel.jsx` —
vérification directe : faux. Ces fichiers utilisent `@dnd-kit/core` uniquement pour déplacer un objet
entre conteneurs, jamais pour réordonner une liste via `sort_order`, et `@dnd-kit/sortable` n'est
même pas une dépendance installée. Décision (déléguée par Saar, tranchée sur le critère
d'aggradation — testable/robuste/pérenne, jamais le confort) : boutons ↑/↓ plutôt qu'un drag&drop
complet à écrire de zéro pour un besoin qu'aucune autre liste du projet n'a aujourd'hui.

- `shared/exoSystemsCapacity.js` (nouveau, pur) — `selectDisconnectedSystems` : partitionne les
  systèmes d'une exo-armure selon la capacité de l'ordinateur actif, RAW = un compte de systèmes
  (jamais une somme pondérée, contrairement au Potentiel). 8/8 tests.
- `char-sheet.js` GET `/exo/systems` enrichit chaque système avec `disconnected`, calculé à la volée
  (jamais stocké — un basculement principal/secours doit se refléter immédiatement).
- `socketCombatHelpers.js` — le pool IEM "Systèmes auxiliaires" (Lot 2bis/3b) exclut les systèmes
  déconnectés avant tirage ; l'ordinateur actif reste toujours candidat.
- `ExoSystemsPanel.jsx` — badge « Déconnecté » + boutons ↑/↓ qui renumérotent toute la liste
  (0..N-1) plutôt qu'échanger deux `sort_order`, tous à 0 par défaut à la création.

**Testé** : `node --check` (2 fichiers serveur), `npx eslint` (composant client), validation JSON
(`fr.json`), 8/8 `exoSystemsCapacity.test.mjs` + non-régression `computerStats.test.mjs` (24/24) ;
validation en jeu réel par Saar (« Fonctionnel »).
**Non testé** : rien en suspens sur ce lot.
**Données** : aucune migration — tout calculé à la volée.
**Retour arrière** : un seul commit, `git revert` direct si besoin.

**Chantier Informatique** : Lot 1/2/2bis/4 validés jeu réel. Lot 3b codé, testé (trace de code sur
le chemin RNG à faible probabilité, accepté par Saar en lieu d'une observation en direct), pas
encore observé de bout en bout en jeu réel — seul point encore ouvert avant clôture complète du
chantier.

## Session (Dev) — 2026-09-16 — Lot A2 : interaction de déplacement sur les 15 caisses/coffres, incident et durcissement

Suite de `PLANS/PLAN_ENTITES_INTERACTIVES_ROADMAP.md` Lot A2 (preuve `move_type`). Décision Saar :
appliquer directement sur les 15 caisses/coffres déjà cataloguées (les 10 initiales + les 5 d'A1),
pas un blueprint de test jetable — le lot décoratif (`16_crate_pack_tarped_stack_decor`) reste exclu,
décision A1 confirmée.

**Incident (trouvé par Saar en testant, pas par moi)** : l'entrée manifest ajoutée pour "Déplacer"
omettait `required_state_ids`. Deux sites de lecture identiques dans `SessionPage.jsx`
(`handleEntityClick` et le rendu du `RadialMenu`) appellent `i.required_state_ids.includes(...)`
sans garde — `undefined.includes()` levait une exception à chaque clic sur une des 15 caisses,
pour le MJ et le joueur, en combat comme hors combat. `docs/SYSTEME/CREATION_OBJETS_3D.md`
avertissait déjà explicitement de ce piège exact (ligne ajoutée lors du chantier caisses
interactives précédent) — non relu avant d'écrire l'entrée manifest, malgré la consigne de
vigilance maximale de Saar sur ce lot.

**Saar a explicitement demandé une analyse à charge du correctif** ("correctif sérieux... ou fix
bricolé ?") avant de considérer l'incident clos. Corriger seulement les 15 entrées manifest aurait
réparé l'instance du jour, pas la classe de défaut : `tools/validate-3d-manifest.mjs` ne validait
la forme de `states`/`interactions` sous aucun angle (confirmé en lisant le fichier en entier), et
la route serveur de l'Atelier (`entity-blueprints.js`) fait le même `JSON.stringify(interactions ||
[])` sans validation — deuxième porte d'entrée pour la même faille, non traitée dans ce lot (Atelier
très peu utilisé actuellement, urgence moindre — noté pour plus tard).

**Durcissement appliqué, même cause racine** :
1. `tools/validate-3d-manifest.mjs` — nouvelles fonctions `validateStates`/`validateInteractions` :
   `required_state_ids` doit être un tableau, ses valeurs et `target_state_id` doivent référencer un
   `states[].id` réellement déclaré, `move_type` limité à `"displacement"`, `action_label` obligatoire
   (lu sans garde par `RadialMenu.jsx`, `truncate()` y plante aussi sur `undefined`). Testé : reproduction
   de l'incident exact dans un manifest temporaire → correctement rejeté ; les 7 manifests existants du
   dépôt revalidés sans régression.
2. `client/src/lib/entityInteractions.js` (nouveau) — `getAvailableInteractions(entity)` unique,
   remplace les deux filtres dupliqués de `SessionPage.jsx`. Garde `Array.isArray` à la lecture :
   une interaction malformée qui contournerait le validateur (ex. via l'Atelier, non couvert) est
   ignorée silencieusement plutôt que de faire planter la session — frontière légitime au sens du
   principe « valider aux limites », pas une rustine sur le symptôme du jour.
3. Manifest corrigé : `required_state_ids: [0, 1]` sur les 15 interactions Déplacer (valable que la
   caisse soit ouverte ou fermée).

**Testé** : `node tools/validate-3d-manifest.mjs` sur les 7 manifests du dépôt (0 régression) + sur
un manifest reproduisant l'incident (rejeté comme attendu) ; `eslint` ciblé (0 erreur, warnings
pré-existants sans rapport) ; `npm run build` complet (succès).
**Non testé : ⚠️ clos partiel** — validation en jeu réel par Saar (protocole : pose d'une caisse,
tir hors ligne de mire, Déplacer vers la ligne de tir, nouveau tir, vérifier la ligne « Couverture
cible ») encore à faire après ce correctif.
**Données** : aucune migration — contenu manifest + code client/outillage uniquement.
**Retour arrière** : rien committé à ce stade, en attente de la validation jeu réel de Saar.
**Hors périmètre, noté** : même absence de validation côté route Atelier serveur
(`entity-blueprints.js`) — deuxième porte d'entrée pour la même classe de défaut, urgence moindre
tant que l'Atelier reste inutilisé (cf. audit éditeur 4 fils, `docs/JOURNAL8.md` même date).

## Session (Dev) — 2026-09-17 — Résolution du token acteur : unification (MJ sans token possédé bloqué sur les interactions d'entité)

Suite du test A2 (Déplacer) : le MJ ne pouvait jamais utiliser une interaction d'entité
(`ENTITY_MOVE_REQUEST`) sans token possédé — `console.warn('[EntityMove] Aucun token acteur
trouvé...')`, aucun repli. Diagnostic demandé par Saar : « qu'est-ce qui a provoqué la perte de
cette fonctionnalité ? Documente-toi, regarde ce que font les pros. »

**Racine trouvée par archéologie git, pas supposée** : ce n'est pas une régression. `handleEntityMove`
(Session 41, 2026-04-30, "9F-B2") a toujours eu cette limitation, dès le premier commit. Le patron
plus robuste (`followToken` dans `Canvas3D.jsx` : token possédé → token sélectionné → repli non-MJ)
est arrivé 2,5 mois plus tard, au commit "Fusion Kiwi" (2026-07-15), construit pour la caméra 3e
personne — jamais rapproché du code des interactions d'entité, plus ancien. `selectedTokenId`
lui-même (sélection + anneau visuel) est encore plus ancien (Session 5) mais a toujours vécu comme
état local de `Canvas3D`, structurellement invisible depuis `SessionPage.jsx`.

**Confirmé par la doc Foundry VTT** : le patron pro traite "le token contrôlé" comme un concept
global unique (`canvas.tokens.controlled`), jamais recalculé par fonctionnalité — cohérent avec la
direction retenue.

**Correctif structurel** (même défaut que `getAvailableInteractions` corrigé le 2026-09-16 : une
propriété calculée à plusieurs endroits divergents plutôt qu'une autorité unique) :
1. `selectedTokenId` promu de l'état local de `Canvas3D.jsx` vers `tokenStore.js` (accessible
   partout, plus de prop-drilling nécessaire pour ce besoin).
2. `client/src/lib/actingToken.js` (nouveau) — `resolveActingToken()` unique, même ordre de
   résolution que l'ancien `followToken` (possédé → sélectionné → repli non-MJ). Le serveur reste
   seul autoritaire sur l'ownership réel (`.claude/rules/entities.md`) — ce résolveur exprime une
   intention côté client, jamais une autorisation.
3. Trois sites rebranchés sur ce résolveur unique : `followToken` (caméra 3e personne),
   `handleEntityMove`, le calcul `actorToken` du rendu `RadialMenu` — les deux derniers dans
   `SessionPage.jsx`, qui réimplémentaient chacun une version tronquée (possédé seulement).

**Testé** : `eslint` ciblé sur les 4 fichiers touchés (0 erreur ; le seul nouvel avertissement,
dépendance manquante `setSelectedTokenId`, corrigé) ; comparaison avant/après par `git stash` sur
`Canvas3D.jsx` confirmant que les 14 erreurs `react-hooks/refs` restantes sont préexistantes, sans
rapport ; `npm run build` complet (succès).
**Non testé : ⚠️ clos partiel** — validation en jeu réel par Saar (MJ sélectionne un token via clic,
utilise Ouvrir/Déplacer sur une caisse sans token possédé).
**Données** : aucune migration — état client uniquement (`tokenStore.js`, pas de colonne DB).
**Retour arrière** : rien committé, en attente de validation jeu réel.
**Hors périmètre, noté explicitement à Saar** : `handleEntityAction` (Ouvrir/Fermer) résout un
*personnage* (pas un token) via une logique différente, déjà marquée `TODO` ("chantier /sc") par une
session antérieure — même famille de problème, mais pas touchée ici, hors du périmètre validé.
Reste également ouvert : pourquoi le joueur voit un cercle radial vide quelle que soit la distance
(hypothèse de portée infirmée par Saar), et pourquoi le joueur ne peut plus déplacer son propre
token hors combat — deux fils distincts, non encore investigués.

## Session (Dev) — 2026-09-17 — Sélection MJ : découplage caméra/menu/sélection (UX, patron RTS)

Suite du correctif précédent (résolution du token acteur) : Saar a testé, la mécanique fonctionne
mais l'UX est inutilisable — un seul clic sur un token déclenchait simultanément la sélection, le
recentrage caméra 3e personne, et l'ouverture du menu du token (`TokenRadialMenu`), avec un anneau
de sélection quasi invisible. Analyse à charge demandée avant tout code ("on n'est pas pressés"),
recherche RTS (StarCraft/AoE : clic = sélection seule, commande séparée pour l'action, caméra
jamais liée à la sélection) confirmant le même patron déjà validé chez Foundry VTT (2026-09-16).

**Diagnostic exact** (lu dans `Canvas3D.jsx`, pas supposé) : un clic court sur un token appelait
`onTokenSelect` (sélection) ET, si propriétaire/MJ, `onTokenDoubleClick` (ouvre `TokenRadialMenu`,
un menu riche : Fiche/Retirer/Échange/Viser/Statuts + boussole de rotation — vérifié en lisant le
fichier, pas un menu accessoire) — malgré son nom, ce prop se déclenchait sur simple clic. La
caméra bougeait parce que `followToken` (qui pilote la 3e personne) venait d'être étendu la veille
pour inclure `selectedTokenId` — effet de bord non anticipé du correctif précédent.

**Correctif, périmètre volontairement réduit après analyse à charge** (le plan initial proposait un
nouveau champ `followedTokenId` + un geste dédié pour "faire suivre la caméra à un token choisi" —
écarté : personne n'a demandé cette capacité, corriger l'effet de bord suffit) :
1. `followToken` ne considère plus jamais `selectedTokenId` — retour exact au comportement caméra
   d'avant le correctif de la veille.
2. `client/src/lib/doubleClickTracker.js` (nouveau) — `useDoubleClickTracker()`, détection de
   double-clic par comparaison de timestamp (le clic token est géré à la main via
   pointerdown/up sur le canvas, pas par les props JSX de R3F — `dblclick` natif non fiable ici).
3. `TokenRadialMenu` ne s'ouvre plus que sur un vrai double-clic détecté ; la sélection reste
   inconditionnelle sur chaque clic court.
4. `TokenRing` (`Canvas3D.jsx`) — l'anneau "sélectionné" était une simple version animée du même
   anneau fin semi-transparent affiché pour tous les tokens (couleur de faction), quasiment
   indissociable au repos. Ajout d'un second anneau, distinct (vert `#3ddc84`, même convention que
   le highlight de snap grille de l'éditeur), plus large, avec la pulsation déjà existante.

**Point 4 du plan initial (persistance de la sélection perdue à la fermeture du menu) — non traité
séparément** : probablement un symptôme de la collision résolue par les points 1-3 (sélection et
ouverture de menu ne partagent plus le même clic) plutôt qu'une cause distincte. À revalider par
Saar après ce correctif avant de creuser plus loin — pas de correctif spéculatif sans repro.

**Testé** : `eslint` ciblé (0 erreur ; un avertissement de dépendance introduit puis corrigé) ;
`npm run build` complet (succès).
**Non testé : ⚠️ clos partiel** — validation en jeu réel par Saar.
**Données** : aucune migration, état client uniquement.
**Retour arrière** : rien committé, en attente de validation jeu réel.
**Hors périmètre, toujours ouvert** : raycast qui ouvre parfois le menu d'une caisse proche au lieu
du token (priorité de détection de clic) ; cercle radial vide côté joueur ; joueur ne peut plus
déplacer son propre token hors combat.

## Session (Dev) — 2026-09-17 — Collision clic token/caisse : correctif ciblé + ouverture du chantier de fusion

Suite immédiate du point précédent (raycast qui ouvre parfois le menu d'une caisse proche au lieu
du token). Analyse à charge demandée par Saar : « peut-on éviter complètement la superposition de
modules/fonctions ? » puis, après ma réponse initiale (correctif ciblé, fusion complète jugée
disproportionnée) : « je m'en fous que ce soit disproportionné si ça aggrade l'architecture — si ça
permet une architecture adaptative/évolutive, la question mérite d'être posée. »

**Cause confirmée** : deux systèmes de détection de clic totalement indépendants. Les tokens
passent par une boucle manuelle (écouteurs bruts sur le canvas, `Canvas3D.jsx`, nécessaire pour le
drag) qui arbitre déjà AOE/déplacement combat/mode visée entité/drag avec un ordre de priorité
explicite. Les entités utilisent le système `onClick` déclaratif intégré à React Three Fiber
(`EntityMesh.jsx`), totalement à côté de cet arbitrage. Le token n'avait aucun gestionnaire `onClick`
côté R3F — invisible pour son arbitrage interne (plus proche intersection gagne), qui ne connaissait
donc que les entités comme candidates.

**Décision de séquencement** (après avoir pesé le risque, pas le volume de travail — sur demande
explicite de Saar de ne jamais utiliser le volume de travail comme critère) : correctif ciblé
immédiat qui ferme le trou précis sans fusionner les deux systèmes ; fusion complète ouverte comme
chantier séparé, cadré proprement, pas improvisée dans ce fil de débogage déjà long — risque de
mélanger les causes si quelque chose casse pendant une réécriture qui touche potentiellement tous
les packs d'assets, pas seulement les caisses.

**Correctif** : `Canvas3D.jsx`, le token reçoit désormais un gestionnaire `onClick` (juste
`e.stopPropagation()`) — le fait participer à l'arbitrage de R3F sans toucher à la boucle manuelle
ni à `EntityMesh.jsx`. Pas un pansement séparé : première étape légitime vers la fusion, pas un
correctif à défaire plus tard.

**Chantier ouvert** : `docs/PLANS/PLAN_CLIC_3D_UNIFICATION.md` (stub) — référencé dans
`docs/SYSTEME/INDEX.md` et `docs/ROADMAP.md`. Recense l'état connu, le correctif intérimaire, et ce
que le cadrage détaillé devra faire (inventaire de tous les types d'objets cliquables, raycast
unique, migration à risque identifié pour `EntityMesh.jsx`).

**Testé** : `eslint` ciblé (0 nouvelle erreur/avertissement) ; `npm run build` complet (succès).
**Non testé : ⚠️ clos partiel** — validation en jeu réel par Saar (token proche d'une caisse, clic
exact sur le token).
**Données** : aucune migration.
**Retour arrière** : rien committé, en attente de validation.
**Hors périmètre, toujours ouvert** : cercle radial vide côté joueur ; joueur ne peut plus déplacer
son propre token hors combat ; décision caméra au double-clic (proposée par Saar, avis donné contre
sans trancher — en attente de sa décision) ; chantier de fusion complète (stub créé, cadrage à
faire séparément).

## Session (Dev) — 2026-09-17 — Test réel de Déplacer : MJ bloqué sans repli PNJ, ouverture du chantier d'autorité serveur

Premier test réel de Lot A2 (`ENTITY_MOVE_REQUEST`) après tous les correctifs précédents. Deux
symptômes rapportés par Saar : joueur sans accès aux caisses (menu radial noir, aucun log — non
reproduit, hypothèse principale : bundle client périmé, cadré ci-dessous) ; MJ avec accès au menu
mais Déplacer sans aucun effet.

**Cause confirmée pour le MJ**, par le log serveur lui-même : `token:beeca25d...` → personnage
**Baboulinet**, `type: 'pnj'`, `user_id: null`. `ENTITY_MOVE_REQUEST` (`socketEntity.js`) vérifiait
l'ownership avec `character.user_id !== user.id`, **sans aucun repli MJ** — contrairement à la
quasi-totalité des autres handlers socket du projet. Un MJ sans PJ propriétaire (le cas normal d'un
MJ) ne pouvait donc jamais utiliser Déplacer, même via le token d'un PNJ.

Saar a demandé, avant tout code, si ce correctif ne devrait pas plutôt aller dans
`PLAN_CLIC_3D_UNIFICATION.md` — l'occasion de trancher explicitement : non, périmètre différent
(autorisation serveur, pas détection de clic client, Règle 1 documentaire), mais même **forme** de
problème (un trou ponctuel révélant une duplication plus large) et donc même séquencement.

**Correctif** : `canActAsCharacter()` extraite dans `server/src/lib/socketUtils.js` — reprend le
patron déjà éprouvé de `COMBAT_INIT_STATE` (`socketCombatState.js`, MJ autorisé sur un PNJ, jamais
un PJ ni un drone), câblée uniquement sur `ENTITY_MOVE_REQUEST`. Pas une invention : un patron déjà
validé en prod, extrait pour son 2ᵉ appelant plutôt que recopié une 7ᵉ fois ailleurs dans le code.

**Chantier ouvert** : `docs/PLANS/PLAN_AUTORITE_PERSONNAGE_SERVEUR.md` (stub) — référencé dans
`docs/SYSTEME/INDEX.md` et `docs/ROADMAP.md`. Recensement brut (grep, pas une lecture ligne à ligne)
d'au moins 3 philosophies de contournement MJ différentes dans 8+ handlers socket (`socketDice.js`,
`socketToken.js`, `socketChance.js`, `socketConnector.js`, `socketCombatState.js`,
`socketCombatResolution.js`, `socketCombatAnnouncement.js`) — à lire un par un au cadrage, pas
supposé unifiable en une seule règle sans vérification.

**Testé** : `node --check` sur les deux fichiers serveur modifiés.
**Non testé : ⚠️ clos partiel** — validation en jeu réel par Saar (MJ pilote un PNJ pour Déplacer).
**Données** : aucune migration.
**Retour arrière** : rien committé, en attente de validation.
**Hors périmètre, toujours ouvert** : bug joueur (menu radial noir, non reproduit — hypothèse bundle
périmé à vérifier par Saar via hard refresh avant nouvelle analyse) ; le mécanisme Déplacer complet
(jet FOR, mouvement réel, malus « Couverture cible ») toujours pas observé en jeu de bout en bout ;
cadrage détaillé de `PLAN_AUTORITE_PERSONNAGE_SERVEUR.md` (8+ sites à auditer un par un).

## Session (Dev) — 2026-09-17 — Déplacer une caisse : diagnostic « clic sans effet » et affordances manquantes

Après le correctif MJ/PNJ, Saar signale « clic sur Déplacer, rien » — sans aucun log, ni F12 ni
serveur. Diagnostic erroné à deux reprises avant la bonne cause (autocritique explicite de Saar
demandée en cours de route, cf. feedback à sauver) : d'abord une piste sur le clic de confirmation
(dot=0 ambigu), écartée par Saar (« tu ne me lis pas ») ; puis une piste sur la portée du MJ,
écartée par la couleur identique Ouvrir/Déplacer dans le menu. La vraie cause, confirmée par Saar :
le clic sur « Déplacer » fonctionne, mais **rien ne signale qu'un second clic est nécessaire, ni ce
qu'il fait** — pas un bug fonctionnel, une absence totale d'affordance.

**Analyse à charge demandée avant tout code** (« reprends-toi », rappel des priorités qualité/temps).
Proposition initiale insuffisante (bandeau texte seul, `cursor: crosshair` inventé) rejetée par
Saar sur 3 points précis, tous corrigés après relecture : (1) c'est une destination, pas une
direction — le ghost snappe déjà sur une case ; (2) un curseur personnalisé existe déjà dans le
projet (`SceneCursorOverlay.jsx`/`useSceneCursor.js`, modes `'case'`/`'cible'`, assets
`CURSEUR_CASE.svg`/`CURSEUR_CIBLE.svg`) — jamais câblé sur `moveTarget`, oublié depuis l'introduction
de la mécanique ; (3) `EntitySelectionHalo` (`EntityMesh.jsx`) existe déjà (halo doré) mais n'est
jamais branché en mode jeu, seulement dans l'éditeur GM.

**Recherche demandée et faite** : le patron correct pour ce problème est le State pattern/pushdown
automaton pour la gestion des entrées (*Game Programming Patterns*, Robert Nystrom) — un seul « mode
actif », chaque mode portant son propre curseur/annulation/priorité. Confirmé pertinent ici : 5
modes de visée (`combatMoveMode`/`combatTargetMode`/`combatAoeTargetMode`/`losMode`/`moveTarget`)
déjà traités comme une famille par un effet de nettoyage (`Canvas3D.jsx:761-773`), mais recopiés à la
main dans le curseur ET dans 5 `useEffect` Échap quasi identiques — `moveTarget` avait raté le
curseur et le halo, jamais la priorité de clic ni le nettoyage.

**Décision de séquencement** (même critère risque/qualité que pour le clic 3D et l'autorité serveur
plus haut ce jour, redemandée explicitement par Saar avant de trancher) : correctif ciblé additif
(`moveTarget` rejoint la branche `'case'` existante de `useSceneCursor.js` ; `isSelected` câblé sur
l'appel `<EntityMesh>` de `Canvas3D.jsx` pour afficher le halo sur la caisse ciblée), sans migrer les
4 modes combat déjà validés en jeu réel vers un vrai State pattern — risque de régression non
maîtrisé sans suite de tests automatisés, à cadrer séparément.

**Correctif** : `client/src/lib/useSceneCursor.js` (+`moveTarget` en paramètre et dans la branche
`'case'`) ; `client/src/components/Canvas3D.jsx` (`moveTarget` transmis à `useSceneCursor`,
`isSelected={moveTarget?.entity?.id === entity.id}` sur `<EntityMesh>`).

**Chantier élargi** : `docs/PLANS/PLAN_CLIC_3D_UNIFICATION.md` (déjà ouvert plus haut ce jour) —
retitré et étendu pour couvrir tout le cycle de vie d'un mode de visée (clic + curseur + annulation),
pas seulement l'arbitrage de clic ; référencé `INDEX.md`/`ROADMAP.md`.

**Testé** : `eslint` ciblé (17 problèmes, baseline pré-existant inchangé, 0 nouveau).
**Non testé : ⚠️ clos partiel** — validation en jeu réel par Saar (curseur `'case'` visible pendant
le mode visée, halo doré sur la caisse ciblée).
**Données** : aucune migration.
**Retour arrière** : rien committé, en attente de validation.
**Hors périmètre, toujours ouvert** : bug joueur (menu radial noir) ; le mécanisme Déplacer complet
jamais observé en jeu de bout en bout avec succès ; cadrage détaillé de `PLAN_CLIC_3D_UNIFICATION.md`
et `PLAN_AUTORITE_PERSONNAGE_SERVEUR.md`.

## Session (Dev) — 2026-09-17 — Clôture de Lot A2 : Difficulté non jouable, troisième chantier ouvert, documentation durable

Après le correctif curseur/halo, Saar teste réellement Déplacer avec le PNJ Baboulinet (FOR 18,
maximum humain) : deux jets, deux échecs (4→MR-1, 10→MR-7). Question posée avant tout code : cette
difficulté est-elle RAW ou « au pif » ?

**Vérifié, pas supposé** : la conversion Attribut→AN est RAW à l'identique (`docs/REGLES/
ATTRIBUTS.md:131-142`, table p.114, reproduite dans `shared/polarisUtils.js` `AN_TABLE`) — FOR 18 →
AN+3, confirmé par calcul direct. La Difficulté appliquée (0) n'est en revanche **une absence de
donnée, jamais une valeur choisie** : aucun `difficulty_dc` n'existe sur aucune des 15 caisses, et
aucune règle RAW de Difficulté de poussée par poids/taille d'objet n'a été trouvée dans les documents
transcrits (recherche faite, rien trouvé). Résultat : 15 % de réussite avec l'Attribut humain maximal,
sans aucun moyen de l'ajuster — la décision du 2026-07-31 portait sur la formule (Test d'Attribut
seul), jamais sur cette valeur.

Saar a ensuite posé trois constats (difficulté trop punitive pour un usage réel, invisible pour
joueur et MJ, aucune interface de surcharge MJ alors que le système est censé être un repli
ajustable) puis une question de fond : *« j'en suis à un point où je me pose la question de ce qu'on
fait »* — Lot A2, censé être une preuve de concept mineure, a fait remonter coup sur coup deux
chantiers d'architecture (clic 3D, autorité serveur) et maintenant un vrai trou de design/outillage,
sans qu'aucun d'eux n'ait pu être improvisé sans risque.

**Décision (Saar)** : clore Lot A2 ici, à l'état réel (mécanisme prouvé, pas prêt pour la table),
plutôt que de continuer à empiler des correctifs sur un fil déjà long. Documenter fortement avant de
passer à autre chose — PLAN, ROADMAP et SYSTEME, pas seulement ce journal.

**Documentation de clôture** :
- `docs/PLANS/PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md` (nouveau stub) — 3ᵉ chantier ouvert
  aujourd'hui, même traitement que les deux précédents (déclencheur, état vérifié, hors périmètre,
  rien codé).
- `docs/PLANS/PLAN_ENTITES_INTERACTIVES_ROADMAP.md` — Lot A2 marqué CLOS à l'état réel, les trois
  chantiers listés comme conséquence, dépendance explicite posée sur
  `PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md` avant toute reprise du test en jeu.
- `docs/SYSTEME/ENTITES.md` — nouvelle §10 (Règle 10 : les faits durables sortent du PLAN une fois
  vérifiés) documentant le moteur d'interactions runtime (schéma `states`/`interactions`, protocole
  `ENTITY_ACTION_REQUEST`/`ENTITY_MOVE_REQUEST`, ownership `canActAsCharacter`/`resolveActingToken`)
  et ses 3 limites connues, chacune référencée vers son stub.
- `docs/ROADMAP.md` / `docs/SYSTEME/INDEX.md` — ligne « Interactions d'entité » mise à jour (clôture
  réelle de Lot A2, pointeurs vers les 3 stubs) ; nouvelle ligne pour
  `PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md`.

**Testé** : aucun code nouveau dans cette entrée — travail 100 % documentaire.
**Non testé** : sans objet (pas de code).
**Données** : aucune migration.
**Retour arrière** : sans objet.
**Hors périmètre, définitivement fermé pour cette session** : Lot A2 ne sera pas retesté avant le
cadrage d'au moins `PLAN_DIFFICULTE_INTERACTIONS_ENTITES.md`. Bug joueur (menu radial noir) reste
non reproduit, non repris ici.

## Session (Dev) — 2026-09-17 — Clôture PLAN_CLIC_3D_UNIFICATION : Lots 1+2 validés en jeu réel, occupation circulaire corrigée en cours de route

Chantier ouvert le même jour (cadrage §2bis/§5 : 6 systèmes de clic indépendants recensés, pas 2 ;
découpage Lot 1 arbitrage de clic / Lot 2 cycle de vie curseur+Échap ; `Editor3D.jsx` explicitement
hors périmètre). Les deux lots codés, commités et validés en jeu réel dans la même session
(`2825eae`, `b373410`, `2057b09`, `d81e503`, `6f87d85`, `2a3493f`, `dev/Saar`).

**Lot 1** — `aimModeActive`, une autorité unique dérivée des 5 modes de visée, gate désormais
`onClick` d'`EntityMesh`/`HoverIcon`/`ConnectorSegment` pendant un mode de visée. Piste de design
initiale (registre + `raycaster.intersectObjects` fait main) écartée après lecture de la doc R3F
officielle : le raycaster partagé + la distribution nearest-first + `stopPropagation()` existent
déjà nativement, un registre maison aurait dupliqué ce que R3F fournit gratuitement.

**Lot 2** — un seul tableau `aimModes` (`{key, active, cursor, onCancel, blocksEntityClick}`)
remplace la recopie manuelle des 5 états dans `useSceneCursor.js` et les 5 `useEffect` Échap
dupliqués de `Canvas3D.jsx`. Régression trouvée en jeu réel après clôture initiale : `combatMoveMode`
(survol de déplacement ambiant, armé en continu pour tout le tour) avait été inclus dans la garde de
clic entité par symétrie avec les 4 autres modes — rendait les caisses inutilisables pour tout le
tour, pas seulement pendant un clic de visée ponctuel. Corrigé par un champ `blocksEntityClick`
explicite par mode (`false` seulement pour `combatMoveMode`).

**Détour de session, root cause distincte trouvée en testant Lot 2** — poignées de fenêtres de
déclaration combat coincées derrière la timeline (PJ/Exo/MJ), `onCancel` manquant dans
`useAutoMoveMode` de la fenêtre MJ, et surtout : le déplacement combat bloqué par une caisse
pourtant hors de portée réelle. Cause racine serveur, pas cliente : `canOccupy`
(`shared/world/spatialIndex.js`) ne testait que les boîtes carrées (AABB) entre acteur et
occupant, jamais la distance circulaire réelle — une caisse à 0,90 m diagonale bloquait un nœud de
navigation dont la somme des rayons circulaires n'était que 0,764 m. Corrigé par
`actorFootprintsOverlap` (narrow-phase circulaire après le broad-phase AABB existant, inchangé),
2 tests de régression ajoutés avec les chiffres réels de la campagne de Saar
(`shared/world/spatialIndex.test.mjs`), suite complète `shared/**/*.test.mjs` → 597 tests, 0
échec. Un second cas rejoué par Saar (PNJ2 immobile) s'est révélé être un vrai chevauchement
circulaire (token posé sur une caisse) — pas un bug, mais a fait remonter une demande produit non
cadrée : une mécanique empêchant de poser un token sur une case déjà occupée. Notée
`docs/PLANS/PLAN_BLOCAGE_CASES_OCCUPEES.md` (stub) — nom en collision avec un chantier déjà clos
sous ce même nom (empêcher de poser une ENTITÉ sur une case occupée) ; la résolution réelle de ce
point (placement de TOKEN) vit finalement sous `docs/Old/PLAN_PLACEMENT_TOKEN_MJ.md`, CLOS
2026-09-23.

**Testé** : arbitrage de clic token/entité/connecteur, garde `blocksEntityClick`, curseur + Échap
pour les 5 modes de visée, poignées des 3 fenêtres de déclaration, déplacement combat après le
correctif d'occupation circulaire — tout confirmé en jeu réel par Saar. Lint, build client et
`shared/**/*.test.mjs` (597 tests) vérifiés à chaque étape.
**Non testé** : rien d'identifié en attente pour ce périmètre.
**Données** : aucune migration. Le correctif d'occupation circulaire modifie un calcul serveur pur,
aucune donnée persistée touchée.
**Retour arrière** : `git revert` des 6 commits ci-dessus si besoin, aucune dépendance externe
(migration/seed) ne l'empêcherait.

**Documentation de clôture (hygiène différée, corrigée dans cette même entrée)** : PLAN archivé
`docs/Old/` (Règle 10) ; faits durables intégrés dans `docs/SYSTEME/REACT.md` (nouveau P59) et
`docs/SYSTEME/ENTITES.md` (§10.5 limite mise à jour) ; `docs/ROADMAP.md`/`docs/SYSTEME/INDEX.md`
nettoyés de la ligne stub périmée ; `client/public/CHANGELOG.md` — entrées joueur ajoutées (poignées
de fenêtres, déplacement combat).

## Session (Dev) — 2026-09-18 — Clôture PLAN_DIFFICULTE_INTERACTIONS_ENTITES : surcharge MJ, bandeau joueur, panneau réparé

Déclenché par le test réel de Déplacer une caisse (Lot A2, session précédente) : FOR 18 (max humain)
sans Difficulté donnait 15 % de réussite, invisible avant le jet, et aucune interface ne permettait
au MJ de corriger la valeur au cas par cas. Cadrage fait en 3 passes (plan → analyse à charge →
re-cadrage après recherche du pattern déjà résolu pour les portes verrouillées) avant tout code,
conformément à la demande explicite de Saar de privilégier la qualité structurelle.

**L1 — Surcharge MJ par instance.** `entities.interaction_overrides` était déjà lu par
`socketEntity.js` (Ouvrir/Fermer et Déplacer) mais jamais écrit par aucune interface, et la route
`PUT /entities/:id` persistait la valeur sans validation de forme (risque de NaN dans la résolution
du jet). `normalizeInteractionOverrides` (`shared/world/entityTransform.js`, même autorité
client+serveur que `withEntityScale`) filtre les ids d'interaction inconnus et les valeurs non
finies, symétrique au traitement déjà réservé à `lockDifficultyDc` pour les portes verrouillées
(`surfaceDocument.js`, chantier antérieur trouvé en cherchant un précédent pro avant de coder).
Champs Difficulté/Portée ajoutés à `EntityInstancePanel.jsx`, avec un aperçu du seuil de référence
(FOR 18, même benchmark que le déclencheur).

**L2 — Bandeau Difficulté joueur.** Découverte en analysant l'existant : le MJ voit déjà la
Difficulté effective avant d'approuver un Test d'entité arbitré (`ENTITY_ACTION_PENDING` →
`sidebar.actionDC`, `MessageRendererRegistry.jsx`) — Déplacer est le seul chemin sans étape
d'arbitrage MJ (décision RAW antérieure : Test d'Attribut seul, résolution directe), donc le seul
où personne ne voyait rien avant le jet. Un bandeau centré, dérivé de `moveTarget` (aucun state
séparé, apparaît/disparaît avec le mode visée lui-même), affiche uniquement le modificateur signé —
pas un seuil calculé — pour rester cohérent avec le seul autre précédent du jeu (les fenêtres de
modificateurs combat ne révèlent jamais non plus une chance de réussite calculée avant le tir).
`getEffectiveInteractionDifficulty` (`client/src/lib/entityInteractions.js`) étend le point de
lecture unique déjà utilisé par `getAvailableInteractions`, générique à toute interaction — L4
(Ouvrir/Fermer un jour testé) satisfait par construction, aucun code séparé nécessaire. L3 (aperçu
MJ à la conception) s'est avéré déjà couvert par le champ « Seuil de référence » ajouté en L1.

**Décision actée** : pas de repli automatique dérivé du poids/taille de l'objet pour la Difficulté
(RAW silencieuse sur la poussée/traction) — le MJ règle `difficulty_dc` par défaut directement au
blueprint dans l'atelier (`EntityBuilderTab.jsx`, déjà possible avant ce chantier, simplement jamais
utilisé). Simplifie le périmètre initialement envisagé (§3 du plan).

**Bug de câblage trouvé et corrigé en cours de route** : `EntityInstancePanel.jsx` n'envoyait jamais
`interaction_overrides` dans le payload de sauvegarde malgré la route qui l'acceptait déjà — corrigé
dans le même lot.

**Détour de session — panneau de configuration inutilisable, cause distincte** : après L1/L2, Saar
signale "Déplacer" absent du panneau malgré des données confirmées correctes en base (vérifié par
requête directe). Après plusieurs hypothèses infirmées (repli fermé par défaut, hauteur non liée à
`position.top`), cause racine trouvée par lecture de `FloatingPanelSection.jsx` : un enfant avec
`overflow` différent de `visible` dans un conteneur flex-column a une taille minimale automatique de
0 (piège CSS documenté, `docs/SYSTEME/REACT.md` P60 nouveau) — le panneau semblait "tenir" en
écrasant ses sections au lieu de déborder et de déclencher le défilement. `flexShrink: 0` ajouté sur
`FloatingPanelSection.jsx`, corrige du même coup le même défaut latent sur `SurfaceWallPanel.jsx` et
`SurfaceRoomPanel.jsx` qui partagent ce composant. Retours UI groupés dans la foulée : label "Nom
affiché" redondant retiré, "État actuel" et X/Z/Altitude alignés sur une ligne (label + champ).

**Testé** : `node --check` (fichiers serveur/shared), lint ciblé (0 erreur), `npm run build` client à
chaque étape, `node --test shared/world/entityTransform.test.mjs` (7 tests, `normalizeInteractionOverrides`
inclus). Panneau de configuration, défilement molette, champ Déplacer atteignable et éditable,
confirmés en jeu réel par Saar.
**Non testé** : un jet de Déplacer réussi en jeu réel avec une Difficulté réglée à une valeur
jouable (configuration + affichage validés, pas encore le jet lui-même) ; effet sur `state_cover`/LOS
en situation de couverture réelle.
**Données** : aucune migration — `interaction_overrides` est une colonne jsonb déjà existante.
**Retour arrière** : `git revert` des commits de ce chantier si besoin, aucune dépendance externe.

**Documentation de clôture** : PLAN archivé `docs/Old/` (Règle 10) ; faits durables intégrés dans
`docs/SYSTEME/ENTITES.md` (§10.1/§10.5) et `docs/SYSTEME/REACT.md` (nouveau P60) ; `docs/ROADMAP.md`/
`docs/SYSTEME/INDEX.md` nettoyés de la ligne stub périmée ; `client/public/CHANGELOG.md` — entrée
joueur ajoutée (v236).

---

## Session (Dev) — 2026-09-18 — Blocage des cases occupées : entités du monde

**Déclencheur** : en rejouant le correctif d'occupation circulaire (`spatialIndex.js`, session
précédente), Saar a trouvé un PNJ réellement immobilisé par une caisse — pas un bug de collision,
mais rien n'empêchait de poser un token sur une case déjà occupée à la pose initiale. Recensement
complet des flux de pose avant tout code (méthode imposée par `AGENTS.md`) : **les tokens sont déjà
protégés**, création et déplacement consultent tous deux `canOccupy`
(`resolveBattlemapPlacement`/`executeBattlemapTokenMovement`, `worldMovementService.js`). Le vrai
trou : **les entités du monde** (caisses, meubles, décors posés depuis l'éditeur) — `POST`/`PUT
/api/entities` écrivaient `pos_x/pos_y/pos_z` sans jamais consulter l'occupation runtime, contraire
à l'invariant déjà écrit dans `.claude/rules/entities.md`. Scénario cohérent avec le cas Baboulinet :
la caisse (entité) a été posée par-dessus le token, geste jusque-là totalement silencieux côté
serveur.

**Décisions actées avec Saar** : refus dur (409, cohérent avec le comportement déjà existant des
tokens — pas de snap, pas d'avertissement) ; entités murales (`placementMode: 'wall'`) exclues de
la V1 (l'approximation circulaire du moteur surestimerait un objet plat contre un mur) ; concurrence
tranchée après recherche externe (contraintes `EXCLUDE ... USING gist` PostgreSQL écartées — second
moteur de collision dupliquant `actorFootprintsOverlap` en SQL, interdit par `.claude/rules/world.md`)
— verrou transactionnel PostgreSQL (`.forUpdate()`, ordre `battlemaps→tokens→entities` symétrique à
`executeBattlemapTokenMovement`) uniquement sur la branche `PUT` qui déplace réellement une entité,
pas à la création (symétrique à la création de token, elle-même non transactionnelle).

**Code** : `entityOccupant()` extrait de `worldMovementService.js` (autorité unique réutilisée par
`dynamicOccupantsFromRows` et par les deux routes entités — pas de formule dupliquée). `entities.js`
POST/PUT refusent (409) toute pose/déplacement d'entité bloquante `placementMode: 'free'` chevauchant
un occupant existant ; le PUT ne déclenche le contrôle que sur un changement de position réel
(comparaison de valeur à la base, pas présence du champ — `EntityInstancePanel.jsx` envoie toujours
`pos_x/pos_y/pos_z`, même sans déplacement). Client (`Editor3D.jsx`, `EntityInstancePanel.jsx`) :
message FR dans le fil de session sur refus (réutilise `declare_error`/`addMessage`, même patron que
`session.tokenDropNoSurface`).

**Analyse à charge menée avant de coder** (étape distincte, demandée explicitement par Saar) : trois
erreurs trouvées et corrigées dans le plan avant tout code — mauvaise source pour `is_blocking`
(vit sur `blueprint.states[current_state_id]`, jamais dans le JSON `state` de la requête), condition
de déclenchement du contrôle PUT sous-spécifiée, `r` retiré du déclenchement (n'affecte jamais le
rayon de collision circulaire actuel).

**Vérification du code mort évoqué par Saar** : l'ancienne carte de collision Redis
(`isCaseOccupied`, `collision:${battlemapId}`, `docs/Old/PLAN_ENTITY.md`) est déjà entièrement
supprimée du code (zéro référence dans `server/src`) et sa suppression déjà documentée dans
`docs/SYSTEME/MOTEUR_MONDE.md` §2.2 (« Redis et son hash de collision ont été supprimés ») —
rien à nettoyer ni à noter, vérifié plutôt que supposé.

**Testé** : `node --check` (`entities.js`, `worldMovementService.js`), `node --test
worldMovementService.test.mjs` (5/5, aucune régression du refactor `entityOccupant`), `eslint` ciblé
sur `Editor3D.jsx`/`EntityInstancePanel.jsx` (0 erreur, aucun nouveau warning), `npm run build`
client, validation JSON `fr.json`, `git diff --check`. **Confirmé en jeu réel par Saar** (« test
fonctionnel »).
**Non testé** : déplacement concurrent réel (verrou transactionnel non observable sans multi-session).
**Données** : aucune migration.
**Retour arrière** : `git revert` des commits de ce chantier si besoin, aucune dépendance externe.

**Documentation de clôture** : PLAN archivé `docs/Old/` (Règle 10) ; faits durables intégrés dans
`docs/SYSTEME/ENTITES.md` (§3.1/§3.3) et `docs/SYSTEME/MOTEUR_MONDE.md` (§2.2) ; `docs/ROADMAP.md`/
`docs/SYSTEME/INDEX.md` nettoyés de la ligne stub périmée ; `client/public/CHANGELOG.md` — entrée
MJ ajoutée (v237).

---

## Session (Dev) — 2026-09-18 — Clôture Sprint 2d Drones : mode autonome « ordres permanents »

**Contexte** : dernier morceau du chantier Drones (`docs/PLANS/PLAN_DRONE.md`) avant Sprint 3
(télépilotage). RAW (LdB p.320) : un drone autonome n'a pas d'Initiative propre, réagit immédiatement
— séquence Détection → Ami/Ennemi → Armement sans intervention MJ/joueur, jusqu'à 3 tentatives (INI
12 → 7 → 2).

**Décision actée en cours d'implémentation (retour Saar)** : pas un réglage de campagne unique —
« le MJ peut être en classique et les joueurs en ordres permanents, ou l'inverse ». Devenu deux
réglages indépendants, `drone_turn_model_gm`/`_player`, discriminés par `characters.user_id` (`NULL`
→ `_gm`, sinon → `_player`), même autorité déjà en place ailleurs dans ce chantier pour « ce drone
est-il possédé par un joueur ? ». Migration 355 remplacée par une migration 356 neuve (355 déjà
appliquée en base avant la révision — correction par migration, pas édition en place,
`.claude/rules/migrations.md`).

**Trouvaille en implémentant** : le déclenchement ne devait pas être un nouveau dispatch sur clic
humain, mais réutiliser le mécanisme déjà construit pour l'explosion de grenade différée
(`registerAutonomousStepResolver`/`autoResolve`, `PLAN_GRENADES.md` §3d) — RAW « réagit
immédiatement », zéro interaction humaine, même famille que « mines, pièges » déjà anticipée dans le
commentaire d'origine du moteur. Extension nécessaire et rétrocompatible : le résolveur autonome
retourne désormais `{ suspend }` (la grenade ne suspend jamais, un drone visant un PJ si — vraie
défense active).

**Analyse à charge du backend menée avant tout test réel** (étape distincte demandée par Saar) : bug
réel trouvé et corrigé (revérifier la LOS à chaque tentative via `resolveAttackLOS` aurait spammé le
chat et risqué une interception fantôme — remplacé par `checkLOSForPrecheck`, une seule fois avant la
boucle) ; incohérence corrigée (Détection/Ami-Ennemi utilisaient une comparaison brute plutôt que le
pipeline de Test standard — un échec critique risque maintenant une Catastrophe comme tout Test).

**Testé** : `node --check`/`eslint`/`npm run build` propres ; `combatTurnEngine.test.mjs` étendu à 25
cas (`node --env-file=.env --test server/src/socket/combatTurnEngine.test.mjs`) ;
`campaignSettingsService.test.mjs` (5/5). **Confirmé fonctionnel en jeu réel par Saar (2026-09-18)** :
bandeau « ordres permanents » dans `DroneWindow.jsx`, résolution autonome au chat, suspension correcte
sur cible PJ.
**Non testé** : Mode `drone_targeting_mode: 'spatial'` (champ présent, non implémenté — refuse
proprement, prévu V2) ; télépilotage (Sprint 3, hors périmètre).
**Données** : migrations 354 (`combat_roster.acquired_target_token_id`/`acquired_drone_weapon_inv_id`)
et 356 (`combat_state.drone_turn_model_gm`/`_player`, remplace la 355 appliquée puis abandonnée).
**Retour arrière** : `git revert` des commits de ce Sprint si besoin ; migrations réversibles
(`down()` testé en round-trip).

**Documentation de clôture** : faits durables intégrés dans `docs/SYSTEME/COMBAT.md` § « Mode
autonome drone — ordres permanents » ; `docs/PLANS/PLAN_DRONE.md` statut mis à jour (Sprint 2d clos,
seul Sprint 3 reste) — pas d'archivage `docs/Old/` tant que le chantier entier n'est pas clos ;
`docs/ROADMAP.md` ligne Drones réduite au seul Sprint 3 restant ; `client/public/CHANGELOG.md` —
entrée MJ ajoutée (v238).

---

## Session (Dev) — 2026-09-18 — Ticket INI1 : Surprise critique non gérée, extraction `surpriseService.js`

**Déclenchement** : ticket `INI1` (« Surprise critique (roll=1) → initiative=1 », cluster Initiative,
jamais investigué). Lecture du code (`COMBAT_SURPRISE_RESULT`, `socketCombatState.js`) : le Test de
Réaction (LdB p.213-214) faisait une comparaison brute `diceRoll <= entry.base_ini` au lieu du
pipeline de Test partagé (`resolveTestOutcome`/`getCriticalSuccessBonus`/`applyCriticalSuccessBonus`,
`shared/polarisTestResolution.js`) — une Réussite critique ne recevait donc jamais le bonus RAW sur
l'Initiative obtenue.

**Élargi en testant** (Saar, jeu réel, deux retours successifs) :
1. Le jet PJ n'affichait aucun contexte en chat (`formula:'1d20'` nu, sans `skillLabel`) et le jet
   auto PNJ (`COMBAT_START`) n'émettait strictement aucun `DICE_RESULT` — silence total. En creusant,
   les deux chemins avaient une seconde divergence, plus grave : le PNJ ne passait par aucun pipeline
   de Test (formule `base_ini + roll` au lieu de la marge de réussite RAW, jamais d'échec possible).
   **Décision structurelle** (question directe de Saar : « un fichier, une responsabilité ? ») :
   extraction d'un module dédié `server/src/lib/surpriseService.js` (même patron que
   `gmArbitratedTestService.js`/`woundService.js`/`activeMalusRegistry.js`, même raison — risque de
   divergence déjà vécu ailleurs, collision PC28, dispatch drone) plutôt qu'un patch local à chaque
   site.
2. Une fois le PNJ audible en chat, Saar a signalé que tous les PNJ surpris étaient révélés d'un coup
   à `COMBAT_START`, avant même le début des déclarations — gameplay gênant (on sait qui va agir avant
   que ce soit pertinent), symptôme resté invisible tant qu'aucun `DICE_RESULT` n'était émis. Corrigé
   en déplaçant la résolution PNJ dans `advanceAnnouncementQueue` (`combatTurnEngine.js`, point
   d'entrée déjà unique de la file d'ANNONCE, partagé par 5 sites) — chaque PNJ surpris est désormais
   résolu à son propre tour (`base_ini ASC`, même ordre que tout le monde), jamais en bloc.

**Portée explicitement limitée** (décision Saar) : une exo-armure pilotée par un PNJ continue de se
résoudre à `COMBAT_START` — cas jamais rencontré en jeu (aucune exo réelle en jeu à ce jour), non
étendu à un chemin non testable en conditions réelles plutôt que deviné.

**Bug corrigé en cours de route** : le blocage PJ ne serait pas apparu — mais en différant la
résolution PNJ, le bloc de prompt PJ (`COMBAT_ANNOUNCE_START`, filtre `surprise_roll IS NULL`) aurait
commencé à traiter aussi les PNJ désormais non résolus à ce stade, ouvrant une ligne `combat_pending`
orpheline (jamais consommable, aucun compte joueur propriétaire). Exclu explicitement
(`character.type==='pnj'`) avant que ça n'atteigne le jeu réel.

**Testé** : `node --check` (4 fichiers serveur), `npx eslint` (composant client, 0 erreur), `npm run
build` client propre, `fr.json` validé, `shared/polarisTestResolution.test.mjs` 25/25 (primitives
réutilisées), `combatTurnEngine.test.mjs` étendu à 27 cas — 2 nouveaux, déterministes (`baseIni=20` →
succès garanti, `baseIni=0` → échec garanti, sans mocker le dé) couvrant la résolution différée, le
contenu du `DICE_RESULT`, l'auto-skip et la trace `combat_actions`. **Confirmé fonctionnel en jeu réel
par Saar (2026-09-18)**, y compris une Réussite critique observée en conditions réelles.
**Non testé** : exo pilotée par un PNJ (scope exclu, voir ci-dessus).
**Données** : aucune migration.
**Retour arrière** : `git revert` du commit si besoin, aucune dépendance externe.

**Documentation de clôture** : faits durables intégrés dans `docs/SYSTEME/COMBAT.md` § « Surprise —
Test de Réaction » (nouvelle section, le mécanisme n'était pas documenté avant) ; `client/public/
CHANGELOG.md` — entrée MJ/joueur ajoutée (v239) ; ticket `INI1` à clôturer en base par Saar (script
fourni, écriture DB jamais faite par Claude).

---

## Session (Dev) — 2026-09-18 — Ticket INI2 : Initiative non recalculée après blessure

**Cause** [VÉRIFIÉ] : RAW (`REGLESYSCOMBAT.md:111`) — les malus de blessure « affectent le niveau de
Réaction du personnage et donc son Initiative de base ». `calcREA` ne les intègre jamais (les
attributs restent "propres", le malus de blessure est une surcouche appliquée Test par Test via
`activeMalusRegistry.js`, jamais injectée dans l'Attribut lui-même) — `combat_roster.base_ini` ne
bougeait donc jamais, blessure ou pas, même acquise avant `COMBAT_START`.

**Dette trouvée en creusant, corrigée au passage** : le calcul "fetch attrs/archétype/avantages +
`calcREA`" était dupliqué en 5 endroits. Réexamen un par un (demandé explicitement par Saar avant de
coder, "100% sûr") : seuls 2 étaient de la vraie duplication à corriger (`COMBAT_START` branche
humanoïde, `GET /battlemaps/:id/combat-ini`) — les 3 autres (`socketDice.js` MACRO_ROLL,
`char-sheet.js`, branche exo de `COMBAT_START`) réutilisent déjà un contexte multi-valeurs partagé
(`loadCharacterTestContext` ou leur propre fetch qui sert aussi à autre chose) ; les faire passer par
la nouvelle fonction aurait dupliqué le fetch DB en plus du contexte déjà partagé — laissés inchangés.

**Piège d'import trouvé en vérifiant, évité avant d'écrire une ligne de code** :
`combatantContextService.js` importe déjà `damageService.js`, qui importe `woundService.js`. Mettre la
nouvelle fonction dans `combatantContextService.js` (l'emplacement "naturel", avec ses fonctions
sœurs `resolveCombatantIdentity` etc.) et la faire importer par `woundService.js` aurait fermé ce
cycle. Nouveau module feuille dédié à la place : `server/src/lib/reactionService.js`
(`computeCharacterBaseIni(db, characterId)`), consommé directement par `woundService.js` et les 2
sites ci-dessus, sans passer par `combatantContextService.js`.

**Ajustement trouvé en implémentant** (annoncé à Saar après coup, pas avant — pas un changement de
périmètre) : seul `base_ini` est retouché par le hook, jamais `initiative` en direct. Une entrée
`combat_timeline_entries` déjà construite ce Tour encode `phase_position = initiative × 100` —
l'écraser à chaud pendant une Résolution en cours aurait pu désynchroniser l'échelle de phases déjà
posée. Le nouveau `base_ini` prend effet sur l'Initiative réelle au Tour suivant via le reset déjà
existant d'`endTurn()` — même latence que la récupération après une Surprise ratée (RAW : « au Tour
suivant, il retrouve son score d'Initiative habituel »), pas une improvisation locale.

**Code** : `server/src/lib/reactionService.js` (nouveau) ; `socketCombatState.js`/`battlemaps.js`
consomment `computeCharacterBaseIni` ; `woundService.js#applyWound` — hook après le broadcast
`WOUND_ADDED` : si le personnage a un token `combat_roster.status='active'`, recalcule `base_ini`
(`computeCharacterBaseIni(...) + calcWoundPenalty(wounds)`), diffuse `COMBAT_ROSTER_UPDATED`. No-op
silencieux hors combat.

**Testé** : `node --check` (5 fichiers), imports runtime vérifiés sans cycle (`node -e
"import(...)"`), `combatTurnEngine.test.mjs` 27/27 (aucune régression), `woundService.test.mjs`
étendu à 8 cas — 2 nouveaux : recalcul déterministe (`grave`=-5, base neutre=3 en fixture sans
attributs → -2 attendu, vérifié) + confirmation qu'`initiative` n'est jamais touchée en direct ; cas
hors-combat (no-op, aucun événement émis). **Confirmé fonctionnel en jeu réel par Saar (2026-09-18)**.
**Non testé** : recalcul multi-tokens (un personnage avec plusieurs tokens actifs simultanément, cas
rare non rencontré en jeu).
**Données** : aucune migration.
**Retour arrière** : `git revert` du commit si besoin, aucune dépendance externe.

**Documentation de clôture** : faits durables intégrés dans `docs/SYSTEME/COMBAT.md` § « Surprise —
Test de Réaction » (sous-section « Initiative après blessure (INI2) ») ; `client/public/CHANGELOG.md`
— entrée MJ/joueur ajoutée (v240) ; ticket `INI2` à clôturer en base par Saar
(`server/src/scripts/resolve_ticket_ini2.js`, déjà commité, écriture DB jamais faite par Claude).

---

## Session (Dev) — 2026-09-18 — Exo-armure : fenêtre non masquée au ciblage (réapplication d'un fix retiré)

**Déclenchement** : retour direct Saar (« la fenêtre EXO-ARMURE ne se masque pas au clic sur CIBLE »).
Lecture du code avant tout diagnostic (invariant #1) : `CombatExoActionWindow.jsx:215-231` documentait
un masquage identique **déjà ajouté le 2026-08-26, puis retiré le 2026-08-27** après un retour Saar
("l'armure n'émet plus aucune action"), avec la note explicite de l'époque « cause probable... root
cause de fond pas encore investiguée » — une hypothèse jamais confirmée, un repli par prudence.

**Analyse avant de recoder** (demandée explicitement par Saar, historique à charge) : vérifié que
`combatTargetMode` (état partagé, `useCombatUIState`) se nettoie déjà par plusieurs chemins — clic
Annuler (bouton rendu dans `CombatOverlay.jsx`, indépendant de la fenêtre elle-même, donc toujours
accessible même masquée), validation de cible, **et** automatiquement à chaque `COMBAT_PHASE_CHANGED`/
`COMBAT_SLOT_ADVANCED` (`useCombatSocket.js#onModeReset`) — l'hypothèse « bloqué indéfiniment » de
2026-08-27 ne correspond pas au code actuel. Trouvaille : le même jour (2026-08-27), un AUTRE bug exo
avait été corrigé — déclarer une arme sans cible envoyait un payload vide, action perdue en silence
(`canDeclareAttack`, `useExoDeclare.js`, garde toujours en place aujourd'hui). Hypothèse retenue,
présentée à Saar avant de coder : le vrai coupable du symptôme de l'époque était plus probablement ce
second bug (déjà corrigé, indépendamment), pas le masquage lui-même.

**Code** : `CombatOverlay.jsx` passe `combatTargetMode`/`combatAoeTargetMode` aux deux montages de
`CombatExoActionWindow` (MJ et joueur) — manquaient tous les deux, `combatAoeTargetMode` n'avait
d'ailleurs jamais été branché du tout (même trou que `combatTargetMode`, trouvé en vérifiant). Réutilise
le même patron que `CombatActionWindow.jsx#isHidden` : dérivé de l'état partagé, jamais un flag local
(`isSelectingOnMap` étendu avec `isTargeting`/`isAoeTargeting`).

**Testé** : `eslint` ciblé (2 fichiers) — 0 nouvelle erreur (2 erreurs pré-existantes dans
`CombatExoActionWindow.jsx`, confirmées par stash avant/après, ticket connu I18N-LINT3 sans rapport) ;
`npm run build` client propre ; `git diff --check`. **Confirmé fonctionnel en jeu réel par Saar
(2026-09-18)**, y compris déclaration effective après ciblage (le point sensible de la régression
2026-08-27).
**Non testé** : aucun point identifié en suspens.
**Données** : aucune migration.
**Retour arrière** : `git revert` du commit si besoin, aucune dépendance externe.

**Documentation de clôture** : faits durables + historique intégrés dans `docs/SYSTEME/EXOARMURE.md`
(nouveau point sous la liste §5) ; `client/public/CHANGELOG.md` — entrée joueur/MJ ajoutée (v241).

---

## Session (Dev) — 2026-09-22 — Clôture Sprint 3 Drones : télépilotage (dernier morceau du chantier)

**Contexte** : dernier Sprint du chantier Drones (`docs/PLANS/PLAN_DRONE.md`), après Sprint 2d (mode
autonome, clos 2026-09-18 ci-dessus). RAW (LdB p.319) : le pilote utilise sa Compétence Télépilotage
(limitative sur le programme du drone), Initiative = celle du pilote, « son action ce tour = l'action
du drone ». Cadrage revu en conversation avec Saar le jour même : action exclusive du Tour, non
persistant (mode persistant différé en V2, jamais demandé), lien pilote↔drone = même autorité que
Sprint 2c/2d (`character.user_id`), pas de nouvelle colonne.

**Trois points de substitution pilote→drone trouvés en codant** (absents du cadrage initial,
`combat_actions.token_id` reste celui du pilote pour l'Initiative, mais chaque effet physique doit
cibler le drone) : déclaration (`socketCombatAnnouncement.js`, budget/position de mouvement du drone),
résolution assault/melee (`socketCombatResolution.js`, `resolvedAction` reconstruit avec le
`token_id` du drone, même patron que `resolveDroneAutoAction`), et un troisième site non anticipé —
la boucle « actions simples » de mouvement en Résolution, qui aurait déplacé le token du pilote au lieu
du drone sans le même correctif.

**Deux bugs trouvés et corrigés avant clôture, jeu réel (même session)** :
1. Garde de phase : `ordres_permanents` distinguait un drone déjà agi via `combat_timeline_entries`,
   qui n'existe pas encore en phase ANNONCE (n'est construit qu'à la transition RÉSOLUTION) — corrigé
   en lisant `combat_actions.status` de la ligne `drone_auto` pré-remplie à la place.
2. Arbitrage ambiant : `CombatActionWindow.jsx` instancie `useAutoMoveMode`/`useCombatClickAttack` 3×
   (pilote / drone en tour propre / drone télépiloté) ; la condition `enabled` du pilote (préexistante)
   n'avait jamais été mise à jour avec `!telepilotDroneId`, le laissant actif en permanence pendant le
   télépilotage et empêchant le drone de s'armer — même défaut dupliqué dans les deux hooks jumeaux.
   Root cause générique : aucune valeur unique ne dérive « quel rôle est actif », chaque site réécrit sa
   propre négation à la main. Corrigé + durci : `registerAmbientAttackHandler` (`useCombatUIState.js`)
   refuse désormais explicitement un écrasement par un autre déclarant (garde d'exclusivité par
   `tokenId`) — `useCombatClickAttack` n'avait aucune protection équivalente à celle de
   `useAutoMoveMode`.

**Plafond de compétence** : `calcLimitedSkillTotal` (déjà réutilisé pour Manœuvre d'armure/Exo)
plafonne le Seuil, jamais la maîtrise/le bonus de critique — vérifié RAW (`ATTRIBUTS.md:209-211`),
pas une extension assumée.

**Testé** : `node --check` propre sur les fichiers serveur touchés, `eslint`/`npm run build` propres
côté client. **Confirmé fonctionnel en jeu réel par Saar (2026-09-22)** : déclaration, Tir/CaC ET
déplacement télépilotés.
**Non testé** : automatisé (pas de nouveau test unitaire dédié à cette session — le test déjà écrit
pendant Sprint 2d pour le cas « drone déjà télépiloté ce Tour, pas re-préposé »,
`combatTurnEngine.test.mjs:522`, tourne déjà sous le flag global `DATABASE_URL`, rien à dé-skip).
Interception RAW en télépiloté (mécanique d'interception absente du moteur, indépendamment de ce
Sprint — non bloquant, non traité ici).
**Données** : aucune migration (colonnes déjà existantes, `action_key`/`type` texte libre).
**Retour arrière** : `git revert` du commit `1054814` si besoin, aucune dépendance externe.

**Documentation de clôture** : faits durables intégrés dans `docs/SYSTEME/COMBAT.md` § « Télépilotage
drone » ; `docs/PLANS/PLAN_DRONE.md` marqué CLOS en tête puis archivé `docs/Old/PLAN_DRONE.md`
(2026-09-23, sur décision de Saar — écrase l'ancienne version périmée du même nom qui y vivait, sans
valeur historique restante une fois ce chantier clos) ; `docs/ROADMAP.md` — ligne Drones retirée
(chantier clos) ; mémoire de session mise à jour. `client/public/CHANGELOG.md` — entrée joueur/MJ
ajoutée (v242).

## Session (Dev) — 2026-09-23 — Placement de token MJ hors combat : validé par défaut

**Root cause** [VÉRIFIÉ code] : tout drag&drop de token par le MJ passait par
`POST /tokens/:id/teleport` — bypass spatial explicite (ni snap au graphe de navigation, ni
`canOccupy`), conçu pour des cas rares (replacer un token legacy, poser derrière un mur verrouillé)
mais devenu le chemin par défaut de tout drag normal. Comme les tests se font depuis le compte MJ,
chaque déplacement hors combat échappait totalement au moteur monde — placement hors-grille,
tokens finissant en chevauchement réel avec une entité (caisse), pathfinding qui « galère » ensuite
sur ces positions invalides. Le joueur (`/world-move`) était déjà validé, non concerné.

**Décision produit écartée avant codage** : un mode persistant à 3 états (« tout permis » / « MJ
restreint » / « Mode Joueur ») togglé par commande chat, proposé par Saar puis écarté après analyse
critique — même classe de risque qu'un bug trouvé la veille (arbitrage ambiant pilote/drone
télépiloté, `project_combat_window_drag_handle` Round 7) : un état qui reste actif après que le
contexte a changé, parce que rien ne force à y repenser. Retenu à la place : pas de mode, un geste
explicite par action (patron pro standard — snap par défaut, touche modificatrice tenue pour forcer
le placement libre ponctuellement).

**Correctif** : nouvelle route `POST /api/tokens/:id/place` (sœur validée de `/teleport`, même
fichier/montage de routeur) — appelle `resolveBattlemapPlacement` (déjà utilisé à la création de
token, snap au point libre le plus proche via graphe de navigation + `canOccupy`), écrit la
position dans une transaction avec verrous (`forUpdate`), resynchronise l'état passager d'ascenseur
via `syncTokenElevatorPassenger` (même primitive que `executeBattlemapTokenMovement`, le chemin
déjà validé — plus correct que le détachement brutal de `/teleport`, un placement validé pouvant
légitimement atterrir sur une cabine). Client (`Canvas3D.jsx`/`Canvas2D.jsx`, `handlePointerUp`) :
drag normal du MJ → `/place` (défaut) ; `Shift` tenue pendant le drop → `/teleport` (bypass
explicite, comportement et capacités du MJ inchangés, juste devenu un geste conscient). Vérifié
avant codage qu'aucune touche modificatrice n'était déjà prise ailleurs dans la scène 3D (grep
exhaustif + config `MapControls`).

**Testé** : `node --check` serveur propre, `eslint`/`npm run build` client propres (0 nouveau
problème). **Confirmé fonctionnel en jeu réel par Saar (2026-09-23)**.
**Non testé** : aucun scénario ascenseur/cabine exercé en jeu réel (vérifié en conception
uniquement) ; `Canvas2D.jsx` non testé en jeu réel (même changement que `Canvas3D.jsx`, modificateur
confirmé libre par grep mais pas rejoué).
**Données** : aucune migration.
**Retour arrière** : `git revert` du commit applicable, aucune dépendance externe.

**Documentation de clôture** : `docs/Old/PLAN_PLACEMENT_TOKEN_MJ.md` marqué CLOS puis archivé
(nom final — `PLAN_BLOCAGE_CASES_OCCUPEES.md` écrasait par erreur un chantier déjà clos et commité
sous ce même nom, `empêcher de poser une ENTITÉ sur une case occupée`, 2026-09-18 ; restauré depuis
git, renommé) ; fait durable intégré à `docs/SYSTEME/MOTEUR_MONDE.md` §7 ; `docs/ROADMAP.md` —
ligne retirée (chantier clos) ; `client/public/CHANGELOG.md` — entrée MJ ajoutée (v243) ; mémoire de
session mise à jour (`project_combat_window_drag_handle` Round 7).

## Session (Dev) — 2026-09-23 — Forme de collision des entités : cercle → forme explicite

**Root cause** [VÉRIFIÉ code + données réelles] : `entityOccupant()` (`worldMovementService.js`,
autorité unique du profil de collision d'une entité) modélisait toute entité comme un cercle
(repli `max(width,depth)/2` en l'absence de `collider` configuré — soit 100 % du catalogue actuel).
Correct pour un objet ~carré, faux pour un objet allongé : « Lot de caisses assorties »
(`width=2,259m, depth=1,049m`) calculait un rayon de 1,13 m, bloquant un token à 1 m sur son côté
étroit alors que l'objet ne fait que 0,52 m du centre à son bord réel dans ce sens. Cercle réutilisé
par simplicité de l'interface acteur (`actorProfile{radius,height}`), jamais un choix délibéré pour
les entités.

**Catalogue futur hétérogène** (confirmé par Saar) : tonneau réellement cylindrique (le cercle est
la forme CORRECTE pour lui), sous-marin/lit/table/chaises/évier/bac plutôt rectangulaires — pas un
simple remplacement cercle→rectangle, un discriminant de forme extensible.

**Processus de cadrage, explicitement demandé par Saar avant tout code** : deux analyses à charge
indépendantes par des agents frais (sans le contexte de cadrage), chacune sommée de vérifier les
affirmations du plan contre le vrai code plutôt que de faire confiance au texte.
- **1ʳᵉ passe** : 5 trous, dont un bug factuel dur — `entity.r` n'a PAS la convention `tokens.r`
  (0-3/90°, pas 0-7/45°, confondues à tort dans la v1) ; `normalizeActorProfile` aurait jeté
  silencieusement les champs de forme, cassant le broad-phase ; rectangle-vs-rectangle atteignable
  via `entities.js`, non couvert ; deuxième autorité de profil de collision dans
  `worldForcedMovementService.js` ; convention d'origine (`floor-center` vs coin) ignorée.
- **2ᵉ passe** : 4/5 corrections confirmées solides (vérifiées contre le code réel) ; la 5ᵉ
  (intégration `worldForcedMovementService.js`) sous-spécifiée au point de régresser
  silencieusement si codée telle quelle (geometry jamais chargée, objet enveloppe passé au lieu du
  profil plat, `null` non géré) — corrigée avec 3 précisions exactes.
- Bonne surprise : corriger la convention de rotation a *simplifié* l'algorithme — avec seulement
  4 orientations possibles (0/90/180/270°), un rectangle d'entité est toujours axis-aligned, donc
  aucune trigonométrie nécessaire nulle part (clamp axis-aligned pour cercle-vs-rectangle,
  `boundsIntersect` déjà existant réutilisé tel quel pour rectangle-vs-rectangle).

**Trouvailles en codant, au-delà des deux revues** — grep exhaustif systématique plutôt qu'un
correctif site par site :
1. `loadBattlemapDynamicOccupants` (fonction la PLUS utilisée du moteur monde : pathfinding,
   placement, déplacement de tokens) ne sélectionnait jamais `entities.r` — sans ce correctif,
   aucune entité tournée n'aurait jamais son échange largeur/profondeur appliqué dans le chemin le
   plus emprunté du jeu réel.
2. `entities.js` (création ET déplacement d'entité) : les candidats testés avant écriture ne
   transmettaient pas non plus `r` — un commentaire existant affirmait explicitement le contraire
   (« r n'entre pas dans le test »), vrai avant ce plan, faux depuis. Corrigé, commentaire mis à
   jour.
3. Régression trouvée en LANÇANT les tests existants (pas par une revue) : un test de
   `worldForcedMovementService.test.mjs` comptait implicitement sur l'ancien défaut
   `entityProfile = {}` — cassé en changeant le défaut vers `null` (sémantique « entité non
   bloquante, aucun test pour elle-même »). Corrigé en rendant le test explicite + nouveau test
   dédié au cas `null`.

**Design retenu** : `collider.shape` explicite et extensible (`circle`/`rect`, capsule documentée
V2 — sous-marin/tonneau couché, pas construite). Défaut `rect` pour tout blueprint non configuré —
strictement plus sûr qu'un cercle pour la quasi-totalité du catalogue actuel et futur. Acteur
(token) toujours un cercle, inchangé. `normalizeActorProfile`/`actorFootprintsOverlap`
(`shared/world/spatialIndex.js`) dispatchent selon la forme de chaque occupant ; rayon "enveloppe"
(demi-diagonale) conservé pour le broad-phase (`actorBoundsAt`), jamais un faux négatif possible.

**Testé** : `node --check` sur les 4 fichiers serveur/partagés touchés, 623 tests verts
(`shared/**/*.test.mjs` complet + les 3 fichiers serveur touchés, 0 échec). **Confirmé fonctionnel
en jeu réel par Saar (2026-09-23)**.
**Données** : aucune migration.
**Retour arrière** : `git revert` du commit applicable, aucune dépendance externe.

**Documentation de clôture** : `docs/Old/PLAN_FORME_COLLISION_ENTITES.md` marqué CLOS puis archivé
(vérifié `docs/Old/` avant archivage — leçon du chantier précédent, cf. mémoire de session) ; fait
durable intégré à `docs/SYSTEME/MOTEUR_MONDE.md` §7 ; `docs/ROADMAP.md` — ligne retirée (chantier
clos) ; `client/public/CHANGELOG.md` — entrée joueur/MJ ajoutée (v244) ; mémoire de session mise à
jour (`project_combat_window_drag_handle` Round 7).

---

## Session (Dev) — 2026-09-24 — Option de campagne `players_edit_statuses` (statuts de token : joueurs ou MJ seul)

**Origine** : préalable du chantier `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md` (Lot 1, statut `dead`).
Saar voulait d'abord réserver tous les statuts au MJ ; relu contre le code, cela renversait la
décision de `docs/Old/PLAN_STATUT.md` (« Propriétaire ajoute+retire son token ») et retirait aux joueurs
un usage existant (`grappled`, `off_balance`…). **Décision Saar (2026-09-24)** : ne pas trancher pour
tout le monde — **option de campagne laissée au MJ, défaut autorisé** (comportement historique
inchangé, aucun impact sur les campagnes existantes).

**Implémenté** : clé `players_edit_statuses` (booléen, défaut `true`) dans `SETTINGS_SCHEMA`
(`server/src/lib/campaignSettingsService.js`) ; `TOKEN_STATUS_TOGGLE` (`socketToken.js`) ignore la
bascule d'un non-MJ quand l'option est `false` — **serveur autoritaire**, le client (panneau en lecture
seule, légende « Lecture seule ») ne fait que refléter ; case à cocher dans les réglages de campagne
(`SectionGameRules.jsx`) ; propagation en direct par `CAMPAIGN_SETTINGS_UPDATED` existant. Aucune
migration (JSONB + `mergeWithDefaults`). Indépendante de `status_effects_mode` (affichage/application
des effets, pas les droits).

**À venir dans ce chantier** (commit suivant, pas ici) : le statut `dead` sera réservé au MJ
**quelle que soit** cette option — mort et résurrection ne sont pas une auto-déclaration de joueur.

**Testé** : `node --check` (2 fichiers serveur), `fr.json` valide, `node --test
server/src/lib/campaignSettingsService.test.mjs` (6/6), ESLint client 0 erreur, `git diff --check`.
**Confirmé fonctionnel en jeu réel par Saar (2026-09-24), aucun écart** (option cochée/décochée,
joueur/MJ).
**Données** : aucune migration. **Retour arrière** : `git revert` du commit applicable.

---

## Session (Dev) — 2026-09-24 — Cadrage : la 6ᵉ ligne du compteur de blessures (Mort subite / Membre détruit)

**Décisions de cadrage** (détail et architecture : `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md`, aucun
code écrit à ce stade) :
- **Cause racine unique** [VÉRIFIÉ code] : le moteur n'implémente que 5 des 6 lignes du compteur RAW
  (`REGLEBLESSURES.md:20-26,135-149`). Trois symptômes : un coup ≥ 30 = simple Mortelle + drapeau
  `is_lethal` non persisté ; aucun état « mort » ; débordement de la ligne Mortelle **muet**
  (`nextSeverity('mortelle') === null` → `applyWound` renvoie `null`, aucune blessure écrite).
- Le report du 2026-07-29 (Membre détruit = option future) était une décision de **périmètre** du lot
  Guérison, pas une affirmation du RAW ; **Mort subite n'y avait jamais été tranchée**. Ce chantier
  lève le report.
- **La 6ᵉ ligne = une seule case, six localisations**, affichée comme un mot (« Mort » sur Tête/Corps,
  « Membre détruit » sur les membres), toujours visible, cliquable. Une blessure « Mort » pose le
  statut de token `dead` ; il disparaît avec elle.
- **Écart RAW assumé — Chance** : racheter une Mort subite en Blessure critique coûtera **3 points**
  de Chance (le RAW, `REGLE_CHANCE.md:122-123`, ne chiffre pas ; 2 semblait trop peu vu la
  gravité). Dépasse aussi la limite générale de 2 points d'un seul coup : exception propre à cette
  ligne. Applicable seulement quand le Lot 3 sera codé.
- Membre détruit : blessure aiguë (6ᵉ gravité) **et** état permanent du membre séparé (paralysie
  au-delà de la guérison en Critique) → rendu barré/gris, Lot 4 du plan.

**Retour arrière** : sans objet (décisions, aucun code).

---

## Session (Dev) — 2026-09-24 — Registre unique des statuts de token (refactor, zéro changement de comportement)

**Root cause** [VÉRIFIÉ code] : le vocabulaire des statuts (`token_statuses.status_code`, texte libre sans
catalogue) était **recopié** dans 3 listes (`socketToken.js`, `TokenStatusPanel.jsx`,
`TokenPresentation.jsx`) + les 4 couleurs de catégorie dans 2 fichiers client, et chaque règle de
comportement (déclaration bloquée, sans défense, nettoyage de fin de combat) était un tableau littéral
dispersé dans le moteur de combat. Ajouter un statut (`dead`, prochain commit) aurait exigé 6+ éditions
parallèles sans garde-fou.

**Décision** (Saar délègue l'architecture, cible : robuste/pérenne/adaptative ; recherche : FoundryVTT
`CONFIG.specialStatusEffects` + foundryvtt#9245, dnd5e `conditionTypes`) : **registre unique en code**
`shared/tokenStatusRegistry.js` (entrées `{ code, category, manualToggle, inPanel, blocksDeclaration,
defenseless, clearedAtCombatEnd }`), structures dérivées. **Pas de table SQL catalogue** (un statut porte un
comportement = du code ; patron des autres registres du projet ; testable sans base) — évolution « statuts
créés par le MJ » notée, compatible. Périmètre : les 16 codes des 3 listes ; `iem_survival` et
`ati_*` restent déclarés par leur propriétaire (recherche tolérante). Sémantiques propres volontairement
non dérivées : expiration d'étourdissement, exclusion mutuelle, garde d'annonce.

**Testé** : `node --test shared/tokenStatusRegistry.test.mjs` (9/9, instantané des anciens littéraux :
bascule, panneau + ordre, catégories, couleurs, 3 ensembles de comportement, invariants, tolérance aux codes
inconnus) ; `node --test 'shared/**/*.test.mjs'` complet (659/659) ; `node --check` des 4 fichiers serveur ;
ESLint client (2 fichiers, 0 problème) ; `npm run build` client OK ; `git diff --check`.
**Non testé** : scénario en jeu (panneau Statuts, étourdir un token, fin de combat) — à faire par Saar.
**Données** : aucune migration. **Retour arrière** : `git revert` du commit applicable.

**Documentation** : `docs/SYSTEME/STATUTS_TOKEN.md` créé (+ ligne `INDEX.md`) ; `VOCABULARY.md` — affirmation
périmée (« `status_code` ne connaît que stunned/unconscious ») corrigée.

---

## Session (Dev) — 2026-09-24 — Statut de token `dead` (« Mort ») + règle de droits unique sur les statuts

**Origine** : Lot 1b de `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md` (décision Saar : la mort est un statut de
token ; une blessure « Mort » le posera au Lot 2). Ce commit ne fait que le statut et ses droits.

**Implémenté** : entrée `dead` dans `shared/tokenStatusRegistry.js` (`gmOnly`, `blocksDeclaration`,
`defenseless`, catégorie `mort` gris sombre, **ni expiration ni `clearedAtCombatEnd`**) ; icône
`client/public/assets/status/dead.svg` ; `fr.json` `status.dead` = « Mort ». Un token mort a son tour passé
automatiquement par la garde de résolution existante (comme `unconscious`, uniquement en mode `enforced`), est
« sans défense », et **reste mort après le combat** — seul le MJ le retire (bascule ou `/heal`).
**Droits** : nouveau drapeau `gmOnly` (`burning`, `acid`, `decompression`, `hypothermia`, `dead`) et **une seule
règle** `canEditTokenStatus`, appelée par le serveur (`socketToken.js`, autorité) ET le panneau client — plus de
comparaison `isGm`/`isOwner` recopiée. **Défaut de droits refermé** : le serveur acceptait la bascule nue de
`hypothermia` par un joueur propriétaire (le client ne l'envoyait jamais) ; désormais refusée. Le message de
refus lit le libellé dans `status.<code>` (plus de branche « inconscient »/« étourdi » en dur).

**Décisions assumées** : un mort garde un tour d'initiative passé automatiquement en attendant le lot 1c (sortie
de la file d'initiative, non cadré — Saar : acceptable provisoirement) ; option `players_edit_statuses`
inchangée pour les statuts ordinaires.

**Testé** : `node --test shared/tokenStatusRegistry.test.mjs` (15/15 : instantané mis à jour volontairement avec
`dead`, `gmOnly`, matrice de la règle de droits, `dead` jamais nettoyé en fin de combat, **garde-fou icône +
clé i18n pour tout statut affiché ou bloquant**) ; `node --test 'shared/**/*.test.mjs'` complet 667/667 ;
`node --check` ; ESLint client (0 erreur, 1 avertissement préexistant) ; `npm run build` client OK.
**Non testé** : scénario en jeu — à faire par Saar. **Données** : aucune migration. **Retour arrière** :
`git revert` du commit applicable.

---

## Session (Dev) — 2026-09-24 — Retrait direct des dangers Feu/Décompression (plus de fenêtre de confirmation)

**Origine** : retour de Saar au test de « Mort » — une fenêtre de confirmation apparaissait « parfois » au retrait
d'un statut. [VÉRIFIÉ code] Elle ne concernait que les 4 statuts à formulaire dédié (`TokenStatusPanel.jsx`) :
Enflammé, Décompression (simple bouton « Retirer » = pure confirmation), Corrodé (vrai choix de règle : « persiste
1D6 Tour(s) après retrait ») et Hypothermie (le formulaire sert aussi à *modifier* la tranche de froid d'une
exposition en cours).

**Décision** : supprimer les confirmations **pures** seulement. Feu et Décompression se retirent en un clic.
Acide garde son formulaire (choix RAW) ; Hypothermie garde le sien (modification de tranche) — non retirés sans
accord de Saar. **Autorité unique** : nouveau drapeau `lingersOnClear` (Acide) dans
`shared/environmentalHazardRegistry.js`, lu par le serveur (`clearHazard` refuse `linger` sans lui, à la place du
littéral `'acid'`) ET par le panneau (formulaire seulement si le danger a un choix). `HAZARD_CODES` du panneau
est désormais dérivé de ce registre (constaté (iii) du Lot 1a, résolu).

**Testé** : `node --test` registre des dangers + registre des statuts (19/19), `node --check` service, ESLint
client (0 problème), `npm run build` OK, `git diff --check`. **Non testé** : scénario en jeu (retirer Enflammé et
Décompression en un clic ; Corrodé ouvre toujours son formulaire ; Hypothermie inchangée) — à faire par Saar.
**Données** : aucune. **Retour arrière** : `git revert` du commit applicable.

---

## Session (Dev) — 2026-09-24 — Lot 1c : blocage PROACTIF des tokens bloqués (mort / étourdi / inconscient)

**Origine** : retours de Saar au test de « Mort » — « la fenêtre de déclaration s'affiche pour le mort » puis, à la
résolution, « action impossible, vous êtes mort » : « le blocage n'est pas au bon endroit ». [VÉRIFIÉ code] Cause
racine : « ce token peut-il agir ? » n'était posé que par deux gardes *réactives* (`socketCombatResolution.js`
PRECHECK/CONFIRM), APRÈS l'ouverture de la fenêtre ; même défaut pour `stunned`/`unconscious`.

**Décision (conception + analyse à charge dans `PLAN_BLESSURE_SIXIEME_LIGNE.md`)** : la question se pose là où le
moteur CHOISIT le prochain acteur. Autorité unique `getDeclarationBlockedTokens` (`combatTurnEngine.js`, statuts
`blocksDeclaration` du registre + stun en attente, mode `enforced` seulement) ; ANNONCE : `advanceAnnouncementQueue`
passe le token par `skipPlayer` ; RÉSOLUTION : `advanceTimeline` clôt son pas par `forfeitToken` sans `SLOT_ACTIVE`
(y compris tour obligatoire des retardataires ; « X a été passé » sans doublon). **Garde-fou anti-boucle** : pas de
passage automatique s'il ne reste aucun acteur non bloqué (drones `ordres_permanents` exclus des acteurs) — sinon les
Tours défileraient seuls. Erreur de lecture → fenêtre normale (jamais une file figée). Les 2 gardes des handlers
appellent la même fonction et restent en filet. Effet de bord voulu : `stunned`/`unconscious` en bénéficient.

**Testé** : `node --check` ; `node --test 'shared/**/*.test.mjs'` 671/671 ; test pur `hasActionableToken` ;
12 tests d'intégration ajoutés à `combatTurnEngine.test.mjs` — **lancés par Saar sur sa base locale :
40/40** (`node --env-file=.env --test server/src/socket/combatTurnEngine.test.mjs`). En jeu (log de Saar) : mort passé
à l'annonce et à la résolution sans fenêtre ni doublon. **Non testé** en jeu : mort au milieu/dernier, PJ mort,
mort+inconscient, tous bloqués, `icon_only`. **Données** :
aucune migration. **Retour arrière** : `git revert` du commit applicable.

---

## Session (Dev) — 2026-09-24 — Drone d'interception, Lot 1 : le drone bouclier s'interpose sur un tir

**Origine** : dette RAW `COMBAT_FLUX.md` §7.4 (« Programme interception — non implémenté »). RAW `REGLEDRONE.md` « Drone
bouclier » : Test avec le niveau d'interception ; si sa marge de réussite est supérieure à celle de l'attaque, le drone
s'interpose ; inutile au corps à corps. Cadrage complet (plan v2.1, analyse à charge, recherche : midi-qol pour les
réactions à des moments nommés du pipeline, rpg-toolkit pour la pause/reprise) puis code, commit `d75907b`.

**Décisions de règle (Saar, 2026-09-23/24)** : le drone n'intervient que sur ce qui **vise son protégé** ; il rejoint au
plus court une case que la trajectoire traverse, avec sa vitesse maximale, et **se déplace dès qu'il tente**, avant le Test,
réussi ou non — mais **jamais sur un tir raté** ; un drone protège plusieurs personnages, lien persistant ; l'exo est
protégée (elle protège déjà son pilote) ; aucune exception « tir ami » ; un drone d'interception ne « passe » pas
(réaction, pas action de Tour) ; **le décor ne bloque pas le drone, seuls les tokens** (option B).
**Simplifications actées (écarts au RAW ou lectures)** : pas de registre de mouvement par Tour (le déplacement d'interposition
est gratuit) ; drone aérien traité comme au sol (`mode_deplacement` est narratif, décision du 2026-08-28) ; un seul
protecteur par attaque (meilleur niveau, égalité → identifiant), pas de cascade ; aucun modificateur sur le Test
d'Interception ; le drone doit **réussir** son Test ET dépasser strictement la marge d'attaque ; un drone télépiloté ce Tour
ne s'interpose pas.

**Architecture** : noyau pur `shared/droneInterception.js` (éligibilité, choix du protecteur, décision) ; coquille
`server/src/lib/droneInterceptionService.js` ; accroche unique par famille de tireur (`finalizeAssaultHitOutcome`,
`finalizeAssaultOutcome` avec `attackKind` explicite car il sert aussi le corps à corps d'un drone) ; navigation à
destination par prédicat + borne de coût, cases traversées `gridCells.js`, `ignoreEntityOccupants`, émetteur partagé
`tokenMovementEmitter.js` ; table `drone_interception_targets` (migrations 357-359) exclue du coffre ; routes REST + section
« Protection » de la fiche drone. Chat : chaque étape est dite (clés `session.drone*`), y compris les refus et les tirs
ratés ; messages de dégâts d'un drone (gravité, intégrité) aux 5 sites de dégâts, gravité issue de la table RAW partagée
(`woundSeverityForDamage`).

**Corrigé au passage** : notices système de même clé et de même milliseconde perdues (id client) ; alerte « Initiative ≤ 0 :
Action reportée » émise à tort pour tout drone en ordres permanents (`buildTimelineEntries` déduisait le report de
`resolution_snapshot != null`, or `drone_auto` y pose `{ autoResolve: true }`).

**Testé** : 669 tests `shared/**` + tests purs serveur ; rejeu en lecture seule sur la carte de test ; en jeu (Saar) : drone
qui perd, drone qui gagne (MR 7 contre marge 8), déplacement visible, messages. **Non testé** : effets de bord avec joueurs
(beta test). **Données** : migrations 357-359 appliquées (catalogue : catégorie `interception` par `name`). **Retour arrière** :
`git revert d75907b` (les `down()` des migrations sont écrits).

---

## Session (Dev) — 2026-09-24 — Drone d'interception, Lot 2 : grenades et explosifs

**Origine** : RAW « s'il réussit à bloquer une arme affectant une zone [...] il absorbe la moitié des dommages ». Commit
`b2cf98d`.

**Décisions de règle (Saar, 2026-09-24)** : le drone ne distingue pas un explosif d'un projectile (même règle « au plus
court ») ; contre une grenade il l'**attrape en vol : elle tombe à ses pieds** et explose là, tout de suite (percussion) ou
au Tour suivant (minuterie) ; il prend **la moitié des dommages BRUTS, avant blindage et RD, arrondie à l'inférieur, et lui
seul** — les autres cibles de la zone, protégé compris, prennent les dégâts normaux ; la **marge de l'attaque est celle du
Test de Coordination du lancer** (négative si le lancer est raté : un lancer raté est facile à intercepter) ; le drone joue
sur la **trajectoire réelle**, après dispersion. **« Vise son protégé » = point visé à moins de
`GRENADE_PROTECTION_AIM_RADIUS_M` (1,5 m au départ) des pieds du protégé**, même étage : décision prise après le test en jeu
du modèle « case exacte », jugé ridicule (point visé à 1,43 m de la cible mais dans la case voisine, aucun drone ne réagissait).
Le rayon est une **constante réglable** (`shared/droneInterception.js`) à ajuster aux tests ; **valeur finale à consigner ici
après le beta test**. Un tir n'active toujours le drone que si le protégé en est la cible.

**Trouvaille de conception** : `isInterposed` devait exiger un Test **réussi** — contre un lancer de grenade raté (marge
négative), un Test de drone raté « moins négatif » passait à tort.

**Non couvert** : cônes et jets (fusil à pompe, lance-flammes : pas de recentrage), grenade lancée par une exo-armure ou un
drone (non câblé), CRD multi-drones (Lot 3 : plafond 4, −1 par interception supplémentaire).

**Testé** : 671 tests `shared/**` (dont `isInterposed`, `halveExplosionDamage`, `aimedAtProtected` par distance) ; rejeu en
lecture seule ; en jeu (Saar) : drone qui perd (jet 17 contre Seuil 10, grenade qui suit sa trajectoire), drone qui gagne à
percussion (jet 2 contre lancer raté, grenade tombée aux pieds du drone, persistée en base). **Non testé** : grenade à
minuterie avec drone gagnant et explosion du Tour+1, effets de bord — beta test avec joueurs. **Données** : aucune migration.
**Retour arrière** : `git revert b2cf98d`.

**Constats hors chantier** (tickets : `server/src/scripts/create_tickets_20260924_drone_beta_findings.js`, à lancer par Saar) :
fenêtre Chance PNJ « Catastrophe — … » peu claire ; message figé « L'ordre a changé entre-temps » ; badge « succès » sur la
durée d'étourdissement ; 403 sur les blessures d'un PNJ côté joueur ; drone : −1 d'intégrité à chaque touche même sous 5 de
dégâts nets, à confronter au RAW. Un token « mort » restait cible d'une zone : transmis à la session « Gestion MORT ».

---

## Session (Dev) — 2026-09-24 — Lot 1e : un mort ne dépense pas de Chance (et ne reçoit aucune fenêtre)

**Origine** : test de Saar — un token « mort » a reçu « Éviter la zone d'effet — Échec 14 » d'une grenade
(session « drones », relayé). [VÉRIFIÉ code] `queryTokensInShape` ne filtre aucun statut ; les fenêtres de Chance de
l'esquive de zone, de la réduction de gravité et de la défense au contact ne regardaient pas la mort.

**Décision de Saar** (RAW muet sur le cadavre — décision de règle, pas un raccourci) : le mort ne peut NI esquiver NI
dépenser de Chance, MAIS il reste une cible qui prend des blessures (technologies de résurrection) → aucun filtrage
des cibles, seulement plus de fenêtre. **Conception** : propriété de registre `isDeath` (`dead`) ;
`deathStateService.js:isCharacterDead` (feuille ; lecture au niveau du personnage, mode `enforced` seulement) ;
`resolveChanceRecipientCharacterId(db, campaignId, characterId, type)` (autorité EXISTANTE du destinataire de Chance,
contrat « `null` = aucune fenêtre » déjà respecté par ses 3 appelants) renvoie `null` pour un cadavre (exo : exo OU
pilote morts). Signature changée (`campaignId` ajouté en 2ᵉ position) : les 3 appelants mis à jour.
Modèle : « immunités aux états » de dnd5e / PF2e (la cible reste visée, seul l'effet n'est pas appliqué).

**Testé** : `node --check` ; imports ESM des modules touchés (aucun cycle) ; `node --test 'shared/**/*.test.mjs'`
672/672 (dont `isDeath`) ; 4 tests d'intégration `deathStateService.test.mjs` (`skip` sans base — à lancer par Saar :
`node --env-file=.env --test server/src/lib/deathStateService.test.mjs`). **Non testé** : ces tests en base ; le
scénario en jeu (grenade sur un mort : plus d'esquive ni de Chance, il prend les dégâts ; blessure grave sur un mort :
pas de fenêtre de réduction). **Données** : aucune migration. **Retour arrière** : `git revert` du commit applicable.

---

## Session (Dev) — 2026-09-24 — Lot 1f : un cadavre ne reçoit pas d'état de corps vivant

**Origine** : log du test de Saar — un tir sur le token mort a lancé le test de Choc puis `applyStunWithDuration …
stunned duration:3` sur lui. **Décisions de Saar** (RAW muet sur le cadavre) : INTERDITS = Entravé, Déséquilibré,
Étourdi, Inconscient, Asphyxie, Aveuglé, Hypothermie, Évanoui ; AUTORISÉS = Enflammé, Corrodé, Irradié, Saisi,
Électrocuté, Infecté, Empoisonné, Décompression (« le corps reste là et prend des blessures ») ; test de Choc ET
durée d'étourdissement coupés ; **le MJ reste libre** ; à la mort, tous les états interdits sont retirés.

**Conception** (modèle « immunités aux états » dnd5e/PF2e : la cible reste visée, seul l'effet n'est pas appliqué) :
propriété de registre `incompatibleWithDeath` (ensemble dérivé) ; `isTokenDead`/`isCharacterDead`
(`deathStateService.js`, niveau personnage, mode `enforced`) ; barrière dans `applyStunWithDuration` (SEUL écrivain
automatique d'étourdi/inconscient/évanoui — vérifié par lecture de tous les `status_code` écrits) avec option
`gmOverride` pour `COMBAT_APPLY_STUN` ; Choc coupé dans `resolveTargetHit` (seul site de `resolveShockTest`) ;
`applyDeathConsequences` (purge des états interdits sur tous les tokens du personnage + `combat_pending` 'stun'),
appelée par la bascule `dead` de `socketToken.js` ; `canEditTokenStatus` reçoit `targetIsDead` (serveur + aperçu du
panneau, prop `statusEffectsMode`). Le formulaire d'hypothermie/danger du MJ n'est pas borné (MJ libre).

**Testé** : `node --check` (tous fichiers) ; imports ESM sans cycle ; `node --test 'shared/**/*.test.mjs'` 674/674 ;
ESLint client (0 erreur, avertissements préexistants de SessionPage) ; `npm run build` client OK ; 4 tests
d'intégration ajoutés à `deathStateService.test.mjs` (8 au total) — **lancés par Saar sur sa base locale : 8/8**
(`node --env-file=.env --test server/src/lib/deathStateService.test.mjs`). **Non testé** : le scénario en jeu (tir sur un mort : blessure sans Choc ni étourdissement ; marquer « Mort » un token étourdi : statut
retiré ; joueur sur son token mort : états interdits grisés). **Données** : aucune migration. **Retour arrière** :
`git revert` du commit applicable. **Limite connue** : choix d'étourdissement déjà ouvert chez un joueur à la mort.

---

## Session (Dev) — 2026-09-24 — CLÔTURE du chantier « Statut Mort » (Lots 0, 1a→1f) — documentation complète, plan archivé

**Constat de Saar** : le chantier avait été mené lot par lot sans plan à lui — son détail vivait dans
`PLAN_BLESSURE_SIXIEME_LIGNE.md` (§4 « Lot 1 »), qui porte un autre sujet (la 6ᵉ ligne du compteur RAW, Lots 2-4, non commencés).
**Décision** : chaque plan garde une responsabilité (Règle 1). Le chantier est clos et documenté selon la checklist de la Règle 10.

**Livré** (7 commits, tous validés en jeu par Saar ; `df7dcce`, `845412d`, `c30ce5b`, `65dc133` déjà poussés, `b443c4c`, `35a5197`,
`26543f6` non encore poussés) : option de campagne `players_edit_statuses` ; registre unique des statuts
(`shared/tokenStatusRegistry.js`) ; statut `dead` réservé MJ ; retrait direct des dangers Feu/Décompression ; blocage proactif
(`getDeclarationBlockedTokens`, moteur de tour) ; un cadavre ne reçoit ni fenêtre de Chance ni test de Choc ni état de corps vivant,
purge à la mort (`applyDeathConsequences`), le MJ reste libre. Aucune migration.

**Documentation de clôture** (rien de dupliqué : chaque information a UN endroit) :
- **Plan** : `docs/Old/PLAN_STATUT_MORT.md` créé (historique, décisions, lots, recherches, analyses à charge, tests, limites) et **archivé**
  d'emblée ; `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md` allégé de 280 lignes (ne garde que les Lots 2-4, pointeur vers le plan archivé ;
  point ouvert « Mort : par token ou par personnage ? » tranché).
- **SYSTEME** : `STATUTS_TOKEN.md` réécrit (registre + tableau des 16 codes, options de campagne, qui pose/retire, blocage proactif,
  cadavre, invariants, limites) ; `COMBAT.md` (blocage proactif + cadavre ; bloc `is_stunned` d'`state_character` déclaré périmé ;
  chemin du moteur corrigé) ; `COMBAT_FLUX.md` (file d'annonce : token bloqué, gardes STUN2 = filets, Choc coupé, `applyStunWithDuration`
  corrigé — exclusion mutuelle, pas de merge) ; `BLESSURES.md` (5 lignes sur 6, mort par statut) ; `SERVICES_COMBAT.md` (nouveaux
  services) ; `COUVERTURE_RAW.md` (écart de la 6ᵉ ligne) ; `CONVENTIONS.md` §19 (pièges P59-P62) ; `INDEX.md` (statuts, plan, 3 couplages).
- **VOCABULARY** : « Mort (statut) » précisé, « Cadavre » et « État de corps vivant » ajoutés.
- **Règles automatiques** : `.claude/rules/combat.md` (invariant statuts/cadavre + 4 chemins ajoutés à ses `paths`, dont
  `combatTurnEngine.js` qui n'était couvert par aucune règle).
- **Suivi** : `ROADMAP.md` (ligne « 6ᵉ ligne du compteur de blessures », Lots 2-4 ; « Membres détruits » repointé) ; `EN_COURS.md` (ligne de
  vigilance P59-P62) ; 7 tickets préparés dans `server/src/scripts/create_tickets_20260924_statut_mort_constats.js` (**à lancer par Saar** :
  `node --env-file=.env server/src/scripts/create_tickets_20260924_statut_mort_constats.js`) ; `CHANGELOG.md` v245→v250 (libellés réels de
  l'option). `ASBUILT.md` volontairement non touché : il décrit le *déployé et stable*, et ce chantier n'est pas déployé (non poussé).

**Testé** : voir chaque entrée de lot ci-dessus ; `node --test 'shared/**/*.test.mjs'` 674/674 ; `combatTurnEngine.test.mjs` 40/40 et
`deathStateService.test.mjs` 8/8 lancés par Saar sur sa base ; `git diff --check`. **Non testé** : rien de nouveau (documentation).
**Données** : aucune. **Reste** : push par Saar (3 commits de code locaux + ce commit de documentation) ; lancer le script de tickets ;
puis Lots 2-4 (6ᵉ ligne) — plan + analyse à charge avant tout code.
