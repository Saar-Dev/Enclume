# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-06-15 Session 96
> Index priorité → [`docs/EN_COURS.md`](EN_COURS.md) §Dettes actives

---

## MÉTHODE — Comment traiter les bugs dans ce projet

### Principe fondateur (issu des pratiques pro)

**Ni un bug à la fois, ni tout en batch.** Le modèle professionnel est :

> **Triage batch → Analyse par cluster → Fix par cluster → Validation avant le cluster suivant**

Basé sur :
- Bug triage (Atlassian, SmartBear, BrowserStack) : analyser tous les bugs ensemble pendant que le contexte est frais → meilleure priorisation, moins de re-lecture
- Defect clustering (Functionize, TestSigma) : les bugs se regroupent naturellement par module ou cause racine. Résoudre un bug du cluster résout souvent les autres. Économie 40–60% du temps de debug vs. traitement isolé
- Root Cause Analysis (Splunk, selementrix, TechTarget) : ne jamais patcher le symptôme. Toujours trouver la cause racine (technique des "5 Pourquoi")
- Pragmatic Engineer : un commit par cause racine, pas par symptôme. Si 3 bugs partagent la même cause dans le même fichier → un seul fix, un seul commit

---

### Phase 1 — TRIAGE (batch, une fois par session)

1. Lister tous les bugs connus
2. Attribuer sévérité (impact fonctionnel) + priorité (urgence pour les sessions de jeu)
3. Identifier les **clusters** (voir définition ci-dessous)
4. Produire l'ordre de sprint → mettre à jour `EN_COURS.md`

**Ne pas coder à cette étape.**

---

### Phase 2 — ANALYSE (par cluster, avant de coder)

Pour chaque cluster, dans la même session de lecture :

1. Lire tous les fichiers concernés par le cluster (TABLE DE ROUTING)
2. Identifier la **cause racine** — pas le symptôme
   - Technique "5 Pourquoi" : demander "pourquoi ?" jusqu'à atteindre la cause structurelle
   - Exemple : `localisation: null` (symptôme) → "pourquoi null ?" → branche 8a ne lit pas `droneSheet` → cause racine
   - **Si la cause racine cite une règle de jeu → vérifier la source primaire LdB avant de valider.** Une référence incorrecte dans ce fichier peut transformer un comportement CONFORME en faux bug, et un correctif planifié en régression. (Leçon Session 94 — COM3)
3. Vérifier les **effets de bord** : le fix du bug A casse-t-il le bug B dans le même cluster ?
4. Produire le plan exact : fichier, ligne, ce qui change, ce qui ne change pas

**Run à vide obligatoire avant de coder** — anticiper pièges, ambiguïtés, effets de bord.

---

### Phase 2b — INSTRUMENTATION (si cause HYPOTHÈSE ou INCONNU)

Avant de coder le correctif, si la cause racine n'est pas **VÉRIFIÉ** :

1. Ajouter des logs ciblés préfixés `[DBG-BUGID]` au point exact suspecté
   - Serveur : `console.log('[DBG-COM3]', { attackSuccess, isSuccess })`
   - Client : `console.warn('[DBG-D1]', token.character_id, characters.map(c => c.id))`
2. SR — reproduire le scénario exact du bug
3. Lire la sortie → confirmer ou infirmer la cause racine
4. Mettre à jour le label dans ce fichier : `HYPOTHÈSE → VÉRIFIÉ` (ou réviser le diagnostic)
5. Un log pertinent peut rester permanent — retirer uniquement les logs bruités ou redondants avant le commit

**Ne jamais coder un correctif sur une cause INCONNUE ou non confirmée.**

---

### Phase 3 — CORRECTIF (par cluster)

- Coder uniquement ce qui est dans le plan validé
- **Un commit par cluster** (pas par bug individuel si cause racine commune)
- Si deux bugs du cluster touchent des fichiers sans rapport → deux commits séparés dans le même sprint
- Jamais mélanger deux clusters dans un seul commit

