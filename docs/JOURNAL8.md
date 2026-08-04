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
