# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-07-19 Session 162 (COM25/COM28/COM29 clos — détail EN_COURS.md Items 90-91 ; COM2 clos Session 161, cluster E) ; 2026-07-19 (Saar) triage `docs/COMPARATIF.md` — ajout INI4/MELEE-MR/DEF5/TIRIMP/WNDMORT/CHOC1 ; 2026-07-19 (dev/Saar, chantier Tir Multi) — ajout INI5, audit demandé par Saar ; 2026-07-19 Session 166 (Saar) — INI4 clos (item 96 `EN_COURS.md`) ; ST1/CH1 retirés du registre (reclassés chantiers dédiés, voir `docs/ROADMAP.md`) ; KIWI2 retiré (résolu, confirmé Saar) ; JSON1 (dette `EN_COURS.md`, pas ici) clos — dette fantôme déjà résolue par le merge Fusion Kiwi ; MELEE-MR clos (item 97 `EN_COURS.md`) ; DEF5 clos (item 98 `EN_COURS.md`), ajout SURPRISE1 (trouvé en cours de route) ; TIRIMP clos (item 99 `EN_COURS.md`, refonte `shared/combatSituationMods.js` — retrait du sentinel -99), ajout COUVERTURE_TOTALE (trouvé en cours de route) ; WNDMORT clos (item 100 `EN_COURS.md`, `WOUND_PENALTIES.mortelle` -20→0 + garde déclaration/défense), ajout WNDMORT-UI et WNDMORT-HORSCOMBAT (résiduels) ; 2026-07-21 Session 167 (Saar) — chantier Moding Groupe 4 clos (item 104 `EN_COURS.md`, Phases 1/3/4 codées et testées) ; ajout MODING4-ATI/MODING4-MEMOIRE/MODING4-PROJECTEUR/MODING4-INTEGRATION (résiduels, décisions produit + câblage restants)
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
| **H — Dettes techniques** | TC1 + DCO1 + VX1 + AU1 + INI1 + INI2 + INI3 + TOK1 + MAP1 + COM14 + DASH1 | divers | Basse |
| **I — Affichage dégâts drone** | DMG1 + DMG2 | `socketCombatResolution.js` | SR ✅ — validation fonctionnelle requise |
| **Q — UI divers** | UI2 + UI3 + ST3 | composants dés + chat | Basse |

**Règle d'or :** valider le cluster A avant B, B avant C, etc. Validation fonctionnelle obligatoire entre clusters.

---

## Dettes combat — issues confirmées par l'audit COMPARATIF (2026-07-19)

> Triage de `docs/COMPARATIF.md` (audit ponctuel 2026-07-17, `MANUELSYSCOMBAT.md` vs code réel) — ces
> 6 dettes étaient citées dans l'audit mais n'avaient pas d'entrée dédiée ici, contrairement à la règle
> d'hygiène du fichier (« Détail technique de chaque bug → `BUGIDENTIFIE.md` »). `COMPARATIF.md` est
> archivé vers `docs/Old/` une fois ce triage fait — ne plus le traiter comme registre vivant.

### Dette INI5 — CaC : forfait Initiative de déclaration (-3/-5) potentiellement redondant avec le décalage de phase RAW

**Symptôme** : Aucun cas observé en jeu à ce jour — trouvé en vérifiant le RAW pour
`docs/PLAN_TIRMULTI.md` (2026-07-19), pas encore instrumenté ni reproduit en jeu.

**Règle** : RAW p.218-219 (`docs/REGLES/REGLESYSCOMBAT.md:604-618`, « Effectuer plusieurs Attaques par
Tour ») ne décrit qu'**un seul** coût chiffré pour les Attaques multiples : le décalage de phase de -5
Initiative par attaque supplémentaire (« Deuxième Action : Initiative -5, Troisième Action :
Initiative -10 »). Aucun forfait d'engagement ni malus de déclaration distinct n'est mentionné dans ce
paragraphe.

