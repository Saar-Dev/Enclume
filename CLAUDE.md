# CLAUDE.md — Projet Enclume
> Session 112 — 2026-06-20

---

## RÈGLES ABSOLUES

CODE > conversation. Jamais travailler de mémoire. Lire les fichiers.
1. Lire le fichier concerné avant toute proposition.
2. Confirmer la lecture : *"Fichier [nom] lu. Trouvé : [...]. Continuer ?"*
3. Plan exact avant de coder — lignes touchées, ce qui change, ce qui ne change pas.
4. "Je code ?" une seule fois, plan complet.
5. Relire le fichier produit en entier avant livraison.
6. Confirmation fonctionnelle obligatoire avant étape suivante.
7. **Un seul bug à la fois.** Plan pour un bug → validation → bug suivant. Jamais deux bugs dans le même plan.
8. **Reprise depuis un résumé = nouvelle session.** Exécuter le protocole complet sans exception.

---

## PROTOCOLE

### Début de session
> **Reprise depuis un résumé = nouvelle session — le résumé ne remplace jamais la lecture.**

- `docs/EN_COURS.md` → si la prochaine étape n'est pas claire depuis `## ÉTAT COURANT` ci-dessous.
- `docs/ASBUILT.md` → si la tâche touche à l'architecture (nouvelles routes, migrations, nouveaux services).
- `docs/JOURNAL5.md` (dernier `## Session N` uniquement) → si un bug précis nécessite l'historique d'une décision.
- **Fichiers domaine → chargés automatiquement** via `.claude/rules/` quand les fichiers source sont ouverts.

### Avant de coder
- Lire les fichiers concernés. Jamais de mémoire.
- Plan exact : lignes touchées, ce qui change, ce qui ne change pas.
- "Je code ?" une seule fois.
- Pour tout composant UI : inventaire exhaustif (chaque bouton/input/handler) avant "Je code ?".

### Pendant le développement
- **Run à vide autocentré obligatoire** à la fin de chaque étape.
- **Sessions analytiques (audit, investigation, debug) :** utiliser `docs/JOURNALTEMP.md` comme scratch pad. Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

### Après chaque tâche confirmée fonctionnelle
- Appender `docs/JOURNAL5.md`.
- Mettre à jour le header date de tout fichier `.md` modifié.
- Proposer un scénario de test (étapes + résultat attendu) avant de passer à la suite.
- Fin de session : mettre à jour `EN_COURS.md`, `ASBUILT.md`, `ROADMAP.md`, `CLAUDE.md`.
- Fin de session : mettre à jour `client/public/CHANGELOG.md` — `## vN — date — titre`.
- Rappeler le push Git :
```powershell
git add .
git commit -m "Session N — ..."
git push origin master
```

### Fermeture de bug
Toute clôture ✅ exige :
- **Testé :** [ce qui a été vérifié]
- **Non testé :** [ce qui reste] → si non vide : `⚠️ clos partiel`

### Jamais
- Coder sans confirmation.
- Réécrire un fichier sans l'avoir relu dans cette session.
- Avancer sans confirmation fonctionnelle.
- Écrire "probablement / suppose / certainement" sur une cause non lue → `[INCONNU]` + `[DBG-X]`.
- Proposer un plan couvrant plusieurs bugs simultanément → un seul bug par plan.
- Traiter un résumé de conversation comme substitut à la lecture obligatoire des fichiers.

---

## DÉTECTEUR DE DÉRIVE

→ "rapide / suppose / probablement / certainement / évidemment / je pense que / devrait" → STOP. Tous les fichiers lus ?
→ Diagnostic de cause racine sans lecture de code → STOP. `[INCONNU]` + `[DBG-X]`.
→ Fermer un bug sans "Testé / Non testé" → STOP.
→ "Je code ?" pour la 2e fois sur le même sujet → STOP. Plan complet → code directement.
→ Question de diagnostic console F12 → STOP. Lisible dans le code source ?
→ Créer événement WS / composant / fonction → STOP. Existe déjà ?
→ Implémenter mécanique de combat → STOP. `docs/REGLESYSCOMBAT.md` lu dans cette session ?
→ Conversation reprise depuis un résumé → STOP. Protocole début de session complet avant toute proposition.
→ Plan mentionnant deux bugs ou plus → STOP. Un bug à la fois.

---

## PROJET

