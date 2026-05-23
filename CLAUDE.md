# CLAUDE.md — Projet Enclume
> Dernière mise à jour : 2026-05-23 Session 60

---

## ⚠️ PROTOCOLE OBLIGATOIRE

Ce n'est pas une liste de recommandations. Chaque point est le résultat d'une erreur réelle.

### Avant de proposer quoi que ce soit
- Lire les 4 documents de la section "Lecture obligatoire" en entier
- Confirmer chaque lecture : *"Fichier [nom] lu. Voici ce que j'ai trouvé : [...]. Puis-je continuer ?"*

### Avant de coder
- Lire le(s) fichier(s) concerné(s) — **jamais de mémoire**
- Expliquer le plan exact : lignes concernées, ce qui change, ce qui ne change pas
- Poser **"Je code ?"** une seule fois quand le plan est complet — pas avant
- Relire le fichier produit en entier avant de livrer
- Attendre la confirmation fonctionnelle avant l'étape suivante

### Après chaque tâche confirmée fonctionnelle
- Appender `docs/JOURNAL2.md`
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

1. `docs/JOURNAL2.md` — 100 dernières lignes en priorité absolue
2. `docs/ASBUILT.md` — snapshot stable actuel
3. `docs/EN_COURS.md` — prochaine étape exacte
4. `docs/SYSTEME.md` — flux, ownership, pièges détaillés

Règle absolue : **CODE (mémoire externe) > conversation en cours.**
Toute décision non documentée est considérée comme nulle.

---

## État actuel — Session 62 (2026-05-23)

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **56 migrations stables** — prochaine : **57**
- Chantiers terminés : 9A–9E ✅ / 9F-0/A/B/C ✅ / Dice Rework ✅ / Chantier 10 sprint 1+2+3+4+5 ✅ / Chantier 11 sprint 1+2 ✅ / PC22 ✅ / Sprint 2.5 ✅ / Sprint 4 ✅ / Sprint 4.1 ✅ / Sprint 5 ✅

**Session 62 — Sprint 5 : Serveur COMBAT_ACTION_DECLARE :**
- `server/src/socket/index.js` : COMBAT_ACTION_DECLARE rewrite — moveAction, KEY_MOD nettoyé, PC33, actionRows bulk (1 ligne/action, getSequence/getType), modifiers:{ini_mod} par ligne
- `server/src/socket/index.js` : COMBAT_SURPRISE_RESULT + skipPlayer + startResolutionPhase — fix INSERTs colonnes droppées (migration 56)
- Validé ✅

**Prochain chantier :**
- Sprint 6 — Phase Résolution (startResolutionPhase complet + COMBAT_ACTION_CONFIRM + endTurn)

**Bug ouvert :**
- Surprise critique (roll=1) → initiative=1 (agit en dernier). À analyser : ordre tri INI vs sémantique roll surpris.

**Dettes actives :**
- D10 UV texturing V2 — modèle Blender .glb (PE33)
- `useDiceAudio.js` — sons impact dés
- `.gitattributes:3` — attribut invalide
- Timer auto-skip (`action_timer_sec > 0`) — prévu Sprint 2, reporté Sprint 3

---

## Pièges critiques — non-évidents uniquement

Pièges complets dans `docs/SYSTEME.md`. Ceux-ci sont les plus fréquemment oubliés.

**P1 — token.owner_id est mort**
Ne jamais utiliser `token.owner_id`. Toujours : `token.character_id → characters.user_id`.

**P3 — socket dans les dependency arrays**
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.

**P4 — ordre de déclaration React**
Si callback A appelle callback B → A déclaré APRÈS B. Violation → ReferenceError silencieux.

**P13 — updated_at après le guard Object.keys**
`updates.updated_at = db.fn.now()` toujours APRÈS `if (Object.keys(updates).length === 0)`.