**Code impliqué** : `server/src/socket/socketCombatAnnouncement.js:305-308` — à la déclaration d'un
CaC, `iniDelta += -3` s'applique systématiquement dès qu'une attaque CaC est déclarée, puis
`iniDelta += -5` supplémentaire si `mapActions.melee.length > 1` (2 ET 3 attaques payent le même -5
fixe). Ce coût réduit directement `combat_roster.initiative` (donc décale la position du personnage
sur toute l'échelle), **en plus** du décalage de phase déjà appliqué séparément par
`computeSeriesPositions` (`server/src/socket/socketCombatHelpers.js:207-209`, -500/attaque à l'échelle
×100 = -5/-10 RAW) au moment de `buildTimelineEntries`.

**Cause racine [HYPOTHÈSE]** : lecture de code uniquement, non instrumentée. Deux hypothèses à
départager avant tout correctif :
1. Le `-3` est un forfait « engagement CaC » générique, indépendant des Attaques multiples (règle
   maison sans lien avec le RAW cité) — dans ce cas seul le `-5` additionnel (si `length > 1`) serait le
   doublon suspect.
2. Le `-3` et le `-5` modélisaient tous deux, avant la refonte de l'échelle de phases (session 159), le
   coût RAW « à la main » via `combat_roster.initiative` — devenus redondants depuis que
   `computeSeriesPositions` calcule le vrai décalage RAW au niveau de l'échelle elle-même, ce qui
   pénaliserait aujourd'hui un CaC multi-attaque deux fois pour le même effet.

**Trouvé pendant** : vérification RAW pour `docs/PLAN_TIRMULTI.md` §4 D3 (2026-07-19) — en évaluant si
Tir Multi devait payer un forfait Initiative équivalent au CaC, constat que le seul coût RAW chiffré
(le décalage de phase) est déjà couvert par l'architecture de l'échelle, ce qui a fait remonter la
question du forfait CaC existant.

**Prochaine étape** : **audit demandé par Saar (2026-07-19)** — reconstituer l'historique de ce `-3`/`-5`
(git blame, `docs/JOURNAL6.md`/journaux archivés, avant/après la refonte session 159) pour établir s'il
a été conçu comme un forfait CaC indépendant du RAW p.218, ou comme une modélisation aujourd'hui
redondante du même décalage de phase, avant de décider de le retirer, le garder ou le redéfinir. Ne pas
coder tant que l'audit n'a pas tranché — dette indépendante du chantier Tir Multi en cours, traitée
séparément (`CLAUDE.md` §13, un plan = un problème).

---

### Dette SURPRISE1 — `combat_roster.is_surprised` jamais remis à `false`

**Symptôme** : Aucun cas observé en jeu signalé — trouvé en instrumentant DEF5 (2026-07-19).

**Règle** : `docs/REGLES/REGLESYSCOMBAT.md:184-188` — la surprise ne s'applique qu'au premier Tour de
combat ; au Tour suivant, le personnage "retrouve son score d'Initiative habituel".

**Code impliqué** : `is_surprised` écrit une seule fois à `COMBAT_START` (`socketCombatState.js:96-107`),
jamais réinitialisé ensuite (`endTurn` ne le touche pas non plus).

**Cause racine [VÉRIFIÉ]** : grep confirmé, aucun `UPDATE ... is_surprised = false` nulle part dans le
code.

**Contournement en place** : `isTargetDefenseless` (DEF5, `socketCombatHelpers.js`) ne consomme
`is_surprised` que si `combat_state.current_turn === 1`, pour ne pas hériter de ce flag jamais remis
à zéro. N'importe quel autre futur consommateur du flag devra appliquer le même garde tant que ce
correctif n'est pas fait.

**Prochaine étape** : correctif isolé — ajouter `is_surprised: false` au reset déjà fait dans `endTurn`
(même requête que le correctif INI4).

---

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

### Dette CHOC1 — Choc étourdissant de l'arme (`ref_equipment.shock`) jamais lu en résolution

**Symptôme** : Aucun cas observé en jeu — remis à plat en profondeur Session 166 (Saar), l'axe initial
"tir marche, CaC non" était inexact.

**Vrai axe du problème [VÉRIFIÉ]** : le Choc porté par une **munition** (`ammo_effects` DSL) fonctionne
(tir uniquement, Lot B Session 152). Le Choc porté par **l'arme elle-même** (`ref_equipment.shock`,
migration 48) n'est lu par aucun chemin de résolution — ni CaC, ni tir (des armes à distance comme
Flex/Fusil choc Stun portent leur Choc sur l'arme, pas une munition — leur Choc est donc déjà cassé en
tir aussi). `ref_shock` est fetché dans 5 requêtes (`char-sheet.js`, `inventoryService.js`) mais jamais
réutilisé après — mort pour la résolution, vivant seulement pour l'affichage inventaire.

**Détail complet, inventaire catalogue vérifié (11 armes réelles concernées + mutation Corne), sources
RAW et scope proposé** : `docs/PLAN_CHOC1.md` — ne pas dupliquer ici, ce plan est la référence.

