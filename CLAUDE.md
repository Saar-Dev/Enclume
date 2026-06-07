# CLAUDE.md — Projet Enclume
> Dernière mise à jour : 2026-06-06 Session 83

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
| Règles LdB Polaris (CaC, tir, actions, déplacements) | `docs/SYSTEME/REGLES_LdB.md` |
| Ambiguïtés identifiants, termes RPG | `docs/GLOSSAIRE.md` |
| Nouvelles strings UI dans composant React | Convention i18n — voir `## Convention i18n` ci-dessous |
| Fenêtres combat, classes CSS, visuels | `client/src/index.css` Section 11 — modifier là, pas dans le composant |

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
- Fin de session : mettre à jour `client/public/CHANGELOG.md` — version = numéro de session (ex: `## v66 — date — titre`)
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

1. `docs/JOURNAL3.md` — lire depuis le **dernier** en-tête `## Session N` jusqu'à la fin du fichier (dernier bloc uniquement — pas un nombre de lignes fixe)
2. `docs/ASBUILT.md` — snapshot stable actuel
3. `docs/EN_COURS.md` — prochaine étape exacte
4. `docs/SYSTEME/` — lire le(s) fichier(s) thématique(s) concerné(s) par le chantier (voir tableau ci-dessus)
5. `docs/GLOSSAIRE.md` — si ambiguïté sur un identifiant ou terme RPG

Règle absolue : **CODE (mémoire externe) > conversation en cours.**
Toute décision non documentée est considérée comme nulle.

---

## État actuel — Session 83 (2026-06-06)

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **74 migrations stables** — prochaine : **75**
- Chantiers terminés : 9A–9E ✅ / 9F-0/A/B/C ✅ / Dice Rework ✅ / Chantier 10 sprint 1+2+3+4+5 ✅ / Chantier 11 sprint 1+2 ✅ / PC22 ✅ / Sprint 2.5 ✅ / Sprint 4 ✅ / Sprint 4.1 ✅ / Sprint 5 ✅ / Sprint 6 ✅ / Sprint 7.1 ✅ / Sprint 7.2 ✅ / Sprint 7.3 ✅ / Sprint 7.4 ✅ / Sprint 7.4bis ✅ / Sprint 7.5 ✅ / Sprint 7.6 ✅ / Sprint GM ✅ / Sprint GM-A ✅ / Sprint GM-B ✅ / D20 normales GLB ✅ / DicePanel v3 ✅ / Sprint Pathfinding ✅ / Sprint Raycast ✅ / PLAN13 Jets Favoris ✅ / Sprint i18n Option B ✅ / Sprint CaC 1 ✅ / Sprint CaC 2 ✅ / Sprint CaC 3 ✅ / Déploiement Kiwi ✅ / Sprint Token par défaut campagne ✅ / Sprint Timeline BG3 ✅ / Sprint CaC 4a ✅ / Sprint Bibliothèque 1 ✅ / Sprint Token Radial 1 ✅ / Sprint Optimisation Voxels Phase A ✅ / Sprint Optimisation Voxels Phase B ✅ / Sprint Statuts Phase 1 ✅ / Sprint Bibliothèque 2 ✅ / Sprint Annonce v2 ✅ / Sprint Rework Design ✅ / Sprint Drones 1bis ✅ / Migration 74 fix_ref_skills ✅

**Session 74 — EN ATTENTE VALIDATION :**
- **Sprint CaC 4b — Attaque multiple** : malus −5/−7 (LdB p.218), UI PJ séquentielle, GM queue étendue, N rows melee server — codé, non validé fonctionnellement

**Session 81 ✅ :**
- **Bug ammo_remaining** : migration 70 backfill + `resolveAmmoInit` serveur (3 routes) + fix `isAmmoEmpty` client ✅
- **Bug crash écran noir** : `setMeleePendingTokenIds` (3 occurrences corrigées dans `CombatActionWindow.jsx`) ✅
- **Sprint Annonce v2** : batch GM supprimé, appels directs, ghost déplacement + ligne assaut pour spectateurs, mini-panneau déclarant, timeline `isDimmed` ✅
- **S1 GM** : roster PNJ collapsible localStorage dans `CombatGmDeclareWindow` ✅
- **S2** : ligne déplacement bleu + label token Billboard/Text au-dessus destination (`Canvas3D`) ✅
- **S1 PJ** : roster multi-personnage dans `CombatActionWindow`, architecture multi-token, fix violation hooks `useDraggable` ✅
- **S3 Live Preview GM** : `COMBAT_ANNOUNCE_PREVIEW` — in-memory Map serveur, relay room, sync SESSION_JOIN, debounce 150ms PJ, panneau monitoring GM ✅

**Session 81 suite — EN ATTENTE VALIDATION :**
- **Sprint Test de Choc** : migration 69 `shock_auto_stun`, option campagne, bouton GM "Appliquer l'étourdissement", helper `applyStunStatus` + connexion `token_statuses`, `COMBAT_END` cleanup badges, fix GM voit dégâts PJ→PNJ — codé, non validé fonctionnellement

