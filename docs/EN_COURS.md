# EN COURS — Travail en cours / incomplet
> Dernière mise à jour : 2026-04-22 Session 34

---

## Phase 0 — ✅ Complète
## Phase 1 — ✅ Complète
## Phase 2 — En cours

### Chantier 9A — Refonte voxel ✅
### Chantier 9B — Interface CRUD texture packs ✅
### Chantier 9C — Système entités interactables ✅
### Chantier 9D — Atelier du GM ✅
### Chantier 9E — Entités en session 🔲

Travaux effectués en session 34 :
- Bug 9D (blueprints palette éditeur) ✅ corrigé
- Textures entités ✅ (fix pack_id dans JOIN)
- Icône ⚙ cliquable et stable ✅
- RadialMenu ✅ nouveau composant
- EntityInstancePanel ✅ nouveau composant (header draggable)
- Flux interaction joueur → arbitrage GM → changement d'état ✅ (partiel)

---

## Bugs ouverts — priorités session 35

### Bug S34-1 — Changement d'état non visible sans F5 — PRIORITÉ 1
**Symptôme :** Après une interaction réussie (arbitrage GM validé), `current_state_id` est mis à jour en base (confirmé par requête directe), `ENTITY_UPDATED` est émis par le serveur, mais l'entité ne change pas d'apparence visuellement sans F5. Le problème est intermittent : fonctionne sur une instance, pas sur une autre du même blueprint.
**Cause confirmée partielle :** `ENTITY_UPDATED` est reçu et `updateEntity` est appelé dans le store. La réactivité visuelle de `EntityMesh` sur `entity.current_state_id` doit être vérifiée.
**Cause à confirmer :** Vérifier que `updateEntity` dans `entityStore.js` met bien à jour l'objet entité dans le tableau `entities[]` avec le nouveau `current_state_id`. Vérifier que `EntityMesh` reçoit le nouvel objet entité (référence différente) et recalcule `currentState`.
**Fichiers à uploader et lire :** `client/src/stores/entityStore.js`, `client/src/components/EntityMesh.jsx` (déjà relu — relire résolution `currentState`), `client/src/components/Canvas3D.jsx` handler `handleEntityUpdated`.

### Bug S34-2 — Jet de dés lancé sans compétence — PRIORITÉ 2
**Symptôme :** Jet `null (2d10) vs DC1` affiché dans le chat même quand `skill_id` est null sur l'interaction.
**Cause identifiée :** Dans `socket/index.js` handler `ENTITY_ACTION_RESOLVE`, aucun guard sur `pending.skillId` avant la branche jet.
**Correction à faire :** Ajouter en tête de la branche jet : `if (!pending.skillId) { await resolveEntityState(...); return }`.
**Décision :** Si `skill_id` est null/vide → pas de jet, `resolveEntityState` directement (succès automatique).
**Fichier à modifier :** `server/src/socket/index.js` — uploader en début de session.

### Bug S34-3 — Formule de jet : 2d10 au lieu de 1d20 — PRIORITÉ 2
**Symptôme :** Le jet affiché utilise 2d10. Le système Polaris utilise 1d20.
**Cause identifiée :** Formule codée en dur dans `socket/index.js` handler `ENTITY_ACTION_RESOLVE`.
**Correction à faire :** Remplacer la formule de jet par `1d20`.
**Fichier à modifier :** `server/src/socket/index.js` — même fichier que Bug S34-2, corriger en même temps.

### Bug S34-4 — GM auto-approve non implémenté — PRIORITÉ 3
**Symptôme :** Quand le GM clique sur une interaction d'entité, rien ne se passe (le radial ne s'ouvre pas, ou s'ouvre mais l'action n'est pas exécutée directement).
**Décision :** Quand le GM déclenche une interaction, l'état change immédiatement sans arbitrage, sans traçage dans le chat.
**Architecture à décider avant de coder :** Deux options :
  - Option A : Nouvel event WS `ENTITY_ACTION_GM_DIRECT` → serveur appelle directement `resolveEntityState` → broadcast `ENTITY_UPDATED`.
  - Option B : Appel REST direct `PUT /entities/:entityId` avec `current_state_id` + broadcast WS depuis la route.
  Note : `PUT /entities/:entityId` dans `entities.js` n'émet pas de WS actuellement — il faudrait l'ajouter pour l'option B.
**Décision à prendre en début de session 35** avant de coder.
**Fichiers concernés :** `client/src/pages/SessionPage.jsx`, `server/src/socket/index.js` (option A) ou `server/src/routes/entities.js` (option B).

### Bug S34-5 — Notifications interactions dans le chat — PRIORITÉ 4
**Symptôme :** Les notifications d'actions en attente sont dans un onglet "Actions" de la Sidebar — non ergonomique.
**Décision :** Notifications dans le fil chat (message système) + bouton onglet "Chat" change de couleur (orange) quand une notification non lue est présente.
**Fichiers concernés :** `client/src/pages/SessionPage.jsx` handler `ENTITY_ACTION_PENDING`, `client/src/components/Sidebar.jsx` style onglet Chat.
**Fichiers à uploader :** `SessionPage.jsx`, `Sidebar.jsx`.

