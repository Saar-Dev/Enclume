# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-06-24 Session 121
> Index priorité → [`docs/EN_COURS.md`](EN_COURS.md) §Dettes actives

---

## MÉTHODE — Triage → Cluster → Fix → Validation

| Phase | Action | Règle critique |
|---|---|---|
| **1. Triage** (batch) | Lister tous les bugs → sévérité + priorité → identifier clusters → mettre à jour EN_COURS.md | Ne pas coder à cette étape |
| **2. Analyse** (par cluster) | Lire les fichiers (TABLE DE ROUTING) → cause racine "5 Pourquoi" → effets de bord → plan exact | **Vérifier LdB si règle citée** — une référence fausse transforme un comportement conforme en faux bug (Leçon Session 94 — COM3) |
| **2b. Instrumentation** (si HYPOTHÈSE/INCONNU) | Logs `[DBG-BUGID]` au point exact → SR → reproduire → confirmer → `HYPOTHÈSE → VÉRIFIÉ` | Ne jamais coder sur une cause non confirmée |
| **3. Correctif** (par cluster) | Coder le plan validé uniquement. **1 commit par cause racine.** 2 clusters sans rapport → 2 commits | Ne jamais mixer deux clusters dans un seul commit |
| **4. Validation** | Test fonctionnel → zones adjacentes → fermer EN_COURS.md → appender JOURNAL4.md | Fermeture sans test fonctionnel → interdit |

**Définition cluster** : même fichier source / même cause racine / même mécanique / fix A nécessite fix B.

**Labels** : `[VÉRIFIÉ]` — cause confirmée par lecture du code. `[HYPOTHÈSE]` — à confirmer par 2b. `[INCONNU]` — non investigué.

**Run à vide obligatoire** avant de coder — anticiper pièges, ambiguïtés, effets de bord.

---

## ROUTING PAR CLUSTER — Sprint order recommandé

| Cluster | Bugs | Fichier principal | Priorité |
|---|---|---|---|
| **D — Fenêtres combat UI** | UI1 + COM8 + COM5 + CL2 + COM15 | composants combat + `index.css §11` | **Haute** |
| **E — Arme et statuts** | ~~COM1~~ + COM2 + COM4 + COM7 + COM10 + COM11 + ~~COM12~~ + ~~COM13~~ + ~~COM17~~ + COM18 | `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` | Moyenne |
| **F — Ghosts + portraits** | ~~CL1~~ + CL3 + COM16 | `CombatTimeline.jsx` + `CombatOverlay.jsx` + `useCombatSocket.js` | Moyenne |
| **G — Drone store** | D1 + D2 + D3 | `SessionPage.jsx` + `Canvas3D.jsx` + DB `drone_programs` | Moyenne |
| **H — Dettes techniques** | ~~WS1~~ + TC1 + DCO1 + VX1 + AU1 + INI1 + INI2 + TOK1 + MAP1 + COM14 + DASH1 | divers | Basse |
| **I — Affichage dégâts drone** | DMG1 + DMG2 | `server/src/socket/index.js` | SR ✅ — validation fonctionnelle requise |
| **K — Chat** | CH1 | `SessionPage.jsx` | Haute — sprint persistance séparé |
| **L — Statuts** | STAT1 | `statusService.js` | **Haute** |
| **M — Règles combat** | COM19 | `socketCombatAnnouncement.js` | **Haute** |
| **N — UI combat** | COM20 + COM21 + COM22 + COM23 + FEAT3 | `Canvas3D.jsx` + `CombatActionWindow.jsx` + `losService.js` | Moyenne / Haute |
| **O — Fiche personnage** | CS1 + CS2 + CS3 + CS4 + CS5 + CS6 | `CharacterWindow.jsx` + `SkillsPanel.jsx` + DB ref_ | Haute |
| **P — Drones v2** | DR2 + DR7 + DR8 + DR9 + DR10 | `DroneWindow.jsx` + `socketCombatResolution.js` + DB | Moyenne |
| **Q — UI divers** | UI2 + UI3 + ST3 | composants dés + chat | Basse |
| **R — Infrastructure Kiwi** | KIWI2 | upload GLB + MinIO + config Kiwi | Haute |
| ~~A / B / C / J~~ | ~~B6 / COM6 / DR1 / DC1-3 / SHOCK1 / SHK3-6 / ST2~~ | — | ✅ Clos Sessions 94–97 |
| ~~I partiel~~ | ~~DR4 + DR6~~ | — | ✅ Clos Session 101 |

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

### Bloc Shock — ~~REFONTE~~ ✅ CLOS — REWORK-01 Session 96 + REWORK-03 Session 97

5 copies copier-collé → `resolveShockBlock` (REWORK-01) + `woundService.applyWound` (REWORK-03). Résolu.

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

## Bugs drone — Session 89 (2026-06-11) — Non résolus

### Bug D1 — Menu radial "fiche" drone : rien ne s'ouvre

**Symptôme** : Clic sur "fiche" dans le menu radial d'un token drone → rien ne s'ouvre. Fonctionne correctement pour les tokens humanoïdes (PJ/PNJ).

**Code impliqué** : `SessionPage.jsx` — IIFE du menu radial, `characters.find(c => c.id === contextMenu.token.character_id)`.

**Cause racine** [HYPOTHÈSE] : Ce `find` retourne `undefined` pour un token drone, alors qu'il réussit pour les humanoïdes. Piste principale : mismatch de type entre `character.id` dans le store characters (string depuis JSON API) et `token.character_id` dans le store tokens (number depuis DB via API tokens). Investigation bloquée — non reproductible en lecture seule.

**[DBG-D1] suggestion** :
```js
console.warn('[DBG-D1]', { tokenCharId: contextMenu.token.character_id, storeIds: characters.map(c => c.id) })
```
Ajouter dans la IIFE du menu radial `SessionPage.jsx` avant le `find` pour comparer types et valeurs.

**Ce qui a été tenté** :
- Architecture `openSheet` centralisée (dispatcher unique par `character.type`) — correcte mais inefficace si `character` est null
- Les deux stores (characters, tokens) semblent cohérents en lecture de code — la discordance n'est pas visible sans debug runtime

**Prochaine étape** : Instrumenter avec [DBG-D1], reproduire le clic "fiche" sur un drone, lire la console.

---

### Bug D3 ✅ CLOS Session 119 — Drone CaC : programme "armement_contact" absent du catalogue

**Correction** : Migration 83 — "Attaque" → "Contact" (`armement_contact`), "Tir" → "Balistique", "Contrôle armement" supprimé. `DroneSheet.jsx` group key `armement_distance` → `armement`.
**Testé** : SR ✅, migration ✅, fonctionnel confirmé. **Non testé** : session combat réelle avec drone CaC.

---

### Bug D2 — Token drone : changement de GLB non fonctionnel

**Symptôme** : Upload d'un nouveau GLB pour un drone via DroneWindow → token 3D ne se met pas à jour visuellement.

**Code impliqué** : `Canvas3D.jsx:879` — `characters.find(c => c.id === token.character_id)` pour calculer `glbUrl`. `Canvas3D.jsx:246` — `key={glbUrl}` sur `TokenGlbErrorBoundary`.

**Cause racine** [HYPOTHÈSE] : Même cause racine que D1. Si le drone n'est pas trouvé dans `characters`, `glbUrl = defaultTokenGlbUrl` (constante). `key` ne change jamais → pas de remontage → pas de rechargement GLB.

**Fix partiel appliqué** : `key={glbUrl}` sur `TokenGlbErrorBoundary` + `updateCharacter(res.data.character)` dans `DroneWindow.SettingsTab.handleGlbUpload`. Correcte en théorie, inefficace tant que D1 n'est pas résolu.

---

## Bugs Session 91 — CombatDeclareLog (2026-06-11) — Non résolus

### Bug CL1 ✅ CLOS Session 109 — Timeline joueur : portraits PNJ non visibles

**Correction** : Corrigé (confirmation Saar — Session 109). Bug de design visuel.

---