Enclume — VTT maison. Sessions privées 4–8 joueurs, Raspberry Pi 4.
Stack : React 19 + Vite / Node.js + Express + Socket.io / PostgreSQL + Redis + MinIO / Three.js R3F / Zustand / JWT httpOnly.
Monorepo : `client/` + `server/` + `shared/` + `docs/`.
Démarrage : `.\start.ps1` depuis `Enclume/`. Vérification : `http://localhost:3001/api/health` + `http://localhost:5173`.
Git — toujours depuis `Enclume/`, jamais depuis `server/` ou `client/`.
Serveur Alpha "Kiwi" : `http://89.92.219.211:8193` — voir `docs/SERVEURDISTANTKIWI.md`.

**Nomenclature docs :**
| Préfixe | Rôle |
|---|---|
| `docs/SYSTEME/*.md` | Spécifications techniques d'implémentation (lire sur demande via rules) |
| `docs/REGLE*.md` | Sources de vérité règles Polaris (LdB) — source absolue |
| `docs/MANUEL*.md` | Synthèse technique des règles (séquences, pipeline) |
| `docs/PLAN_*.md` | Planifications réalisées ou en cours |
| `docs/ARCHI_REWORK.md` | Bible des reworks actifs |
| `docs/ARCHI_REWORK_DONE.md` | Specs complètes des reworks achevés |
| `.claude/rules/*.md` | Règles domaine — chargées automatiquement (path-scoped) |

---

## ÉTAT COURANT — Session 112 (2026-06-20)

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **81 migrations stables** (80 = combat_pending, 81 = combat_state.sub_phase — REWORK-04)

**Session 111 ✅ clos complet (REWORK-04 : FSM Combat) :**
- `server/src/lib/combatFSM.js` créé — 4 fonctions pures (`canTransition`, `nextState`, `setFSMSubPhase`, `allowedEvents`), table TRANSITIONS 6 états
- Migrations 80 (`combat_pending`) + 81 (`combat_state.sub_phase`) appliquées
- `socketCombat.js` : guards `canTransition` (10 handlers) + 3 Maps in-memory → DB
- `statusService.applyStun` : `pendingStunActions` Map retiré → `combat_pending` DB
- `index.js` : SESSION_JOIN restaure prompts sur reconnexion RESOLUTION (C3)
- `combatStore.js` + `useCombatSocket.js` : `subPhase` propagé (C1+C2)
- `node --check` ×4, build client ✅
- Prochaine étape : sprint suivant (bugs actifs — voir EN_COURS.md)

**Session 112 ✅ clos complet (FEAT2-A + FEAT2-C + COM12 + COM13) :**
- `losUtils.js` créé — `checkLOS()` pure, `fast-voxel-raycast`, PE14 — eye height `pos_z+2.5`
- Menu radial : secteur "Vue" actif + `losMode` / `losResult` dans SessionPage
- Scene : ray 3D `<line>` natif (vert/rouge) + callback `onLosResult`
- Bug eye height corrigé : `pos_z+0.75` → `pos_z+2.5` (pieds + 1.5, token 2-cases)
- COM12 ✅ : `CombatGmDeclareWindow` + `CombatActionWindow` — reset `fire_mode` si invalide pour l'arme équipée
- COM13 ✅ : `CombatActionWindow` — `computeFireVariant` + `{ defaultCcCount: 1 }` → "Tir simple" débloqué sans re-clic
- FEAT2-C ✅ : `useCameraLOS.js` réécrit — service complet (feature-as-service) — Canvas3D.jsx : 1 appel hook, zéro logique LOS
- Caméra "épaule droite" fonctionnelle — P-LOS13 résolu (`justHandledTargetRef` dans le service)
- SR + fonctionnel confirmé

**Session 109 ✅ clos complet (triage docs + housekeeping) :**
- JOURNAL5.md créé — JOURNAL4.md archivé dans docs/Old/
- ARCHI_REWORK.md : 969 → ~100 lignes — specs achevées déplacées dans ARCHI_REWORK_DONE.md
- ARCHI_REWORK_DONE.md : REWORK-09 spec ajoutée + 2 DoD items ✅
- BUGIDENTIFIE.md : +FEAT1 (Map2D style Roll20) + FEAT2 (LOS raycast cible)
- EN_COURS.md : REWORK-08 ✅ clos + REWORK-04 ajouté prochaine étape architecture
- docs/Old/ : 4 plans archivés (REWORK_CONTACT, PLAN_ARCHICOMBAT_SLOTS, PLAN_DRONE, PLAN_DRONESYSCOMBAT)
- ASBUILT.md : mise à jour Sessions 102–108 ✅
- WS1 ✅ clos — WorkshopPage 5 catch handlers (`err.response?.data?.error || err.response?.data?.message || err.message`)
- REWORK-10 scénarios 1–8 ✅ validés (confirmation Saar) — UI1 clos complet
- REWORK-03 tests ✅ validés (confirmation Saar) — clos complet
- Prochaine étape : **REWORK-04 (FSM Combat)** — spec à rédiger avant tout code