**Session 83 ✅ :**
- **Sprint Rework Design** : 9 composants combat + `index.css` — styles JS inline → classes CSS système. 27 tokens `--combat-*`, Section 11 COMBAT WINDOW SYSTEM. `C.red`/`C.green` conservés hex (template literals `${accent}55`). ✅
- **Sprint Drones 1bis** : migration 73 (drone_programs ALTER + seed 34 logiciels ref_equipment family='Logiciels'), char-sheet.js 4 routes drone (fix 5 champs + profondeur_max/disponibilite + catégorie serveur + validation ordinateur), DroneSheet.jsx réécriture (DISPLAY_GROUPS + optgroups + tooltip + mode catalogue/custom), fr.json nettoyé. Déployé Kiwi ✅

**Serveur Alpha "Kiwi" :** `http://89.92.219.211:8193` — voir `docs/SERVEURDISTANTKIWI.md`

**"Changer le mode de tir" — non implémenté.** Sprint dédié futur.

**Prochain chantier :**
- **Sprint CaC 4b — Validation** : tester attaque multiple melee (Session 74 codé, non validé)
- **Harmonisation boutons d'attaque** : CaC vs Tir — extension fenêtre, sélection cible, validation selon acteur (PNJ/PJ) et type d'assaut — sprint dédié
- **Sprint Token Radial 2** : wounds array complet dans anneau, secteur Jet (jets favoris), secteur Recharger (ammo_remaining live), portée d'arme (anneaux concentriques)
- **Sprint Bibliothèque 3** : upload PDF sécurisé (analyse sécurité préalable requise — voir JOURNAL3 Session 80)
- **Sprint Test de Choc — Durée** : `stunned_until_turn: current_turn + 1d6` remplace `is_stunned: true`, `endTurn` expire les stuns + retire badge `token_statuses`, `is_unconscious: true` flag séparé
- **Sprint Test de Choc — Enforcement (PC42)** : guard `is_stunned` dans `COMBAT_ACTION_DECLARE` — −5 compétence, allure max moyenne, ne peut pas attaquer
- D2 Jets Favoris : drag-to-reorder macros (sort_order en DB, UI non implémentée)
- **Notification entité interactive** — sablier joueur au-dessus de l'entité + bouton rouge GM dans chat
- **Persistance du chat** — sprint dédié futur

**Bug ouvert :**
- Surprise critique (roll=1) → initiative=1 (agit en dernier). À analyser.

**Dettes actives :**
- `useDiceAudio.js` — sons impact dés
- `.gitattributes:3` — attribut invalide
- `is_stunned` settable + badge `token_statuses` connecté (session 81) mais non enforced — `COMBAT_ACTION_DECLARE` ne lit pas le flag → PC42 (voir SYSTEME/COMBAT.md)
- `is_stunned` sans durée — flag persistant jusqu'à `COMBAT_END` ; durée réelle LdB = 1d6 tours → sprint `stunned_until_turn` requis
- WorkshopPage écran blanc sur import invalide — `err.response?.data?.error` objet AppError → crash React
- Kiwi P-SRV-5 — ports Docker non restreints à 127.0.0.1 (UFW contourné par Docker)
- `onTokenRotate` dead code dans Canvas3D/Scene (signatures + prop SessionPage) — nettoyage sprint futur
- `getVoxelSurfaceTop` — pas de cas pour `slope`/`wedge` (default `v.y+1.0` acceptable tant que ces géométries sont inactives)
- Sprint Annonce v2 — fenêtre GM : CombatActionWindow PJ et CombatGmDeclareWindow PNJ doivent afficher les actions du déclarant précédent en lecture seule (suite architecture)

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

---

## Convention i18n — Localisation

**Règle : jamais de string UI hardcodée dans un composant React.**
Toute chaîne visible par l'utilisateur passe par `useTranslation`.

**Pattern obligatoire :**
```js
import { useTranslation } from 'react-i18next'
const { t } = useTranslation()   // dans le composant
{t('section.cle')}               // dans le JSX
```

**Source unique :** `client/src/locales/fr.json` — ajouter la clé **avant** de l'utiliser dans le code.
Structure : `"section": { "cle": "valeur" }` → usage : `t('section.cle')`.

**État session 66 :** ~18 fichiers wired. Combat (12) + équipement (6) : hors scope — sprint i18n dédié futur. SkillTooltips : roadmap.

**Convention CSS (Session 76) :**
- Tout bouton → `className="btn"` ou variante (`.btn-ghost`, `.btn-danger`, `.btn-gold`, `.btn-icon`, `.btn-toggle`, `.btn-tool`)
- Tout badge → `className="badge badge-gm"` etc.
- Inline `style={}` = UNIQUEMENT layout/position calculé (width, flex, margin, top...) — jamais de visuel (background, border, color, font)
- Valeurs visuelles dynamiques → CSS custom property : `style={{ '--sidebar-w': '300px' }}`
- Les classes sont définies dans `index.css` Section 10 — modifier une classe = modifier partout

**Ajouter EN plus tard (Option C) :**
1. Créer `client/src/locales/en.json` (même structure que fr.json)
2. `i18n.js` : `import en` + `resources: { fr, en }` + `supportedLngs: ['fr', 'en']`
3. Ajouter sélecteur de langue dans l'UI (sidebar ou page profil)