### Bug CL2 — CombatDeclareLog : design et divergence GM/joueur

**Symptôme** : La fenêtre de déclarations est visuellement différente côté GM (flottant standalone) et côté joueur (intégrée dans CombatActionWindow). Design jugé mauvais dans les deux cas.

**Référence visuelle** : Le rendu GM (screenshot gauche Session 91) est la référence cible — à reproduire côté joueur.

**Code impliqué** :
- `client/src/components/CombatDeclareLog.jsx` — version GM (floatante, avec header draggable, titre "DÉCLARATIONS · TOUR N")
- `client/src/components/CombatActionWindow.jsx` — `declareLogSection` intégré (branches read-only), titre généré via `W.sectionTitle`
- `client/src/index.css` — classes `.combat-declare-log-*`

**Note architecture** : Les deux versions partagent les mêmes classes CSS mais la structure JSX diffère (header, wrapper, titre). Aligner la structure du `declareLogSection` joueur sur celle de `CombatDeclareLog` GM.

---

### Bug CL3 — Ghosts de déplacement d'annonce disparus

**Symptôme** : Les marqueurs visuels ("ghosts") indiquant la destination de déplacement annoncée par chaque acteur ne s'affichent plus sur la carte pendant la phase ANNOUNCEMENT.

**Code impliqué** : `CombatOverlay.jsx` — `announcementMarker` state + rendu des ghosts sur le canvas. `SessionPage.jsx` — handler `COMBAT_ACTION_DECLARED` qui set `announcementMarker`.

**Cause racine** [HYPOTHÈSE] : `announcementMarker` est toujours alimenté côté `SessionPage.jsx`. La régression est probablement dans le rendu — vérifier si le composant ou la condition d'affichage du ghost a été modifié lors des sessions 88-91.

**Prochaine étape** : Lire `CombatOverlay.jsx` — rechercher `announcementMarker` et la condition de rendu du ghost.

---

## Bugs Session 91 — Sprint CaC Drone — Non résolus

### Bug DR2 — Drone : aucune action de déplacement disponible

**Symptôme** : Dans la fenêtre de déclaration GM pour un drone, il n'existe aucun bouton / option pour déclarer un déplacement. Les drones peuvent pourtant se déplacer selon les règles.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — section rendu drone (isActiveDrone). La section drone affiche uniquement sélection arme + sélection cible, pas de déplacement.

**Prochaine étape** : Sprint dédié — ajouter le déplacement drone (similaire au déplacement PNJ humanoïde, mêmes allures).

---

## Bugs Session 95 suite 2 — Statuts token / Test de Choc — Non résolus

### Bug ST1 — Badge statut illisible sur token canvas

**Symptôme** : Badge hexagonal "Étourdi" (et autres statuts) visible sur le token mais texte trop petit pour être lisible en jeu.

**Code impliqué** : Sprint 14-2 — affichage badges SVGs sous le nom token (`Canvas3D.jsx` / Html drei).

**Prochaine étape** : Sprint 14-2 dédié.

---

### Bug ST3 — Fenêtre THUG STATUTS trop petite

**Symptôme** : La fenêtre de statuts token (grille hexagonale) ne peut pas afficher tous les statuts disponibles — overflow non géré.

**Code impliqué** : Composant fenêtre statuts token (SessionPage ou Canvas3D — menu contextuel statuts).

**Prochaine étape** : Sprint 14-1 (menu contextuel) ou sprint dédié UI — rendre la fenêtre scrollable ou agrandir la grille.

---

### Bug CH1 — Historique chat perdu au F5

**Symptôme** : L'historique des messages du chat en session ne survit pas à un rechargement de page (F5). Le chat redémarre vide.

**Cause racine** [HYPOTHÈSE] : Les messages du chat sont stockés uniquement en mémoire React (useState). `SESSION_JOIN` sync ne rejoue pas l'historique des messages existants. Pas de persistance DB des messages de chat, ou pas de query "derniers N messages" au reconnect.

**Code impliqué** : `client/src/pages/SessionPage.jsx` — state messages. `server/src/socket/index.js` — handler `SESSION_JOIN` (vérifier si historique chat est inclus dans le sync).

**Prochaine étape** : Sprint persistance chat — projet non-trivial. Vérifier d'abord si table `chat_messages` existe en DB. Si non → sprint dédié (modèle, migration, API, sync SESSION_JOIN) avant tout correctif.

---

## Bugs Session 93-4 — Test CaC Étape 3 — Non résolus

### Bug UI1 — Fenêtre déclaration : design tout blanc / dégueulasse

**Symptôme** : La fenêtre de déclaration GM (`CombatGmDeclareWindow`) et/ou joueur (`CombatActionWindow`) a un design visuel dégradé (fond blanc, absence de styles).

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx`, `CombatActionWindow.jsx`, `client/src/index.css` Section 11.

**Prochaine étape** : Audit CSS combat — comparer les classes appliquées avec Section 11 de `index.css`. Sprint Design dédié.

---

### Bug COM1 ✅ CLOS — Recharger : action ne fait rien (humanoïde)

**Correction** : Corrigé (confirmation Saar — Session 109). `resolveReloadAction` opérationnel.

---

### Bug COM2 — Vérification statut arme non appliquée pour PNJ GM

**Symptôme** : Côté joueur, il existe une vérification que l'arme est "au clair" avant de pouvoir attaquer. Cette vérification n'a pas été reproduite pour les PNJs contrôlés par le GM dans `CombatGmDeclareWindow`.

**Code impliqué** : `client/src/components/CombatActionWindow.jsx` (vérification joueur), `CombatGmDeclareWindow.jsx` (absence vérification GM).

**Prochaine étape** : Identifier la vérification exacte dans CombatActionWindow, la porter dans CombatGmDeclareWindow.

---

### Bug COM4 — CaC exige statut "Arme au clair" alors que mains nues possibles

**Symptôme** : Le système refuse ou grise le CaC si l'arme n'est pas "au clair", alors qu'une attaque à mains nues ne requiert pas d'arme équipée.

**Règle** : CaC à mains nues = action libre, pas de pré-requis statut arme.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx` et/ou `CombatActionWindow.jsx` — condition d'autorisation CaC.

**Prochaine étape** : Identifier la condition `state_weapon === 'drawn'` ou équivalent et la rendre optionnelle pour CaC mains nues.

---

### Bug COM5 — Fenêtre Annonce GM, CaC : clic "mode combat" sélectionne aussi la cible

**Symptôme** : Côté GM (`CombatGmDeclareWindow`), cliquer sur un mode de combat (ex: "Offensif") sélectionne simultanément la cible. Côté joueur (`CombatActionWindow`), sélection mode de combat et sélection cible sont deux gestes distincts.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx` — handler sélection mode combat + logique cible.

**Prochaine étape** : Dissocier les deux actions côté GM — le clic sur mode combat ne doit pas auto-sélectionner une cible.

---

### Bug COM7 — Multi-attaque CaC : duplicata / "Déclarer" grisé

**Symptôme** : L'option "multi-attaque" CaC semble un duplicata de "Attaque multiple" (existante). Quand sélectionnée, le bouton "Déclarer" reste grisé. Vérifier la pertinence règles et corriger si conservée.

**Règle à vérifier** : §6.2 MANUELSYSCOMBAT — attaque multiple melee (Sprint CaC 4b déjà planifié).

**Code impliqué** : `CombatGmDeclareWindow.jsx` — `meleeAttackCount` / `meleePendingMode`. `canDeclare` ou équivalent grisé.

**Prochaine étape** : Audit règles Polaris §6.2 — si "multi-attaque" et "attaque multiple" sont identiques, supprimer le duplicata. Sinon corriger le guard `canDeclare`.

---

### Bug COM10 — CaC multi-attaque : sélection de la 2e cible impossible — plantage silencieux

**Symptôme** : En mode multi-attaque CaC, après avoir sélectionné la 1re cible, il est impossible de sélectionner une 2e cible. Aucun message d'erreur — le système ne réagit pas ou annule silencieusement la sélection.

**Cause racine** [INCONNU] : Non investigué. Pistes possibles : état `meleeTargetIds` non réinitialisé entre les sélections successives ; guard côté client bloquant la 2e sélection ; payload déclaration ne supporte pas un tableau de 2 cibles distinctes ; ou le handler serveur `COMBAT_ACTION_DECLARE` ne valide pas plusieurs `meleeTargetIds`.

**[DBG-COM10] suggestion** :
```js
console.log('[DBG-COM10] meleeTargets', { meleeTargetIds, pendingMeleeTargets, canAddTarget })
```
Ajouter dans le composant de sélection de cible CaC pour observer l'état au moment du 2e clic.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx` et/ou `CombatActionWindow.jsx` — logique `meleeTargetIds` / mode sélection cible CaC. `server/src/socket/index.js` — `COMBAT_ACTION_DECLARE` validation `mapActions.melee`.

