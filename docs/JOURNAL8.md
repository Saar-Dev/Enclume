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