---

### Phase 4 — VALIDATION

- Test fonctionnel du cluster avant de passer au suivant
- Vérifier les zones adjacentes (régressions)
- Fermer les bugs validés dans `EN_COURS.md` (✅ Clos)
- Appender `JOURNAL4.md`

---

### Définition d'un "cluster" pour Enclume

Un cluster = bugs qui satisfont **au moins un** des critères :

| Critère | Exemple |
|---|---|
| Même fichier source | COM3 + DC3 + DC2 → tous dans `socket/index.js` |
| Même cause racine | DR1 + COM6 → "arme non pré-sélectionnée" → même pattern init |
| Même mécanique de jeu | DC1 + DC3 + DR3 → flow CaC drone |
| Fix A nécessite Fix B | B6 + DC3 → les deux dans `resolveDroneAssaultAction` |

Des bugs de **sévérité différente** peuvent être dans le même cluster si la cause racine est identique.

---

### Ce qu'il ne faut jamais faire

- Coder un fix sans avoir lu les fichiers dans cette session
- Mixer des clusters sans rapport dans le même sprint (dette de contexte)
- Fermer un bug sur "ça semble fonctionner" — confirmation fonctionnelle obligatoire
- Patcher un symptôme sans comprendre la cause racine → le bug reviendra

---