**Prochaine étape** : Cluster E — Phase 2b — instrumenter [DBG-COM10], reproduire la sélection 2e cible, lire console.

---

### Bug COM11 — Assaut tir : multi-attaque non implémenté

**Symptôme** : Il n'existe pas d'option dans la fenêtre de déclaration (GM et joueur) pour déclarer plusieurs attaques à distance sur des cibles distinctes en une même action. L'équivalent CaC (`meleeTargetIds[]`) existe, pas la version tir.

**Règle** : À vérifier dans `docs/REGLESYSCOMBAT.md` / `docs/MANUELSYSCOMBAT.md` — règles attaque multiple distance (bonus/malus initiative, conditions).

**Cause racine** [INCONNU] : Fonctionnalité non implémentée — le payload `mapActions.attack` ne supporte qu'une cible (`attackTargetId` scalaire). La résolution serveur (`resolveAssaultAction`) ne boucle pas sur plusieurs cibles.

**Code impliqué** :
- `client/src/components/CombatGmDeclareWindow.jsx` — section assaut tir (AssaultRangedPanel) : pas de multi-cible
- `client/src/components/CombatActionWindow.jsx` — idem
- `server/src/socket/index.js` — `COMBAT_ACTION_DECLARE` + `resolveAssaultAction` : payload `attack` scalaire

