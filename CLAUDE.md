# CLAUDE.md — Projet Enclume
> Dernière mise à jour : 2026-05-25 Session 64

---

## 🔴 POURQUOI CETTE DOC EXISTE — LIRE EN PREMIER

Ce projet dure depuis 64+ sessions. Chaque piège documenté représente des **heures perdues** à déboguer un bug qui aurait été évité en lisant la doc.

**Session 64 — exemple concret de ce qu'il ne faut JAMAIS faire :**
> En codant `resolveAssaultAction` (Sprint 7.3), j'ai inventé un événement `COMBAT_ATTACK_RESULT` et ignoré `DICE_RESULT` + `ArmorWoundPanel` — pourtant documentés dans `docs/SYSTEME/`. J'avais "lu" mais pas **appliqué**. Résultat : des heures de boulot pour réimplémenter de zéro ce qui existait déjà.

**La doc n'est pas une formalité. C'est la mémoire externe du projet. CODE > conversation.**

---

## 🔴 MÉCANISME DE RELECTURE OBLIGATOIRE

**À chaque début de réponse qui implique du code ou une proposition technique :**

1. Demande-toi : "Ai-je relu le fichier SYSTEME/ concerné dans cette conversation ?"
2. Si non → **RELIS avant de continuer.**
3. **Si tu ne sais pas si tu dois relire → relis.**

**Checkpoints obligatoires :**
| Domaine touché | Fichier à lire |
|---|---|
| Dés, DICE_RESULT, DiceRoller | `docs/SYSTEME/DICE.md` |
| Blessures, armures, calculs malus | `docs/SYSTEME/BLESSURES.md` |
| Combat, resolveAssault, state_character | `docs/SYSTEME/COMBAT.md` |
| Tokens, entités, collision Redis, déplacement | `docs/SYSTEME/ENTITES.md` |
| Coordonnées 3D, voxels, PE14 | `docs/SYSTEME/VOXELS.md` |
| Auth, stores Zustand, événements WS | `docs/SYSTEME/CORE.md` |
| Hooks React, dependency arrays, lock éditeur | `docs/SYSTEME/REACT.md` |
| MinIO, faces entités, Atelier GM | `docs/SYSTEME/ASSETS.md` |
| Conventions, pièges §18-§19 | `docs/SYSTEME/CONVENTIONS.md` |
| Ambiguïtés identifiants, termes RPG | `docs/GLOSSAIRE.md` |

**Avant tout nouvel événement WS, composant, ou fonction utilitaire :**
→ Vérifier `shared/events.js`, `client/src/`, `server/src/lib/` — est-ce que ça existe déjà ?

---

## ⚠️ PROTOCOLE OBLIGATOIRE

Ce n'est pas une liste de recommandations. Chaque point est le résultat d'une erreur réelle.

### Avant de proposer quoi que ce soit
- Lire les documents de la section "Lecture obligatoire" en entier
- Confirmer chaque lecture : *"Fichier [nom] lu. Voici ce que j'ai trouvé : [...]. Puis-je continuer ?"*

### Avant de coder
- Lire le(s) fichier(s) concerné(s) — **jamais de mémoire**
- Expliquer le plan exact : lignes concernées, ce qui change, ce qui ne change pas
- Poser **"Je code ?"** une seule fois quand le plan est complet — pas avant
- Relire le fichier produit en entier avant de livrer
- Attendre la confirmation fonctionnelle avant l'étape suivante

### Pendant le développement
- **Run à vide autocentré OBLIGATOIRE** à la fin de chaque étape : s'arrêter, évaluer l'état réel du code, les risques, les dépendances cachées, avant de passer à l'étape suivante.

### Après chaque tâche confirmée fonctionnelle
- Appender `docs/JOURNAL3.md`
- Fin de session : mettre à jour `EN_COURS.md`, `ASBUILT.md`, `ROADMAP.md`, `CLAUDE.md`
- **Rappeler le push Git** avec la commande complète

### Jamais
- Coder sans confirmation préalable
- Réécrire un fichier sans l'avoir relu dans cette session
- Passer à l'étape suivante sans confirmation fonctionnelle