**Session 108 ✅ clos complet (REWORK-08 Étapes 6 & 7) :**
- `socketCombat.js` créé (13 handlers + 13 helpers + 7 constantes) — `registerCombatHandlers(io, socket, context, pendingMaps)`
- `index.js` : 2994 → 143 lignes — imports nettoyés, handlers combat supprimés, disconnect → SESSION_JOIN
- `node --check` ×2, `npm run build`, SR ok, scénarios 1–17 validés ✓
- REWORK-08 archivé dans ARCHI_REWORK_DONE.md — ARCHI_REWORK.md : ✅ Clos complet
- **[R8-3] Fuite Maps combat disconnect** — pendingMaps non nettoyées si PJ déco en résolution → sprint dédié

**Session 108b ✅ clos complet (REWORK-08 Étape 5 + correctifs entités) :**
- REWORK-08 Étape 5 : `server/src/socket/socketEntity.js` créé (~766 lignes) — 7 handlers + `resolveEntityState` helper module-level
- `registerEntityHandlers(io, socket, context, pendingEntityActions)` dans SESSION_JOIN — bloc entités `index.js` supprimé
- Bug 1 ✅ gm_only : filtre Canvas3D + broadcast WS via nouveau `socket.on(ENTITY_UPDATED)` serveur + prop socket EntityInstancePanel
- Bug 2 ✅ delete : bouton suppression EntityInstancePanel + REST DELETE + socket emit + store
- Bug 3 ✅ sablier : `useEntitySocket` clear `pendingEntityId` sur `DICE_RESULT type=entity_action` (échec jet non géré)
- **Prochaine étape : REWORK-08 Étape 6 (planification) — lire `ARCHI_REWORK.md` §REWORK-08 + index.js L.1464–2744**

**Session 107 ✅ clos complet (planning) :**
- REWORK-08 : Étape 4 corrigée (mrTable singleton-promise + imports socketDice) + Étape 5 planifiée complète (`docs/ARCHI_REWORK.md` §REWORK-08)
- Étape 4 : bug QueryBuilder Knex → `.then(r => r)` fix, [R8-12] imports charStats confirmés, [R8-13] CHARACTER_UPDATED relique
- Étape 5 (socketEntity) : 6 écarts Interface cible corrigés [R8-14], table substitution ×14/×5/×5/×5/×5/×2, pièges gm_only/socket.id/pending.campaignId documentés
- Recherche Socket.IO : risque Maps combat sans cleanup disconnect → [R8-3] mis à jour, sprint dédié post-REWORK-08

**Session 106c ⚠️ clos partiel (REWORK-10) :**
- REWORK-10 : `DeclareLogContent` intégré dans le tab chat de `Sidebar.jsx` (haut zone messages, collapsible, GM + joueurs)
- Ancienne approche sidebar fixe gauche (`CombatDeclareLogSidebar` dans `CombatOverlay`) abandonnée — rejetée après test
- SR ok, fonctionnel confirmé — scénarios 1–8 non testés (pas de session combat)
- Dead code : `CombatDeclareLogSidebar` (default export `CombatDeclareLog.jsx`) + classes `.cdl-window*` — à nettoyer sprint futur
- Prochaine étape secondaire : valider scénarios 1–8 (plan archivé par Saar — historique dans docs/Old/JOURNAL4.md)

**Session 106 ✅ clos complet (planning) :**
- REWORK-08 : Étapes 1, 2, 3 auditées et enrichies (`docs/ARCHI_REWORK.md` §REWORK-08)
- Étape 2 (socketToken) : imports corrigés (×2), substitution table complète, [R8-7] documenté
- Étape 3 (socketVoxel) : imports corrigés, MAP_SWITCH détaillé (3 occurrences), [R8-8 à R8-11] documentés
- `socketUtils.js` vérifié — `checkTokenOwnership` confirmé (`role === 'gm'`)

**Session 105 ✅ clos complet (planning) :**
- REWORK-08 : spec complet rédigé + validé (`docs/ARCHI_REWORK.md` §REWORK-08) — 7 étapes, prêt à coder
- Architecture validée : `registerXxxHandlers(io, socket, context)` = pattern officiel Socket.IO v4
- Fix singleton-promise intégré dans la spec `mrTable.js` (race condition résolue)
- Bug INI2 ajouté (`BUGIDENTIFIE.md`) — initiative non recalculée après blessure

