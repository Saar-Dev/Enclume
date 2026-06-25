# BUGIDENTIFIE.md — Registre des bugs actifs

> Dernière mise à jour : 2026-06-24 Session 123
> Index priorité → [`docs/EN_COURS.md`](EN_COURS.md) §Dettes actives

---

## MÉTHODE — Triage → Cluster → Fix → Validation

| Phase | Action | Règle critique |
|---|---|---|
| **1. Triage** (batch) | Lister tous les bugs → sévérité + priorité → identifier clusters → mettre à jour EN_COURS.md | Ne pas coder à cette étape |
| **2. Analyse** (par cluster) | Lire les fichiers (TABLE DE ROUTING) → cause racine "5 Pourquoi" → effets de bord → plan exact | **Vérifier LdB si règle citée** — une référence fausse transforme un comportement conforme en faux bug (Leçon Session 94 — COM3) |
| **2b. Instrumentation** (si HYPOTHÈSE/INCONNU) | Logs `[DBG-BUGID]` au point exact → SR → reproduire → confirmer → `HYPOTHÈSE → VÉRIFIÉ` | Ne jamais coder sur une cause non confirmée |
| **3. Correctif** (par cluster) | Coder le plan validé uniquement. **1 commit par cause racine.** 2 clusters sans rapport → 2 commits | Ne jamais mixer deux clusters dans un seul commit |
| **4. Validation** | Test fonctionnel → zones adjacentes → fermer EN_COURS.md → appender JOURNAL5.md | Fermeture sans test fonctionnel → interdit |

**Définition cluster** : même fichier source / même cause racine / même mécanique / fix A nécessite fix B.

**Labels** : `[VÉRIFIÉ]` — cause confirmée par lecture du code. `[HYPOTHÈSE]` — à confirmer par 2b. `[INCONNU]` — non investigué.

**Run à vide obligatoire** avant de coder — anticiper pièges, ambiguïtés, effets de bord.

---

## ROUTING PAR CLUSTER — Sprint order recommandé

| Cluster | Bugs | Fichier principal | Priorité |
|---|---|---|---|
| **D — Fenêtres combat UI** | UI1 + COM8 + COM5 + CL2 | composants combat + `index.css §11` | **Haute** |
| **E — Arme et statuts** | COM2 + COM7 + COM10 + COM11 + COM18 | `CombatGmDeclareWindow.jsx` + `CombatActionWindow.jsx` | Moyenne |
| **F — Ghosts + portraits** | CL3 + COM16 | `CombatTimeline.jsx` + `CombatOverlay.jsx` + `useCombatSocket.js` | Moyenne |
| **G — Drone store** | D1 + D2 | `SessionPage.jsx` + `Canvas3D.jsx` + DB `drone_programs` | Moyenne |
| **H — Dettes techniques** | TC1 + DCO1 + VX1 + AU1 + INI1 + INI2 + TOK1 + MAP1 + COM14 + DASH1 | divers | Basse |
| **I — Affichage dégâts drone** | DMG1 + DMG2 | `socketCombatResolution.js` | SR ✅ — validation fonctionnelle requise |
| **K — Chat** | CH1 | `SessionPage.jsx` | Haute — sprint persistance séparé |
| **N — UI combat** | COM20 + COM21 + COM23 + FEAT3 | `Canvas3D.jsx` + `CombatActionWindow.jsx` | Moyenne / Haute |
| **P — Drones v2** | DR2 + DR7 + DR8 + DR9 + DR10 | `DroneWindow.jsx` + `socketCombatResolution.js` + DB | Moyenne |
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

## Bugs drone — Cluster G

### ~~Bug D1~~ ✅ CLOS — Menu radial "fiche" drone : rien ne s'ouvre

**Clos Session 124** — Cause racine confirmée et corrigée (mismatch type string/number `character_id`). Fiche drone s'ouvre correctement via le menu radial.

---

### ~~Bug D2~~ ✅ CLOS — Token drone : changement de GLB non fonctionnel