---

## DÉTECTEUR DE DÉRIVE

Si tu t'apprêtes à écrire *"rapide", "suppose", "probablement", "certainement", "évidemment", "je pense que", "devrait"* →
**STOP. As-tu lu tous les fichiers concernés ? Si non → demander le fichier.**

Si tu t'apprêtes à poser "Je code ?" pour la deuxième fois sur le même sujet →
**STOP. Le plan est complet ? Si oui → code directement. Si non → une seule question ciblée.**

Si tu t'apprêtes à poser une question de diagnostic en console F12 →
**STOP. La réponse est-elle lisible dans le code source ? Si oui → demander le fichier.**

Si tu t'apprêtes à créer un nouvel événement WebSocket, un nouveau composant, ou une nouvelle fonction utilitaire →
**STOP. Est-ce que ça n'existe pas déjà ? Vérifier `shared/events.js`, `client/src/`, `server/src/lib/` avant de créer quoi que ce soit.**

---

## Le projet

Enclume — VTT maison, alternative à Roll20. Sessions privées 4–8 joueurs, Raspberry Pi 4.
Stack : React 19 + Vite / Node.js + Express + Socket.io / PostgreSQL + Redis + MinIO / Three.js R3F / Zustand / JWT cookie httpOnly.
Monorepo : `client/` + `server/` + `shared/` + `docs/`.

**Démarrage :** `.\start.ps1` depuis `Enclume/`
**Vérification :** `http://localhost:3001/api/health` + `http://localhost:5173`

**Git — toujours depuis `Enclume/`, jamais depuis `server/` ou `client/` :**
```powershell
git add .
git commit -m "Session N — ..."
git push origin master
```

---

## Lecture obligatoire — dans cet ordre, en entier

1. `docs/JOURNAL3.md` — 100 dernières lignes en priorité absolue
2. `docs/ASBUILT.md` — snapshot stable actuel
3. `docs/EN_COURS.md` — prochaine étape exacte
4. `docs/SYSTEME/` — lire le(s) fichier(s) thématique(s) concerné(s) par le chantier (voir tableau ci-dessus)
5. `docs/GLOSSAIRE.md` — si ambiguïté sur un identifiant ou terme RPG

Règle absolue : **CODE (mémoire externe) > conversation en cours.**
Toute décision non documentée est considérée comme nulle.

---

## État actuel — Session 65 (2026-05-27)

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **58 migrations stables** — prochaine : **59**
- Chantiers terminés : 9A–9E ✅ / 9F-0/A/B/C ✅ / Dice Rework ✅ / Chantier 10 sprint 1+2+3+4+5 ✅ / Chantier 11 sprint 1+2 ✅ / PC22 ✅ / Sprint 2.5 ✅ / Sprint 4 ✅ / Sprint 4.1 ✅ / Sprint 5 ✅ / Sprint 6 ✅ / Sprint 7.1 ✅ / Sprint 7.2 ✅ / Sprint 7.3 ✅ / Sprint 7.4 ✅ / Sprint 7.4bis ✅ / Sprint 7.6 ✅ / Sprint GM ✅ / Sprint GM-A ✅ / D20 normales GLB ✅

**Session 65 — Sprint 7.6 ✅ CONFIRMÉ :**
- combatSections.js : STATE_DEFS 5 états + matrices coût, calcIniDelta, MAP_ACTIONS multi-select, QUICK_ACTIONS incrémentaux
- CombatActionWindow v2 : StateSelector segmented control, blocs TACTIQUE/ARMEMENT/ACTION/RAPIDES, QB, payload v2
- socket/index.js : COMBAT_ACTION_DECLARE v2, matrices STATE_COSTS, UPDATE state_*, endTurn reset colonnes
- CombatGmDeclareWindow : adapté v2 (MAP_ACTIONS/QUICK_ACTIONS, emit v2)
- Migration 58 : state_cover / state_fire_mode / state_vitesse sur combat_roster

