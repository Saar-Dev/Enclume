# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-07-19 Session 162 (COM25/COM28/COM29 clos — détail EN_COURS.md Items 90-91 ; COM2 clos Session 161, cluster E) ; 2026-07-19 (Saar) triage `docs/COMPARATIF.md` — ajout INI4/MELEE-MR/DEF5/TIRIMP/WNDMORT/CHOC1 ; 2026-07-19 (dev/Saar, chantier Tir Multi) — ajout INI5, audit demandé par Saar ; 2026-07-19 Session 166 (Saar) — INI4 clos (item 96 `EN_COURS.md`) ; ST1/CH1 retirés du registre (reclassés chantiers dédiés, voir `docs/ROADMAP.md`) ; KIWI2 retiré (résolu, confirmé Saar) ; JSON1 (dette `EN_COURS.md`, pas ici) clos — dette fantôme déjà résolue par le merge Fusion Kiwi ; MELEE-MR clos (item 97 `EN_COURS.md`) ; DEF5 clos (item 98 `EN_COURS.md`), ajout SURPRISE1 (trouvé en cours de route) ; TIRIMP clos (item 99 `EN_COURS.md`, refonte `shared/combatSituationMods.js` — retrait du sentinel -99), ajout COUVERTURE_TOTALE (trouvé en cours de route) ; WNDMORT clos (item 100 `EN_COURS.md`, `WOUND_PENALTIES.mortelle` -20→0 + garde déclaration/défense), ajout WNDMORT-UI et WNDMORT-HORSCOMBAT (résiduels) ; 2026-07-21 Session 167 (Saar) — chantier Moding Groupe 4 clos (item 104 `EN_COURS.md`, Phases 1/3/4 codées et testées) ; ajout MODING4-ATI/MODING4-MEMOIRE/MODING4-PROJECTEUR/MODING4-INTEGRATION (résiduels, décisions produit + câblage restants) ; 2026-07-24 (Saar) chantier i18n Combat — ajout I18N-LINT1 (hook conditionnel `CombatGmDeclareWindow.jsx`), I18N-LINT2 (variables inutilisées Combat) et I18N-DEADCODE1 (doublon mort `WizardCreationPage.jsx`), trouvés en cours de chantier, sans rapport avec le texte en dur — consigne Saar : toute trouvaille hors scope non traitée va systématiquement dans `BUGIDENTIFIE.md` (bug/dette) ou `ROADMAP.md` (feature/chantier futur), jamais laissée orpheline ; 2026-07-24 (Saar, triage priorisé) — CHOC1 clos (Palier 1 testé en jeu, confirmé Saar) ; Cluster I / DMG1+DMG2 clos (validation fonctionnelle confirmée Saar) ; SURPRISE-ROLL retiré (comportement normal, pas un bug — confirmé Saar) ; SURPRISE1 codé (`is_surprised: false` ajouté au reset `endTurn`, même requête qu'INI4 ; contournement `current_turn === 1` dans `isTargetDefenseless` retiré, devenu redondant), détail `EN_COURS.md`, non testé en jeu ; INI5 clos (audit git blame + relecture RAW p.218-219 : forfait `-3`/`-5` introduit Session 65, 94 sessions avant `computeSeriesPositions`, aucune base RAW — décision Saar : retiré, serveur + client + i18n, détail `EN_COURS.md` item 111, non testé en jeu) ; COM27 analysé en profondeur (flux d'émission tracé en entier, ordre serveur semble garanti correct par construction) mais mis en pause — reproduction non confirmée, décision Saar : attendre une nouvelle occurrence en jeu ; COM24 clos (bonus "deux armes" CaC déconnecté de l'arme déclarée — mécanisme "deux armes" à la déclaration ajouté, miroir exact du dual-wield Tir déjà existant, `shared/weaponSlots.js` réutilisé tel quel, revalidation serveur déclaration+résolution, 7 fichiers, détail `EN_COURS.md` item 112, non testé en jeu), ajout MELEE-INHAND (résiduel, trouvé en cours de route) ; 2026-07-28 (Saar, Session 182) — I18N-DEADCODE1 clos (`client/src/components/creation/WizardCreationPage.jsx` supprimé, confirmé sans importeur, build client OK) ; COM26 clos (migration 209 : `Darts 7.62mm ST SAP` → `DMG=BASE;TXT=FX=SAP|DEPTH=...` cohérent avec le mécanisme Lot C1 déjà câblé + confirmé RAW par Saar ; `Flèche IEM` → valeur ground-truth retrouvée dans le fichier d'extraction Excel original, identique à ses munitions sœurs — vérifié contre le vrai parseur `weaponAmmoDsl.js`, tests existants passent, non testé en jeu réel), ajout DARTS-TAGDUP (résiduel, trouvé en vérifiant le fix) ; TRADE1 clos (`socketTrade.js` — `TRADE_TRANSFER_DECLINED` vérifie maintenant l'ownership du `decliningCharId` sur `to_char_id`, même patron que `TRADE_TRANSFER_ACCEPTED`/`CANCELLED` ; `ExchangeWindow.jsx` + `TradeWindow.jsx` mis à jour pour envoyer ce paramètre, build client OK, non testé en jeu) ; I18N-LINT1 clos (`CombatGmDeclareWindow.jsx` — les deux `useRef` remontés avant le retour conditionnel `allGmManaged.length === 0`, ESLint `rules-of-hooks` confirmé propre avant/après, build client OK), REFS-RENDER clos (les deux affectations `.current` déplacées en `useEffect` dédié, `currentFireMode`/`effectiveMeleeCount`/`effectiveAssaultCount` remontés avant le retour conditionnel — vérifié par doc officielle react.dev/useRef "Pitfall" avant de coder, ESLint confirmé propre, build client OK, non testé en jeu), démasque une occurrence supplémentaire d'I18N-LINT3 dans le même fichier (ajoutée à l'entrée existante, pas un nouveau code) ; 2026-07-28 (Saar, Session 184, `docs/PLAN_RW_SYSCOMBAT.md` Lots 3-4) — ajout MELEE-ATKNAME (fenêtre défense CaC affiche le nom du compte au lieu du personnage attaquant, trouvé en testant Lot 4/Tir, sans rapport avec ce chantier) ; 2026-07-29 (Saar) — ajout EAU1 (nappe d'eau `Canvas3D` calée sur le plafond global de la carte au lieu du plafond local de l'étage d'eau, `computeSurfaceWaterCells`/`surfaceData.js`) ; investigation approfondie révèle une improvisation client (nappe jamais validée serveur, doublonnant le vrai système de compartiments/effets runtime déjà construit) — décision Saar : retrait complet de la nappe ambiante, eau en jeu recentrée sur l'effet runtime "inondation" existant, eau structurelle authorée différée en v2 (`docs/ROADMAP.md`) ; codé (`SurfaceDungeonScene.jsx`, `Editor3D.jsx`, `SurfaceEditorScene.jsx`, `surfaceData.js`, `surfaceData.test.mjs`), tests/build/lint OK, non testé en jeu ; documentation `docs/SYSTEME/SURFACES_SALLES.md` section "Rendu de l'eau" réécrite ; DEPLACEMENT1 clos (2026-07-29, confirmé fonctionnel en jeu par Saar — cache LRU `loadBattlemapRuntimeContext`, détail `docs/EN_COURS.md`) ; ajout DEPLACEMENT2 (destination occupée → déplacement entièrement annulé au lieu de s'arrêter à la dernière case libre, `shared/world/navigation.js:findNavigationPath`, trouvé en validant DEPLACEMENT1) ; 2026-07-29
(Saar, Session 186, `docs/PLAN_BATTLEMAP2D.md` Lot 3) — FEAT1 retiré (obsolète, la carte 2D existe
désormais et est trackée par le plan/EN_COURS.md, pas par ce registre) ; ajout GRID2D1 (grille non
affichée sur une carte 2D malgré `grid_enabled=true` vérifié client et serveur — cause non identifiée,
non bloquant, décision Saar de ne pas creuser davantage)
> Index priorité → [`docs/EN_COURS.md`](EN_COURS.md) §Dettes actives

---

## MÉTHODE — Triage → Reproduire → Analyser → Instrumenter → Corriger → Valider

> **Règle d'hygiène :** Tout bug clos est **SUPPRIMÉ** de ce registre. En cas de divergence entre docs et code → vérifier le code réel.

> **Loi fondamentale :** Lire le code → au mieux `[HYPOTHÈSE]`. `[VÉRIFIÉ]` exige instrumentation + observation du code **en exécution**. Ce sont deux choses distinctes — ne jamais les confondre.

