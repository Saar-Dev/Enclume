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