**Session 65 — Sprint GM + Sprint GM-A ✅ CONFIRMÉS :**
- CombatGmDeclareWindow : réécriture complète (InlineChip click-to-cycle, batch mode, STATE_DEFAULTS, roster intégré)
- combatSections.js : tooltips LdB + label reperer corrigé, slider GM affiche coût INI réel
- CombatRosterWindow v2 : détection arme/armure pré-combat, chips T/C/B/J PJ/PNJ, quick-equip GM-only, bannière alerte
- battlemaps.js : GET /:id/combat-equipment
- char-sheet.js : POST /:characterId/quick-equip (GM-only, bypass container)
- equipment.js : +location dans GET /equipment SELECT

**Session 65 — D20 normales GLB ✅ CONFIRMÉ :**
- `DiceMesh.jsx` : branche D20 dédiée (IcosahedronGeometry) supprimée → D20 passe par `faceNormal` → `D20_GLB_NORMALS`
- `diceMath.js` : `D20_GLB_NORMALS` — 20 normales Blender exactes, clés = numéros réels du dé (remapping par test visuel, validation antipodal dot=-1.000 ✓)
- Piège : remapping permutation → toujours utiliser la direction inverse (`new[X] = old[inverse[X]]`, pas `old[mapping[X]]`)

**"Changer le mode de tir" — non implémenté.** Sprint dédié futur.

**Prochain chantier :**
- Sprint GM-B — Déplacement PNJ (onEnterMoveMode depuis CombatOverlay, moveSelection per-PNJ)
- Sprint 7.5 — Décompte munitions

**Bug ouvert :**
- Surprise critique (roll=1) → initiative=1 (agit en dernier). À analyser.

**Dettes actives :**
- D10 UV texturing V2 — modèle Blender .glb (PE33)
- `useDiceAudio.js` — sons impact dés
- `.gitattributes:3` — attribut invalide
- Timer auto-skip (`action_timer_sec > 0`) — prévu Sprint 2, reporté Sprint 3

---

## Pièges critiques — 6 non-évidents les plus dangereux

Pièges complets dans `docs/SYSTEME/CONVENTIONS.md`. Ces 6 causent les bugs les plus silencieux.

**P1 — token.owner_id est mort**
Ne jamais utiliser `token.owner_id`. Toujours : `token.character_id → characters.user_id`.

**PE14 — coordonnées entités : pos_y/pos_z inversés**
`pos_y` en base = profondeur (Z Three.js). `pos_z` en base = altitude (Y Three.js).
```js
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }  // Three.js → base
```

**BUG C — weapon_inv_id ≠ item_id pour ref_equipment_skill_assoc**
`ref_equipment_skill_assoc.item_id` est FK vers `ref_equipment.id`, **pas** `char_inventory.id`.
Pattern obligatoire : `weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id`.
Erreur → skillTotal = 0, CDR trop faible, assaut toujours raté.

**P51 — effectiveMalus : formule exacte**
```js
effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)  // ≤ 0
chancesDeReussite = skillTotal + totalDiffMod + effectiveMalus
```
Jamais cumuler deux malus santé. Jamais appliquer sur un attribut — toujours sur le total.

**PC27 — Entité ≠ PNJ**
`!token.character_id` = Entité de décor — **jamais un PNJ**.
PNJ = `character.type === 'pnj'`. Entité exclue du combat. Ne pas confondre.

**P3 — socket dans les dependency arrays**
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps. Absence → emit silencieux.

---

## Conventions de communication

- **SR** = Serveur Redémarré sans erreur. Si erreur → copier intégralement.
- **Run à vide** = pause de vérification sans instruction. Fortement encouragé.
- `JOURNAL3.md` en append. Tous les autres docs en remplacement complet.
- Félicitations ≠ validation. Toujours vérifier le fonctionnel avant de documenter stable.
- **Simuler la session avant de coder** — identifier les pièges, fichiers manquants, dépendances cachées.
- **Pour tout composant UI : inventaire exhaustif avant "Je code ?"** — lister chaque élément interactif (bouton, checkbox, input) avec son handler. Confirmation du plan = "cet inventaire est-il complet par rapport aux specs ?"

**"La Forêt Maudite"** — pas de `default_battlemap_id` → ne jamais utiliser pour les tests.