*Sources : [Atlassian — Bug Triage](https://www.atlassian.com/agile/software-development/bug-triage) · [Functionize — Defect Clustering](https://www.functionize.com/blog/why-bugs-appear-in-clusters) · [selementrix — RCA](https://www.selementrix.ch/blog/how-do-we-perform-effective-root-cause-analysis-instead-of-just-patching) · [Pragmatic Engineer — Bug Management](https://newsletter.pragmaticengineer.com/p/bug-management-that-works-part-1)*

---

## COLD START — Orientation rapide pour une nouvelle conversation

> Lire ce bloc en premier si tu arrives sans contexte de session précédente.

**Ce fichier est la source de vérité des bugs actifs.** Il est structuré pour qu'une IA puisse reprendre le travail à froid sans perdre de contexte.

**Index de priorité** : `EN_COURS.md §Dettes actives` — tableau synthétique (ID | Description | Priorité).

**Table de routing fichiers** : `CLAUDE.md §TABLE DE ROUTING` — quel fichier lire selon le domaine touché.

**Labels épistémiques sur chaque bug :**
- `[VÉRIFIÉ]` — cause confirmée par lecture du code source
- `[HYPOTHÈSE]` — cause probable, à confirmer par instrumentation (Phase 2b)
- `[INCONNU]` — cause non encore investiguée

**Avant tout correctif :** lire les fichiers du cluster concerné dans la même session. Ne jamais coder depuis la mémoire.

---

## ROUTING PAR CLUSTER — Sprint order recommandé

| Cluster | Bugs | Fichier principal | Priorité |
|---|---|---|---|
| **A — Socket résolution drone** | ~~B6~~ ✅ / ~~COM3~~ FAUX BUG / ~~DC2~~ ✅ / ~~DC3~~ ✅ | `server/src/socket/index.js` | ✅ Clos Session 95 suite |
| **B — Init arme défaut** | ~~COM6~~ ✅ / ~~DR1~~ ✅ | `CombatGmDeclareWindow.jsx` | ✅ Clos Session 95 |
| **C — Flow CaC drone** | ~~DC1~~ ✅ / ~~DR3~~ ✅ | `CombatOverlay.jsx` + `socket/index.js` | ✅ Clos Session 95 suite |
| **J — Pipeline shock + COMBAT_END** | ~~SHOCK1~~ ✅ / ~~SHK3~~ ✅ / ~~ST2~~ ✅ | `server/src/socket/index.js` | ✅ Clos Session 96 |
| **K — UX curseur + chat** | ~~CUR1~~ ✅ + CH1 (sprint persistance séparé) | `SessionPage.jsx` | ~~CUR1~~ Clos Session 95-6 |
| **D — Fenêtres combat UI** | UI1 + COM8 + COM5 + CL2 | composants combat + `index.css §11` | Haute |
| **E — Arme et statuts** | COM1 + COM2 + COM4 + COM7 | `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` | Moyenne |
| **F — Ghosts + portraits** | CL1 + CL3 | `CombatTimeline.jsx` + `CombatOverlay.jsx` | Moyenne |
| **G — Drone store** | D1 + D2 | `SessionPage.jsx` + `Canvas3D.jsx` | Moyenne |
| **H — Dettes techniques** | WS1 + TC1 + DCO1 + VX1 + AU1 + INI1 | divers | Basse |
| **I — Affichage dégâts drone** | DR6 + DR4 + DMG1 + DMG2 | `server/src/socket/index.js` | **Haute** |

**Règle d'or :** toujours finir le cluster A avant d'entamer B. Validation fonctionnelle obligatoire entre clusters.

---

## AUDIT ARCHITECTURAL — Pipeline Combat — Session 95-3 (2026-06-15)

> Lecture de `server/src/socket/index.js` (handlers, fonctions résolution) + `charStats.js` + `woundUtils.js`.
> **🔴 REFONTE** = ne pas corriger individuellement — reconstruire proprement.
> **🟢 OK** = structure saine, corrections ciblées acceptables.
> **🟡 TECH DEBT** = non bloquant V1, sprint futur.

---

### Fondations — `charStats.js` / `woundUtils.js` / helpers atomiques
**🟢 OK — conserver sans toucher.**

| Élément | Verdict |
|---|---|
| `calcSeuils`, `calcResistanceDommages`, `calcResistanceArmure` | ✅ Pures, correctes, conformes LdB |
| `isShockTestRequired`, `getShockMalus` | ✅ Pures, conformes LdB |
| `applyStunWithDuration` | ✅ Écrit **uniquement** dans `token_statuses` — architecture post-Sprint 14-0 conforme. Zéro écriture JSONB. |
| `rollStunDuration` | ✅ Single-purpose, correct |
| `resolveWoundInsertion` | ✅ Transactionnel, correct |
| Guard stun `COMBAT_ACTION_DECLARE` (~ligne 1923) | ✅ Lit depuis `token_statuses` uniquement |
| Schéma DB + migrations | ✅ Solide |

---

### Bloc Shock — `socket/index.js`
**🔴 REFONTE TOTALE — ne pas patcher individuellement.**

Le bloc shock (isShockTestRequired → calcSeuils → rollChoc → outcome → stunDuration → applyStunWithDuration → shockResult) est **copié-collé 5× avec des noms de variables différents** :

| Site | Fonction | Var stun |
|---|---|---|
| ~2495 | COMBAT_DAMAGE_CONFIRM | `stunDuration` |
| ~2781 | COMBAT_MELEE_DEFENSE_CONFIRM | `stunDuration2` |
| ~3612 | resolveMeleeAction (PNJ auto) | `stunDuration3` |
| ~4065 | resolveDroneAssaultAction 8b | `stunDuration` |
| ~4434 | resolveAssaultAction (PNJ auto) | `stunDuration4` |

**Symptômes actifs de cette structure :**
- **SHOCK1** ✅ clos — bloc entier absent en 8b → copy-paste incomplet, corrigé en urgence Session 95-3
- **ST2** — D6 durée sans DICE_RESULT dans les 5 copies → **ne pas patcher individuellement**

**Plan refonte :** extraire un helper `resolveShockBlock(io, campaignId, { finalSeverity, localisation, for_na, con_na, vol_na, is_lethal, targetTokenId, userId, username, color })` qui retourne `shockResult`. Un seul endroit. ST2 (DICE_RESULT D6) corrigé une fois. Les 5 sites deviennent un appel d'une ligne.

---

### Handlers de résolution — Monolithes
**🟡 TECH DEBT — non bloquant V1.**

| Fonction | Lignes estimées | Problème |
|---|---|---|
| `resolveMeleeAction` | ~507 | Attaque PJ + PNJ + multi-attaque + pipeline complet inline |
| `resolveAssaultAction` | ~367 | PJ + PNJ + setup attaquant + pipeline complet inline |
| `COMBAT_DAMAGE_CONFIRM` handler | ~213 | Lookup DB + calcul dégâts + wound + shock + 4 émissions |
| `COMBAT_MELEE_DEFENSE_CONFIRM` handler | ~261 | Même problème |

Acceptable V1. Découpage en modules (`resolveDamage.js`, `resolveMelee.js`) = sprint dédié post-V1. **Ne pas bloquer les corrections actuelles pour ça.**

---

### Ordre d'exécution Cluster J — révisé

| Étape | Action | Raison |
|---|---|---|
| 1 | **DBG-SHK3** — instrumenter + SR + lire console | SHK3 = [HYPOTHÈSE] — cause racine non confirmée |
| 2 | **Refonte `resolveShockBlock`** — 1 commit | ST2 résolu dedans + futur-proof |
| 3 | **Fix SHK3** — 1 commit | Après DBG confirmé uniquement |

**Règle :** ST2 ne se corrige pas en 5 endroits. `resolveShockBlock` est le prérequis.

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

## Bugs Session 91 — Sprint CaC Drone (2026-06-12) — Non résolus

### ~~Bug DC1~~ — ✅ CLOS — Session 95 suite

**Symptôme initial** : Drone CaC présentait `CombatModifiersWindow` (fenêtre distance) au lieu de `CombatCacModifiersWindow`.

**Verdict** : Fix déjà présent en base de code (Session 91 commité). `isDroneCaC` flag + routing `CombatCacModifiersWindow` — correct. Confusion initiale due à cache Firefox stale. Validé fonctionnellement après rechargement forcé.

---

### ~~Bug DC2~~ — ✅ CLOS — Session 95 suite

**Symptôme initial** : Mods de situation non appliqués dans `resolveDroneAssaultAction`.

**Verdict** : Fix déjà présent — `situationMods = confirmedModifiers?.situation ?? []` en base de code (Session 91 commité). Validé fonctionnellement Session 95 suite.

---

### ~~Bug DC3~~ — ✅ CLOS — Session 95 suite

**Symptôme initial** : `portee = 'bout_portant'` → +5 illégitime pour `armement_contact`.

**Verdict** : Fix déjà présent — `portee = null` pour `armement_contact` → `PORTEE_MOD_COMP[null] ?? 0 = 0` — en base de code (Session 91 commité). Validé fonctionnellement Session 95 suite.

---

## Bugs Session 95 suite 2 — Validation Sprint 14-0 (2026-06-15) — Nouveaux

### Bug SHOCK1 — Test de Choc non déclenché pour cibles PNJ ✅ Clos — Session 95-3

**Symptôme** : Attaque drone sur PNJ humanoid → blessure Mortelle/Critique/Grave (Tête/Corps) → aucun Test de Choc, aucun stun.

**Cause racine** [VÉRIFIÉ] : `resolveDroneAssaultAction` branche 8b (drone → PNJ). Trois défauts cumulés : `vol_na` non destructuré dans `fetchCibleNA`, bloc shock absent après `resolveWoundInsertion`, `shockResult: null` hardcodé dans `COMBAT_ATTACK_RESULT`.

**Correctif** : `server/src/socket/index.js` branche 8b — `vol_na` ajouté, bloc shock complet inséré, `shockResult` dynamique.

**Testé** : drone → PNJ humanoid, blessure Mortelle Corps → Test de Choc déclenché ✅, stun appliqué si outcome ≠ ok ✅
**Non testé** : —

---

### ~~Bug SHK3~~ — ✅ CLOS (FAUX BUG) — Session 95-3

**Symptôme initial** : Après `COMBAT_END`, badge disparu mais stun mécanique persistant au combat suivant.

**Verdict [VÉRIFIÉ]** : FAUX BUG. Instrumentation [DBG-SHK3] confirme :
- `applyStunWithDuration` → uniquement `token_statuses`, zéro JSONB ✅
- Guard COMBAT_ACTION_DECLARE → lit uniquement `token_statuses` ✅
- Cleanup COMBAT_END : `avant cleanup: [{ token_id, status_code:'unconscious', expires_at_turn:31 }]` → `après cleanup: []` ✅
- Nouveau combat (`current_turn: 1` à chaque départ) → aucun guard bloquant ✅

Le code est correct. Les deux hypothèses initiales infirmées par lecture + logs.

**Testé** : stun PNJ (inconscient, durée 30) → COMBAT_END → nouveau combat → déclaration attaque → non bloquée ✅
**Non testé** : —

---

### ~~Bug CUR1~~ — ✅ CLOS — Session 95-6 — Curseur bloqué après fermeture combat

**Symptôme** : Si le GM ferme le monde combat (ou COMBAT_END) alors qu'un token est en mode déplacement ou sélection de cible, le curseur reste bloqué dans l'état "combat" (curseur spécial déplacement/cible). La SessionPage ne revient pas au curseur normal.

**Cause racine** [HYPOTHÈSE] : `combatTargetMode` et/ou `combatMoveMode` (state React SessionPage ou CombatOverlay) ne sont pas remis à `false` lors de COMBAT_END ou COMBAT_PHASE_CHANGED. Le curseur CSS est conditionné par ces states.

**Code impliqué** : `client/src/pages/SessionPage.jsx` — state `combatTargetMode` / `combatMoveMode`. `client/src/components/CombatOverlay.jsx` — reset sur événements WS. `client/src/index.css` — curseur conditionné par classe CSS combat.

**Prochaine étape** : Cluster K — lire les listeners `COMBAT_END` + `COMBAT_PHASE_CHANGED` dans SessionPage et CombatOverlay, vérifier si les states de mode sont réinitialisés.

---

### Bug CH1 — Historique chat perdu au F5

**Symptôme** : L'historique des messages du chat en session ne survit pas à un rechargement de page (F5). Le chat redémarre vide.

**Cause racine** [HYPOTHÈSE] : Les messages du chat sont stockés uniquement en mémoire React (useState). `SESSION_JOIN` sync ne rejoue pas l'historique des messages existants. Pas de persistance DB des messages de chat, ou pas de query "derniers N messages" au reconnect.

**Code impliqué** : `client/src/pages/SessionPage.jsx` — state messages. `server/src/socket/index.js` — handler `SESSION_JOIN` (vérifier si historique chat est inclus dans le sync).

**Prochaine étape** : Sprint persistance chat — projet non-trivial. Vérifier d'abord si table `chat_messages` existe en DB. Si non → sprint dédié (modèle, migration, API, sync SESSION_JOIN) avant tout correctif.

---

## Bugs Session 95 suite — Statuts token (2026-06-15) — Validation Sprint 14-0 + Test de Choc

### Bug ST1 — Badge statut illisible sur token canvas

**Symptôme** : Badge hexagonal "Étourdi" (et autres statuts) visible sur le token mais texte trop petit pour être lisible en jeu.

**Code impliqué** : Sprint 14-2 — affichage badges SVGs sous le nom token (`Canvas3D.jsx` / Html drei).

**Prochaine étape** : Sprint 14-2 dédié.

---

### ~~Bug ST2~~ — ✅ CLOS — Session 96 (REWORK-01)

**Symptôme initial** : D6 durée roulé silencieusement serveur. Aucune carte DICE_RESULT.

**Correctif Session 95-5** : Refonte `resolveShockBlock` → helper unique. DICE_RESULT D6 émis. Carte "Durée étourdissement" visible dans sidebar chat.

**Correctif Session 96 (REWORK-01)** : REWORK-01 `statusService.js` — PJ ciblé → `CombatStunWindow` fenêtre interactive "Lancer 1D6". PNJ → auto D6 serveur + DICE_RESULT broadcast. SR ✅ — testé drone→PNJ (inconscient, D6=6, 60 tours).

**Testé** : Scénarios 1-5 ARCHI_REWORK.md tous validés — PNJ cible ✅ / PJ cible + CombatStunWindow ✅ / non-régression blessure légère ✅ / PJ offline fallback ✅ / CaC shock non-régression ✅
**Non testé** : —

---

### ~~Bug SHK6~~ — ✅ CLOS — Session 96 suite — COMBAT_DAMAGE_CONFIRM : autorisation PJ cible

**Symptôme** : Drone → PJ : fenêtre "GESTION DES DÉGÂTS" côté PJ bloquée à "Calcul en cours..." après clic "Lancer les dés". Aucun résultat en sidebar.

**Cause racine** [VÉRIFIÉ] : `COMBAT_DAMAGE_PROMPT` envoyé au socket PJ (ligne 4065 — `io.fetchSockets()` + `s.user?.id` fonctionne en mémoire locale sans Redis adapter). Quand le PJ envoie `COMBAT_DAMAGE_CONFIRM`, la condition d'autorisation ligne 2379 échoue : `pending.userId` (null — drone sans user_id) ≠ `socket.user.id` (PJ) ET `socket.role !== 'gm'` → return silencieux, jamais de `COMBAT_DAMAGE_RESULT`.

**Correctif** : `server/src/socket/index.js`
- Branch 8c : `targetUserId: cibleCharacter.user_id` ajouté au pending action
- Ligne 2379 : condition élargie à `pending.targetUserId !== socket.user.id`

**Testé** : drone → PJ, fenêtre fonctionnelle, résultats affichés ✅
**Non testé** : `CombatStunWindow` post-damage pour PJ si shock requis

---

### ~~Bug SHK4 — D20 Test de Choc : non visible en chat~~ ✅ Clos — Session 95-7

**Symptôme** : Quand un Test de Choc est déclenché, le jet D20 est résolu côté serveur mais aucune carte `DICE_RESULT` n'est émise. Les joueurs ne voient pas le résultat du test dans la sidebar chat.

**Correctif** : `resolveShockTest` → retourne désormais `rolls` + `seed`. Nouvelle export synchrone `emitShockDiceResult` dans `statusService.js`. 5 call sites dans `index.js` appellent `emitShockDiceResult` avant `COMBAT_ATTACK_RESULT`/`COMBAT_DAMAGE_RESULT`. Sidebar : nouveau routing `cardType='shock_test'` + clé i18n `shockTestDetail`. `CombatStunWindow` : violations CSS [A1] corrigées.

**Testé** : D20 visible chat (3 outcomes ok/étourdi/inconscient) ✅ — carte "Test de Choc" avec seuils ✅ — badge résultat ✅ — non-régression Scénarios 1-5 REWORK-01 ✅
**Non testé** : —

---

### ~~Bug SHK5 — shock_auto_stun=false : PJ ciblé routé vers sa propre fenêtre au lieu du GM~~ ✅ Clos — Session 95-7

**Symptôme** : Quand `campaigns.shock_auto_stun = false`, l'intention est que le GM gère TOUS les lancers D6 de durée (PJ et PNJ). L'implémentation actuelle routait les PJ vers leur propre `CombatStunWindow` même en mode `false`.

**Correctif** : `applyStun` branche PJ — lecture `shock_auto_stun` depuis `campaigns` avant de choisir le socket cible. Si `false` → `gmSocket` + `isGmPrompt: true`. Si `true` (défaut) → `pjSocket` + `isGmPrompt: false`. Handler `COMBAT_STUN_CONFIRM` inchangé (gérait déjà `isGmPrompt: true`).

**Testé** : `shock_auto_stun=false` → `CombatStunWindow` chez GM ✅ — PJ ne reçoit pas la fenêtre ✅ — GM lance D6 → badge stun PJ ✅ — non-régression `shock_auto_stun=true` → PJ reçoit toujours ✅
**Non testé** : —

---

### Bug ST3 — Fenêtre THUG STATUTS trop petite

**Symptôme** : La fenêtre de statuts token (grille hexagonale) ne peut pas afficher tous les statuts disponibles — overflow non géré.

**Code impliqué** : Composant fenêtre statuts token (SessionPage ou Canvas3D — menu contextuel statuts).

**Prochaine étape** : Sprint 14-1 (menu contextuel) ou sprint dédié UI — rendre la fenêtre scrollable ou agrandir la grille.

---

## Bug COM9 — Viser une Localisation précise — non implémenté

**Symptôme** : Dans `CombatModifiersWindow` (résolution assaut tir), aucune option ne permet de viser une localisation précise. Le D20 de localisation est toujours aléatoire.

**Règle** : LdB §"Viser une Localisation précise" — Corps −3 / Jambes −5 / Tête+Bras −7.

**Code impliqué** :
- `client/src/components/CombatModifiersWindow.jsx` — section manquante + state `aimedLocation` absent
- `server/src/socket/index.js` — `resolveAssaultAction` : pas de champ `aimedLocation` dans `confirmedModifiers`, pas de bypass du D20 localisation (branche PJ : `pendingDamageActions`, branche PNJ : L.4303). `COMBAT_DAMAGE_CONFIRM` (L.~2392) : D20 toujours joué.

**Prochaine étape** : Sprint dédié — NE PAS bricoler dans un autre sprint. Voir analyse complète dans JOURNAL4.md Session 95-7.

---

## Bugs Session 93-4 — Test CaC Étape 3 (2026-06-15) — Nouveaux

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

### ~~Bug COM3~~ — FAUX BUG — Jet de défense CaC (Session 94)

> ⛔ **FAUX BUG — NE PAS CORRIGER.** Voir table FAUX BUGS ci-dessus.

**Symptôme initial** : Jet de défense déclenché même si l'attaquant échoue.

**Verdict LdB** (`REGLES_Contact.md` p.222) : test d'opposition CaC = **les deux roulent toujours**. 4 cas documentés dont "A rate, D réussit" et "Les deux ratent". La référence règle originale ("§6.2 — défense uniquement si attaque réussie") était incorrecte. Le code `resolveMeleeAction` est conforme.

**Si UX confuse** (joueur PJ reçoit prompt défense alors que l'attaque a déjà raté visuellement) → créer Bug UI distinct, sprint UX dédié.

---

### Bug COM4 — CaC exige statut "Arme au clair" alors que mains nues possibles

**Symptôme** : Le système refuse ou grise le CaC si l'arme n'est pas "au clair", alors qu'une attaque à mains nues ne requiert pas d'arme équipée.

**Règle** : CaC à mains nues = action libre, pas de pré-requis statut arme.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx` et/ou `CombatActionWindow.jsx` — condition d'autorisation CaC.

**Prochaine étape** : Identifier la condition `state_weapon === 'drawn'` ou équivalent et la rendre optionnelle pour CaC mains nues.

---

### Bug COM5 — Fenêtre Annonce GM, CaC : clic "mode combat" sélectionne aussi la cible (incohérence GM/Joueur)

**Symptôme** : Côté GM (`CombatGmDeclareWindow`), cliquer sur un mode de combat (ex: "Offensif") sélectionne simultanément la cible. Côté joueur (`CombatActionWindow`), sélection mode de combat et sélection cible sont deux gestes distincts.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx` — handler sélection mode combat + logique cible.

**Prochaine étape** : Dissocier les deux actions côté GM — le clic sur mode combat ne doit pas auto-sélectionner une cible.

---

### ~~Bug COM6~~ — ✅ CLOS — Session 95

**Symptôme** : Quand une arme de corps à corps est présente dans l'équipement du personnage, elle n'est pas pré-sélectionnée par défaut dans la fenêtre de déclaration. L'utilisateur doit manuellement la choisir.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — `selectedGmMeleeWeaponId` (init à `null`). `CombatActionWindow.jsx` — équivalent joueur.

**Prochaine étape** : Initialiser `selectedGmMeleeWeaponId` avec la première arme CaC disponible depuis `equipment[activeTokenId]`, après le fetch.

---

### Bug COM7 — Multi-attaque CaC : duplicata / "Déclarer" grisé

**Symptôme** : L'option "multi-attaque" CaC semble un duplicata de "Attaque multiple" (existante). Quand sélectionnée, le bouton "Déclarer" reste grisé. Vérifier la pertinence règles et corriger si conservée.

**Règle à vérifier** : §6.2 MANUELSYSCOMBAT — attaque multiple melee (Sprint CaC 4b déjà planifié).

**Code impliqué** : `CombatGmDeclareWindow.jsx` — `meleeAttackCount` / `meleePendingMode`. `canDeclare` ou équivalent grisé.

**Prochaine étape** : Audit règles Polaris §6.2 — si "multi-attaque" et "attaque multiple" sont identiques, supprimer le duplicata. Sinon corriger le guard `canDeclare`.

---

### Bug COM8 — Fenêtre d'annonce non masquée lors de la sélection de cible

**Symptôme** : Quand le joueur ou le GM entre en mode sélection de cible (à distance, au CaC, ou sélection destination déplacement), la fenêtre d'annonce reste visible et encombre l'écran.

**Code impliqué** : `client/src/components/CombatGmDeclareWindow.jsx`, `CombatActionWindow.jsx` — gestion `combatTargetMode` / `onEnterTargetMode` / `onEnterMoveMode`. `CombatOverlay.jsx` — condition de rendu des fenêtres.

**Prochaine étape** : Ajouter condition `!combatTargetMode && !combatMoveMode` au rendu des fenêtres d'annonce.

---

### ~~Bug DR1~~ — ✅ CLOS — Session 95

**Symptôme** : Dans la fenêtre de déclaration GM pour un drone, aucune arme n'est pré-sélectionnée par défaut. `selectedDroneWeaponId` reste `null` jusqu'à sélection manuelle.

**Lien** : Bug COM6 (même problème, version drone). `canDeclareDrone` reste `false` tant qu'aucune arme n'est choisie.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — `selectedDroneWeaponId` (init null), `droneWeapons` fetch (lines 158-163).

**Prochaine étape** : Après le fetch `droneWeapons`, si `selectedDroneWeaponId === null && droneWeapons.length > 0`, setSelectedDroneWeaponId(droneWeapons[0].id).

---

### Bug DR2 — Drone : aucune action de déplacement disponible

**Symptôme** : Dans la fenêtre de déclaration GM pour un drone, il n'existe aucun bouton / option pour déclarer un déplacement. Les drones peuvent pourtant se déplacer selon les règles.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — section rendu drone (isActiveDrone). La section drone affiche uniquement sélection arme + sélection cible, pas de déplacement.

**Prochaine étape** : Sprint dédié — ajouter le déplacement drone (similaire au déplacement PNJ humanoïde, mêmes allures).

---

### ~~Bug DR3~~ — ✅ CLOS — Session 95 suite

**Note** : Identique à DC1 + DC3. Clos avec eux — Session 95 suite.

---

## ~~Bug B6~~ — ✅ CLOS — Session 94

---

## Bugs Session 93-5 — Pipeline dégâts drone (2026-06-15)

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

**Migration 72** (`72_drone_sheet_fix.js`) supprime déjà `resistance_dommages` (+ `iv`, `survie_iem`, `architecture`, `structure_materiau`) — identifiés sans source LdB. Colonne absente du schéma actuel. Aucune action requise.

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
Ajouter au point de calcul de l'initiative finale pour capturer le cas roll=1.

**Code impliqué** : Non identifié — vérifier la logique initiative dans `server/src/socket/index.js` (calcul REA + dé caché).

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