**Clos Session 124** :
- Token 3D : rechargement automatique via `key={glbUrl}` L.248 Canvas3D + `updateCharacter` dans `handleGlbUpload` — opérationnel depuis fix D1 (find drone dans characters maintenant fonctionnel)
- Notification upload : `glbStatus` (null|uploading|success|error) dans SettingsTab + timer ref cleanup + `glbSuccess/glbError` i18n + label coloré avec transition

---

### Bug CL3 — Ghosts de déplacement d'annonce disparus

**Symptôme** : Les marqueurs visuels ("ghosts") indiquant la destination de déplacement annoncée ne s'affichent plus sur la carte pendant la phase ANNOUNCEMENT.

**Code impliqué** : `CombatOverlay.jsx` — `announcementMarker` state + rendu des ghosts. `SessionPage.jsx` — handler `COMBAT_ACTION_DECLARED`.

**Cause racine** [HYPOTHÈSE] : `announcementMarker` est toujours alimenté côté `SessionPage.jsx`. Régression probablement dans le rendu — vérifier si la condition d'affichage du ghost a été modifiée lors des sessions 88-91.

**Prochaine étape** : Lire `CombatOverlay.jsx` — rechercher `announcementMarker` et la condition de rendu du ghost.

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

### Bug COM7 — Multi-attaque CaC : duplicata / "Déclarer" grisé

**Symptôme** : L'option "multi-attaque" CaC semble un duplicata de "Attaque multiple". Quand sélectionnée, le bouton "Déclarer" reste grisé (fonctionnalité non implantée ?).

**Règle à vérifier** : §6.2 MANUELSYSCOMBAT — attaque multiple melee.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — `meleeAttackCount` / `meleePendingMode`. Guard `canDeclare`.

**Prochaine étape** : Audit règles Polaris §6.2 — si identiques, supprimer le duplicata. Sinon corriger `canDeclare`.

---

### Ajout COM9 — Viser une Localisation précise — non implémenté

**Symptôme** : Dans `CombatModifiersWindow`, aucune option ne permet de viser une localisation précise. Le D20 de localisation est toujours aléatoire.

**Règle** : LdB §"Viser une Localisation précise" — Corps −3 / Jambes −5 / Tête+Bras −7.

**Code impliqué** :
- `CombatModifiersWindow.jsx` — section manquante + state `aimedLocation` absent
- `socketCombatResolution.js` — pas de champ `aimedLocation` dans `confirmedModifiers`, pas de bypass du D20

**Prochaine étape** : Sprint dédié — NE PAS bricoler dans un autre sprint.

---

### Bug COM11 — Assaut tir : multi-attaque non implémenté

**Symptôme** : Pas d'option pour déclarer plusieurs attaques à distance sur cibles distinctes. L'équivalent CaC (`meleeTargetIds[]`) existe, pas la version tir.

**Cause racine** [INCONNU] : Le payload `mapActions.attack` ne supporte qu'une cible (`attackTargetId` scalaire). `resolveAssaultAction` ne boucle pas sur plusieurs cibles.

**Code impliqué** : `CombatGmDeclareWindow.jsx`, `CombatActionWindow.jsx` — AssaultRangedPanel. `resolveAssaultAction` serveur.

**Prochaine étape** : Sprint dédié post-stabilisation panneaux partagés.

---

### Bug COM16 — Phase ANNONCE : traits liaison attaquant↔cible disparaissent

**Symptôme** : Les traits visuels reliant attaquant à sa cible déclarée disparaissent au fur et à mesure des déclarations.

**Code impliqué** : `CombatOverlay.jsx` ou `SessionPage.jsx` — rendu des annotations de déclaration.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster F — lire `CombatOverlay.jsx` + handler `COMBAT_ACTION_DECLARED` dans `useCombatSocket.js`.

---

### Bug COM18 — Roster PNJ : déclaration état initial arme/posture absente côté GM

**Symptôme** : Le joueur peut déclarer l'état initial (arme au clair, posture) avant son slot. L'équivalent pour les PNJ GM n'existe pas dans `CombatGmDeclareWindow`.

**Cause racine** [INCONNU] : Fonctionnalité non implémentée côté GM.

**Code impliqué** : `CombatGmDeclareWindow.jsx` — section état initial PNJ absente.

**Prochaine étape** : Cluster E — identifier le composant joueur gérant la déclaration initiale, le porter dans `CombatGmDeclareWindow`.

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