**P25 — MinIO avant base**
Toujours écrire dans MinIO en premier, puis en base. Jamais l'inverse.

**P40 — battlemapRef pattern**
Ref miroir d'un state/prop pour lecture stable dans `useCallback`/`useFrame` sans l'inclure dans les deps. Utilisé pour `tokensRef`, `ghostRef`, `targetRef`.

**PE14 — coordonnées entités : pos_y/pos_z inversés**
`pos_y` en base = profondeur (Z Three.js). `pos_z` en base = altitude (Y Three.js).
```js
// Pose (Three.js → base) :
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }
```

**PE27 — moveType : double calcul obligatoire**
Client calcule `moveType` par dot(AE, AD) → envoie dans payload.
Serveur recalcule indépendamment — source de vérité. Discordance → refus silencieux.

**PE28 — collision map Redis : voxels convertis en PE14**
`voxel_data` stocke Three.js brut. Redis stocke PE14. Conversion dans `buildCollisionMap`/`add`/`remove` :
```js
const [vx, vy, vz] = key.split(':').map(Number)
const pe14Key = `${vx}:${vz}:${vy}`
```

**PE29 — acteur step-by-step vérifié à pos_z+1**
`token.pos_z` = altitude des pieds = même niveau que sol. Vérifier `pos_z+1` = espace de marche.

**PE31 — upsertCharacter : guard visible+isGm**
Si `!character.visible && !state.isGm` → retirer du store. Le broadcast envoie l'objet complet — le store reproduit le filtre.

**PE32 — DiceMesh useMemo deps : dieType obligatoire**
`[geoDef.type, color, dieType]` — D10 a 3 types (`d10`, `d10_units`, `d10_tens`) avec matériaux différents.

**PE33 — D10 UV kite = V2 Blender uniquement**
Ne pas tenter de calculer les UVs kite en code pur. V1 = Html overlay `position={[0,0,0]}` — ne pas déplacer.

**PE34 — Altitude pieds token en Three.js**
`token.pos_z + 0.5` = centre du voxel (l'overlay serait à l'intérieur). `token.pos_z + 1.0` = surface sol = pieds.
Pour un overlay au sol : `token.pos_z + 1.0 + 0.05` (évite z-fighting).

**PI1 — Container 'Sac' conditionnel**
Disponible seulement si le character possède ≥1 item `ref_equipment.location='D'` dans son inventaire. Idem 'Ceinture' → `location='Ce'`. 'Coffre' toujours disponible. Vérifier avec `isContainerAvailable()` avant tout POST/PUT.

**PI2 — Équipement (slot ≠ null) → container forcé 'Sac'**
Si `slot` demandé et 'Sac' indisponible → 400. Ne jamais silencieusement forcer 'Coffre'. Pattern : slot prend la priorité sur container dans le même PUT.

**PI3 — Items équipés comptés dans le poids**
`slot IS NOT NULL` ne signifie pas "hors du sac". Container reste 'Sac', poids toujours compté. Le filtre `container != 'Coffre'` est la seule exclusion de poids.

**PI4 — FOR nette pour l'encombrement**
`calcEncumbrancePenalty` requiert `base_level + pc_modifier` de `char_attributes WHERE attr_id='FOR'`, pas seulement `base_level`.

**PI5 — Items manuels (equipment_id null) exclus du poids**
`ref_weight` est null → `item.ref_weight == null` → skip dans la réduction poids.

**P49 — Promotion blessures : rechargement complet obligatoire**
Si `res.data.promoted === true`, le serveur a supprimé toute la ligne source.
Toujours `GET /wounds` complet — jamais `setWounds(prev => [...prev, wound])` sur une promotion.

**P50 — toggle Polaris : ne jamais dupliquer charSkills dans un sous-composant**
Tout sous-composant qui lit ET modifie `charSkills` doit recevoir la liste en props et émettre via callback.
Stocker une copie locale → changements non propagés → SkillsPanel jamais mis à jour.

