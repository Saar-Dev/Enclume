## Session 163 (Saar) — 2026-07-19 — Anomalie infra notée : `knex migrate:rollback` inopérant ⚠️ NON INVESTIGUÉ

**Contexte** : en validant le retour arrière de la migration `178_ammo_charge_electrique.js`
(`docs/PLAN_CAC_BATTERIE.md`), `knex migrate:rollback` (CLI) annonce un succès (« Batch rolled
back ») mais ne modifie ni la ligne `knex_migrations` correspondante ni les données — vérifié :
`migration_time` identique avant/après l'appel, aucune ligne `ref_equipment` revenue en arrière.

**Isolé `[VÉRIFIÉ]`** : le `down()` de la migration n'est pas en cause — appelé directement en
Node (import du fichier de migration, `migMod.down(db)`, en contournant la CLI), il s'exécute
correctement (20 lignes → 0, aucune exception). Le problème est donc dans le chemin rollback de
Knex lui-même sur ce projet, pas dans une migration précise.

**Piste non creusée** : `server/src/db/naturalMigrationSource.cjs` (chargeur de migrations custom
du projet, `NaturalMigrationSource`) — jamais vérifié spécifiquement côté rollback jusqu'ici.
`migrate:latest` fonctionne correctement avec ce même chargeur (vérifié à plusieurs reprises), donc
si la cause est bien là, elle est spécifique au chemin de lecture/exécution du rollback.

**Décision (Saar)** : ne pas investiguer maintenant — noter et enquêter seulement si le besoin de
rollback se reproduit en pratique.

**Contournement utilisé cette session** (fiable, vérifié deux fois) : suppression manuelle de la
ligne `knex_migrations` concernée puis `migrate:latest` normal, plutôt que `migrate:rollback`.

**Non testé** : cause racine réelle de l'anomalie CLI. **Retour arrière** : sans objet (rien codé,
constat uniquement).

---

## Session 166 (Saar) — 2026-07-19 — Cluster bugs combat (audit `COMPARATIF.md`) : INI4, MELEE-MR, DEF5, TIRIMP, WNDMORT ✅ codés, navigateur non testé

**Contexte** : reprise du triage `docs/BUGIDENTIFIE.md` pendant que le chantier Tir Multi attendait sa
validation navigateur (commité et clos entre-temps, session 165). Priorisation proposée par Saar :
purge des dettes fantômes/déjà résolues avant tout code (JSON1, KIWI2 — jamais mis à jour dans les
registres malgré résolution antérieure), puis le cluster combat confirmé par `docs/Old/COMPARATIF.md`,
un correctif isolé à la fois, chaque RAW exact revérifié dans `docs/REGLES/REGLESYSCOMBAT.md`/
`REGLEBLESSURES.md` avant de coder — plusieurs paraphrases de `BUGIDENTIFIE.md` se sont révélées
imprécises ou incomplètes à la relecture du texte source.

**Hygiène registre (avant tout code)** : `JSON1` (déjà résolu par le merge `caaf1af` "Fusion Kiwi",
jamais retiré du registre) et `KIWI2` (résolu, confirmé Saar) clos sans code. Corrections de
nomenclature `MANUELSYSCOMBAT.md` déjà faites (vérifié). `ST1` et `CH1` reclassés chantiers UI/UX
dédiés (`docs/ROADMAP.md`) plutôt que correctifs ponctuels, sur diagnostic affiné par Saar.