**Prochaine étape** : décision Saar sur le scope du plan (Palier 1 généralisable vs différé).

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

### Dette VX1 — getVoxelSurfaceTop : pas de cas slope/wedge

**Code impliqué** : `Canvas3D.jsx` — `getVoxelSurfaceTop`. Retourne `y+1.0` pour tous les voxels non-cube.

**Note** : Acceptable V1.

**Prochaine étape** : Sprint voxels v2 — hors scope V1.

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


### Bug COM24 — Bonus "deux armes" (+3 CaC) déconnecté de l'arme réellement déclarée

**Symptôme** : Aucun cas observé en jeu à ce jour — gap trouvé par lecture de code lors d'un run à
vide (pas encore rencontré en pratique). Un personnage possédant deux armes de contact équipées en
slots MD/MG obtiendrait le bonus "deux armes" (+3 au Test de combat au contact) même sur une attaque
où il choisit explicitement de combattre "Mains nues" ou avec une seule des deux armes.

**Règle** : LdB "Se battre avec deux armes" (`docs/REGLES/REGLESYSCOMBAT.md`) — le bonus suppose que
le personnage combat effectivement avec une arme dans chaque main pour cette attaque, pas seulement
qu'il en possède deux d'équipées.

**Code impliqué** : `server/src/socket/socketCombatHelpers.js` — `resolveMeleeAction`, calcul de
`deuxArmesSlots`/`deuxArmesBonus` (~ligne 443-444).