**P51 — Malus Polaris : non-cumulatif santé, cumulatif encombrement**
Malus état de santé (blessures, fatigue, maladies) : pire seul retenu — `calcWoundPenalty` retourne déjà le minimum.
Malus encombrement (règle maison) : s'additionne.
```js
effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)  // ≤ 0
chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus
```
Ne jamais cumuler deux sources de malus santé. Ne jamais appliquer le malus sur un attribut — toujours sur le total du jet.

**PI6 — LOCATION_TO_SLOT : codes indépendants par localisation**
`bras_gauche:'BG'`, `bras_droit:'BD'`, `jambe_gauche:'JG'`, `jambe_droite:'JD'` — pas de partage B/J.
Équiper à une localisation n'équipe que celle-ci. `availableItems` utilise `refCode` (SLOT_TO_REF_LOCATION) pour compat ref_location.
La Pagan `ref_location='B'` est disponible dans TOUS les panels (BG et BD), mais s'équipe per-location.

**PI7 — refCode vs slotCode dans LocationPanel**
`slotCode` : code unique de la localisation (BG/BD/JG/JD) — utilisé pour `equippedItems` et `handleEquip/Unequip`.
`refCode` : code compat pour `ref_location` lookup (B/J) — utilisé uniquement pour `availableItems` filter.
Confusion → items non disponibles ou multi-location mal géré.

**PI8 — POST handler : LIKE query pour multi-slot**
Serveur POST `/inventory` : WHERE clause doit utiliser LIKE `'/' || COALESCE(slot,'') || '/' LIKE '%/CODE/%'`.
Ancien `WHERE slot = code` ne trouve pas items multi-slot → 1+S+S check silencieusement broken pour multi-couches.

**PI9 — Format erreur serveur : objet imbriqué**
`errorHandler.js` envoie `{ error: { status, message } }`. Dans les catch Axios :
```js
err.response?.data?.error?.message  // ✓ string
err.response?.data?.error           // ✗ objet → crash React si rendu en JSX
```
Toujours finir par `.message` quand on extrait le message d'erreur.

**PI10 — seed 2_seed_equipment.js après migration 53**
Ne jamais rejouer `2_seed_equipment.js` après la migration 53 — réinsérerait les 636 anciens noms sans erreur (pas de UNIQUE sur `ref_equipment.name`). Doublons silencieux.

**PI11 — polarisRound : source unique shared/polarisUtils.js**
Ne jamais redéfinir `polarisRound` localement. Import obligatoire : `'../../../shared/polarisUtils.js'`.
Toute copie locale (const, function) est interdite — erreur de code si trouvée lors d'une review.

**PC27 — Entité ≠ PNJ**
`!token.character_id` = Entité de décor (porte, console) — jamais un PNJ.
PNJ = `character.type === 'pnj'`. Entité exclue du combat (`continue` dans COMBAT_START).
`characters.type` enum `'pj'|'pnj'` — extensible (`'vehicle'`, `'drone'`). Source de vérité unique.

**"La Forêt Maudite"**
Pas de `default_battlemap_id` → ne jamais utiliser pour les tests.

---

## Conventions de communication

- **SR** = Serveur Redémarré sans erreur. Si erreur → copier intégralement.
- **Run à vide** = pause de vérification sans instruction. Fortement encouragé.
- `JOURNAL2.md` en append. Tous les autres docs en remplacement complet.
- Félicitations ≠ validation. Toujours vérifier le fonctionnel avant de documenter stable.
- **Simuler la session avant de coder** — identifier les pièges, fichiers manquants, dépendances cachées.
- **Pour tout composant UI : inventaire exhaustif avant "Je code ?"** — lister chaque élément interactif (bouton, checkbox, input) avec son handler. Chaque ligne sans handler = trou visible. Confirmation du plan = "cet inventaire est-il complet par rapport aux specs ?"