## Bugs UI combat — Cluster N

### Bug COM20 — Phase 1 : arme affichée sans munition dans la fenêtre de déclaration

**Symptôme** : En phase ANNONCE, la fenêtre de déclaration PJ/PNJ n'affiche pas l'arme courante équipée, les munitions restantes ni le type d'arme (compétence liée).

**Code impliqué** : `CombatActionWindow.jsx` + `CombatGmDeclareWindow.jsx` — section affichage arme absente ou incomplète.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster N — lire les deux composants, identifier où et comment afficher l'arme.

---

### Bug COM21 — Collision tokens : deuxième token bloqué sans feedback

**Symptôme** : Deux tokens déclarant un déplacement vers la même case — le deuxième ne peut pas s'y rendre. Pas de feedback visible côté client.

**Code impliqué** : `socketToken.js` ou pipeline déplacement — validation collision.

**Cause racine** [INCONNU] : La règle est peut-être déjà appliquée serveur (rejet silencieux). Feedback client absent.

**Prochaine étape** : Cluster N — vérifier si refus collision existe en serveur, puis ajouter feedback client.

---

### Bug COM23 — Label token : pénètre dans les murs

**Symptôme** : Le label nom affiché au-dessus du token peut s'afficher à l'intérieur des murs selon l'angle de caméra.

**Code impliqué** : `Canvas3D.jsx` — rendu label `<Html>` drei. Piste : `occlude` prop non activée ou position Y trop faible.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster N — lire rendu label HTML dans Canvas3D.

---

### FEAT3 — Token actif : cercle de sélection (surbrillance)

**Besoin** : Le token dont c'est le tour doit apparaître en surbrillance (cercle ou halo) sur la carte 3D.

**Code impliqué** : `Canvas3D.jsx` — rendu token actif. `activeTokenId` disponible dans le store combat.

**Prochaine étape** : Sprint dédié — ajouter cercle/halo R3F sous le token actif (ex: `<mesh>` disc avec `emissive`).

---

### Bug DR7 — Drone : le propriétaire ne peut pas modifier la fiche

**Symptôme** : Le joueur propriétaire d'un drone ne peut pas modifier sa fiche dans DroneWindow (champs grisés ou refusés).

**Code impliqué** : `DroneWindow.jsx` — guard d'édition. Routes REST drone — vérification `role === 'gm'`.

**Cause racine** [INCONNU] : Guard trop restrictif (`gm` uniquement) — propriétaire non autorisé.

**Prochaine étape** : Cluster P — lire DroneWindow + route REST drone.

---

### Bug DR8 — Drone : munitions arme infinies (jamais décrémentées)

**Symptôme** : Les armes des drones ne consomment pas de munitions lors des attaques. Probablement lié au fait que la propriété GM (Bug DR7) et de l'option de campagne PNJ=munition infinie

**Code impliqué** : `losService.js` — `_spendAmmo`. `socketCombatResolution.js` — `resolveDroneAssaultAction`.

**Cause racine** [INCONNU] : Probablement pas de branche drone dans `_spendAmmo`.

**Prochaine étape** : Cluster P — lire `_spendAmmo` + `resolveDroneAssaultAction`.

---

### Bug DR10 — Drone contrôlé par joueur : GM reçoit aussi la fenêtre de contrôle

**Symptôme** : Quand un joueur contrôle un drone, le GM reçoit aussi la fenêtre de déclaration et peut agir dessus. Le GM devrait avoir une vue lecture uniquement.

**Code impliqué** : `DroneWindow.jsx` ou `CombatGmDeclareWindow.jsx` — condition d'affichage GM vs joueur propriétaire.

**Cause racine** [INCONNU] : Non investigué.

**Prochaine étape** : Cluster P — lire DroneWindow + CombatGmDeclareWindow.

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

## Nouvelles fonctionnalités

### FEAT1 — Map2D (style Roll20)

**Besoin** : Affichage alternatif 2D de la carte (vue du dessus) en complément de la vue 3D existante.

**Prochaine étape** : Sprint dédié — spécifier l'interface (toggle 2D/3D, rendu canvas 2D, synchronisation tokens).
