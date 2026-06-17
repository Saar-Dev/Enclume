# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-06-16 Session 97
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
| **D — Fenêtres combat UI** | UI1 + COM8 + COM5 + CL2 | composants combat + `index.css §11` | **Haute** |
| **E — Arme et statuts** | COM1 + COM2 + COM4 + COM7 + COM10 + COM11 | `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` | Moyenne |
| **F — Ghosts + portraits** | CL1 + CL3 | `CombatTimeline.jsx` + `CombatOverlay.jsx` | Moyenne |
| **G — Drone store** | D1 + D2 | `SessionPage.jsx` + `Canvas3D.jsx` | Moyenne |
| **H — Dettes techniques** | WS1 + TC1 + DCO1 + VX1 + AU1 + INI1 | divers | Basse |
| **I — Affichage dégâts drone** | DR6 + DR4 + DMG1 + DMG2 | `server/src/socket/index.js` | **Haute** |
| **K — Chat** | CH1 | `SessionPage.jsx` | Haute — sprint persistance séparé |
| ~~A / B / C / J~~ | ~~B6 / COM6 / DR1 / DC1-3 / SHOCK1 / SHK3-6 / ST2~~ | — | ✅ Clos Sessions 94–97 |

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

### Bug D2 — Token drone : changement de GLB non fonctionnel

**Symptôme** : Upload d'un nouveau GLB pour un drone via DroneWindow → token 3D ne se met pas à jour visuellement.

**Code impliqué** : `Canvas3D.jsx:879` — `characters.find(c => c.id === token.character_id)` pour calculer `glbUrl`. `Canvas3D.jsx:246` — `key={glbUrl}` sur `TokenGlbErrorBoundary`.

**Cause racine** [HYPOTHÈSE] : Même cause racine que D1. Si le drone n'est pas trouvé dans `characters`, `glbUrl = defaultTokenGlbUrl` (constante). `key` ne change jamais → pas de remontage → pas de rechargement GLB.

**Fix partiel appliqué** : `key={glbUrl}` sur `TokenGlbErrorBoundary` + `updateCharacter(res.data.character)` dans `DroneWindow.SettingsTab.handleGlbUpload`. Correcte en théorie, inefficace tant que D1 n'est pas résolu.

---

## Bugs Session 91 — CombatDeclareLog (2026-06-11) — Non résolus

### Bug CL1 — Timeline joueur : portraits PNJ non visibles

**Symptôme** : Côté joueur uniquement, certains portraits dans la timeline de combat ne s'affichent pas. Exemple observé : PNJ "Soleil" sans portrait. Côté GM : OK.

**Code impliqué** : `CombatTimeline.jsx` — rendu des portraits. Probable dépendance à `characters` (store characterStore) qui ne contient côté joueur que les personnages appartenant au joueur, pas les PNJ GM.

**Cause racine** [HYPOTHÈSE] : La timeline joueur tente de résoudre le portrait via `characters.find(c => c.id === token.character_id)` — retourne `undefined` pour les PNJ non chargés dans le store joueur → fallback image absente ou non rendue.

**Prochaine étape** : Lire `CombatTimeline.jsx` — vérifier comment le portrait est résolu et si un fallback visible existe pour les tokens sans `character` dans le store.

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

### Bug COM1 — Recharger : action ne fait rien (humanoïde)

**Symptôme** : En combat humanoïde, déclarer l'action "Recharger" et la résoudre n'a aucun effet observable.

**Cause racine** [INCONNU] : Non encore investigué — `resolveReloadAction` peut être absent, ou l'état `weapon_loaded` non persisté en base.

**[DBG-COM1] suggestion** :
```js
console.log('[DBG-COM1] reload handler reached', { actionType, tokenId, weaponInvId })
```
Ajouter au début du handler `COMBAT_ACTION_CONFIRM` pour vérifier si le type `reload` est bien routé.

**Code impliqué** : `server/src/socket/index.js` — `COMBAT_ACTION_CONFIRM` → handler reload. À vérifier : est-ce que `resolveReloadAction` (ou équivalent) est appelé ? Est-ce que l'état de l'arme (chargée/vide) est tracké en base ?

**Prochaine étape** : Lire le handler reload dans `index.js`, vérifier la route et la persistance.

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

### Bug DR4 — calcDroneRD : RD négatif pour drone en bonne santé → dégâts augmentés

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

### Bug DR6 — Blindage drone non lu lors de la résolution (Blindage:0 affiché malgré valeur DB = 15)

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

## Bugs divers — Dette technique

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

### Bug WS1 — WorkshopPage crash import invalide

**Symptôme** : Handler d'erreur accède `err.response?.data?.error` — structure absente sur certaines erreurs → crash ou message vide.

**Correction** : `err.response?.data?.message ?? err.message`.

**Code impliqué** : `client/src/pages/WorkshopPage.jsx` — handler catch.

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