**Prochaine étape** : Sprint dédié — implémenter après validation fonctionnelle REWORK-05 (les panneaux partagés `AssaultRangedPanel` doivent être stables avant d'y ajouter une mécanique).

---

### Bug COM12 ✅ CLOS Session 112 — Mode de tir : reset au premier mode disponible si arme incompatible

**Correction** : `useEffect([activeTokenId, equipment])` dans `CombatGmDeclareWindow.jsx` + `useEffect([assaultWeapons])` dans `CombatActionWindow.jsx` — reset `fire_mode` au premier mode disponible (`ref_equipment.fire_mode`) si le state sauvegardé n'est pas dans les modes de l'arme équipée. Filtrage visuel (`StateSelector` greyed / `InlineChip` cycling) déjà présent, seul le reset manquait.
**Testé :** SR ✅, fonctionnel confirmé. **Non testé :** scénario exact state DB incompatible arme — session combat réelle requise.

---

### Bug COM13 ✅ CLOS Session 112 — Assaut tir joueur : "Tir simple" par défaut non validé sans re-sélection

**Correction** : `computeFireVariant(currentFireMode, assaultBulletCount, assaultVariantAB, { defaultCcCount: 1 })` dans `CombatActionWindow.jsx` — ajout `{ defaultCcCount: 1 }` (même comportement que le GM). Quand `assaultBulletCount = null` + CC, `effectiveBulletCount = 1` → radio "Tir simple" active → `currentVariant = cc_1` → `assaultValid = true` → "Déclarer" débloqué immédiatement.
**Testé :** SR ✅, fonctionnel confirmé.

---

### Bug COM15 ✅ CLOS Session 118 — Fenêtres combat : propriétaire du slot non identifiable (GM)

**Fix** : `CombatGmDeclareWindow.jsx` — header : nom actif en or (PNJ/Drone) ou grisé italique (PJ en attente), entre le titre et le compteur déclarés. `CombatModifiersWindow` + `CombatCacModifiersWindow` déjà conformes.
**Testé** : SR ✅ — nom affiché en session combat. **Non testé** : cas PJ actif hors session réelle.

---

### Bug COM16 — Phase ANNONCE : traits liaison attaquant↔cible disparaissent

**Symptôme** : Les traits visuels reliant attaquant à sa cible déclarée (tir ou CaC) disparaissent au fur et à mesure des déclarations. À la fin de la phase ANNONCE, aucun trait n'est visible.

**Code impliqué** : `client/src/components/CombatOverlay.jsx` ou `SessionPage.jsx` — rendu des annotations de déclaration.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster F — lire `CombatOverlay.jsx` + handler `COMBAT_ACTION_DECLARED` dans `useCombatSocket.js`.

---

### ~~Bug COM17~~ ✅ — Phase ANNONCE : arme par défaut = Mains nues au lieu de l'arme équipée

**Symptôme** : En phase d'annonce, lorsqu'un personnage a une arme dégainée (`state_weapon = 'drawn'`), la fenêtre de déclaration (GM et joueur) sélectionne "Mains nues" par défaut.

**Fix (Session 118)** : Pattern valeur dérivée — `selectedMeleeWeaponId` / `selectedGmMeleeWeaponId` passé de `null` (deux rôles ambigus) à sentinelle `undefined` (auto-dériver) / `null` (mains nues explicite) / `id` (choix). `effectiveMeleeWeaponId` / `effectiveGmMeleeWeaponId` calculées depuis `decl.weapon` + liste armes disponibles — aucun useEffect de sync.

**Testé** : SR ✅ — arme CaC sélectionnée automatiquement (drawn), mains nues si rangée/main sur l'arme.
**Non testé** : Cycle holstered→drawn→holstered, arme distance, choix explicite mains nues ré-ouverture.

---

### Bug COM18 — Roster PNJ : déclaration état initial arme/posture absente côté GM

**Symptôme** : Côté joueur, une fenêtre permet de déclarer l'état initial (arme au clair, posture de combat) avant que le slot ne soit joué. L'équivalent pour les PNJ du GM n'existe pas — le GM ne peut pas déclarer l'état initial arme/posture de ses PNJ depuis le roster de déclaration.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx` — section état initial PNJ absente. Composant joueur à identifier pour référence.

**Cause racine** [INCONNU] : Fonctionnalité non implémentée côté GM. Le roster GM `CombatGmDeclareWindow` n'expose pas de sélecteur d'état initial arme/posture.

**Prochaine étape** : Cluster E — identifier le composant joueur gérant la déclaration initiale (probablement `CombatActionWindow` ou composant dédié), puis porter l'équivalent dans `CombatGmDeclareWindow`.

---

### Bug COM14 — Cibles combat non effacées à COMBAT_END

**Symptôme** : Quand le GM termine le combat, les cibles précédemment sélectionnées (assaut tir ou CaC) restent affichées dans les fenêtres de déclaration côté GM et joueur. Plus généralement, certains états de sélection client ne sont pas nettoyés à la fin du combat.

**Code impliqué** : `client/src/lib/useCombatSocket.js` — handler `COMBAT_ENDED` (reset des états). `client/src/components/CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` — états `assaultTarget`, `meleeTargets`, etc.

**Cause racine** [INCONNU] : Non investigué. Piste : le reset sur `COMBAT_ENDED` dans `useCombatSocket` ne couvre pas tous les états de sélection de cible dans les composants déclaration.

**Prochaine étape** : Cluster H — lire `useCombatSocket.js` handler `COMBAT_ENDED` + états reset dans `CombatGmDeclareWindow` / `CombatActionWindow` pour identifier les états manquants.

---

### Bug COM8 — Fenêtre d'annonce non masquée lors de la sélection de cible

**Symptôme** : Quand le joueur ou le GM entre en mode sélection de cible (à distance, au CaC, ou sélection destination déplacement), la fenêtre d'annonce reste visible et encombre l'écran.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx`, `CombatActionWindow.jsx` — gestion `combatTargetMode` / `onEnterTargetMode` / `onEnterMoveMode`. `CombatOverlay.jsx` — condition de rendu des fenêtres.

**Prochaine étape** : Ajouter condition `!combatTargetMode && !combatMoveMode` au rendu des fenêtres d'annonce.

---

## Bug COM9 — Viser une Localisation précise — non implémenté

**Symptôme** : Dans `CombatModifiersWindow` (résolution assaut tir), aucune option ne permet de viser une localisation précise. Le D20 de localisation est toujours aléatoire.

**Règle** : LdB §"Viser une Localisation précise" — Corps −3 / Jambes −5 / Tête+Bras −7.

**Code impliqué** :
- `client/src/components/CombatModifiersWindow.jsx` — section manquante + state `aimedLocation` absent
- `server/src/socket/index.js` — `resolveAssaultAction` : pas de champ `aimedLocation` dans `confirmedModifiers`, pas de bypass du D20 localisation (branche PJ : `pendingDamageActions`, branche PNJ : L.4303). `COMBAT_DAMAGE_CONFIRM` (L.~2392) : D20 toujours joué.

**Prochaine étape** : Sprint dédié — NE PAS bricoler dans un autre sprint. Voir analyse complète dans JOURNAL4.md Session 95-7.

---

## Bugs Session 93-5 — Pipeline dégâts drone — Non résolus

### Bug DMG1 — DICE_RESULT dégâts drone : label "Compétence" sémantiquement faux

**Symptôme** : La carte DICE_RESULT "Dégâts — drone" affiche "Compétence : 41" alors que 41 = rawDice (résultat des dés de dégâts). Le label "Compétence" est celui des cartes d'attaque — réutilisé à tort dans le contexte dégâts.

**Cause racine** [VÉRIFIÉ] : `mechanicalTotal: rawDice` dans le payload DICE_RESULT branch 8a. Le client affiche le label générique "Compétence" pour `mechanicalTotal`, non contextualisable sans modification client ou ajout de champ.

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` branch 8a (~ligne 3992).

**Prochaine étape** : Cluster I — modifier `skillLabel` pour inclure l'info intégrité (proposition session 93-5), ou ajouter champ `mechanicalLabel` au payload DICE_RESULT.

---

### Bug DMG2 — DICE_RESULT dégâts drone : label "Seuil" sémantiquement faux

**Symptôme** : La carte DICE_RESULT "Dégâts — drone" affiche "Seuil : 47" alors que 47 = degatsNets. "Seuil" désigne le seuil D20 de réussite d'un jet d'attaque — invalide dans un contexte dégâts.

**Cause racine** [VÉRIFIÉ] : `chancesDeReussite: degatsNets` dans le payload DICE_RESULT. Le client affiche "Seuil" pour ce champ, label générique non contextuel.

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` branch 8a (~ligne 3993). Client : composant rendu DICE_RESULT.

**Prochaine étape** : Même sprint que DMG1.

---

### Bug DR4 ✅ CLOS Session 101 — calcDroneRD : RD négatif pour drone en bonne santé → dégâts augmentés

**Symptôme** : Un drone avec `integrite_actuelle = 15` prend 3 dégâts *supplémentaires* au lieu de bénéficier d'une résistance. Exemple : degautsBruts=44, blindage=15, RD calculé=-3 → degatsNets = 44 − 15 − (−3) = **32** au lieu de 29.

**Cause racine** [VÉRIFIÉ] :
```
calcDroneRD(15) → rdInput = 15 × 2 = 30
→ RD_TABLE[{ min:30, max:33, rd:-3 }] → retourne -3
→ degatsNets = degautsBruts − blindage − (−3) = +3 dégâts supplémentaires
```
La `RD_TABLE` (`charStats.js` ligne 93) est conçue pour les sommes FOR+CON humanoïdes (plage typique 4–16 → rd positif = protection). Pour les drones, `integrite × 2` atteint 20–40, plage "hauts scores" où rd vaut 0 à -5 dans la table. Résultat : plus un drone est en bonne santé, plus il prend de dégâts — sens **inverse** de ce que dicte le LdB.

**Règle LdB** (`REGLEDRONE.md`) : *"la Résistance aux dommages peut être calculée en multipliant l'Intégrité actuelle par deux, et en se référant au tableau correspondant (page 112)"*. La table p.112 doit être vérifiée pour confirmer l'orientation des valeurs dans la plage 20-40.

**[DBG-DR4] suggestion** :
```js
console.log('[DBG-DR4]', { integrite: droneSheet.integrite_actuelle, rdInput: droneSheet.integrite_actuelle * 2, rdDrone, degautsBruts, degatsNets })
```

**Code impliqué** : `server/src/socket/index.js` — `calcDroneRD` (~ligne 4472). `server/src/lib/charStats.js` — `RD_TABLE` (ligne 93).

**Prochaine étape** : Cluster I — vérifier table LdB p.112 pour la plage 20-40. Si les hautes valeurs doivent donner une protection positive → créer `DRONE_RD_TABLE` dédiée ou corriger l'orientation de `RD_TABLE`.

---

### Note DR5 — drone_sheet.resistance_dommages : ✅ RÉSOLU — colonne supprimée en migration 72

Migration 72 (`72_drone_sheet_fix.js`) supprime déjà `resistance_dommages` (+ `iv`, `survie_iem`, `architecture`, `structure_materiau`) — identifiés sans source LdB. Colonne absente du schéma actuel. Aucune action requise.

---

### Bug DR6 ✅ CLOS Session 101 — Blindage drone non lu lors de la résolution (Blindage:0 affiché malgré valeur DB = 15)

**Symptôme** : La carte DICE_RESULT "Dégâts — drone" affiche "Blindage:0 RD:0" alors que `drone_sheet.blindage = 15` en base pour le drone ciblé. Le blindage n'est pas soustrait des dégâts.

**Cause racine** [HYPOTHÈSE] : Le code lit `droneSheet.blindage ?? 0` — logiquement correct si la colonne existe et vaut 15. Causes possibles :
- `cibleCharacter.id` ne matche pas le bon `drone_sheet.character_id` → `droneSheet` récupéré appartient à un autre drone (blindage=0)
- Knex retourne la colonne sous un autre nom (improbable, snake_case standard)
- La valeur 15 a été persistée APRÈS le test (données modifiées entre test et lecture du screenshot)

**[DBG-DR6] suggestion** :
```js
// Ajouter après `const droneSheet = await db('drone_sheet')...`
console.log('[DBG-DR6]', {
  cibleCharId: cibleCharacter.id,
  droneSheetFound: !!droneSheet,
  blindage: droneSheet?.blindage,
  integrite: droneSheet?.integrite_actuelle,
})
```

**Code impliqué** : `server/src/socket/index.js` — `resolveDroneAssaultAction` branch 8a (~ligne 3976-3984).

**Prochaine étape** : Cluster I — Phase 2b — ajouter [DBG-DR6], SR, reproduire l'attaque drone → vérifier console serveur.

---

### TODO-DRONE-1 — Tooltips champs blindage / armure / blindage IEM (UI DroneWindow)

**Besoin** : Les champs "BLINDAGE", "ARMURE", "BLINDAGE IEM" dans la fiche drone n'ont pas d'explication. L'utilisateur ne peut pas distinguer :
- **Blindage** = valeur entière soustraite des dégâts physiques (mécanique active)
- **Armure** = matériau de construction (informatif, non mécanique)
- **Blindage IEM** = protection contre impulsions électromagnétiques

**Prochaine étape** : Sprint UI dédié — ajouter tooltips ⓘ sur ces trois champs dans DroneWindow.

---

## Bugs Session 119 — REWORK-17/18 + Combat résolution — Non résolus

### Bug RW17-1 ✅ CLOS Session 120 — Régression REWORK-17 : `calcDroneRD` non importée dans `socketCombatResolution.js`

**Correction** : `calcDroneRD` et `calcDroneDegatsNets` déplacées dans `charStats.js` (agent précédent Session 120) — 3 call sites migrés dans `socketCombatResolution.js` + `socketCombatHelpers.js`. Import `calcDroneRD` ajouté.
**Testé** : SR ✅, COMBAT_DAMAGE_CONFIRM cible drone fonctionnel. **Non testé** : session combat réelle complète avec drone.

---

### Bug AA-1 ✅ CLOS Session 121 — Blessures combat non affichées si CharacterWindow fermée ou sur autre onglet

**Symptôme** : Blessures infligées en combat (WS `WOUND_ADDED`) n'apparaissent dans l'onglet Matériel qu'après réouverture de la CharacterWindow. Blessures manuelles (clic) inchangées.

**Cause racine** [VÉRIFIÉ] : Chaîne `WOUND_ADDED → woundVersions++ → woundReloadKey prop → useEffect → bumpInventoryVersion → reloadKey → load()` ne fonctionnait que si `ArmorWoundPanel` était monté (onglet Matériel actif). Si la fenêtre était fermée ou sur un autre onglet, WOUND_ADDED était perdu.

**Correction** :
- `characterStore.js` : `woundsByCharId` + `setWounds` — wounds persistés en store Zustand global
- `useCharacterSocket.js` : handlers `WOUND_*` → fetch REST → `setWounds(charId, wounds)` dans le store (plus de bump `woundVersions`) — fonctionne même si ArmorWoundPanel n'est pas monté
- `ArmorWoundPanel.jsx` : `useEffect([storeWounds])` → mise à jour locale depuis le store ; suppression du pattern `cancelled` (React 18 StrictMode — flash 250ms)
- `CharacterWindow.jsx` + `SessionPage.jsx` : renommage `woundReloadKey` → `inventoryReloadKey` (prop ne pilote plus que les reloads `INVENTORY_*`)

**Testé** : build ✅, blessure visible immédiatement à l'ouverture onglet Matériel même si CharacterWindow était fermée pendant le combat. **Non testé** : session combat réelle complète avec plusieurs joueurs simultanés.

---

### Bug RW18-1 — Régression REWORK-18 : blessures/dégâts broadcastés avant DICE_RESULT

**Symptôme** : En CaC (PNJ touché) et assaut distance (PNJ touché), la mise à jour de blessure arrive sur le client **avant** DICE_RESULT / COMBAT_MELEE_RESULT / COMBAT_ATTACK_RESULT.

**Cause racine** [VÉRIFIÉ] : REWORK-18 a transformé les émissions directes en descripteurs flushés après retour de la fonction. Mais `woundService.applyWound(io, ...)` (L.711 `resolveMeleeAction`) et `damageService.resolveTargetHit(io, ...)` (dans `resolveAssaultAction`) restent hors périmètre — ils émettent directement **pendant** l'exécution. Ordre réel : `wound direct → (queued) DICE_RESULT → (queued) COMBAT_ATTACK_RESULT`.

**Note Session 121** : AA-1 clos — le client est maintenant résilient à WOUND_ADDED reçu hors-séquence (store Zustand toujours à jour). L'impact utilisateur de RW18-1 est donc atténué. Le fix serveur reste souhaitable pour la cohérence de l'architecture FCIS.

**Code impliqué** :
- `server/src/socket/socketCombatHelpers.js` — `resolveMeleeAction` L.711 (`woundService.applyWound`) + `resolveAssaultAction` (`damageService.resolveTargetHit`)
- `server/src/socket/socketCombatResolution.js` — `flushEmissions` (dispatché après return)

**Prochaine étape** : Sprint dédié Bloc B — `woundService.applyWound` + `statusService.emitShockDiceResult` : flag `{ skipEmit: true }` → retourner payload → push descripteur dans `emissions` avant `COMBAT_ATTACK_RESULT`.

---

### Bug STUN2 ✅ CLOS Session 120 — PJ étourdi (stun reçu pendant résolution adverse) peut confirmer son action

**Cause racine** [VÉRIFIÉ] : FSM `AWAITING_DAMAGE` bloquait PRECHECK du slot suivant (pas un bug stun à proprement parler). L'overlay "Ligne de vue bouchée" s'affichait à tort pendant l'attente.
**Correction** :
- `socketCombatResolution.js` PRECHECK : état `AWAITING_DAMAGE` → `{ awaiting: true }` sans message d'erreur
- `CombatOverlay.jsx` : `precheckRetryKey` state + listener `COMBAT_ATTACK_RESULT` → re-fire PRECHECK après DAMAGE_CONFIRM
- Callbacks assault + melee PRECHECK : gestion `awaiting` → `setPrecheckOk(null)` (aucun overlay pendant attente)
**Testé** : SR ✅, all OK (confirmation Saar). **Non testé** : session combat réelle avec drone → PJ étourdi.

---

## Bugs divers — Dette technique

### Bug CRASH1 — Freeze tour : drone CaC hors de portée [INCONNU]

**Symptôme** : Tour complet freezé après confirmation d'action CaC drone hors de portée (première occurrence session 113). Aucun log d'erreur — gel silencieux. Les logs s'arrêtent après le `[DBG] COMBAT_ACTION_CONFIRM` du drone, avant tout log de résolution. Tour suivant (combat relancé) : fonctionnel.

**Code impliqué** : `server/src/socket/socketCombat.js` — `COMBAT_ACTION_CONFIRM` handler + `resolveDroneAssaultAction`.

**Cause racine** [INCONNU] : Possiblement état FSM incorrect après résolution du slot précédent, ou guard silencieux (`activeSlot.token_id !== tokenId`). Non reproduit.

**Prochaine étape** : Reproduire avec log exhaustif. Vérifier `advanceSlot` + état FSM après résolution du slot précédent (96dd9b06 → c9ca043a).

---

### Bug RANGE1 — CaC hors de portée : aucune notification client

**Symptôme** : Quand un CaC est hors de portée, le serveur log "hors portée" et retourne silencieusement. Le joueur ne reçoit aucun feedback — l'action disparaît sans explication.

**Code impliqué** : `server/src/socket/socketCombat.js` — `resolveMeleeAction` ~L.1690 : `return false` sans émettre d'event WS dans la branche hors portée.

**Cause racine** [VÉRIFIÉ] : Pas de `io.to(campaignId).emit(...)` dans la branche hors portée.

**Prochaine étape** : Cluster H — ajouter notification WS (DICE_RESULT ou event dédié) dans `resolveMeleeAction` branche hors portée.

---

### Bug INI2 — Modificateurs de blessure/soin non propagés automatiquement (initiative, malus)

**Symptôme** : Quand un personnage reçoit une blessure OU est soigné pendant le combat, les modificateurs dérivés du statut de blessures (`calcWoundPenalty`) ne se mettent pas à jour automatiquement pour les autres clients. L'initiative dans la timeline est l'exemple visible : elle reste à la valeur calculée au début du combat. D'autres modificateurs dépendant des blessures (malus compétences) pourraient être affectés de même.

**Règle** : Malus blessures = `calcWoundPenalty(wounds)` — soustrait du score REA dans le calcul d'initiative, et s'applique aux jets de compétences. Ce malus change à chaque blessure reçue ou soin appliqué.

**Cause racine** [INCONNU] : L'initiative est pré-calculée et stockée dans `combat_roster` au moment de `COMBAT_START`. `woundService.applyWound` émet `WOUND_ADDED` mais ne recalcule pas le roster. Aucun event ne notifie les clients d'un changement de modificateur de blessure. Le sens inverse (soin → malus réduit → initiative remonte) n'est pas non plus géré.

**Code impliqué** :
- `server/src/lib/woundService.js` — `applyWound` : vérifier si un recalcul roster est prévu après insertion blessure
- `server/src/socket/index.js` — `COMBAT_START` : voir comment l'initiative est calculée et stockée dans `combat_roster`
- `server/src/socket/index.js` — helper `endTurn` / `startResolutionPhase` : voir si roster est recalculé entre les tours
- Soin de blessures (endpoint REST ou WS) : vérifier si `WOUND_REMOVED` / `WOUND_HEALED` existe et propage un recalcul

**Prochaine étape** : Cluster H — investigation future. Lire `woundService.applyWound` + calcul `combat_roster` dans `COMBAT_START`. Fix probable : recalculer l'initiative du token après chaque changement de statut blessure et broadcaster un `COMBAT_ROSTER_UPDATED` partiel.

---

### Bug INI1 — Surprise critique : roll=1 → initiative=1

**Symptôme** : Un jet de dé donnant 1 (critique) produit une initiative finale de 1 au lieu d'être calculée normalement.

**Cause racine** [INCONNU] : Non encore investigué — peut être un cas limite dans le calcul `REA + dé caché` (roll=1 interprété comme critique et court-circuitant le calcul normal).

**[DBG-INI1] suggestion** :
```js
console.log('[DBG-INI1] initiative calc', { roll, rea, hiddenDie, finalInitiative })
```

**Code impliqué** : Non identifié — vérifier la logique initiative dans `server/src/socket/index.js`.

**Prochaine étape** : Investigation dédiée.

---

### Bug WS1 ✅ CLOS Session 109 — WorkshopPage crash import invalide

**Correction appliquée** : `err.response?.data?.error || err.response?.data?.message || err.message || t('...')` — 5 catch handlers (L96, L120, L133, L146, L156).

**Code impliqué** : `client/src/pages/WorkshopPage.jsx` — handlers catch.

---

### Dette AU1 — useDiceAudio.js : sons dés manquants

**Symptôme** : Aucun son lors du lancer de dés (animation 3D muette).

**Code impliqué** : `client/src/lib/useDiceAudio.js` — non branché.

**Prochaine étape** : Sprint audio dédié.

---

### Dette TC1 — .gitattributes:3 : attribut invalide

**Symptôme** : Ligne 3 de `.gitattributes` contient un attribut inconnu de Git → warning au clone/fetch.

**Code impliqué** : `.gitattributes` ligne 3.

**Prochaine étape** : Corriger lors d'un commit de nettoyage.

---

### Bug TOK1 — Rotation token : inversion nord/sud et est/ouest

**Symptôme** : La direction visuelle du token semble inversée après rotation — nord affiché côté sud et vice versa (est/ouest idem). Observé post-Étape 2 REWORK-08, mais probablement pré-existant (logique `newR = ((token.r ?? 0) + 1) % 8` non touchée lors de la migration).

**Cause racine** [INCONNU] : Non investigué. Pistes : incrément `+1` devrait peut-être être `-1` pour correspondre au sens visuel ; ou `rotation.y = r * Math.PI / 4` côté client interprète le sens dans la direction opposée à l'attendu.

**Code impliqué** : `server/src/socket/socketToken.js` — `TOKEN_ROTATE` handler, `newR = ((token.r ?? 0) + 1) % 8`. Client : composant Canvas3D — calcul `rotation.y`.

**Note Session 109** : Confirmé en session réelle. Comportement camera-dépendant — certaines orientations correctes, d'autres non selon la position de caméra. Pas une simple inversion. Logique `rotation.y = r * Math.PI / 4` (Canvas3D) à comprendre en relation avec le système de coordonnées Three.js + caméra orbitale avant tout correctif.

**Prochaine étape** : Cluster H — investigation dédiée. NE PAS bricoler (inversion `+1 → −1` insuffisant).

---

### Dette MAP1 — MAP_VIEWPORT : pas de déclencheur UI côté GM

**Symptôme** : Le handler `WS.MAP_VIEWPORT` existe côté serveur (socketVoxel.js) et côté client (réception). Mais aucun bouton / geste GM dans l'interface ne permet de l'émettre — la fonctionnalité "partager ma vue / snap caméra / verrouiller caméra" est donc inatteignable en jeu.

**Code impliqué** : UI GM (SessionPage.jsx ou Canvas3D.jsx) — bouton "Partager ma vue" absent. `server/src/socket/socketVoxel.js` — handler MAP_VIEWPORT fonctionnel côté serveur.

**Prochaine étape** : Sprint UI dédié — ajouter un bouton GM (ex: toolbar carte) émettant `WS.MAP_VIEWPORT` avec `{ position, target, mode: 'snap' }`.

---

### Dette DCO1 — onTokenRotate : dead code Canvas3D/Scene

**Symptôme** : Handler `onTokenRotate` déclaré mais non utilisé dans `Canvas3D.jsx` ou `Scene`.

**Code impliqué** : `client/src/components/Canvas3D.jsx`.

**Prochaine étape** : Supprimer lors d'un sprint nettoyage.

---

### Dette VX1 — getVoxelSurfaceTop : pas de cas slope/wedge

**Symptôme** : `getVoxelSurfaceTop` retourne `y+1.0` par défaut pour tous les voxels non-cube. Les types slope/wedge devraient retourner une valeur intermédiaire.

**Code impliqué** : `client/src/components/Canvas3D.jsx` — `getVoxelSurfaceTop`.

**Note** : Comportement `y+1.0` acceptable pour V1.

**Prochaine étape** : Sprint voxels v2 — hors scope V1.

---

### Bug DASH1 — Dashboard : tag `changelog.tags.refactor` affiché brut (non traduit)

**Symptôme** : Sur la page Dashboard, le tag "refactor" du changelog affiche la clé i18n brute `changelog.tags.refactor` au lieu du libellé traduit.

**Code impliqué** : Composant Dashboard (à identifier) — affichage tags changelog. `client/src/locales/fr.json` — clé `changelog.tags.refactor` absente ou mal référencée.

**Cause racine** [INCONNU] : Clé i18n manquante dans `fr.json`, ou appel `t()` incorrect dans le composant.

**Prochaine étape** : Cluster H — vérifier `fr.json` (clé `changelog.tags.refactor` présente ?) + composant Dashboard (appel `t()` correct ?).

---

## Nouvelles fonctionnalités — Non implémentées

### FEAT1 — Map2D (style Roll20)

**Besoin** : Affichage alternatif 2D de la carte (vue du dessus, style Roll20) en complément de la vue 3D existante.

**Cause racine** [INCONNU] : Fonctionnalité non implémentée — aucun composant 2D existant.

**Prochaine étape** : Sprint dédié — spécifier l'interface (toggle 2D/3D, rendu canvas 2D, synchronisation tokens).

---

### FEAT2 — LOS (Ligne de vue) — Session 112

**Découpage :**
- **FEAT2-A (MVP)** : Outil LOS dans le menu radial token — ✅ CLOS COMPLET Session 112
- **FEAT2-B (automatique)** : Intégration pipeline déclaration d'assaut — sprint futur

**FEAT2-A — Architecture (Session 112) :**
- `client/src/lib/losUtils.js` — `checkLOS(voxels, fromToken, toToken)` pur, `fast-voxel-raycast`, PE14
- Menu radial : secteur "Vue" (ex-"Viser") actif → `losMode { active, sourceTokenId }` dans SessionPage
- Scene : clic token cible → `handleLosTarget` → ray 3D natif `<line>` (vert/rouge) + callback `onLosResult`
- SessionPage : overlay DOM résultat (cliquable pour fermer)

**FEAT2-B — ⚠️ Implémenté, validation en cours (session 113) :**
- `server/src/db/migrations/82_campaigns_los.js` — `campaigns.allow_los_cancel` boolean
- `shared/losUtils.js` — `checkLOS` + `findInterceptingTokens`
- `server/src/lib/losService.js` — `checkCombatLOS` + `_spendAmmo`
- `server/src/socket/socketCombat.js` — injection dans `resolveAssaultAction` + `resolveDroneAssaultAction`
- LOS bloquée → DICE_RESULT "Tir en aveugle" émis (`io.to(campaignId)`)
- `ce71acbb → 6c84fd12` : LOS bloquée ✅ confirmé (logs session 113)
- **[LOS1] DICE_RESULT "Tir en aveugle" visible côté client non confirmé** — émission serveur vérifiée en code, affichage UI à valider en session
- **Bloc B** (allow_los_cancel=true → prompt joueur) : sprint séparé

---

## Bugs archivés (clos) — Référence rapide

| ID | Description | Résolution | Session |
|---|---|---|---|
| B6 | Loc-Drone : `localisation: null` cible drone | Fix `resolveDroneAssaultAction` branche drone | 94 |
| B7 | Dmg-Drone : dégâts non enregistrés | Fix pipeline drone branch 8a | 94 |
| COM3 | CaC : jet défense déclenché si attaque ratée | FAUX BUG — LdB p.222 : les deux roulent toujours (test d'opposition 4 cas) | 94 |
| DC1 | Drone CaC : CombatModifiersWindow au lieu de CombatCacModifiersWindow | Déjà fixé Session 91 — cache Firefox stale | 95 suite |
| DC2 | Drone ranged : mods situation ignorés | Déjà fixé — `situationMods = confirmedModifiers?.situation ?? []` | 95 suite |
| DC3 | `portee = 'bout_portant'` → +5 illégitime pour `armement_contact` | Déjà fixé — `portee = null` → `PORTEE_MOD_COMP[null] ?? 0 = 0` | 95 suite |
| DR1 | Drone : arme non pré-sélectionnée | `selectedDroneWeaponId` init au premier `droneWeapons[0].id` | 95 |
| DR3 | Identique DC1 + DC3 | Clos avec eux | 95 suite |
| COM6 | Arme CaC non pré-sélectionnée (GM + joueur) | `selectedGmMeleeWeaponId` init au premier arme CaC dispo | 95 |
| SHOCK1 | Test de Choc non déclenché pour cibles PNJ (drone → PNJ) | Branche 8b : `vol_na` ajouté + bloc shock complet + `shockResult` dynamique | 95-3 |
| SHK3 | COMBAT_END : stun résiduel (badge supprimé, effet persiste) | FAUX BUG — [DBG-SHK3] confirme `token_statuses: []` après cleanup | 95-3 |
| CUR1 | Curseur bloqué après fermeture combat en mode déplacement/cible | Reset `setCombatMoveMode/setCombatTargetMode` dans COMBAT_ENDED + COMBAT_PHASE_CHANGED | 95-6 |
| SHK4 | D20 Test de Choc non visible en chat | `resolveShockTest` retourne `rolls+seed` + `emitShockDiceResult` — 5 call sites index.js | 95-7 |
| SHK5 | shock_auto_stun=false : PJ routé vers lui-même | `applyStun` lit `shock_auto_stun` depuis campaigns → gmSocket si false | 95-7 |
| ST2 | D6 durée étourdissement jamais visible joueur | REWORK-01 `resolveShockBlock` → `statusService.js` centralisé | 96 |
| SHK6 | COMBAT_DAMAGE_CONFIRM : PJ cible bloqué à "Calcul en cours…" | Condition autorisation élargie à `pending.targetUserId` (drone sans user_id) | 96 suite |
| DIV-1 | `worst_wound_severity` absent WOUND_ADDED combat → anneau sévérité perdu | REWORK-03 `woundService.applyWound` appelle `getWorstWoundSeverity` post-transaction | 97 |
| COM1 | Recharger ne fait rien (humanoïde) | Corrigé — confirmation Saar Session 109 | — |
| CL1 | Portraits PNJ non visibles timeline joueur | Corrigé (design) — confirmation Saar Session 109 | 109 |

---

## Bugs Session 121 — Triage général 2026-06-24

### Bug STAT1 — Statuts is-stunned / unconscious : exclusion mutuelle non appliquée

**Symptôme** : `is-stunned` et `unconscious` peuvent être actifs simultanément. Règle : durée < 10 tours = `is-stunned` ; ≥ 10 tours = `unconscious` (exclusion mutuelle). La transition 10 → 9 doit basculer `unconscious` → `is-stunned`.

**Règle** : LdB — étourdissement < 10 tours = Étourdi ; ≥ 10 tours = Inconscient. Exclusion mutuelle. Refresh obligatoire à chaque décrémentation de durée.

**Code impliqué** : `server/src/lib/statusService.js` — `applyStunWithDuration` + gestion durée par tour. `server/src/socket/socketCombatState.js` — décrémentation durée stun en fin de tour.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster L — lire `statusService.js` + handler fin de tour pour trouver la décrémentation.

---

### Bug COM19 — Assaut (tir) : modificateur -5 INI non appliqué

**Symptôme** : Déclarer une action Assaut (tir) ne déclenche pas le modificateur -5 à l'initiative du combattant.

**Règle** : LdB / MANUELSYSCOMBAT — Assaut (tir) : -5 INI.

**Code impliqué** : `server/src/socket/socketCombatAnnouncement.js` — handler `COMBAT_ACTION_DECLARE`, calcul INI assaut tir. Ou `socketCombatState.js` — calcul roster.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster M — vérifier `docs/MANUELSYSCOMBAT.md` règle INI assaut tir, puis lire handler déclaration.

---

### Bug COM20 — Phase 1 : arme non affichée dans la fenêtre de déclaration

**Symptôme** : En phase ANNONCE (Phase 1), la fenêtre de déclaration PJ/PNJ n'affiche pas l'arme courante équipée, les munitions restantes ni le type (surtout critique pour armes à deux mains).

**Code impliqué** : `client/src/components/CombatActionWindow.jsx` + `CombatGmDeclareWindow.jsx` — section affichage arme absente ou incomplète.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster N — lire les deux composants, identifier où et comment afficher l'arme.

---

### Bug COM21 — Collision tokens : deuxième token bloqué sans feedback

**Symptôme** : Deux tokens déclarant un déplacement vers la même case — le deuxième ne peut pas s'y rendre. Pas de feedback visible côté client.

**Code impliqué** : `server/src/socket/socketToken.js` ou pipeline déplacement — validation collision. Client : feedback manquant.

**Cause racine** [INCONNU] : La règle est peut-être déjà appliquée serveur (rejet silencieux). Feedback client absent.

**Prochaine étape** : Cluster N — vérifier si refus collision existe en serveur, puis ajouter feedback client.

---

### Bug COM22 — LOS bloquée affichée pour tous les joueurs

**Symptôme** : Quand la ligne de vue est bloquée pour un attaquant, le résultat "LOS bloquée / Tir en aveugle" apparaît pour tous les joueurs connectés, pas uniquement pour l'attaquant concerné.

**Code impliqué** : `server/src/lib/losService.js` + `server/src/socket/socketCombatResolution.js` — émission `DICE_RESULT "Tir en aveugle"` via `io.to(campaignId).emit` (broadcast global au lieu de ciblé).

**Cause racine** [HYPOTHÈSE] : L'émission LOS utilise `io.to(campaignId)` (broadcast) au lieu de `socket.emit` vers l'attaquant seul.

**Prochaine étape** : Cluster N — lire `losService.js` + site d'émission dans `socketCombatResolution.js`.

---

### Bug COM23 — Label token : pénètre dans les murs

**Symptôme** : Le label nom affiché au-dessus du token suit le token en 3D et peut s'afficher à l'intérieur des murs ou du décor selon l'angle de caméra.

**Code impliqué** : `client/src/components/Canvas3D.jsx` — rendu label `<Html>` drei.

**Cause racine** [INCONNU] : Non investigué. Piste : `occlude` prop de `<Html>` drei non activée, ou position Y trop faible.

**Prochaine étape** : Cluster N — lire rendu label HTML dans Canvas3D.

---

### Bug CS1 — Onglet Matériel : description arme manquante

**Symptôme** : Dans la fiche personnage, onglet Matériel, les armes n'affichent pas leur description textuelle.

**Code impliqué** : Composant fiche personnage onglet Matériel (à identifier — `ArmorWoundPanel.jsx` ou composant armes dédié).

**Cause racine** [INCONNU] : Non investigué — champ description absent du rendu ou non chargé depuis la DB.

**Prochaine étape** : Cluster O — identifier le composant onglet Matériel, vérifier si `description` est dans le payload arme.

---

### Bug CS2 — Fiche personnage : changement d'arme sans menu déroulant

**Symptôme** : Il n'y a pas de menu déroulant permettant de choisir une arme différente depuis la fiche personnage. Le changement d'arme équipée est absent ou peu ergonomique.

**Code impliqué** : Composant fiche personnage — section armes (à identifier).

**Cause racine** [INCONNU] : Fonctionnalité manquante ou incomplète.

**Prochaine étape** : Cluster O — identifier le composant et la section armes dans CharacterWindow.

---

### Bug CS3 — Arme à deux mains équipable dans chaque main

**Symptôme** : Il est possible d'équiper une arme à deux mains en MG et une autre en MD simultanément. Une arme à deux mains devrait occuper les deux mains ("Main Directrice" unique).

**Règle** : Arme à deux mains = une seule arme, occupe MG + MD. Changer l'UI MG/MD en "Main Directrice" pour ces armes.

**Code impliqué** : Composant fiche personnage / `CharacterWindow.jsx` — logique équipement MG/MD + guard validation.

**Cause racine** [INCONNU] : Pas de guard côté client/serveur vérifiant si l'arme en MG est à deux mains avant d'autoriser MD.

**Prochaine étape** : Cluster O — lire logique équipement mains dans CharacterWindow.

---

### Bug CS4 — Catégorie compétences "Techniques" : titre et liste incorrects

**Symptôme** : La catégorie s'appelle "Technique" (singulier) et sa liste de compétences est incomplète ou incorrecte. Liste attendue :
- Analyses, sons, scans (X) — ADA/INT
- Armes embarquées/Artillerie (X) — INT/INT
- Électronique † (X) — INT/INT
- Informatique † (-3) — INT/INT
- Mécanique [ ] — INT/INT
- Piratage informatique † (X) — INT/INT
- Premiers soins (-3) — ADA/INT
- Systèmes de sécurité (à compléter)

**Code impliqué** : `client/src/locales/fr.json` (libellé catégorie) et/ou données DB (`ref_skills` — liste et attributs).

**Cause racine** [INCONNU] : Données référentielles incorrectes en DB ou libellé i18n incorrect.

**Prochaine étape** : Cluster O — vérifier `ref_skills` en DB + `fr.json` catégorie compétences.

---

### Bug CS5 — Compétence réservée (X) : coût ouverture incorrect

**Symptôme** : Pour ouvrir une compétence réservée (notée X), le système exige 3 XP pour monter directement à 0. La règle : ouvrir = 1 XP (le score reste à -3), les points s'achètent normalement ensuite.

**Règle** : LdB — compétence réservée : coût ouverture = 1 XP, score reste -3. Achat normal des points suivants.

**Code impliqué** : Composant `SkillsPanel.jsx` ou équivalent — logique achat/ouverture compétences réservées.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster O — lire SkillsPanel, logique coût ouverture compétence réservée.

---

### Bug CS6 — Force Polaris classée comme Mutation (devrait être Avantage)

**Symptôme** : "L'accès à la force Polaris" apparaît dans la section Mutations de la fiche personnage alors que c'est un Avantage.

**Règle** : LdB — force Polaris = Avantage, pas une Mutation.

**Code impliqué** : Données DB — table `ref_advantages` ou `ref_mutations` — entrée "Force Polaris" mal catégorisée.

**Cause racine** [INCONNU] : Donnée de référence insérée dans la mauvaise table ou avec le mauvais type.

**Prochaine étape** : Cluster O — requête DB sur `ref_advantages` + `ref_mutations` pour trouver et corriger l'entrée.

---

### Bug DR7 — Drone : le propriétaire ne peut pas modifier la fiche

**Symptôme** : Le joueur propriétaire d'un drone ne peut pas modifier sa fiche dans DroneWindow (champs grisés ou refusés).

**Code impliqué** : `client/src/components/DroneWindow.jsx` — guard d'édition. Routes REST drone — vérification `role === 'gm'`.

**Cause racine** [INCONNU] : Guard trop restrictif (`gm` uniquement) — propriétaire du drone non identifié ou non autorisé.

**Prochaine étape** : Cluster P — lire DroneWindow + route REST drone pour identifier le guard.

---

### Bug DR8 — Drone : munitions arme infinies (jamais décrémentées)

**Symptôme** : Les armes des drones ne consomment pas de munitions lors des attaques.

**Code impliqué** : `server/src/lib/losService.js` — `_spendAmmo` ou équivalent. `server/src/socket/socketCombatResolution.js` — `resolveDroneAssaultAction`.

**Cause racine** [INCONNU] : Probablement pas de branche drone dans `_spendAmmo`, ou la fonction n'est pas appelée pour les drones.

**Prochaine étape** : Cluster P — lire `_spendAmmo` + `resolveDroneAssaultAction`.

---

### Bug DR9 — Logiciels drone : données pas à jour en BDD

**Symptôme** : Les logiciels disponibles pour les drones dans la BDD ne correspondent pas aux données attendues (noms, valeurs, types incorrects ou manquants).

**Code impliqué** : Table `drone_programs` — données de référence. Migration(s) correspondante(s).

**Cause racine** [INCONNU] : Données de référence obsolètes ou mal migrées.

**Prochaine étape** : Cluster P — comparer contenu `drone_programs` avec `docs/REGLEDRONE.md` pour identifier les écarts.

---

### Bug DR10 — Drone contrôlé par joueur : GM reçoit aussi la fenêtre de contrôle

**Symptôme** : Quand un joueur contrôle un drone (slot drone PJ), le GM reçoit aussi la fenêtre de déclaration drone et peut agir dessus. Le GM devrait avoir une vue lecture uniquement dans ce cas.

**Code impliqué** : `client/src/components/DroneWindow.jsx` ou `CombatGmDeclareWindow.jsx` — condition d'affichage / permission GM vs joueur propriétaire.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster P — lire DroneWindow + CombatGmDeclareWindow, identifier la condition d'ouverture côté GM.

---

### Bug UI2 — Dés : alignement visuel incorrect

**Symptôme** : Les dés ne sont pas alignés correctement dans l'interface (canvas dés ou layout résultats).

**Code impliqué** : Composant dés 3D ou layout résultats — CSS/JSX (à identifier).

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster Q — identifier le composant concerné.

---

### Bug UI3 — Dé 100 (D100) : affichage chat incorrect

**Symptôme** : Le résultat d'un lancé de D100 ne s'affiche pas correctement dans le chat de session.

**Code impliqué** : Composant chat + rendu `DICE_RESULT` — cas `dieType = 'd100'` ou `dieType = 'd10x10'`.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster Q — lire rendu DICE_RESULT dans Sidebar/chat + composant dés.

---

### Bug KIWI2 — Import GLB token : fonctionne en local, échoue sur Kiwi

**Symptôme** : L'importation d'un modèle GLB pour les tokens fonctionne correctement en local mais échoue silencieusement ou avec erreur sur le serveur distant Kiwi.

**Code impliqué** : Route REST upload GLB (à identifier) + configuration MinIO / stockage sur Kiwi. `docs/SERVEURDISTANTKIWI.md` pour la config Kiwi.

**Cause racine** [INCONNU] : Non investigué. Pistes probables : chemin MinIO différent sur Kiwi, permissions bucket, variable d'env manquante, ou taille max upload différente.

**Prochaine étape** : Cluster R — tenter un upload GLB sur Kiwi avec logs serveur ouverts, puis lire `SERVEURDISTANTKIWI.md` + config MinIO.

---

### FEAT3 — Token actif : cercle de sélection (surbrillance)

**Besoin** : Le token dont c'est le tour actif doit apparaître en surbrillance (cercle ou halo de sélection) sur la carte 3D pour être immédiatement identifiable par tous les joueurs.

**Code impliqué** : `client/src/components/Canvas3D.jsx` — rendu token actif. Store combat — `activeTokenId` ou équivalent disponible.

**Prochaine étape** : Sprint dédié — ajouter cercle/halo R3F sous le token actif (ex: `<mesh>` disc avec `emissive`).