| Phase | Action | Règle critique |
|---|---|---|
| **1. Triage** (batch) | Lister tous les bugs → sévérité + priorité → identifier clusters → mettre à jour EN_COURS.md | Ne pas coder à cette étape |
| **2. Reproduire** | Reproduire le bug de façon fiable et répétable. Documenter les conditions exactes (séquence d'actions, état initial, utilisateur). | **Sans reproduction confirmée, aucune analyse n'est valide.** Si non reproductible → suspendre et documenter. |
| **3. Analyser** (par cluster) | Lire les fichiers (TABLE DE ROUTING) → formuler une hypothèse — "5 Pourquoi" → effets de bord possibles | Résultat = `[HYPOTHÈSE]` uniquement. **Vérifier LdB si règle citée** — une référence fausse transforme un comportement conforme en faux bug (Leçon Session 94 — COM3) |
| **4. Instrumenter** | Énoncer la prédiction : "si l'hypothèse est vraie, le log doit afficher X". Ajouter `[DBG-BUGID]` au point exact → SR → reproduire → observer → `[HYPOTHÈSE] → [VÉRIFIÉ]` ou nouvelle hypothèse | **Toujours obligatoire.** Ne jamais sauter vers le correctif sans cette étape. |
| **5. Correctif** (par cluster) | Coder le plan validé uniquement. **1 commit par cause racine.** 2 clusters sans rapport → 2 commits | Ne jamais mixer deux clusters dans un seul commit |
| **6. Validation** | Test fonctionnel → zones adjacentes → fermer EN_COURS.md → appender JOURNAL5.md | Fermeture sans test fonctionnel → interdit |

**Définition cluster** : même fichier source / même cause racine / même mécanique / fix A nécessite fix B.

**Labels** : `[VÉRIFIÉ]` — cause confirmée par instrumentation + observation en exécution. `[HYPOTHÈSE]` — inférée par lecture du code, non encore instrumentée. `[INCONNU]` — non investigué.

**Run à vide obligatoire** avant de coder — anticiper pièges, ambiguïtés, effets de bord.

---

## ROUTING PAR CLUSTER — Sprint order recommandé

| Cluster | Bugs | Fichier principal | Priorité |
|---|---|---|---|
| **F — Ghosts + portraits** | COM16 | `CombatTimeline.jsx` + `CombatOverlay.jsx` + `useCombatSocket.js` | Moyenne |
| **H — Dettes techniques** | TC1 + DCO1 + VX1 + AU1 + INI1 + INI2 + INI3 + TOK1 + MAP1 + COM14 + DASH1 + I18N-LINT2 + I18N-LINT3 + I18N-LINT4 | divers | Basse |
| **Q — UI divers** | UI2 + UI3 + ST3 | composants dés + chat | Basse |

**Règle d'or :** valider le cluster A avant B, B avant C, etc. Validation fonctionnelle obligatoire entre clusters.

---

## Dettes combat — issues confirmées par l'audit COMPARATIF (2026-07-19)

> Triage de `docs/COMPARATIF.md` (audit ponctuel 2026-07-17, `MANUELSYSCOMBAT.md` vs code réel) — ces
> 6 dettes étaient citées dans l'audit mais n'avaient pas d'entrée dédiée ici, contrairement à la règle
> d'hygiène du fichier (« Détail technique de chaque bug → `BUGIDENTIFIE.md` »). `COMPARATIF.md` est
> archivé vers `docs/Old/` une fois ce triage fait — ne plus le traiter comme registre vivant.

### Dette COUVERTURE_TOTALE — « Couverture totale » (tir) n'existe nulle part, client ni serveur

**Symptôme** : Aucun cas observé en jeu — trouvé en clôturant TIRIMP (Session 166).

**Règle** : `docs/REGLES/REGLESYSCOMBAT.md:1391-1401` (« Tir en aveugle », optionnel) — une cible en
couverture totale (totalement cachée) rend le tir impossible, sauf le mécanisme optionnel tir en
aveugle (Test d'Observation opposé, puis Test de tir -15+bonus, puis Test de Chance).

**Code impliqué** : `CombatModifiersWindow.jsx` (`COUVERTURES` n'a que 2 checkboxes : partielle/
importante) et `shared/combatSituationMods.js` (`RANGED_SITUATION_MODS` n'a pas de clé
`couverture_totale`) — contrairement à `tireur_allure_maximale`/`obscurite_totale`, cette clé n'a
jamais été câblée, ni client ni serveur. Un simple garde serveur ne suffit pas ici : il faudrait
d'abord ajouter la checkbox côté client.

**Prochaine étape** : à regrouper avec le futur chantier « Tir en aveugle » (RAW lie les deux au même
mécanisme optionnel) plutôt que d'ajouter une checkbox qui rendrait le tir *toujours* impossible sans
aucun recours. Décision Saar (2026-07-19) : pas prioritaire, pas dans ce correctif.

---

### Dette WNDMORT-UI — Fenêtre de déclaration : pas de repli visuel pour Blessure mortelle

**Symptôme** : Aucun cas observé en jeu — trouvé en clôturant WNDMORT (Session 166).

**Contexte** : le garde serveur (`COMBAT_ACTION_DECLARE`) rejette désormais toute action autre que
Déplacement (Allure lente)/Passer le tour pour un personnage mortellement blessé, avec un message
`COMBAT_DECLARE_ERROR` clair. Mais `CombatActionWindow.jsx` ne sait pas encore que ce personnage est
mortellement blessé — aucun fetch de `character_wounds`, aucun bandeau, aucun bouton grisé. Le joueur
découvre la restriction seulement en essayant et en recevant l'erreur, pas avant.

**Code impliqué** : `client/src/components/CombatActionWindow.jsx` — pas de wound fetch actuellement.

**Prochaine étape** : sprint UI dédié — fetch `character_wounds` pour le token actif, bandeau
d'avertissement + désactivation des sections Attaque/CaC/Interaction/Rechargement, garder Déplacement/
Passer actifs. Décision Saar : pas dans ce correctif (le serveur reste l'autorité, ceci n'est que de
l'ergonomie).

---

### Dette WNDMORT-HORSCOMBAT — Test générique hors-combat non gardé (Blessure mortelle)

**Symptôme** : Aucun cas observé en jeu — trouvé en clôturant WNDMORT (Session 166).

**Contexte** : le système générique de Test lié aux interactions du monde (`socketEntity.js:253`,
Test de Force/Reconnaissance/etc. sur un objet) utilise la même donnée `character_wounds` mais n'a pas
reçu le garde `isTestBlockingWound`. Le LdB dit littéralement "aucune action demandant un Test" — pas
seulement en combat — donc ce système reste, en toute rigueur, un écart RAW non corrigé.

**Code impliqué** : `server/src/socket/socketEntity.js` — handler de confirmation de Test générique.

**Prochaine étape** : ajouter le même garde (`isTestBlockingWound`) au point de requête initial de ce
système (pas au point de confirmation vu ici, trop tard pour une bonne UX) — chantier séparé, impact
pratique jugé bien plus faible que le combat (Décision : non traité dans ce correctif).

---

### Dette MODING4-ATI — Analyseur Tactique Individuel : aucune interface de configuration cible/mode

**Symptôme** : Aucun cas observé en jeu — mécanique codée et testée en isolation (Session 167,
architecture `docs/SYSTEME/MODING.md`), jamais atteignable en jeu réel.

**Contexte** : `shared/mods/ati.js` (`atiOnTurnStart`/`atiOnCalculateModifiers`) est fonctionnellement
correct et testé (RAW `docs/Old/script Extraction Excel/equipement/STEP1_cleaned_data.js` EQ_00001),
mais lit `modState.ati.{mode, targetCharacterId}` — rien ne permet aujourd'hui au joueur de choisir le
mode (offensif/défensif) ni la cible verrouillée. Décision produit non technique, jamais tranchée
(item 4.1.4 du plan depuis sa première rédaction).

**Code impliqué** : `shared/mods/ati.js` ; interface à créer côté déclaration de combat ou inventaire.

**Prochaine étape** : décision Saar sur le point d'interface (déclaration de combat vs réglage
inventaire), puis câblage de `resolveModHooks(installedMods, 'onCalculateModifiers'/'onTurnStart', …)`
dans `resolveAssaultAction`/`startResolutionPhase` avec `targetCharacterId` réel.

---

### Dette MODING4-MEMOIRE — Mémoire de cibles : aucune interface d'enregistrement de cibles

**Symptôme** : Aucun cas observé en jeu — mécanique codée et testée en isolation (Session 167),
jamais atteignable en jeu réel.

**Contexte** : `shared/mods/memoire.js` (`memoireOnBeforeAttack`) est correct et testé (RAW EQ_00002),
mais lit `modState.memoire.registeredTargetIds` — rien ne permet au joueur d'enregistrer une cible
parmi les 24 possibles (RAW : "Le modèle Mémo peut enregistrer 24 cibles différentes"). Même nature
que MODING4-ATI : décision produit, pas technique.

**Code impliqué** : `shared/mods/memoire.js` ; interface à créer (probablement fiche perso/inventaire).

**Prochaine étape** : décision Saar sur le point d'interface, puis câblage de
`resolveModHooks(installedMods, 'onBeforeAttack', …)` dans `resolveAssaultAction`.

---

### Dette MODING4-PROJECTEUR — Projecteur de mouvement : "cible en zigzag" n'existe nulle part

**Symptôme** : Aucun cas observé en jeu — vérifié en clôturant Phase 4 (Session 167), avant tout
câblage réel.

**Contexte [VÉRIFIÉ]** : `targetIsMoving`/`targetMovementMalus` (2 des 3 champs de contexte attendus
par `projecteurOnBeforeAttack`) sont directement dérivables de l'existant sans nouvelle donnée —
`confirmedModifiers.situation` (array déjà déclaré par le joueur/GM à la confirmation) contient déjà
`cible_allure_moyenne/rapide/maximale` (`shared/combatSituationMods.js`), qui donnent à la fois le
signal "en mouvement" et la magnitude du malus (`RANGED_SITUATION_MODS[key].mod`). En revanche
`targetMovementIsErratic` (RAW : "se déplace en zigzag ou de manière imprévisible" → niveau de
l'appareil réduit de moitié) **n'existe nulle part** — vérifié par recherche exhaustive dans
`shared/combatSituationMods.js` et `client/src/components/CombatModifiersWindow.jsx` (aucune clé
zigzag/erratique, aucune checkbox correspondante). Nécessite une nouvelle option de situation
(product + UI), pas seulement du câblage serveur.

**Code impliqué** : `shared/combatSituationMods.js` (nouvelle clé) ; `CombatModifiersWindow.jsx`
(nouvelle checkbox) ; `shared/mods/projecteur.js` (déjà prêt à consommer le champ).

**Prochaine étape** : décision Saar sur l'ajout de la situation "cible imprévisible/zigzag" (nouvelle
option UI), puis câblage de `resolveModHooks(installedMods, 'onBeforeAttack', …)` dans
`resolveAssaultAction` — `targetIsMoving`/`targetMovementMalus` sont déjà dérivables sans attendre
cette décision, seul `targetMovementIsErratic` en dépend (peut être câblé en deux temps : d'abord
sans zigzag, en `false` par défaut — comportement RAW partiel mais jamais faux).

---

### Dette MODING4-INTEGRATION — Groupe 4 (ATI/Mémoire/Projecteur) jamais appelé en résolution réelle

**Symptôme** : Aucun cas observé en jeu — chantier clos en l'état (Session 167), câblage volontairement
non fait.

**Contexte** : `resolveAssaultAction`/`resolveMeleeAction` n'appellent aujourd'hui
`resolveModHooks(...)` que pour aucun hook Groupe 4 — les 3 mécaniques (`shared/mods/ati.js`,
`memoire.js`, `projecteur.js`) sont codées, testées, dans le registre (`shared/weaponModRegistry.js`,
`mod_key` peuplé migration 184), mais totalement inertes en combat réel tant que ce câblage n'existe
pas. Dépend de MODING4-ATI/MODING4-MEMOIRE/MODING4-PROJECTEUR pour être fonctionnellement utile — le
câblage lui-même est mécanique et court une fois ces décisions prises.

**Code impliqué** : `server/src/socket/socketCombatHelpers.js` (`resolveAssaultAction`,
`resolveMeleeAction`).

**Prochaine étape** : une fois au moins une des 3 décisions produit tranchée, ajouter l'appel
`resolveModHooks(installedMods, 'onBeforeAttack', context)` (gérer `blocked`) et
`resolveModHooks(installedMods, 'onCalculateModifiers', context)` (injecter dans `totalModComp`) —
même point d'insertion que Groupe 1/2 (`socketCombatHelpers.js:2500-2502`), additif, sans toucher au
calcul Groupe 1/2 existant (Phase 2 reste différée, Strangler Fig).

---

## AUDIT ARCHITECTURAL — Session 95-3 (2026-06-15)

> Lecture : `server/src/socket/index.js` + `charStats.js` + `woundUtils.js`.
> 🔴 REFONTE = ne pas corriger individuellement. 🟢 OK = structure saine. 🟡 TECH DEBT = non bloquant V1.

### Fondations — `charStats.js` / `woundUtils.js` / helpers atomiques
**🟢 OK — conserver sans toucher.**

| Élément | Verdict |
|---|---|
| `calcSeuils`, `calcResistanceDommages`, `calcResistanceArmure` | ✅ Pures, correctes, conformes LdB |
| `isShockTestRequired`, `getShockMalus` | ✅ Pures, conformes LdB |
| `applyStunWithDuration` | ✅ Écrit **uniquement** dans `token_statuses` — architecture post-Sprint 14-0 conforme |
| `rollStunDuration` | ✅ Single-purpose, correct |
| `resolveWoundInsertion` | ✅ Transactionnel, correct |
| Guard stun `COMBAT_ACTION_DECLARE` (~ligne 1923) | ✅ Lit depuis `token_statuses` uniquement |
| Schéma DB + migrations | ✅ Solide |

### Handlers de résolution — Monolithes
**🟡 TECH DEBT — non bloquant V1.**

| Fonction | Lignes estimées | Problème |
|---|---|---|
| `resolveMeleeAction` | ~507 | Attaque PJ + PNJ + multi-attaque + pipeline complet inline |
| `resolveAssaultAction` | ~367 | PJ + PNJ + setup attaquant + pipeline complet inline |
| `COMBAT_DAMAGE_CONFIRM` handler | ~213 | Lookup DB + calcul dégâts + wound + shock + 4 émissions |
| `COMBAT_MELEE_DEFENSE_CONFIRM` handler | ~261 | Même problème |

Découpage en modules (`resolveDamage.js`, `resolveMelee.js`) = sprint dédié post-V1. **Ne pas bloquer les corrections actuelles.**

---

## FAUX BUGS — Comportements attendus non à corriger

| Comportement observé | Explication | Source |
|---|---|---|
| Token GM sans char_sheet → ENTITY_MOVE_REQUEST ignoré silencieusement | Comportement documenté V1 — entité de décor sans fiche | `EN_COURS.md §Points de vigilance` |
| `getVoxelSurfaceTop` retourne `y+1.0` pour slope/wedge | Acceptable V1 — sprint voxels v2 futur | VX1 dans ce fichier |
| `is_stunned` non enforced dans COMBAT_ACTION_DECLARE | Dette connue PC42 — sprint dédié | `CLAUDE.md §Dettes` |
| "Action non autorisée dans cet état de combat" pendant AWAITING_DAMAGE | Comportement FSM NORMAL — autre combattant bloqué pendant qu'un PJ confirme ses dégâts. Message potentiellement confusant mais mécanique correcte. | Session 119 logs |
| Jet de défense CaC toujours déclenché, même si attaque échouée | LdB p.222 — test d'opposition = **les deux roulent toujours** (4 cas). Exception = surprise/inconscient uniquement. Code `resolveMeleeAction` CONFORME. | COM3 — vérifié Session 94 via `REGLES_Contact.md` |
| Stun mécanique résiduel après COMBAT_END (badge disparu, effet persiste) | FAUX BUG. Cleanup `COMBAT_END` correct — [DBG-SHK3] confirme `token_statuses: []` après delete. Guard COMBAT_ACTION_DECLARE lit uniquement `token_statuses`. `current_turn` repart à 1 à chaque nouveau combat. | SHK3 — vérifié Session 95-3 |
| Assaut (tir) : modificateur -5 INI non appliqué | FAUX BUG. LdB `REGLESYSCOMBAT.md` p.213-229 relu intégralement — règle inexistante. `socketCombatAnnouncement.js` STATE_COSTS conforme au LdB. | COM19 — vérifié Session 122 |

> Avant de déclarer un bug, vérifier cette table. Si le comportement est ici → ne pas créer de correctif.

---

## TEMPLATE — Nouvelle entrée de bug

```markdown
### Bug [ID] — [Titre court]

**Symptôme** : [Ce que l'utilisateur observe exactement, dans quel scénario.]

**Règle** : [Référence règle Polaris si applicable — §X.Y MANUELSYSCOMBAT ou REGLESYSCOMBAT.]

**Code impliqué** : `fichier.js` — nom fonction, ligne approximative.

**Cause racine** [VÉRIFIÉ | HYPOTHÈSE | INCONNU] : [Explication technique de la cause, pas du symptôme.]

**[DBG-ID] suggestion** (si HYPOTHÈSE ou INCONNU) :
```js
console.log('[DBG-ID]', { variable1, variable2 })
```

**Travail partiel** (si applicable) : [Ce qui a été tenté mais pas validé.]

**Prochaine étape** : [Action exacte à prendre — cluster, sprint, ou investigation.]
```

---

## Bugs statuts / Chat — Clusters K + Q (partiel)

### Bug COM16 — Phase ANNONCE : traits liaison attaquant↔cible disparaissent

**Symptôme** : Les traits visuels reliant attaquant à sa cible déclarée disparaissent au fur et à mesure des déclarations.

**Code impliqué** : `CombatOverlay.jsx` ou `SessionPage.jsx` — rendu des annotations de déclaration.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster F — lire `CombatOverlay.jsx` + handler `COMBAT_ACTION_DECLARED` dans `useCombatSocket.js`.

---

### Dette AU1 — useDiceAudio.js : sons dés manquants

**Code impliqué** : `client/src/lib/useDiceAudio.js` — non branché.

**Prochaine étape** : Sprint audio dédié.

---

### Dette MAP1 — MAP_VIEWPORT : pas de déclencheur UI côté GM

**Symptôme** : Le handler `WS.MAP_VIEWPORT` existe serveur + client mais aucun bouton GM dans l'interface ne permet de l'émettre.

**Code impliqué** : `SessionPage.jsx` ou `Canvas3D.jsx` — bouton "Partager ma vue" absent. `socketVoxel.js` — handler MAP_VIEWPORT fonctionnel.

**Prochaine étape** : Sprint UI dédié — ajouter bouton GM émettant `WS.MAP_VIEWPORT`.

---

### Dette DCO1 — onTokenRotate : dead code Canvas3D/Scene

**Code impliqué** : `Canvas3D.jsx` — `onTokenRotate` déclaré mais non utilisé.

**Prochaine étape** : Supprimer lors d'un sprint nettoyage.

---

### Dette I18N-LINT3 — `setState` synchrone dans un `useEffect` (plusieurs fichiers Combat)

**Symptôme** : Aucun cas observé en jeu — trouvé par ESLint (`react-hooks/set-state-in-effect`) en
retouchant plusieurs fichiers pour le chantier i18n Combat (`docs/PLAN_LOCALISATION.md`, 2026-07-24),
sans rapport avec ce chantier. `git diff` confirme à chaque fois que les lignes concernées ne sont pas
touchées par le retrofit i18n.

**Code impliqué** :
- `client/src/components/CombatTimeline.jsx:23` — `setSecondsLeft(actionTimerSec)` dans le `useEffect`
  du timer ANNOUNCEMENT.
- `client/src/components/CombatCacModifiersWindow.jsx:66-70` — reset de 5 states (`setSituationAtk`,
  `setSituationDef`, `setTaille`, `setWeaponSkill`, `setIsRolling`) directement dans le corps d'un
  `useEffect` déclenché par `[meleeOrAssaultAction?.id]`.
- `client/src/components/CombatModifiersWindow.jsx:125-131` — même pattern, reset de 7 states
  (`setPorteeOverride`, `setTireurAllureOverride`, `setCibleAllureOverride`, `setCouvertures`,
  `setObscurites`, `setTaille`, `setWeaponSkill`, `setIsRolling`) dans un `useEffect` déclenché par
  `[assaultAction?.id]` — visiblement le même patron copié entre les deux fenêtres CaC/Assaut.
- `client/src/components/CombatGmDeclareWindow.jsx:147-156` — même famille : reset de 16 states
  (`setMapAction`, `setMeleeAttackCount`, etc.) dans le corps de l'effet `[activeTokenId]`. Démasqué
  en clôturant REFS-RENDER (Session 182) — même mécanisme : ESLint n'atteignait pas cette ligne tant
  que les erreurs `react-hooks/refs` du même fichier bloquaient l'analyse plus loin.

Dans les trois cas, ESLint signale un `setState` appelé directement dans le corps de l'effet (pas dans
un callback d'intervalle/événement), pouvant provoquer des rendus en cascade.

**Cause racine [HYPOTHÈSE]** : détection ESLint statique, non instrumentée. Les deux semblent
fonctionner en pratique (pas de symptôme rapporté), mais le pattern n'est pas celui recommandé par
React — probablement un pattern répété ailleurs dans les fichiers Combat, à vérifier plus largement
si un sprint nettoyage est ouvert.

**Prochaine étape** : sprint nettoyage — revoir ces effets (et chercher d'éventuelles occurrences
similaires dans les autres fichiers Combat) sans changer le comportement visible.

---

### Dette VX1 — getVoxelSurfaceTop : pas de cas slope/wedge

**Code impliqué** : `Canvas3D.jsx` — `getVoxelSurfaceTop`. Retourne `y+1.0` pour tous les voxels non-cube.

**Note** : Acceptable V1.

**Prochaine étape** : Sprint voxels v2 — hors scope V1.

---

### Dette I18N-LINT4 — `handleDragEnd` référencé avant déclaration dans `DicePanel.jsx`

**Symptôme** : Aucun cas observé en jeu — trouvé par ESLint (`react-hooks/immutability`) en retouchant
`DicePanel.jsx` pour le chantier i18n (`docs/PLAN_LOCALISATION.md` Lot 4, 2026-07-25), sans rapport
avec le texte en dur. `git show HEAD` confirme que le code incriminé est identique avant toute
modification de ce chantier — dette entièrement préexistante.

**Code impliqué** : `client/src/components/DicePanel.jsx:331-335` — `handleDragEnd` (un `useCallback`)
retire son propre listener `pointerup` en le référençant dans son propre corps avant que la déclaration
`const handleDragEnd = ...` soit complète ; fonctionne à l'exécution (la closure capture la référence
à l'appel, pas à la déclaration) mais viole l'ordre de déclaration attendu par la règle.

**Cause racine [HYPOTHÈSE]** : détection ESLint statique uniquement, non instrumentée ni reproduite en
jeu. Pattern probablement copié tel quel dans d'autres gestionnaires de drag du projet — à vérifier
avant correctif pour éviter une régression isolée qui laisserait les autres occurrences incohérentes.

**Prochaine étape** : pas de symptôme observé, priorité basse — corriger en réordonnant
`handleDragEnd`/`handleDragMove` ou en passant par une `ref` stable, même patron que
`CombatActionWindow.jsx` si un précédent existe déjà.

---

### Dette I18N-LINT2 — Variables/props inutilisées (ESLint `no-unused-vars`) dans plusieurs fichiers Combat

**Symptôme** : Aucun cas observé en jeu — trouvé par ESLint en vérifiant chaque segment du chantier
i18n Combat (`docs/PLAN_LOCALISATION.md`, Segments 2/4/5, 2026-07-24), sans rapport avec le texte en
dur. `git diff`/`git stash` confirment que ces variables préexistent, non introduites par ce chantier.

**Code impliqué** :
- `client/src/components/MeleeCombatPanel.jsx` — `CountChip({ n, ... })` : `n` jamais utilisé.
- `client/src/components/AssaultRangedPanel.jsx` — prop `assaultCount` jamais utilisée.
- `client/src/components/CombatActionWindow.jsx` — prop `stateKey` (`StateSelector`), `currentTurn`,
  `iniTotal`, `myMeleeAction`, `meleeCibleTokens` : jamais utilisés.
- `client/src/components/CombatTimeline.jsx` — import `motion` signalé inutilisé par ESLint bien que
  `<motion.div>` soit présent dans le JSX (ligne ~170/209) — probable faux positif du plugin sur le
  pattern `motion.div` en JSX, à vérifier avant de supprimer quoi que ce soit.
- Plusieurs warnings `react-hooks/exhaustive-deps` (dépendances `useEffect` manquantes) dans
  `CombatActionWindow.jsx`, `CombatGmDeclareWindow.jsx` et `CombatModifiersWindow.jsx`.

**Cause racine [HYPOTHÈSE]** : probablement du code résiduel de refactors successifs (variable
calculée puis plus consommée après un changement d'architecture) — non instrumenté.

**Prochaine étape** : sprint nettoyage dédié — vérifier au cas par cas si chaque variable est un
vestige mort (à supprimer) ou le signe d'un bug fonctionnel plus profond (donnée censée être affichée/
utilisée mais oubliée en route) avant de supprimer aveuglément. Les warnings `exhaustive-deps`
méritent une vérification séparée (une dépendance manquante peut être intentionnelle — ex. pattern
`*Ref` documenté `docs/SYSTEME/REACT.md` P40 — ou un vrai bug de staleness).

---

### Dette INI3 — current_initiative ≤ 0 : report au tour suivant non implémenté

**Symptôme** : Aucun cas observé en jeu à ce jour — gap trouvé par lecture de la règle, pas encore
rencontré en pratique (les Préparations existantes ne descendent pas assez bas pour le déclencher
systématiquement).

**Règle** : `docs/REGLES/REGLESYSCOMBAT.md:354-357` — *"si une Préparation réduit l'Initiative du
personnage à 0 ou moins, l'Action... est reportée au Tour suivant. Le personnage agit en premier et
son Action bénéficie de la Préparation."* Déjà noté comme écart V1 dans `MANUELSYSCOMBAT.md` §3
(*"current_initiative ≤ 0 → action reportée tour suivant. Non implémenté — risque de traitement en
fin de boucle de résolution au lieu de migration."*)

**Code impliqué** : `server/src/socket/socketCombatAnnouncement.js` (calcul `iniDelta`/
`initiative`) + `server/src/socket/socketCombatHelpers.js` (boucle RESOLUTION, `activeSlotIdx`).

**Cause racine** [HYPOTHÈSE] : rien dans le pipeline RESOLUTION ne détecte `initiative ≤ 0` pour
reporter l'action au tour suivant — comportement actuel non instrumenté.

**Trouvé pendant** : planification `docs/PLAN_TIRVISE.md` (Tir visé peut sacrifier jusqu'à -10 INI
en un coup, plus qu'aucune Préparation existante — augmente fortement la probabilité de déclencher
ce cas).

**Prochaine étape** : à investiguer avant ou en parallèle du chantier Tir visé (décision Saar) —
instrumenter `[DBG-INI3]` sur un scénario réel (Préparations cumulées ramenant `initiative` ≤ 0)
avant de coder un correctif.

---

### Dette DEP1 — Allure Maximale accessible même chargé/encombré (sac, armure, arme > pistolet)

**Symptôme** : Aucun cas observé en jeu à ce jour — gap trouvé par lecture de règle (Saar,
2026-07-18), en creusant le système d'Allures pour `docs/PLAN_COMBAT_TIMELINE.md`. Un personnage
portant un sac, une armure, ou une arme plus grosse qu'un pistolet peut aujourd'hui se voir proposer
l'Allure Maximale exactement comme un personnage totalement dégagé.

**Règle** : `docs/REGLES/REGLESYSCOMBAT.md:773-786` (Allures de déplacement, p.220) — *« Allure
rapide [...] C'est aussi la vitesse d'un personnage qui tente de courir tout en étant chargé et/ou
encombré (armure, sacs, armes militaire de type fusil d'assaut, matériel divers…). »* puis *« Allure
maximale : c'est l'Allure d'un personnage qui court le plus vite possible [...] sans être encombré
d'aucune manière. »* — l'Allure Maximale est donc réservée à un personnage sans sac, sans armure et
sans arme plus grosse qu'un pistolet ; au-delà, le plafond RAW est l'Allure Rapide.

**Code impliqué** : `shared/polarisUtils.js:201-205` (`calcAllures`) — calcule les 4 Allures à partir
de la seule Coordination/Athlétisme, aucun paramètre d'encombrement. `server/src/services/
movementBudgetService.js:33-61` (`getCharacterMovementBudget`) — ne lit ni `char_inventory`, ni
l'équipement porté, avant d'exposer le budget `max`.

**Cause racine [HYPOTHÈSE]** : lecture de code uniquement, non instrumentée ni reproduite en jeu réel
— aucun filtre d'éligibilité à l'Allure Maximale n'existe nulle part dans la chaîne de calcul.

**Trouvé pendant** : discussion `docs/PLAN_COMBAT_TIMELINE.md` sur le rattachement du malus
Précision/Équilibre/Furtivité/Vigilance à l'Allure choisie pour une Action combinée avec un
déplacement (§6bis/6ter de ce plan) — sans lien direct avec la Timeline elle-même.

**Prochaine étape** : définir précisément le critère « encombré » (poids total ? présence d'un sac
équipé en slot D/Ce ? armure portée ? catégorie d'arme équipée > pistolet ?) avant de coder un garde
dans `calcAllures`/`getCharacterMovementBudget` — session dédiée, hors scope immédiat de
`docs/PLAN_COMBAT_TIMELINE.md`.

---


### Dette MELEE-INHAND — Arme principale CaC jamais vérifiée "en main" à la résolution

**Symptôme** : Aucun cas observé en jeu — trouvé en codant COM24 (Session 176), en écrivant la
revalidation de l'arme secondaire (en-main, catégorie, propriétaire) pour le bonus "deux armes".

**Contexte** : contrairement au Tir (`fetchHandWeaponForAssault` vérifie `inHand` explicitement,
déclaration ET résolution), `resolveMeleeAction` (`socketCombatHelpers.js`) fetch l'arme **principale**
(`weaponInvId`) uniquement par id dans `char_inventory`, sans jamais vérifier `char_inventory_slots`
(en main MG/MD/2M). Un item transféré hors des mains entre Déclaration et Résolution (fenêtre étroite)
resterait utilisable pour l'attaque CaC.

**Décision (Session 176)** : ne pas corriger dans le cadre de COM24 — appliquer cette rigueur
uniquement à l'arme secondaire (donnée nouvellement introduite, aucun risque de rétrocompatibilité)
sans toucher à la validation existante de l'arme principale (la durcir pourrait rejeter des
déclarations aujourd'hui acceptées, changement de comportement non demandé).

**Prochaine étape** : session dédiée — même patron que `fetchHandWeaponForAssault`, à appliquer à
l'arme principale CaC si jugé prioritaire.

---

### Dette DARTS-TAGDUP — `TXT=DEPTH=...|DEPTH=...` : clés dupliquées dans le même tag, la 2ᵉ écrase la 1ʳᵉ

**Symptôme** : Aucun cas observé en jeu — trouvé en vérifiant la migration 209 (COM26, Session 182)
contre le vrai parseur (`parseAmmoEffects`).

**Contexte** : plusieurs munitions Darts (`Darts 5.56mm SAP`, `Darts 7.62mm APHC`, et maintenant `Darts
7.62mm SAP` via la migration 209) portent `TXT=...|DEPTH=>500M_X0.5|DEPTH=>=1000M_DISABLE` — deux
sous-tags `DEPTH` distincts (règle RAW : au-delà de 500m portée ÷2, à -1000m arme inutile). Or
`parseAmmoEffects` (`shared/weaponAmmoDsl.js`) stocke les tags dans un objet clé→valeur : la 2ᵉ
occurrence de `DEPTH` écrase silencieusement la 1ʳᵉ. `tags.DEPTH` ne contient jamais que
`>=1000M_DISABLE`, jamais les deux valeurs.

**Impact actuel** : aucun — `DEPTH` n'est lu par aucun mécanisme de résolution aujourd'hui (seul `FX`
est consommé, `damageService.js`). Latent, pas actif.

**Prochaine étape** : à traiter avant toute implémentation d'un mécanisme de profondeur (armes
sous-marines) — soit autoriser des valeurs multiples par clé dans `parseAmmoEffects` (ex. tableau),
soit changer la convention catalogue pour une clé composite (`DEPTH=500M_X0.5,1000M_DISABLE`).

---

### Dette COM27 — CaC multi-attaque : le jet de défense semble se lancer avant le jet d'attaque

**Symptôme** : signalé par Saar (2026-07-18) en validant le correctif `combat_pending` (Session 158,
scénario attaque CaC multiple PJ touchant 2 défenseurs PJ) — le jet de défense apparaît lancé/affiché
avant le jet d'attaque, alors que l'ordre attendu est attaque puis défense.

**Code impliqué** : `server/src/socket/socketCombatHelpers.js` — `resolveMeleeAction` (jet d'attaque
`rollAttaque`, ~ligne 533, émis en `DICE_RESULT` immédiatement) précède structurellement l'insertion
`combat_pending(type:'melee_defense')` et l'attente du jet de défense côté
`COMBAT_MELEE_DEFENSE_CONFIRM` (`socketCombatResolution.js`, jet `rollDefense` ~ligne 579) — le code
lu semble donc déjà conforme à l'ordre attendu.

**Cause racine [INCONNU]** : pas encore investigué en instrumentant. Analyse de code approfondie
Session 176 (Saar re-signale le symptôme sans détail de scénario supplémentaire) — trace complète du
flux d'émission :
- `resolveMeleeAction` pousse le jet d'attaque dans un tableau `emissions` (`socketCombatHelpers.js:1464`),
  non envoyé immédiatement.
- Défenseur PJ : insertion `combat_pending` + `setFSMSubPhase(..., 'AWAITING_DEFENSE')` +
  `broadcastCurrentSubPhase` (`:1812-1813`, **émission directe** `COMBAT_TIMELINE_UPDATED`, avant que
  `emissions` ne soit vidé), puis `COMBAT_MELEE_DEFENSE_PROMPT` poussé dans le même tableau `emissions`
  après l'attaque (`:1826`).
- `flushEmissions` (`socketCombatResolution.js:25`) vide ce tableau dans un `for` synchrone : attaque
  puis prompt, ordre préservé par Socket.IO. Le défenseur ne peut pas cliquer "Défendre" avant d'avoir
  reçu le prompt (contient `rollAttaque`/`chancesAttaque`) — son jet ne peut donc pas partir avant
  l'attaque par ce chemin.
- Multi-cibles (CaC multiple sur 2 défenseurs) : chaque cible = une entrée d'échelle séparée, résolue
  une à la fois par `advanceTimeline`/`pickNextTimelineStep` (FSM `SLOT_ACTIVE`/`AWAITING_DEFENSE`/
  `AWAITING_DAMAGE` strictement serialisé) — la 2ᵉ attaque ne démarre qu'une fois l'échange complet
  avec la 1ʳᵉ cible terminé. Pas de parallélisme trouvé dans ce chemin.
- **Point d'attention non tranché** : `broadcastCurrentSubPhase` émet `COMBAT_TIMELINE_UPDATED`
  directement, avant le flush du jet d'attaque — si un composant client réagit à ce changement de
  `subPhase` indépendamment du jet d'attaque, ça pourrait créer une fenêtre. Composant responsable pas
  encore identifié côté client (`CombatOverlay.jsx`/`CombatActionWindow.jsx` à tracer).

**Mis en pause (2026-07-24, décision Saar)** : reproduction non confirmée aujourd'hui, symptôme
resignalé sans nouveau détail de scénario. On attend une nouvelle occurrence en jeu avant de continuer
— ne pas coder sur la base du code lu seul, contradictoire avec le symptôme.

**Prochaine étape** : si le symptôme se reproduit, capturer précisément : nombre de défenseurs,
inversion entre attaque/défense du même échange vs entre deux échanges différents, qui contrôlait quel
personnage. Puis instrumenter `[DBG-COM27]` horodaté aux 3 points d'émission (attaque, changement de
sous-état, défense) avant tout correctif.

---

### Dette MELEE-ATKNAME — Fenêtre défense CaC : « [Compte] vous attaque » au lieu du nom du personnage

**Symptôme** : signalé par Saar (2026-07-28) en testant `docs/PLAN_RW_SYSCOMBAT.md` Lot 4 (Tir, sans
rapport direct) — la fenêtre de défense CaC affiche « Saar (GM) vous attaque » au lieu du nom du
personnage attaquant (ex. « Joueur 3 »).

**Code impliqué** : `server/src/socket/socketCombatHelpers.js:1443-1444` (`resolveMeleeAction`) —
`attackerUsername = userRow?.username ?? character.name ?? 'Inconnu'`, calculé pour l'attribution des
jets de dés (`DICE_RESULT.username`, cohérent avec l'usage « qui a physiquement lancé le dé ») ; cette
même variable est réutilisée telle quelle comme `attackerName` du prompt de défense
(`resolveMeleeDefensePj`, ~L.1875 : `attackerName: attackerUsername`), consommé par
`client/src/components/CombatOverlay.jsx:467` (`{meleeDefensePrompt.attackerName} vous attaque !`).

**Cause racine [HYPOTHÈSE]** : deux usages différents (identité du compte qui a lancé le dé vs identité
du personnage qui attaque narrativement) partagent la même variable. Dès que `character.user_id` est
renseigné pour le token attaquant (vrai pour un PJ, et apparemment pour le token de test de Saar),
`userRow.username` (le compte) l'emporte sur `character.name` dans la chaîne `??`, donc le prompt
affiche le nom du compte plutôt que celui du personnage. Non encore instrumenté/confirmé en exécution
(règle du registre : lecture de code seule = `[HYPOTHÈSE]`).

**Prochaine étape** : instrumenter `[DBG-MELEE-ATKNAME]` (logger `character.user_id`, `character.name`,
`userRow?.username` au moment de construire `attackerUsername`, L.1443-1444) pour confirmer l'hypothèse
sur le cas réel de Saar, puis séparer les deux usages — `attackerUsername`/`attackerColor` restent pour
`DICE_RESULT` (attribution du jet), un champ distinct (`character.name` directement) alimente
`attackerName` du prompt de défense. Vérifier aussi si le même besoin existe côté Tir/PJ (pas de fenêtre
de défense équivalente aujourd'hui, donc pas de symptôme visible, mais à vérifier avant de généraliser
le correctif). Sans rapport avec `docs/PLAN_RW_SYSCOMBAT.md` Lots 3-4 (code non touché par ce chantier).

---

### FEAT4 — Aura de portée CaC (3m + allonge de l'arme)

**Besoin** (Saar, 2026-07-18) : afficher une aura/cercle autour d'un personnage qui attaque au corps à
corps, indiquant sa portée réelle (3m de base + allonge de l'arme équipée, cf. `resolveMeleeAction`
`allonge = parseInt(weapon?.ref_range) || 0`, même valeur que le garde-fou serveur `distanceMChk > 3 +
allonge`) — retour visuel pour savoir qui est à portée avant de déclarer/valider une cible.

**Code impliqué (pistes)** : `Canvas3D.jsx` — `TokenActiveDisk` (ring doré token actif, FEAT3 ci-dessus)
est le précédent le plus proche (cercle centré sur un token, rayon fixe) ; ce besoin demande un rayon
variable selon l'arme équipée du personnage actif. Donnée `allonge` déjà calculée côté serveur
(`resolveMeleeAction`) mais pas exposée au client aujourd'hui pour l'affichage — à vérifier si
`equipment[tokenId]` (fetch `/battlemaps/:id/combat-equipment`, déjà utilisé par
`CombatGmDeclareWindow.jsx`) porte déjà `ref_range` ou s'il faut l'ajouter.

**Prochaine étape** : session dédiée — définir le déclencheur d'affichage (permanent sur le token actif
en phase Résolution CaC ? uniquement pendant le mode ciblage `combatTargetMode`, mode `'melee'` ?),
sourcer `allonge` correctement (arme équipée réelle, mains nues = 0), portée = `WorldMetrics` (1 case =
1,5m, cf. `.claude/rules/world.md`) plutôt qu'une valeur écran arbitraire.

---

### Bug COM23 — Label token : pénètre dans les murs ✅ Session 127

**Symptôme** : Le label nom affiché au-dessus du token peut s'afficher à l'intérieur des murs selon l'angle de caméra.

**Cause racine [VÉRIFIÉ]** : `<Text>` troika — shader SDF `transparent: true` → pass transparent → depth test dégradé. Remplacement par sprite CanvasTexture avec depth test natif WebGL.

**Correctif — `Canvas3D.jsx`** : `TokenLabel` composant — `THREE.CanvasTexture` + `<sprite><spriteMaterial depthWrite={false}>`. Voxels `MeshLambertMaterial` opaque → depth buffer rempli → sprite occludé correctement.

**Testé :** label occludé par murs ✅ | **Non testé :** H3D calibrage (cosmétique)

---

### FEAT3 — Token actif : cercle de sélection (surbrillance) ✅ Session 127

**Besoin** : Le token dont c'est le tour doit apparaître en surbrillance (cercle ou halo) sur la carte 3D.

**Correctif — `Canvas3D.jsx`** : `TokenActiveDisk` composant — ring dorée `#ffd700` (r=0.52–0.72, y=0.03 sol), pulsation `useFrame`. `activeTokenId` de `useCombatStore` (UUID string). Distinct de la ring de sélection (couleur token, y=0.6).

**Testé :** anneau doré token actif ✅, indépendant ring sélection ✅ | **Non testé :** —

---

## Dettes monde 3D — rendu Surface

### Bug EAU1 — Nappe d'eau (Canvas3D) flotte au plafond d'une salle sans rapport, pas au-dessus de son propre étage d'eau

**Symptôme** : En jeu (`Canvas3D` → `SurfaceDungeonScene`), la nappe d'eau translucide apparaît au-dessus des salles, à hauteur de plafond, au lieu de rester juste au-dessus des cases d'eau réelles. Signalé par Saar ; Kiwi dit l'avoir "corrigé" plusieurs fois côté serveur distant, sans trace (pas de dépôt Git de son côté).

**Règle** : Aucune (rendu, pas une règle Polaris). Comportement voulu décrit par Saar : la nappe doit rester au-dessus de son propre étage d'eau, jamais caler sur le plafond d'une salle.

**Code impliqué** : `client/src/lib/surfaceData.js` — `computeSurfaceWaterCells` (~lignes 3250-3369). `mapTopY` (~ligne 3291) = maximum de `level.topY` sur **toute la carte** (tous étages, toute salle, tout mur/plafond/escalier confondu — pas seulement les sources d'eau). Cette valeur est appliquée sans distinction à chaque cellule d'eau finale (~ligne 3363), y compris aux vraies cases "Grille" (`level.candidates`) qui ont pourtant déjà un plafond local précisément calculé par `findCeilingForFloor` (`candidate.ceilingY`, ~lignes 3258-3267) — cette valeur locale est calculée puis jetée au profit de `mapTopY`.

**Cause racine [HYPOTHÈSE]** : `mapTopY` global écrase le plafond local de chaque case d'eau candidate. Si une seule salle haute existe n'importe où sur la carte (tour, atrium), toute l'eau du bâtiment — nappe extérieure et vraies salles "Grille" confondues — remonte à cette hauteur globale, indépendamment de la salle réellement concernée. Un test existant (`client/src/lib/surfaceData.test.mjs:69-79`, *"la surface extérieure de l'eau utilise le sommet global de la carte"*) verrouille ce comportement, mais seulement pour la nappe extérieure (scénario sans aucune case candidate) — il ne couvre pas le cas d'une vraie case d'eau de salle. Non encore instrumenté ni reproduit en exécution réelle par Claude (lecture de code uniquement).

**[DBG-EAU1] suggestion** (si besoin de confirmer en exécution) :
```js
console.log('[DBG-EAU1]', { x, z, baseY, mapTopY, candidateCeilingY: candidate?.ceilingY })
```
à ajouter juste avant `waterCellsByPosition.set(...)` dans `computeSurfaceWaterCells`.

**Investigation (B) — la "nappe extérieure" était une improvisation client, pas juste un bug de hauteur [OBSERVÉ]** : le moteur canonique possédait déjà un vrai système d'eau, complet et autoritaire, que `computeSurfaceWaterCells` ignorait entièrement :
- `worldCompiler.js` (`addCompartments`) compile un `compartment` par salle dans le `WorldSnapshot`, avec `sealedByDefault: room.blocksWater !== false` — "Grille" alimente déjà un vrai graphe canonique, pas seulement un calcul client.
- `shared/world/worldEffects.js` — `buildCompartmentPropagationGraph(snapshot, { channel: 'water' })` construit ce graphe (compartiments reliés par les portes, chaque porte pouvant bloquer l'eau sans bloquer la vision) ; `propagateEffectThroughCompartments` y propage une intensité depuis un compartiment d'origine, avec atténuation — exactement le mécanisme que `MOTEUR_MONDE.md` §10 décrit comme cible ("Le compilateur doit produire des compartiments…"). **Il existe déjà.**
- Ce graphe sert au système d'effets runtime (`world_effect_instances`, type "inondation" — `MOTEUR_MONDE.md` §9), déclenché explicitement par le MJ, journalisé, durable en base, déjà rendu côté client (`Canvas3D.jsx:1076-1104`, `runtimeEffectRegions`, `definitionKey === 'flooded'`).
- `computeSurfaceWaterCells` ne consultait ni le `WorldSnapshot`, ni aucune instance d'effet, et affichait de l'eau même sans aucune case "Grille" déclarée nulle part sur la carte — de l'eau qu'aucun MJ n'avait jamais déclarée, jamais journalisée, jamais validée serveur. Contradiction directe avec `CLAUDE.md` §1.4 (« une propriété métier ou physique possède une autorité unique »), `.claude/rules/world.md` (« le rendu consomme le modèle canonique ; il ne le redéfinit pas ») et §7 (« pas de logique métier dupliquée entre client et serveur »).

**Correctif codé (2026-07-29, décision Saar : option 1 — retrait complet, option 2 "eau structurelle authorée" différée en v2, voir `docs/ROADMAP.md`)** :
- `client/src/components/SurfaceDungeonScene.jsx` — retrait de `computeSurfaceWaterCells`, `WaterSheets`, `mergeWaterCells`, des props `showWater`/`waterOpacity` et de l'import `createWaterMaterial`/`updateWaterMaterial` (toujours utilisé par ailleurs dans `EntityMesh.jsx`, non touché).
- `client/src/components/Editor3D.jsx` / `SurfaceEditorScene.jsx` — retrait du `showWater={false}` devenu sans objet.
- `client/src/lib/surfaceData.js` — suppression de `computeSurfaceWaterCells` et de tout son code mort dédié (`surfaceBlocksWater`, `ensureWaterLevel`, `includeWaterCell`, `findCeilingForFloor`, `wallIntervalCovers`, `segmentsIntersect2d`, `wallMatchesWaterEdge`, `edgeBlocksWater`, `includeWallBounds`, `cellKey`) — plus aucun appelant après retrait du point 1.
- `client/src/lib/surfaceData.test.mjs` — retrait du test devenu orphelin (`"la surface extérieure de l'eau utilise le sommet global de la carte"`) et de l'import associé.
- Doc à jour : `docs/SYSTEME/SURFACES_SALLES.md` (section "Rendu de l'eau" réécrite — eau en jeu = uniquement l'effet runtime "inondation").
- L'eau visible en jeu passe désormais exclusivement par le mécanisme canonique décrit ci-dessus ; plus aucun rendu d'eau n'est recalculé côté client depuis `surface_data` brut.

**Testé** : `node --test client/src/lib/surfaceData.test.mjs` (27/27 ✅), `npm run build` (client, propre), ESLint sur les 5 fichiers touchés (0 erreur, warnings pré-existants sans rapport).
**Non testé** : scénario réel en jeu (poser une salle "Grille", déclencher une inondation MJ, vérifier le rendu bleu translucide de `runtimeEffectRegions` à la bonne position/hauteur) — à la charge de Saar avant de considérer cette dette close et de la retirer du registre (règle d'hygiène du fichier).

---

### Bug DEPLACEMENT2 — Destination occupée : le déplacement est entièrement annulé au lieu de s'arrêter à la dernière case libre

**Symptôme** : Si la case de destination visée est déjà occupée (par un autre token/entité bloquante), l'action "Déplacement" est annulée entièrement (`status: 'unreachable'`) au lieu de mener le personnage jusqu'à la dernière case libre avant l'obstacle. Signalé par Saar (2026-07-29), trouvé en validant DEPLACEMENT1.

**Règle** : Comportement attendu implicite (convention tactique standard : on doit pouvoir s'approcher au contact d'un adversaire même si sa case exacte est occupée) — pas de référence RAW précise identifiée pour l'instant.

**Code impliqué** : `shared/world/navigation.js` — `findNavigationPath` (~ligne 430-450) : `nearestNode(workingGraph.nodes, requestedTo, blocked, maxSnapDistance)` exclut tout nœud dont l'ID est dans `blocked` (occupation, ~ligne 343 de `nearestNode`) ; si le nœud le plus proche de la destination demandée est occupé, `destination` vaut `null` et la fonction retourne `null` sans jamais tenter un chemin partiel. `planWorldPath` (même fichier, ~ligne 505) traduit ce `null` en `status: 'unreachable'`.

**Cause racine [HYPOTHÈSE, lecture de code uniquement — trouvé en cours de validation de DEPLACEMENT1, pas encore instrumenté]** : la sélection du nœud de destination traite "case occupée" comme "aucune destination valide" au lieu de "chercher le nœud libre le plus proche le long du chemin vers la destination demandée". Le budget/coût (`buildMovementPlan`, `shared/world/movementCost.js`) sait déjà tronquer un chemin trouvé à la limite du budget (`status: 'budget'`) — la même logique de troncature pourrait s'appliquer à une destination occupée, mais aujourd'hui la recherche de chemin échoue avant même de démarrer le calcul de coût.

**Prochaine étape** : Reproduire (déclarer un déplacement vers une case occupée, confirmer `status: 'unreachable'` par instrumentation `[DBG-DEPLACEMENT2]`), puis évaluer si le nœud de destination doit retomber sur le nœud libre le plus proche de `requestedTo` le long du graphe (plutôt que le nœud géométriquement le plus proche tout court) avant de coder un correctif.

---

## Bugs UI divers — Cluster Q

### Bug UI2 — Dés : alignement visuel incorrect

**Symptôme** : Les dés ne sont pas alignés correctement dans l'interface.

**Code impliqué** : Composant dés 3D ou layout résultats (à identifier).

**Prochaine étape** : Cluster Q — identifier le composant concerné.

---

### Bug UI3 — Dé 100 (D100) : affichage chat incorrect

**Symptôme** : Le résultat d'un lancé de D100 ne s'affiche pas correctement dans le chat de session. Différence entre le résultat affiché et le résultat dans le chat (source de vérité)

**Code impliqué** : Composant chat + rendu `DICE_RESULT` — cas `dieType = 'd100'`.

**Prochaine étape** : Cluster Q — lire rendu DICE_RESULT dans Sidebar/chat.

---

## Bugs marchands / catalogue

### Bug EQ1 — `ref_equipment.price_modifier` jamais lu, prix formulés facturés au prix de base

**Symptôme** : un item dont le prix dépend d'une formule (ex. Lunette de visée,
`price=1000` + `price_modifier="x (niv x niv)"`, prix réel attendu 1000×niv² selon le niveau visé)
est facturé au prix de base brut (1000 sols, quel que soit le niveau) lors d'un achat marchand —
la colonne `price_modifier` n'est jamais interprétée.

**Règle** : catalogue LdB — prix variable selon niveau d'objet (`niv`), déjà capturé en base au
moment du seed (`ref_equipment.price_modifier`) mais jamais exploité en aval.

**Code impliqué** : `server/src/services/tradeService.js` / `server/src/routes/equipment.js` —
grep confirmé, `price_modifier` n'apparaît que dans les migrations/seeds (`48_ref_equipment.js`,
`2_seed_equipment.js`, `73_drone_programs_catalog.js`, `83_drone_programs_rename.js`), jamais dans
un chemin de lecture/achat.

**Cause racine [VÉRIFIÉ]** : colonne présente en base, aucun consommateur — trouvé en recherchant
comment modéliser le prix de la Lunette de visée pour `docs/PLAN_MODING_PHASEB.md` Groupe 2
(Session 141 suite 21 suite, 2026-07-12).

**Prochaine étape** : sprint dédié marchands/catalogue — hors scope du chantier Moding en cours
(la Lunette de visée sera modélisée en 10 lignes catalogue distinctes avec prix littéral précalculé,
contournement propre pour Groupe 2 sans dépendre de ce correctif). Vérifier l'étendue réelle : quels
autres items du catalogue ont un `price_modifier` non-null et sont donc potentiellement concernés.

---

### Dette TRADE2 — Échange MJ : logique "Agir en tant que" / "Destinataire" pas alignée avec l'usage attendu

**Symptôme** : Testé par Saar en tant que MJ (2026-07-17, validation du chantier refonte slots). La
logique actuelle de la fenêtre Échange (`ExchangeWindow.jsx`) n'est pas celle attendue côté MJ.
Attendu par Saar : "Agir en tant que X" → incarner un **PNJ** ; "Destinataire" → cibler un **Joueur**
(PJ). Comportement livré : le court-circuit MJ (Session 151) fait agir le MJ au nom d'un **PJ**, vers
un autre **PJ** — transfert PJ↔PJ sans double validation, jamais PNJ→PJ.

**Décision d'origine** : `docs/Old/PLAN_TRADE.md` (Sessions 124-141) + extension Session 151 —
étendre le système Échange PJ↔PJ existant pour que le MJ puisse « proposer au nom d'un PJ », scope
volontairement réduit à ce seul côté au moment de la décision.

**Code impliqué** : `client/src/components/ExchangeWindow.jsx` (bandeau « MJ — agit au nom de »,
prop `isGm`) ; `server/src/socket/socketTrade.js` (`TRADE_TRANSFER_OFFER`, résolution `fromChar` sans
filtre `user_id` quand `socket.data.role === 'gm'`).

**Cause racine** : pas un bug — comportement délibérément scopé ainsi en Session 151. Écart entre
l'usage attendu par Saar (PNJ→PJ) et ce qui a été livré (PJ→PJ au nom du MJ).

**Prochaine étape** : décision produit à prendre — un flux PNJ→PJ est-il un **ajout** à côté de
l'existant PJ→PJ, ou son **remplacement** ? Non tranché, hors scope de la tâche qui a fait remonter
le sujet (validation fonctionnelle du chantier `docs/PLAN_INVENTORY_SLOTS.md`).

---

## Bugs mutations

### Dette MUT4 — Griffes : bonus Escalade +3 / malus dextérité manuelle -3 jamais câblés

**Symptôme** : Aucun cas observé en jeu à ce jour — gap trouvé par lecture de règle lors d'un run à
vide, pas encore rencontré en pratique. La mutation Griffes n'a aucun effet mesurable sur les Tests
d'Escalade ni sur les Tests de dextérité manuelle (crocheter une porte, voler un portefeuille, etc.).

**Règle** : `docs/Character/Creation/REGLE_MUTATION.md`, Griffes — *"il bénéficie d'un bonus de +3
en Escalade, quand il peut utiliser ses griffes. En revanche, il subit un malus de -3 lors des Tests
impliquant une certaine dextérité manuelle."*

**Code impliqué** : aucun — `grep` (`server/`) sur "Escalade"/"dextérité manuelle" en lien avec les
griffes ne remonte que les migrations de seed (`95_seed_ref_mutations.js`, texte descriptif),
jamais un point de consommation en résolution de Test.

**Cause racine [HYPOTHÈSE]** : Le Lot 4 `docs/PLAN_MUTATION2.md` (Griffes/Crocs/Corne/Excroissance
osseuse) n'a câblé que les dégâts de corps à corps (`natural_weapon_formula`) — ces deux
modificateurs de Compétence conditionnés par une mutation active n'ont jamais été dans le périmètre
d'aucun lot (1-3 traitent attributs/résistances/RD, pas de bonus/malus de Compétence liés à une
mutation précise). Proche du problème de Lot 5 (`[CS7]`, déblocage de compétences par mutation) mais
distinct : ici il s'agit d'un modificateur de Test, pas d'un déblocage d'accès.

**Trouvé pendant** : run à vide du Lot 4 `docs/PLAN_MUTATION2.md` (Session 141 suite 25), en
relisant le texte complet de Griffes pour vérifier le périmètre exact de ce qui avait été câblé.

**Prochaine étape** : à documenter comme gap différé — pas de mécanisme générique existant pour "un
bonus/malus de Compétence conditionné par une mutation active" (contrairement aux attributs/
résistances qui passent par `char_mutation_effects_view`). Nécessiterait de concevoir cette brique
avant de pouvoir détailler ligne-à-ligne, même famille de travail que Lot 5.

---

## Bugs Polaris

### Dette POL1 — Avantage "Polaris non maîtrisé" (adv_078) : tirage de 2 pouvoirs aléatoires non implémenté

**Symptôme** : Aucun cas observé en jeu à ce jour — signalé par Saar en clarifiant l'architecture du
Lot 5 (`docs/PLAN_MUTATION2.md`), pas encore rencontré en pratique.

**Règle** (`ref_advantages.adv_078`, déjà seedée migration 123, texte en base) : *"Le personnage
manifeste des pouvoirs du Polaris sans jamais avoir réussi à les maîtriser. 2 pouvoirs tirés
aléatoirement, pas d'accès à Maîtrise de la Force Polaris — activation incontrôlée uniquement."*
Distinct d'`adv_079` "Force Polaris" (accès plein via achat de la compétence) et d'`adv_077`
"Polaris latent" (aucun déblocage, réveil MJ seul).

**Code impliqué** : aucun — `grep` confirmé, aucun mécanisme de tirage aléatoire de compétences
"Pouvoirs Polaris" n'existe (`AdvantagesPanel.jsx` Étape 2B ne fait que lister `refSkillsPolaris`
pour toggle manuel `is_learned`, gaté par `adv_079` uniquement — pas de branche `adv_078`).

**Cause racine [INCONNU]** : fonctionnalité jamais construite, pas une régression. Nécessiterait de
définir la famille "Pouvoirs Polaris" (sous-ensemble de `ref_skills`, hors `Maîtrise de la Force/
Écho Polaris` elles-mêmes) avant de pouvoir détailler un tirage aléatoire 2/N.

**Prochaine étape** : session dédiée — hors scope de `docs/PLAN_MUTATION2.md` Lot 5 (qui traite
uniquement le bug d'affichage `[CS7]` des compétences à prérequis MUTATION/ADVANTAGE, pas la
mécanique de tirage `adv_078`).

---

## Nouvelles fonctionnalités

### GRID2D1 — Grille non affichée sur une battlemap 2D (grid_enabled=true confirmé, cause non identifiée)

**Symptôme** : Sur une carte 2D (`Canvas2D.jsx`, `docs/PLAN_BATTLEMAP2D.md` Lot 3), activer "Afficher
la grille" via la modale Paramètres n'affiche aucune grille sur le rendu — même après rechargement
complet de la page (Ctrl+F5) et redémarrage intégral du serveur client Vite (process tué et relancé).
Confirmé par Saar sur plusieurs tentatives (2026-07-29).

**[VÉRIFIÉ]** par instrumentation (log `[DBG-GRID2D]` temporaire, retiré après usage) : côté client,
`battlemap.grid_enabled` vaut bien `true` (booléen), `grid_size=64`, `grid_offset_x/y=0`, bounds de la
salle triviale corrects (24×16 cases) — la condition React `{battlemap.grid_enabled && <Grid .../>}`
est donc remplie, le composant `<Grid>` de drei est bien monté. Persistance serveur également
vérifiée en base (`grid_enabled: true` confirmé par requête directe sur `battlemaps`).

**Piste explorée et écartée [HYPOTHÈSE réfutée]** : perte de contexte WebGL observée dans la console
(`WebGL context was lost`, plusieurs occurrences, y compris sur un chargement à froid) — redémarrage
complet du serveur Vite effectué pour écarter une staleness HMR liée au module `GridMaterial`
(`extend()` de `@react-three/fiber`, connu pour mal survivre à des hot-reloads répétés du fichier
consommateur). Le problème persiste après ce redémarrage — écarte l'hypothèse HMR comme cause unique.

**Différence notée avec `Canvas3D.jsx`** (où le même composant `<Grid>` de drei s'affiche sans
problème, `Canvas3D.jsx:966-972`) : cette instance est **inconditionnelle** et **sans `rotation`** —
celle de `Canvas2D.jsx` est conditionnée par `grid_enabled` et porte une
`rotation={[-Math.PI/2,0,0]}` (nécessaire pour orienter le plan natif de drei vers le plan XY de la
caméra 2D, cf. `docs/PLAN_BATTLEMAP2D.md` §4.3). Cette rotation combinée au swizzle interne du shader
de `Grid` (`position.xzy` dans `GridMaterial`) n'a pas pu être vérifiée en exécution (pas d'accès
navigateur direct côté Claude) — piste la plus probable, non encore instrumentée.

**Cause racine [INCONNU]** — non bloquant, décision Saar (2026-07-29) : ne pas creuser davantage pour
l'instant, la carte 2D reste utilisable sans grille (illustration + tokens libres, cas d'usage
principal de la v1).

**Code impliqué** : `client/src/components/Canvas2D.jsx` (`<Grid>`, position/rotation) ;
potentiellement `node_modules/@react-three/drei/core/Grid.js` (shader `GridMaterial`, swizzle
`position.xzy`).

**Prochaine étape** : si le besoin réel se confirme, instrumenter en conditions réelles (log dans un
`useFrame` temporaire vérifiant `matrixWorld`/`geometry` du mesh `<Grid>` au moment du rendu), ou
remplacer le rendu par un mécanisme n'utilisant pas `extend()`/shaderMaterial (lignes Three.js
natives ou texture répétée) pour écarter définitivement la piste drei.

---
Bug B‑VX — Modification faces voxel non exposée dans l’UI

Symptôme : Impossible de modifier les faces d’un voxel existant via l’interface, alors que la fonction de modification existe probablement côté moteur.

Règle : Aucune référence LdB.

Code impliqué : client/src/components/VoxelBuilderTab.jsx (ou composant d’édition voxel). Le bouton/modale d’édition de faces est absent.

Cause racine [INCONNU] : Non investigué.

Prochaine étape : Identifier le composant responsable de l’édition de voxels, vérifier si la fonctionnalité est seulement masquée ou jamais construite.
