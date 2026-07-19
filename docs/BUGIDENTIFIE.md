# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-07-19 Session 161 (COM2 clos, cluster E)
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
| **K — Chat** | CH1 | `SessionPage.jsx` | Haute — sprint persistance séparé |
| **Q — UI divers** | UI2 + UI3 + ST3 | composants dés + chat | Basse |
| **R — Infrastructure Kiwi** | KIWI2 | upload GLB + MinIO + config Kiwi | Haute |

**Règle d'or :** valider le cluster A avant B, B avant C, etc. Validation fonctionnelle obligatoire entre clusters.

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

### Bug ST1 — Badge statut illisible sur token canvas

**Symptôme** : Badge hexagonal "Étourdi" (et autres statuts) visible sur le token mais texte trop petit pour être lisible en jeu.

**Code impliqué** : `Canvas3D.jsx` / Html drei — affichage badges SVGs sous le nom token.

**Prochaine étape** : Sprint 14-2 dédié.

---

### Bug CH1 — Historique chat perdu au F5

**Symptôme** : L'historique des messages du chat en session ne survit pas à un rechargement de page (F5).

**Cause racine** [HYPOTHÈSE] : Messages stockés uniquement en mémoire React (useState). `SESSION_JOIN` ne rejoue pas l'historique. Pas de persistance DB des messages de chat.

**Code impliqué** : `client/src/pages/SessionPage.jsx` — state messages. `server/src/socket/index.js` — handler `SESSION_JOIN`.

**Prochaine étape** : Sprint persistance chat — vérifier d'abord si table `chat_messages` existe en DB. Si non → sprint dédié (modèle, migration, API, sync SESSION_JOIN).

---

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

### Bug COM25 — Arme sans munition restante continue de tirer (ammo_remaining=0 non bloqué) 🔴 URGENT

**Symptôme** : Aucun cas observé en jeu à ce jour — gap trouvé par lecture de code (question de Saar
sur le comportement d'une arme sans munition chargée, en testant le Lot A `docs/PLAN_ARMES_DSL.md`).
Une arme dont le chargeur est déjà vide (`ammo_remaining = 0`) peut continuer à être déclarée et
résolue en combat comme si elle avait des munitions — aucun blocage du jet de toucher ni de la
résolution des dégâts.

**Règle** : pas de citation LdB précise identifiée — attente métier implicite (une arme sans munition
ne peut pas tirer), à confirmer/sourcer si besoin, mais le comportement actuel est de toute façon
incohérent avec le décompte de munitions déjà en place (qui n'aurait aucun sens si le tir n'était
jamais bloqué à 0).

**Code impliqué** : `server/src/socket/socketCombatHelpers.js:1468-1480` (bloc "Décompte munitions"
dans `resolveAssaultAction`) — décrémente `ammo_remaining` avec `Math.max(0, ...)` (clampé, jamais
négatif) et **saute le décompte entièrement si `ammo_remaining` est `NULL`** ("arme non initialisée
= pas encore suivie"), mais aucun garde nulle part dans le fichier n'empêche l'attaque de se dérouler
quand `ammo_remaining` vaut déjà 0 avant le tir.

**Cause racine [HYPOTHÈSE]** : lecture de code uniquement, non instrumentée ni reproduite en jeu réel
(cf. méthode ci-dessus — lecture seule = `[HYPOTHÈSE]`, jamais `[VÉRIFIÉ]` sans exécution observée).
Aucun `if (weapon.ammo_remaining === 0) return ...` ni équivalent trouvé dans `resolveAssaultAction`
ni dans la Phase 1 Déclaration (`socketCombatAnnouncement.js`, non vérifié en détail).

**Trouvé pendant** : test réel en base du Lot A (Chantier 11 Étape 2, DSL munitions,
`docs/PLAN_ARMES_DSL.md`) — question de Saar sur le sens de "sans munition chargée" dans mon scénario
de test a motivé une relecture du code existant, sans rapport direct avec le DSL lui-même.

**Prochaine étape** — **urgent, priorité Saar** : reproduire en jeu réel (arme avec `ammo_remaining=0`,
tenter une déclaration d'assaut), instrumenter `[DBG-COM25]` avant tout correctif. Décider du point
d'insertion du garde (Phase 1 Déclaration vs Phase 2 Résolution — cohérence avec le reste du FSM
combat, qui valide plutôt tôt) et du message d'erreur (réutiliser le pattern `COMBAT_DECLARE_ERROR`
déjà existant). Exclure explicitement les armes de corps à corps (jamais de munitions) et le cas
`pnj_unlimited_ammo=true` (option campagne déjà gérée ailleurs dans ce même bloc).

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

## Infrastructure — Cluster R

### Bug KIWI2 — Import GLB token : fonctionne en local, échoue sur Kiwi

**Symptôme** : L'importation d'un modèle GLB fonctionne en local mais échoue sur Kiwi.

**Code impliqué** : Route REST upload GLB + configuration MinIO / stockage sur Kiwi. `docs/SERVEURDISTANTKIWI.md`.

**Cause racine** [INCONNU] : Pistes : chemin MinIO différent, permissions bucket, variable d'env manquante, taille max upload.

**Prochaine étape** : Cluster R — tenter un upload GLB sur Kiwi avec logs serveur, puis lire `SERVEURDISTANTKIWI.md` + config MinIO.

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