### Bug S34-6 — Détection ⚙ difficile — PRIORITÉ 5
**Symptôme :** Malgré hitbox ×1.4 et timer 400ms, l'icône ⚙ est difficile à atteindre à angle rasant. La détection cesse parfois de fonctionner pendant plusieurs minutes.
**Cause angle rasant :** L'icône est positionnée au-dessus de l'entité (`height/2 + 0.4`). En montant le curseur vers l'icône, on sort de la hitbox avant de l'atteindre. Le timer aide mais la distance peut être trop grande selon l'angle.
**Cause arrêt intermittent :** Non identifiée. Nécessite investigation dans le comportement de `onPointerEnter`/`onPointerLeave` en R3F avec le `<Html>` drei.
**Piste :** Augmenter le timer à 600-800ms. Ou ajouter une zone de détection séparée (mesh transparent) qui englobe à la fois l'entité et la zone au-dessus où l'icône apparaît.
**Fichier à modifier :** `client/src/components/EntityMesh.jsx`.

---

## Bugs connus antérieurs toujours ouverts

### Bug WebGL — Context Lost au switch play/edit
**Cause :** Three.js r160+ + drivers GPU Windows. Non bloquant. **Statut :** documenté, abandonné.

### Bug A — Toggle visible character non répercuté en temps réel
**Statut :** 🔲 correction prévue session dédiée.

### Bug B — Modification faces voxel existant non exposée dans l'UI
**Statut :** 🔲 correction prévue si besoin.

---

## Prochaines tâches hors bugs

| Priorité | Tâche | Notes |
|---|---|---|
| — | Géométries entités : door + trapdoor | `door` = surface plane verticale, `trapdoor` = horizontale — même modèle géométries voxels |
| — | Favicon client/public/favicon.svg | Fichier présent, non référencé dans index.html |
| — | Interactions — déplacement/rotation entité | Action → déplacement pos ou rotation r (porte coulissante) |
| — | SkillCheck WS `/sc` | Jet côté serveur, résolution PE1 |
| — | Export ZIP pack — inclure blueprints | Blueprints JSON dans `entites/` + GLB dans `glb/` |

---

## Points de vigilance permanents

- **"La Forêt Maudite"** — pas de `default_battlemap_id` → ne jamais utiliser pour les tests
- **token.owner_id** — mort → toujours `character_id → characters.user_id`
- **socket dans dependency arrays** — tout useCallback qui émet doit inclure socket (P3)
- **ordre déclaration React** — callback A qui appelle callback B doit être déclaré APRÈS B (P4, P48)
- **coordonnées voxel** — données brutes en base, +0.5 uniquement dans le rendu visuel
- **reconnectTrigger** — ne jamais appeler socket.disconnect/connect depuis Sidebar
- **voxel_data format base** — `{ "x:y:z": { "tex": N, "geo": "cube", "r": 0 } }`
- **voxel_data format mémoire** — `{ "x:y:z": { x, y, z, tex, geo, r } }`
- **voxel_data save()** — `payload[key] = { tex: v.tex, geo: v.geo, r: v.r }`
- **voxel_textures.id** — integer auto-incrémenté (P22)
- **blocksReady gate** — `true` même si 0 textures (P26)
- **battlemap?.voxel_data dans les deps** — Canvas3D doit réagir aux saves de l'éditeur
- **battlemapRef pattern** — saveFireAndForget utilise une ref miroir
- **setBattlemap après save** — obligatoire pour que Canvas3D voie les nouveaux voxels sans F5
- **socket.data.role** — stocker au SESSION_JOIN pour ciblage GM (PE2)
- **JWT régénéré** — users.js le régénère si username/email change
- **Serveur seul émetteur WS** — ne jamais remettre de socket.emit post-REST côté client
- **updated_at dans les PUT** — après le guard Object.keys (P13)
- **glb_url** — toujours avec `?v=<timestamp>` pour cache busting useGLTF (P19)
- **mat.clone()** — obligatoire avant mutation dans clonedScene (P20)
- **chemins MinIO textures** — `textures/<pack_uuid>/` (P43)
- **name du pack immuable** — jamais dans PUT /texture-packs/:id (P44)
- **PE14 pos_y/pos_z** — pos_y base = Z Three.js, pos_z base = Y Three.js
- **PE11 fallback states[0]** — si current_state_id invalide
- **entity_blueprints.geometry.faces** — chemins PNG strings (PEF1-PEF6)
- **entityTextureMaterials** — indexé par blueprint.id UUID, séparé de textureMaterials voxels
- **pack_id sur blueprint embarqué** — doit être dans le SELECT du JOIN (P47)
- **blueprintIds dans deps Canvas3D** — jamais `entities` directement (référence instable Zustand)