**INI4** — `initiative` jamais remise à `base_ini` en fin de tour. Une ligne ajoutée à l'`UPDATE
combat_roster` déjà existant dans `endTurn` (`socketCombatHelpers.js`), même requête que les 6 autres
champs déjà réinitialisés par tour.

**MELEE-MR** — dégâts CaC calculés sans le MR (dette Session 67). La table `mrTable`/`getModifier`
déjà utilisée côté tir portée aux 4 sites CaC réels (`confirmMeleeDefense` PNJ/PJ-attaquant,
`confirmDamage` branche melee, `resolveMeleeAction` défenseur PNJ/drone) — `socketCombatResolution.js`
ne contenait plus de duplicata depuis le Lot D `docs/Old/PLAN_COMBAT_TIMELINE.md`, cité à tort par la
dette d'origine (fichier réorganisé depuis).

**DEF5** — « Cible sans défense » (+5, pas d'opposition). RAW exact relu
(`REGLESYSCOMBAT.md:1052-1058`) : deux clauses (ne peut voir son assaillant / n'a pas conscience de
l'attaque). Scope tranché avec Saar après discussion (la clause "surprise" initialement écartée —
système d'embuscade jugé non géré — a été réintégrée : le Test de Réaction à `COMBAT_START` existe
déjà). Nouveau helper unique `isTargetDefenseless` (statuts `unconscious`/`blinded`/`stunned` +
`is_surprised` limité au Tour 1) consommé identiquement tir/CaC ; en CaC, généralise le pattern déjà
utilisé pour le défenseur drone à tout type de défenseur, corrigeant au passage un vrai trou (un PNJ
inconscient relançait un jet de défense actif). Dette annexe trouvée et loguée séparément :
`SURPRISE1` (`is_surprised` jamais remis à `false`).

**TIRIMP** — garde serveur absent sur "Tir impossible". Saar a directement questionné le sentinel
numérique `-99` (son propre historique de code) comme du bricolage — recherche faite (wiki Rule
Elements PF2e/Foundry) confirmant le pattern pro (predicate booléen toujours séparé du modificateur
numérique). Refonte : nouveau `shared/combatSituationMods.js`, autorité unique client
(`CombatModifiersWindow.jsx`) + serveur (`socketCombatHelpers.js`, table locale ne garde plus que les
clés CaC), plus aucun `-99` dans le projet. Garde ajouté à `resolveAssaultAction` **et**
`resolveDroneAssaultAction` (faille identique trouvée en migrant, hors scope initial mais corrigée).
Dette annexe : `COUVERTURE_TOTALE` (troisième condition RAW jamais câblée, ni client ni serveur,
regroupée avec le futur chantier "Tir en aveugle").

**WNDMORT** — Blessure mortelle codée comme malus `-20` au lieu de bloquer les Tests. Extrait RAW
initial tronqué (accident d'extraction PDF) — Saar a fourni le texte exact et une contre-proposition
(menu restreint à Déplacement Allure lente/Passer le tour, plutôt qu'un blocage brut) adoptée. Question
annexe de Saar sur un Test de Choc récurrent par action vérifiée dans le texte : ce pattern existe pour
la Fatigue (`REGLEBLESSURES.md:1377-1381`), pas les blessures physiques — chantier Fatigue ajouté à
`docs/ROADMAP.md`, non mélangé à WNDMORT. `WOUND_PENALTIES.mortelle` -20→0,
`isTestBlockingWound`/`isMortalWoundImmobilized` nouveaux. Garde de déclaration en miroir exact du stun
guard existant ; défense CaC via `isTargetDefenseless` étendu (pas de second mécanisme) ; défense en
profondeur dans les deux résolveurs (réutilise les données déjà fetchées). Dettes annexes :
`WNDMORT-UI` (pas de repli visuel client) et `WNDMORT-HORSCOMBAT` (`socketEntity.js` non gardé).

**Fichiers touchés** : `server/src/socket/socketCombatHelpers.js`, `socketCombatAnnouncement.js`,
`server/src/routes/character/char-sheet.js`, `client/src/components/CombatModifiersWindow.jsx`,
`client/src/character/CharacterSheet.jsx`, `client/src/locales/{fr,en}.json`, nouveaux
`shared/combatSituationMods.js` + `shared/woundConstants.js` (étendu) et leurs tests ;
`docs/BUGIDENTIFIE.md`/`EN_COURS.md` (items 96-100)/`ROADMAP.md` mis à jour au fur et à mesure, pas en
fin de session.

**Testé** : `node --check` sur tous les fichiers serveur touchés, build Vite client propre (×2), 64
tests `shared/*.test.mjs` rejoués dont 15 nouveaux (`combatSituationMods`, `woundConstants`) — 0
régression. **Non testé** : aucune connexion PostgreSQL disponible depuis cet environnement — chaque
scénario réel (Précipiter/Dégainer répétés, CaC dans les 4 combinaisons PJ/PNJ/drone, statuts
inconscient/aveuglé/étourdi/surpris, tir à Allure maximale/obscurité totale, déclaration avec Blessure
mortelle) reste à valider par Saar en navigateur avant de considérer le cluster réellement clos.
**Données** : aucune migration sur l'ensemble du cluster. **Retour arrière** : rien committé avant
cette session — un `git diff`/`git checkout` suffirait ; après commit, un `git revert` isolé par
correctif reste possible si un test navigateur invalide l'un des cinq indépendamment des autres.

---

## Session 182 (Saar) — 2026-07-28 — Wizard Kiwi (404/500) + triage BUGIDENTIFIE (6 correctifs isolés) — ✅ codés, navigateur non testé

**Contexte** : Saar signale deux symptômes sur le serveur distant Kiwi (`89.92.219.211:8193`, dépôt
`/home/didier/Enclume`, branche `dev/Saar`) : 404 sur `/api/creation/campaign/:id/drafts` (pool de
personnages du Wizard inaccessible) et 500 sur plusieurs illustrations Wizard. Diagnostic mené par
lecture + logs `journalctl` fournis par Saar (aucun accès SSH direct depuis cette session — confirmé
bloqué, `docs/SERVEURDISTANTKIWI.md`), avant tout code. Une fois ces deux bugs clos, Saar a demandé
d'enchaîner sur le registre `BUGIDENTIFIE.md` : un correctif à la fois, validé puis committé avant le
suivant (I18N-DEADCODE1 → COM26 → TRADE1 → I18N-LINT1 → REFS-RENDER, ce dernier découvert en cours de
route).

**KIWI3 — 404 `/drafts`** : `git log`/`journalctl` fournis par Saar montrent `enclume-server` actif
depuis le 2026-07-15 13:00, sans redémarrage, alors que la route (`server/src/routes/creation.js:91`)
existe depuis Session 172 (23/07) — le process tournait du code d'avant même le merge "Fusion Kiwi" de
ce jour-là. Pas un bug de code : `git pull` (1 commit d'écart, sans rapport) + 25 migrations en attente
appliquées + `systemctl restart` par Saar sur le serveur.

**KIWI4 — 500 sur les illustrations** : deux causes distinctes. (a) `server/src/routes/assets.js`
catchait uniquement `err.code === 'NoSuchKey'` ; `statObject` (HEAD, sans corps XML) renvoie
`'NotFound'` côté SDK minio (vérifié en lisant `node_modules/minio/dist/esm/internal/
xml-parser.mjs:54-56`) — donc tout asset absent partait en 500 au lieu d'un 404 propre, sur
n'importe quelle instance. Fix : les deux codes traités comme équivalents. (b) 46 illustrations
Wizard (`Step0Method.jsx`/`Step2Genotype.jsx`/`Step3Mutations.jsx`/`CareersAllocator.jsx`, dont les 38
`ref_careers.illustration`) jamais uploadées sur le bucket MinIO de Kiwi — Saar a fourni un
`assets.zip` (46 fichiers web + `Profession.xcf` exclu, 39 Mo, fichier source non-web). Discussion
d'architecture : ces illustrations sont fixes, identiques à toute instance, versionnées avec le code —
les faire dépendre d'un bucket MinIO *par instance* crée exactement ce genre de dérive. Sorties vers
`client/public/assets/` (même chemin relatif que celui déjà stocké en base, zéro migration DB), les 4
composants client réécrits pour pointer en statique plutôt que via l'API.

**I18N-DEADCODE1** : `client/src/components/creation/WizardCreationPage.jsx` — doublon mort confirmé
(`diff` contre `pages/WizardCreationPage.jsx` : 1 ligne d'écart, aucun importeur trouvé) puis supprimé.

**COM26** : Darts 7.62mm ST SAP et Flèche IEM portaient toutes deux le DSL exact d'une munition
Assommante (déjà exclues de la migration 160 faute de valeur de correction connue). Recherche menée
dans le fichier d'extraction Excel original (`docs/Old/script Extraction Excel/equipement/
STEP1_cleaned_data.js`) : la valeur IEM y est correcte et identique à 6+ munitions sœurs (ground-truth
directe) ; la valeur SAP y est **déjà fautive à la source** (erreur de saisie antérieure à l'import,
pas introduite par le pipeline). Saar a fourni le tableau RAW des armes sous-marines à projectiles
(portées, dégâts, astérisques air libre) faute de stats par munition — a permis de choisir `DMG=BASE`
plutôt qu'une valeur inventée, `shared/weaponAmmoDsl.js` (Lot C1, déjà câblé dans `damageService.js`)
faisant de `FX=SAP` la seule autorité mécanique sur la formule de l'ARME (4D10+3 du tableau, -1 dé,
armure ×0.5) dès qu'il est posé — le `DMG=` catalogue devient cosmétique. Le tag `RANGE=AIR_X2` des
munitions sœurs semble lui-même faux au vu du tableau (astérisque simple = ×3, pas ×2) mais n'est lu
par aucun code — non touché, dette à part si un jour câblé. Migration 209, vérifiée contre le vrai
parseur (`node --input-type=module`) + suite `weaponAmmoDsl.test.mjs` (16/16). Vérification a aussi
révélé **DARTS-TAGDUP** : `TXT=DEPTH=...|DEPTH=...` (deux sous-tags de même clé) s'écrasent
silencieusement dans l'objet `tags` du parseur — inerte aujourd'hui (rien ne lit `DEPTH`), documenté
sans correctif.

**TRADE1** : `socketTrade.js`, handler `TRADE_TRANSFER_DECLINED` ne vérifiait jamais que l'appelant
correspondait au `to_char_id` de l'offre (contrairement à `ACCEPTED`/`CANCELLED`) — un `offerId`
deviné permettait à n'importe quel membre de refuser l'offre d'un autre. Ajout de la vérification
d'ownership, même patron que `TRADE_TRANSFER_ACCEPTED` ; `ExchangeWindow.jsx`/`TradeWindow.jsx` mis à
jour pour envoyer `decliningCharId`.

**I18N-LINT1 → REFS-RENDER (cascade)** : `CombatGmDeclareWindow.jsx` avait deux `useRef` déclarés
après le retour conditionnel `allGmManaged.length === 0` (violation `rules-of-hooks`). Remontés en
position inconditionnelle — ESLint a alors pu analyser plus loin et signalé une 2ᵉ erreur
(`react-hooks/refs`, règle React Compiler) sur l'écriture `.current` elle-même, déjà présente avant ce
premier fix mais jamais atteinte par le linter. Vérifié contre la doc officielle
(`react.dev/reference/react/useRef`, section Pitfall : écrire une ref pendant le rendu n'est acceptable
que pour une initialisation paresseuse, jamais notre cas) avant de coder — chaque écriture déplacée
dans son propre `useEffect`, ce qui a nécessité de remonter aussi `currentFireMode`/
`effectiveMeleeCount`/`effectiveAssaultCount` avant le retour conditionnel (leurs seules dépendances,
`decl`/`meleeAttackCount`/`assaultCount`, déjà disponibles dès le haut du composant — anciennes
déclarations supprimées, pas dupliquées). Ce 2ᵉ fix a lui-même démasqué une 3ᵉ erreur
(`react-hooks/set-state-in-effect`, déjà documentée ailleurs sous I18N-LINT3) — ajoutée à l'entrée
existante du registre, non traitée (3ᵉ couche, hors scope).

**Fichiers touchés** : `server/src/routes/assets.js`, `server/src/db/migrations/
209_fix_ref_equipment_ammo_sap_iem.js`, `server/src/socket/socketTrade.js`,
`client/src/components/{Step0Method,Step2Genotype,Step3Mutations,CareersAllocator,
CombatGmDeclareWindow,ExchangeWindow,TradeWindow}.jsx`, `client/public/assets/` (46 nouveaux
fichiers), suppression `client/src/components/creation/WizardCreationPage.jsx` ;
`docs/BUGIDENTIFIE.md`/`EN_COURS.md`/`CHANGELOG.md` mis à jour au fur et à mesure.

**Testé** : chaque correctif vérifié isolément avant de passer au suivant — `node --check` (fichiers
serveur), build Vite client (×6, un par correctif), ESLint avant/après comparé pour les deux fixes
hooks, suite `weaponAmmoDsl.test.mjs` (16/16) + vérification directe contre le vrai parseur pour COM26.
**Non testé** : aucun scénario navigateur réel — affichage effectif des illustrations Wizard sur Kiwi
après déploiement, dégâts réels des 2 munitions corrigées en combat, refus d'offre TRADE par le bon
destinataire puis tentative par un tiers, déclaration GM Tir Multi/CaC après le remaniement des hooks.
Tout reste à valider par Saar. **Données** : migration 209 (rétrocompatible, `down()` fourni) — à
appliquer sur Kiwi via la procédure habituelle (`docs/SERVEURDISTANTKIWI.md`). **Retour arrière** :
6 commits distincts sur `dev/Saar` (un par correctif), chacun revert-able isolément sans affecter les
autres.

---

## Session 189 (Saar) — 2026-07-30 — `PLAN_FATIGUE_DOMMAGES.md` Lot 3 clos : Chute/Acide/Décompression/Feu — ✅ codé et confirmé fonctionnel en navigateur

**Contexte** : reprise du chantier Fatigue & Dommages après le Lot 1 (horloge de campagne, Session 188)
et le Lot 2 (moteur d'échéances + Blessures/Guérison, sessions précédentes non journalisées ici — voir
`docs/ASBUILT.md`). Cadrage du Lot 3 fait par exploration du code réel avant tout code (RAW verbatim
relue dans `docs/REGLES/FATIGUE&DOMMAGES.md` p.242-243), avec plusieurs passes d'analyse critique
demandées par Saar avant/entre chaque increment plutôt qu'un plan figé validé une fois pour toutes.

**Increments A-B (extraction préalable)** : `fetchCibleNA` partagée (`damageService.js`, déjà
dupliquée deux fois dans `socketCombatHelpers.js` — complétée en cours de route, une 2ᵉ copie réelle
trouvée dans `resolveAssaultAction` en plus de `resolveDroneAssaultAction`) ; `armorReductionFactor` sur
`resolveTargetHit` (additif, RAW Chute : protection d'armure réduite de moitié).

**Increment C — migration 225** : `token_statuses.data` JSONB nullable. `applyModStatus`/
`clearModStatus` (`statusService.js`) étendues avec `data`/`throwOnFailure` — ce dernier trouvé
nécessaire en analyse critique (l'appelant existant, boucle mods de `startResolutionPhase`, tourne dans
le même bloc `try` que la transition de phase déjà committée ; un échec d'écriture ne doit pas
planter toute la résolution du Tour, mais les nouvelles actions MJ Lot 3 doivent, elles, voir l'échec).

**Increment D — `shared/fallDamageConstants.js`** : table RAW Chute extraite, testée. Simplification
algébrique trouvée pour "au-delà de 4m" (`3D10 + 1D10×(h-4)` ≡ `(h-1)D10`, un seul type de dé —
`parseDice` ne supporte pas les formules composées).

**Increment E — `fallDamageService.js`** (`resolveFall`) : Test d'Acrobatie/Équilibre optionnel, garde
d'entrée serveur ajoutée après coup (validation `groundTrigger`/`heightMeters`, absente de la première
version — trouvée en auto-relecture, pas par Saar).

**Increment F — `environmentalHazardService.js`/`environmentalHazardRegistry.js`** (Acide/Décompression/
Feu récurrents) : le plus gros morceau, plusieurs trous trouvés en cours de route plutôt qu'anticipés au
cadrage :
1. Nettoyage `COMBAT_END` — les statuts environnementaux ne sont volontairement jamais balayés (décision
   Saar : persistent hors combat, mais aucun Tick ne s'exécute hors FSM combat de toute façon).
2. Localisation "exposée" du Feu (RAW littéral p.243, relu en détail seulement à cette passe) : petite
   flamme/feu moyen touchent un point fixe, pas un tirage aléatoire — contrairement au design initial.
   Réutilise le vocabulaire de la visée existant (`LOCATION_TO_SLOT`) plutôt qu'une nouvelle notion,
   directive explicite de Saar ("architecture robuste/pérenne/adaptative, corriger l'ensemble au besoin").
3. Collision de nommage découverte en construisant l'UI : `TokenStatusPanel.jsx`/`socketToken.js`
   avaient déjà `burning`/`acid`/`decompression` en toggle cosmétique (catégorie "dot", icônes/i18n
   existants, aucun effet mécanique) — codes registre renommés pour s'aligner plutôt que dupliquer
   assets/i18n, toggle nu retiré pour ces 3 codes (aurait écrasé silencieusement `data`).
4. Patron de registre corrigé en 2ᵉ passe : `echeanceTypeRegistry.js` (lookup simple), pas
   `weaponModRegistry.js`/`resolveModHooks` (agrégation/priorité) — un excès de langage déjà commis puis
   corrigé une fois pour Lot 2, répété puis recorrigé ici.

**Increment G — routes REST + UI** : cadrage fait en délégant un rôle "expert UX/UI gaming" à part
entière avant de coder. Découverte de fond : `worldEffectService.js` (moteur monde, Codex) a déjà un
système de zones de danger (`fire`/`gas`/`oil`/`flooded`, hooks `turnStart` jamais consommés) — pas un
doublon du Lot 3 mais un cas RAW différent (zone/ambiance vs exposition personnelle/ciblée) ; l'intégration
avec ce système reste un chantier séparé, territoire Codex/dev-monde, volontairement hors scope ici.
UI : aucun nouveau composant structurel — `TokenStatusPanel.jsx` étendu (sous-formulaire danger +
bouton Chute, plutôt qu'une 9ᵉ entrée dans `TokenRadialMenu.jsx` dont la géométrie à 8 secteurs est
couplée dans le composant), `AimedLocationPicker.jsx` (nouveau prop `showMalus`), routes GM-only dans
`campaigns.js`.

**Bug réel trouvé au test navigateur** : Saar a signalé les dégâts environnementaux invisibles "dans le
chat". Cause racine : `resolveTargetHit` ne s'annonce jamais lui-même en jeu — chaque appelant doit
émettre explicitement `WS.COMBAT_ATTACK_RESULT`, ce que ni le Tick récurrent ni la Chute ne faisaient
(la blessure était bien créée en base, juste invisible). Corrigé en réutilisant tel quel les panneaux
`CombatResultGM`/`CombatResultPlayer` existants (`tireurId: null` + nouveau champ `sourceCode` résolu en
libellé côté client, jamais de texte FR figé serveur) ; correctif connexe sur `CombatResultPlayer` qui
affichait `roll`/`seuil` sans garde contrairement à la vue GM.

**Fichiers touchés** : migration `225_token_statuses_data.js` ; nouveaux
`server/src/lib/{fallDamageService,environmentalHazardService}.js`,
`shared/{fallDamageConstants,environmentalHazardRegistry,environmentalHazardPresets}.js` (+ tests) ;
modifiés `server/src/lib/{statusService,damageService,diceParser}.js` (+ nouveau
`diceParser.test.mjs`), `server/src/socket/{socketCombatHelpers,socketToken}.js`,
`server/src/routes/campaigns.js` ; client `TokenStatusPanel.jsx`, `AimedLocationPicker.jsx`,
`SessionPage.jsx`, `CombatOverlay.jsx`, `CombatResultPanels.jsx`, `locales/combat.json` ;
`docs/PLAN_FATIGUE_DOMMAGES.md` tenu à jour à chaque increment (pas en fin de session).

**Testé** : `node --check`/`node --test` sur tous les fichiers serveur/`shared` touchés (constantes RAW,
registre, `diceParser` — 0 régression sur les tests existants rejoués), `eslint`+`npm run build` client
propres à chaque étape, migration 225 vérifiée appliquée en base. Confirmé fonctionnel en navigateur par
Saar (exposition/retrait des 3 dangers, Tick récurrent, Chute avec/sans Test, visibilité en jeu après
correctif), ajustements ergonomiques faits sur retour direct (icônes/panneau agrandis). **Non testé** :
round-trip HTTP authentifié scripté (pas d'identifiants côté agent). **Données** : migration 225,
appliquée automatiquement par le serveur `dev` déjà actif au moment de sa création. **Retour arrière** :
commit isolé sur `dev/Saar`, `git revert` possible sans affecter les chantiers Lot 1/Lot 2 déjà commités
séparément.

---

## Session 190 (Saar) — 2026-07-30 — `PLAN_FATIGUE_DOMMAGES.md` Lot 4 clos : Fatigue — ✅ codé et confirmé fonctionnel en navigateur

**Contexte** : reprise après le Lot 3 (dangers environnementaux, Session 189). Cadrage fait par
relecture RAW complète (`FATIGUE&DOMMAGES.md:838-1017`, capture Annexe p.250 fournie par Saar pour
retrouver la table des cases, absente du texte transcrit) — le §10 initial du plan avait sous-estimé
la mécanique réelle (5 paliers au lieu de 6, un seul malus au lieu de deux indépendants). **7 passes
d'analyse critique**, chacune demandée explicitement par Saar avant de continuer, chacune ayant trouvé
un vrai trou :

1. Aucun point d'agrégation unique des modificateurs de Test dans le projet — `calcWoundPenalty`
   dupliqué à 5 endroits. Corrigé en registre déclaratif (`activeMalusRegistry.js`, patron
   `echeanceTypeRegistry.js`), pas une fonction à paramètres fixes (aurait rouvert le même problème à
   chaque lot futur) — recherche externe faite (Active Effects Foundry VTT) pour confirmer le patron
   avant de trancher.
2. Risque de concurrence non traité sur `fatigue_points` — même classe déjà corrigée deux fois dans ce
   plan (Lot 1, Lot 2). Verrouillage `.forUpdate()` ajouté.
3. Trou préexistant révélé (pas causé par ce lot) : le système de macros joueur n'appliquait aucun
   malus de blessure/encombrement. Tranché par Saar : corrigé dans ce lot plutôt que contourné
   (« même si on doit mettre le projet en pause pour bien recoder cette fonctionnalité »).
4. Le Test de Fatigue lui-même oubliait le malus actif sur son propre seuil — le RAW n'exempte que le
   malus de *palier* de Fatigue, pas blessure/encombrement.
5. `applyStunWithDuration` ne pouvait pas produire le statut `evanoui` (binaire fermé stunned/
   unconscious, vérifié dans le code) — étendue plutôt que dupliquée.
6. **Erreur de fond trouvée en préparant le code** : la première rédaction utilisait `isCriticalFail`
   (jet=20, "Échec critique") comme proxy de "Catastrophe" RAW — faux contre
   `shared/polarisTestResolution.js` : `catastropheRisk` (marge ≤ -15) est un concept distinct, et le
   code source dit explicitement qu'il n'a **jamais** d'effet mécanique automatique nulle part dans le
   projet (juste transmis pour affichage). Tranché par Saar : appliqué automatiquement pour la
   Fatigue quand même — le chapitre RAW ne prévoit aucune option MJ pour ce cas précis.
7. Repéré en préparant l'UI : les 2 routes REST visaient `campaigns.js` (scope `campaignId`) alors que
   `CharacterSheet.jsx`, seule consommatrice, n'a jamais `campaignId` en prop — déplacées vers
   `char-sheet.js` (`req.character.campaign_id` résolu serveur, patron déjà établi par cette route
   family). Correction symétrique sur les clés i18n (`fr.json`, pas `charSheet.json` — ce composant
   n'est pas migré vers les namespaces séparés, `PLAN_LOCALISATION.md` Lot 2 non commencé).

**Trouvaille supplémentaire, hors combat** : le badge Choc (`evanoui`/`unconscious`, palier "À bout de
force") ne peut pas s'appuyer sur une expiration en Tours si le Test est déclaré hors combat
(`current_turn` ne progresse jamais hors FSM combat). Vérifié que ce n'était pas déjà un bug existant
(Lot 3 n'auto-applique jamais ce badge, contrairement à ce que la 1ʳᵉ rédaction de ce lot s'apprêtait à
faire). Saar : comportement voulu, pas un bug — badge sans expiration hors combat, retrait manuel MJ.

**Bug de câblage trouvé au moment de tester (pas en navigateur — en répondant à la question de Saar
"je teste quoi ?")** : le schéma serveur (`fatigue_enabled`, `SETTINGS_SCHEMA`) n'avait aucune case à
cocher côté UI pour l'activer — sans elle, rien n'était testable. Corrigé (`SectionGameRules.jsx`,
même patron que `encumbrance_enabled`) avant que Saar ne commence son test.

**Fichiers touchés** : migration `227_char_sheet_fatigue.js` ; nouveaux
`shared/fatigueConstants.js` (+ test), `server/src/lib/{activeMalusRegistry,fatigueService}.js`
(+ test) ; modifiés `server/src/lib/{charStats,statusService,campaignSettingsService}.js`,
`server/src/socket/{socketCombatHelpers,socketEntity,socketDice}.js`,
`server/src/routes/character/char-sheet.js`, `shared/events.js` ; client
`CharacterSheet.jsx`, `components/campaignSettings/SectionGameRules.jsx`,
`components/TokenPresentation.jsx`, `locales/fr.json`, nouvelle icône `assets/status/evanoui.svg` ;
`docs/{PLAN_FATIGUE_DOMMAGES,VOCABULARY,ASBUILT,EN_COURS}.md` tenus à jour à chaque passe (pas en fin
de session).

**Testé** : 330 tests Node (270 pass / 60 skip DB, 0 échec — 0 régression sur les tests existants
rejoués), ESLint (0 nouvelle erreur, 3 préexistantes confirmées non liées via `git stash`),
`npm run build` client propre à chaque étape. **Confirmé fonctionnel en navigateur par Saar** : case à
cocher campagne, apparition/disparition du bloc Fatigue, Test de Fatigue avec évolution palier/case,
malus dans le tooltip Initiative, boutons Repos, macro joueur reflétant désormais le malus de
blessure. **Non testé** : round-trip HTTP authentifié scripté (pas d'identifiants côté agent).
**Données** : migration 227, s'applique automatiquement au prochain redémarrage du serveur `dev`
(`db.migrate.latest()`). **Retour arrière** : commit isolé sur `dev/Saar`, `git revert` possible sans
affecter les Lots 1-3 déjà commités séparément.