**Session 104 ✅ clos complet :**
- Réorganisation docs : `.claude/rules/` (9 fichiers path-scoped) + CLAUDE.md allégé (216 → ~175 lignes)

**Session 103 ✅ clos complet :**
- REWORK-09 : `SessionPage.jsx` 1509 → 1296 lignes — `useTokenSocket.js` + `useEntitySocket.js` + `useCombatSocket.js`
- Fix TDZ découvert en test (hooks après tous les useState) — scénarios 1–8 validés

**Session 101 ✅ clos complet :**
- REWORK-02 : `damageService.resolveTargetHit` — 4 sites (DAMAGE_CONFIRM + MELEE_DEFENSE_CONFIRM + resolveDroneAssaultAction 8b + resolveAssaultAction PNJ) + `LOC_TABLE` → `armorConstants.js`

**Session 100 ✅ clos complet :**
- REWORK-07 : `socketUtils` — `getUserColor` (6 call sites) + `checkTokenOwnership` (4 call sites) + `LOC_TABLE_CONTACT` supprimé

**Session 97 ✅ clos complet :**
- REWORK-03 : `woundService.applyWound` — 5 call sites WS centralisés + fix DIV-1 (`worst_wound_severity` dans WOUND_ADDED)

**Dettes actives :**
- **Résiduel split-brain** — `COMBAT_STATE_SYNC` reconnexion RESOLUTION — sprint futur
- Bug CL3 — Ghosts déplacement d'annonce disparus
- "Changer le mode de tir" — non implémenté — sprint futur
- `useDiceAudio.js` — sons dés
- `.gitattributes:3` — attribut invalide
- Kiwi P-SRV-5 — ports Docker non restreints à 127.0.0.1
- `onTokenRotate` dead code Canvas3D/Scene
- `getVoxelSurfaceTop` — pas de cas slope/wedge
- Sprint Annonce v2 — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- Surprise critique (roll=1) → initiative=1 — à analyser

---

## PIÈGES CRITIQUES

**P1 — token.owner_id mort**
→ Toujours : `token.character_id → characters.user_id`.

**PE14 — coordonnées entités pos_y/pos_z inversés**
`pos_y` DB = profondeur (Z Three.js). `pos_z` DB = altitude (Y Three.js).
```js
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }  // Three.js → DB
```

**BUG C — weapon_inv_id ≠ item_id**
`ref_equipment_skill_assoc.item_id` FK → `ref_equipment.id`, pas `char_inventory.id`.
Pattern : `weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id`.
Erreur → skillTotal = 0, assaut toujours raté.

**P51 — effectiveMalus formule exacte**
```js
effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)  // ≤ 0
chancesDeReussite = skillTotal + totalDiffMod + effectiveMalus
```

**PC27 — Entité ≠ PNJ**
`!token.character_id` = entité de décor. PNJ = `character.type === 'pnj'`.

**P3 — socket dans les dependency arrays**
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.

**[R8-27] — socket.campaignId / socket.role dépendance implicite post-REWORK-08**
`socket.campaignId` et `socket.role` restent settées dans SESSION_JOIN. Les helpers de `socketCombat.js` (`resolveMeleeAction`, `resolveReloadAction`, `COMBAT_MELEE_DEFENSE_CONFIRM`) les utilisent via `io.fetchSockets()` pour retrouver des sockets tiers. Supprimer ces deux lignes de SESSION_JOIN casse le CaC PJ↔PJ silencieusement.

---

## CONVENTIONS

**Communication :**
- SR = Serveur Redémarré sans erreur. Si erreur → copier intégralement.
- Félicitations ≠ validation.

**CSS (Session 76) :**
- Bouton → `className="btn"` ou variante (`.btn-ghost`, `.btn-danger`, `.btn-gold`, `.btn-icon`, `.btn-toggle`, `.btn-tool`)
- Badge → `className="badge badge-gm"` etc.
- `style={}` = layout/position calculé uniquement (width, flex, margin, top) — jamais visuel.
- Valeurs visuelles dynamiques → CSS custom property.
- Classes dans `index.css` Section 10 — modifier une classe = modifier partout.

**i18n :**
- Aucune string UI hardcodée. Toujours `useTranslation` → `t('section.cle')`.
- Source unique : `client/src/locales/fr.json`. Ajouter la clé avant de l'utiliser.
- Combat (12) + équipement (6) : hors scope — sprint dédié futur.