**Cause racine [HYPOTHÈSE]** : `deuxArmesSlots` filtre uniquement l'inventaire du personnage (slots
MD/MG + `ref_category === 'Arme de contact'`), sans jamais croiser `weaponInvId` (l'arme
effectivement sélectionnée pour l'attaque en cours) ni vérifier que l'attaque utilise réellement les
deux mains. Non instrumenté — lecture de code uniquement.

**Trouvé pendant** : run à vide du Lot 4 `docs/PLAN_MUTATION2.md` (armes naturelles), en vérifiant
que les armes naturelles ne bénéficient pas indûment de ce bonus (elles ne sont pas dans
`char_inventory`, donc exclues par construction) — le bonus s'est avéré déjà découplé de la
sélection réelle pour **toute** arme, pas seulement les naturelles. Pas introduit par le Lot 4.

**[DBG-COM24] suggestion** :
```js
console.log('[DBG-COM24]', { weaponInvId, deuxArmesSlots: deuxArmesSlots.map(s => s.slot), deuxArmesBonus })
```

**Prochaine étape** : instrumenter avant tout correctif — reproduire en jeu réel (personnage avec
deux épées équipées, déclarer une attaque "Mains nues", vérifier si +3 s'applique quand même) pour
confirmer l'hypothèse avant de coder.

---

### Bug COM26 — 2 munitions catalogue avec un `ammo_effects` copié-collé d'une autre munition

**Symptôme** : `ref_equipment` — "Darts 7.62 mm ST - Projectile SAP" (id `30985a34-876d-4c0e-89d0-
5f49cab10809`) et "Flèche - Projectile IEM" (id `4795d390-04ee-4697-8d9c-d8eb77480ccd`) portent toutes
deux `DMG=SET(1D6+2);CHOC=SET(BP:5D10,C:4D10,M:3D10,L:2D10,E:1D10);TXT=FX=ASSOMMANTE` — le DSL exact
d'une munition Assommante — alors que leur propre colonne `description` décrit un mécanisme totalement
différent (SAP : dégâts normaux + pénétration d'armure ; IEM : mi-dégâts + Test de panne). En l'état,
ces deux items infligeraient les dégâts/Choc d'une munition Assommante en jeu, pas ceux annoncés par
leur description/nom.

**Trouvé pendant** : migration `160_fix_ref_equipment_choc_assommante.js` (Chantier 11 Étape 2, Lot B,
`docs/PLAN_ARMES_DSL.md`) — ces 2 lignes correspondaient au filtre `CHOC=SET(BP%` mais ont été
explicitement exclues de la correction (leur description ne parlant pas d'Assommante, les corriger
vers `CHOC=SET(1D10+2)` aurait entériné l'erreur au lieu de la réparer).

**Cause `[HYPOTHÈSE]`** : erreur de copier-coller lors du peuplement initial du catalogue (script
d'extraction Excel, `docs/Old/script Extraction Excel/equipement/`), non instrumentée en jeu.

**Prochaine étape** : reconstruire le bon `ammo_effects` pour ces 2 items à partir de leur description
réelle (SAP : `DMG=SET(...);TXT=PEN=SET(...)|FX=SAP` cohérent avec les autres munitions SAP du
catalogue ; IEM : `DMG=MUL(0.5);TXT=FX=IEM(TEST_PANNE:-3)` une fois le Lot C2 tranché) — probablement
en même temps que le Lot C1/C2 puisque ces deux mécaniques y seront de toute façon retravaillées.

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

**Cause racine [INCONNU]** : pas encore investigué en instrumentant — lecture seule, contradictoire
avec le symptôme rapporté. Pistes à vérifier : ordre d'affichage dans le chat (Sidebar) vs ordre réel
d'émission serveur ; scénario précis testé par Saar (nombre de défenseurs PJ, qui contrôlait quel
personnage) non capturé en détail.

**Prochaine étape** : reproduire avec la séquence exacte de Saar, instrumenter `[DBG-COM27]` sur les
points d'émission `DICE_RESULT` (attaque vs défense) pour confirmer l'ordre réel serveur avant de
soupçonner un problème d'affichage client.

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

### Dette TRADE1 — `TRADE_TRANSFER_DECLINED` : aucune vérification d'ownership côté serveur

**Trouvé en marge** (Session 151, en réactivant le secteur "Échange" du menu radial pour le MJ —
sans rapport direct, pas d'instrumentation dédiée, `[HYPOTHÈSE]` par lecture seule).

**Code concerné** : `server/src/socket/socketTrade.js`, handler `WS.TRADE_TRANSFER_DECLINED` —
contrairement à `TRADE_TRANSFER_OFFER`/`TRADE_TRANSFER_ACCEPTED`/`TRADE_TRANSFER_CANCELLED`, ce
handler ne vérifie jamais que le socket appelant correspond réellement au `to_char_id` de l'offre : il
se contente de `db('trade_offers').where({ id: offerId, campaign_id: campaignId, status: 'PENDING'
}).first()` puis passe l'offre à `DECLINED`. En pratique le client (`ExchangeWindow.jsx`) n'appelle
ça que sur une offre déjà reçue via `TRADE_OFFER_RECEIVED` (ciblée), donc pas exploitable en usage
normal — mais un client modifié ou un `offerId` deviné/observé permettrait à n'importe quel membre de
la campagne de refuser l'offre d'un autre. Sévérité faible (nuisance, pas de perte de données ni gain
matériel), mais un vrai trou d'autorisation.

**Non traité maintenant** — hors scope de la tâche en cours (activation MJ), un problème à la fois.

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

### FEAT1 — Map2D (style Roll20)

**Besoin** : Affichage alternatif 2D de la carte (vue du dessus) en complément de la vue 3D existante.

**Prochaine étape** : Sprint dédié — spécifier l'interface (toggle 2D/3D, rendu canvas 2D, synchronisation tokens).

---
Bug B‑VX — Modification faces voxel non exposée dans l’UI

Symptôme : Impossible de modifier les faces d’un voxel existant via l’interface, alors que la fonction de modification existe probablement côté moteur.

Règle : Aucune référence LdB.

Code impliqué : client/src/components/VoxelBuilderTab.jsx (ou composant d’édition voxel). Le bouton/modale d’édition de faces est absent.

Cause racine [INCONNU] : Non investigué.

Prochaine étape : Identifier le composant responsable de l’édition de voxels, vérifier si la fonctionnalité est seulement masquée ou jamais construite.
Bug SURPRISE‑ROLL — roll=1 → initiative=1, sémantique PJ surpris à revoir

Symptôme : Lorsqu’un PJ obtient un 1 sur son jet de surprise, son initiative est fixée à 1, ce qui le fait agir en dernier au lieu de « surpris et ne pouvant agir ». La règle de surprise devrait l’empêcher d’agir au premier tour.

Règle : docs/REGLES/REGLESYSCOMBAT.md — Surprise. Un personnage surpris ne peut agir au premier tour.

Code impliqué : server/src/socket/socketCombatState.js — COMBAT_START, calcul de l’initiative pour les surpris.

Cause racine [INCONNU] : Non investigué. Soit le code confond « surpris » et « initiative minimale », soit le calcul de l’initiative écrase le flag is_surprised.

Prochaine étape : Instrumenter COMBAT_START pour observer is_surprised et initiative sur un jet de surprise = 1. Vérifier si la FSM interdit bien toute action aux surpris.
