# EN COURS — Travail en cours / incomplet
> Dernière mise à jour : 2026-04-28 Session 39

---

## Phase 0 — ✅ Complète
## Phase 1 — ✅ Complète
## Phase 2 — En cours

### Chantier 9A — Refonte voxel ✅
### Chantier 9B — Interface CRUD texture packs ✅
### Chantier 9C — Système entités interactables ✅
### Chantier 9D — Atelier du GM ✅
### Chantier 9E — Entités en session ✅ (session 36)
### Chantier 9F-0 — Calcul serveur Polaris ✅ (session 36)
### Chantier 9F-A — Fondations mouvement ✅ (session 39)

Travaux effectués en session 39 :
- Migration 44 : colonne `r` sur `tokens` ✅
- Migration 45 : table `polaris_mr` + seed ✅
- `server/src/lib/redis.js` : client ioredis + helpers collision map ✅
- Collision map Redis : construction + maintenance complète ✅
- `TOKEN_ROTATE` : event + handler serveur + clic client ✅
- Affichage rotation token : `rotation.y = r * Math.PI / 4` ✅

---

## Prochaines tâches

### Chantier 9F-B — Déplacement entités (orthogonal)
Prérequis : 9F-A ✅
- `ENTITY_MOVE_REQUEST` + `ENTITY_MOVE_RESULT` dans `events.js`
- Handler serveur : validation, jet d'attribut via charStats.js, MR depuis polaris_mr, step-by-step, broadcast
- Atelier : champs `move_type` + `attribute_id` dans le formulaire interaction
- Client RadialMenu : tranche Déplacement (grisée si hors portée)
- Client mode visée : ghost entité, snap 4 axes, clic destination
Voir PLAN_ENTITY.md §8

### Chantier 9F-C — Diagonal + animation
Prérequis : 9F-B
Voir PLAN_ENTITY.md §9

---

## Bugs connus toujours ouverts

### Bug WebGL — Context Lost au switch play/edit
Cause : Three.js r160+ + drivers GPU Windows. Non bloquant. Statut : documenté, abandonné.

### Bug A — Toggle visible character non répercuté en temps réel
Statut : 🔲 correction prévue session dédiée.

### Bug B — Modification faces voxel existant non exposée dans l'UI
Statut : 🔲 correction prévue si besoin.

---

## Points de vigilance permanents

- **"La Forêt Maudite"** — pas de `default_battlemap_id` → ne jamais utiliser pour les tests
- **token.owner_id** — mort → toujours `character_id → characters.user_id`
- **socket dans dependency arrays** — tout useCallback qui émet doit inclure socket (P3)
- **ordre déclaration React** — callback A qui appelle B doit être déclaré APRÈS B (P4, P48)
- **coordonnées voxel** — données brutes en base, +0.5 uniquement dans le rendu visuel
- **reconnectTrigger** — ne jamais appeler socket.disconnect/connect depuis Sidebar
- **PE14 pos_y/pos_z** — pos_y base = Z Three.js, pos_z base = Y Three.js
- **charStats.js** — fonctions pures, jamais d'accès DB dans ce fichier
- **redis.js** — maintenance Redis dans REST (POST/DELETE), pas dans handlers WS reliques (PE25)
- **resolveEntityState** — returning doit inclure battlemap_id (PE26)
- **collisionMoveToken** — hdel systématique ancienne case, hset conditionnel layer (PE24)
