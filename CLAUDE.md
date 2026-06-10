# CLAUDE.md — Projet Enclume
> Session 87 — 2026-06-10

---

## RÈGLES ABSOLUES

CODE > conversation. Jamais travailler de mémoire. Lire les fichiers.
1. Lire le fichier SYSTEME/ concerné avant toute proposition (TABLE DE ROUTING).
2. Confirmer la lecture : *"Fichier [nom] lu. Trouvé : [...]. Continuer ?"*
3. Plan exact avant de coder — lignes touchées, ce qui change, ce qui ne change pas.
4. "Je code ?" une seule fois, plan complet.
5. Relire le fichier produit en entier avant livraison.
6. Confirmation fonctionnelle obligatoire avant étape suivante.

---

## TABLE DE ROUTING — fichier à lire selon domaine touché

| Domaine | Fichier |
|---|---|
| Dés, DICE_RESULT, DiceRoller | `docs/SYSTEME/DICE.md` |
| Blessures, armures, calculs malus | `docs/SYSTEME/BLESSURES.md` |
| Combat, resolveAssault, state_character | `docs/SYSTEME/COMBAT.md` |
| Règles mécaniques Polaris — source absolue | `docs/REGLESYSCOMBAT.md` |
| Spec technique combat (séquences, pipeline, modificateurs) | `docs/MANUELSYSCOMBAT.md` |
| Bugs architecture combat identifiés | `docs/BUGIDENTIFIE.md` |
| Tokens, entités, collision Redis, déplacement | `docs/SYSTEME/ENTITES.md` |
| Coordonnées 3D, voxels, PE14 | `docs/SYSTEME/VOXELS.md` |
| Auth, stores Zustand, événements WS | `docs/SYSTEME/CORE.md` |
| Hooks React, dependency arrays, lock éditeur | `docs/SYSTEME/REACT.md` |
| MinIO, faces entités, Atelier GM | `docs/SYSTEME/ASSETS.md` |
| Conventions, pièges §18-§19 | `docs/SYSTEME/CONVENTIONS.md` |
| Règles LdB Polaris (CaC, tir, actions, déplacements) | `docs/SYSTEME/REGLES_LdB.md` |
| Ambiguïtés identifiants, termes RPG | `docs/GLOSSAIRE.md` |
| Nouvelles strings UI React | Convention i18n — voir §CONVENTIONS |
| Fenêtres combat, classes CSS | `client/src/index.css` Section 11 |

Avant tout nouvel événement WS, composant, ou fonction utilitaire :
→ vérifier `shared/events.js`, `client/src/`, `server/src/lib/` — existe déjà ?

---

## PROTOCOLE

### Début de session
1. `docs/JOURNAL4.md` — dernier `## Session N` uniquement (jusqu'à fin fichier).
2. `docs/ASBUILT.md` — snapshot stable.
3. `docs/EN_COURS.md` — prochaine étape exacte.
4. `docs/SYSTEME/` — fichiers thématiques concernés (TABLE DE ROUTING).

### Avant de coder
- Lire les fichiers concernés. Jamais de mémoire.
- Plan exact : lignes touchées, ce qui change, ce qui ne change pas.
- "Je code ?" une seule fois.
- Pour tout composant UI : inventaire exhaustif (chaque bouton/input/handler) avant "Je code ?".

### Pendant le développement
- **Run à vide autocentré obligatoire** à la fin de chaque étape.
- **Sessions analytiques (audit, investigation, debug) :** utiliser `docs/JOURNALTEMP.md` comme scratch pad de session. Appender progressivement (analyses, verdicts, plans partiels). Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL4.md en fin de session.

### Après chaque tâche confirmée fonctionnelle
- Appender `docs/JOURNAL4.md`.
- Fin de session : mettre à jour `EN_COURS.md`, `ASBUILT.md`, `ROADMAP.md`, `CLAUDE.md`.
- Fin de session : mettre à jour `client/public/CHANGELOG.md` — `## vN — date — titre`.
- Rappeler le push Git :
```powershell
git add .
git commit -m "Session N — ..."
git push origin master
```

### Jamais
- Coder sans confirmation.
- Réécrire un fichier sans l'avoir relu dans cette session.
- Avancer sans confirmation fonctionnelle.

---

## DÉTECTEUR DE DÉRIVE

→ "rapide / suppose / probablement / certainement / évidemment / je pense que / devrait" → STOP. Tous les fichiers lus ?
→ "Je code ?" pour la 2e fois sur le même sujet → STOP. Plan complet → code directement.
→ Question de diagnostic console F12 → STOP. Lisible dans le code source ?
→ Créer événement WS / composant / fonction → STOP. Existe déjà ?
→ Implémenter mécanique de combat → STOP. `docs/REGLESYSCOMBAT.md` lu dans cette session ?

---

## PROJET

Enclume — VTT maison. Sessions privées 4–8 joueurs, Raspberry Pi 4.
Stack : React 19 + Vite / Node.js + Express + Socket.io / PostgreSQL + Redis + MinIO / Three.js R3F / Zustand / JWT httpOnly.
Monorepo : `client/` + `server/` + `shared/` + `docs/`.
Démarrage : `.\start.ps1` depuis `Enclume/`. Vérification : `http://localhost:3001/api/health` + `http://localhost:5173`.
Git — toujours depuis `Enclume/`, jamais depuis `server/` ou `client/`.
Serveur Alpha "Kiwi" : `http://89.92.219.211:8193` — voir `docs/SERVEURDISTANTKIWI.md`.

---

## ÉTAT COURANT — Session 87 (2026-06-10)

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **75 migrations stables** (76, 76b, 77, 77b planifiées — Sprint Drones 2+3)
- "Changer le mode de tir" — non implémenté. Sprint dédié futur.

**En attente de validation fonctionnelle :**
- Sprint CaC 4b (attaque multiple melee) — Session 74
- Sprint Test de Choc (migration 69, shock_auto_stun) — Session 81

**Session 87 — Audit PLAN_DRONESYSCOMBAT.md :**
- 25 issues analysées (V1–V25), 15 corrections appliquées au plan
- Architecture Sprint 2b : deux branches (PNJ→drone dans resolveAssaultAction, PJ→drone dans COMBAT_DAMAGE_CONFIRM)
- Décision V21 : Option C télépilotage (propriétaire déclare "Télépiloter" → drone status='done' ce round)
- Migration 77b ajoutée (state_control_mode sur combat_roster)
- Plan `docs/PLAN_DRONESYSCOMBAT.md` : **prêt pour implémentation**

**Dettes actives :**
- `is_stunned` non enforced dans `COMBAT_ACTION_DECLARE` → PC42
- `is_stunned` sans durée → sprint `stunned_until_turn` requis
- `useDiceAudio.js` — sons dés
- `.gitattributes:3` — attribut invalide
- WorkshopPage crash import invalide (`err.response?.data?.error`)
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
