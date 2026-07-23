# SYSTEME/CONVENTIONS.md — Règles immuables, pièges actifs §18+§19
> Mis à jour : 2026-07-22 — snapshot monde et environnement Ubuntu.
> Source : SYSTEME.md §18–§19
> Lire pour : tout nouveau code — vérifier que la convention appliquée est documentée ici

---

## §18 — Conventions non-négociables

- **UUID partout** — jamais `increments()` (sauf `voxel_textures.id` — P22)
- **Adaptateurs DB/monde** — `dbPositionToWorldPoint()` / `worldPointToDbPosition()` uniquement ;
  PE14 ne doit jamais être recodé inline
- **`WS.CONSTANTE` toujours** — jamais de chaîne en dur dans `socket.emit/on`
- **`knexfile.cjs`** en CommonJS — CLI Knex ne supporte pas ES Modules
- **Commande migrations portable :** depuis `server/`, `npx knex migrate:latest --knexfile knexfile.cjs`
- **Migrations format .js** — ES module avec `export const up/down`
- **`socket.data.role`** — stocker au SESSION_JOIN, pas `socket.role` (PE2)
- **`owner_id` tokens = mort** — ownership via `character_id → characters.user_id`
- **`updated_at = db.fn.now()` APRÈS le guard `Object.keys`** (P13)
- **`updated_at` jamais dans le JWT** (P14)
- **`glb_url` avec `?v=timestamp`** (P19)
- **`mat.clone()` avant mutation Three.js** (P20)
- **`fetch()` console F12 : URL absolue + credentials**
- **Calculs Polaris** — serveur calcule via `charStats.js`
- **`difficulty_dc`** — modificateur signé (-20 à +10, LdB p.404) — jamais une valeur absolue
- **`isSuccess` Polaris** — `diceRoll <= chancesDeReussite` — jamais `>=`
- **`charStats.js`** — fonctions pures, aucun accès DB — le caller fournit les données
- **`effectiveMalus`** — `calcWoundPenalty(wounds) − calcEncumbrancePenalty(weight, FOR)` — toujours ≤ 0. Appliqué sur le total du jet, jamais sur un attribut (P51)
- **`LOCATION_TO_SLOT` vs `SLOT_TO_REF_LOCATION`** — slotCode (BG/BD/JG/JD) pour les slots individuels, refCode (B/J) pour le lookup `ref_location` compat (PI7)
- **`pendingEntityActions Map` hors `initSocket`** — une seule instance
- **Positions runtime** — `position_space = 'world-feet'` ; convertir uniquement avec
  `dbPositionToWorldPoint()` / `worldPointToDbPosition()`
- **Collision et occupation** — `WorldSnapshot` + `createSpatialIndex()` +
  `createOccupancyIndex()` ; aucun hash Redis spatial
- **Déplacement forcé acteur/objet** — `executeBattlemapRigidPairMovement()` est autoritaire et le
  couple mobile s'exclut lui-même de l'occupation
- **`stepsMax`** — `Math.min(dmax, stepsTarget)` — destination joueur respectée
- **`resolveEntityState returning`** — doit inclure `battlemap_id` (PE26)
- **Lerp EntityMesh** — `useFrame` dans sous-composants (règle des hooks)
- **Logs debug `index.js`** — conservés volontairement, à retirer avant production
- **Dice Rework** — DiceRoller monté dans Canvas3D (pas en overlay HTML séparé) — un seul contexte WebGL
- **DiceMesh material `useMemo`** — deps `[geoDef.type, color, dieType]` — `dieType` requis pour D10 (3 types)
- **`DICE_RESULT` double consommation** — chat + animation parallèles, animation filtrée sur `!skillLabel`
- **`combat_actions.sequence`** — attribuée serveur (PC32) — jamais calculée côté client : moves=1, micro=2, assault=3
- **`fire_mode_bonus_dmg`** — appliqué uniquement en portée `bout_portant` / `courte` (pas en moyenne/longue/extrême)
- **`sortedRoster`** — toujours `[...roster].sort((a,b) => b.initiative - a.initiative)` avant d'indexer avec `activeSlotIdx` (PC29)
- **`surprise_roll`** — jamais dans le broadcast `COMBAT_STARTED` / `COMBAT_PHASE_CHANGED` (PC25)
- **Express 5 — routes sous-routeur** — toujours un `/` initial : `router.get('/:id/foo')` et non `router.get(':id/foo')`. Sans `/`, la route retourne 404 silencieusement sous Express 5 (PC41). Les anciennes routes sans `/` tolérées par Express 4 ne fonctionnent plus.

---

## §19 — Pièges actifs — référence rapide

| Code | Description | Fichier thématique |
|---|---|---|
| P13 | `updated_at = db.fn.now()` après guard Object.keys | CONVENTIONS.md |
| P14 | `updated_at` jamais dans le JWT | CORE.md |
| P17 | Séparateur voxel = `":"` NON NÉGOCIABLE | VOXELS.md |
| P19 | `glb_url` avec `?v=timestamp` obligatoire | ASSETS.md |
| P20 | `mat.clone()` avant mutation matériau Three.js | CONVENTIONS.md |
| P22 | `voxel_textures.id` = integer (exception UUID) | VOXELS.md |
| P26 | `blocksReady = true` même si 0 textures | VOXELS.md |
| P32 | Ordre faces BoxGeometry : east(0), west(1), top(2), bottom(3), south(4), north(5) | VOXELS.md |
| P33 | `side` = alias lecture seule — jamais écrire | CONVENTIONS.md |
| P38 | Raccourcis : `e.code` obligatoire | REACT.md |
| P40 | battlemapRef pattern — ref miroir pour callbacks stables dans useFrame | REACT.md |
| P43 | MinIO : `textures/<pack_uuid>/` jamais par `pack_name` | ASSETS.md |
| P44 | name du pack immuable | ASSETS.md |
| P46 | Route spécifique avant paramétrique | CONVENTIONS.md |
| P49 | Promotion blessures : `promoted===true` → GET /wounds complet — jamais append local | BLESSURES.md |
| P50 | toggle Polaris : ne jamais dupliquer `charSkills` — lift state up obligatoire | CONVENTIONS.md |
| P51 | Malus santé non-cumulatif (pire seul), encombrement cumulatif (règle maison) | BLESSURES.md |
| P52 | CLI knex trie les migrations par ordre lexical, pas par `knex_migrations` — round-trip up/down via import direct du module, jamais la CLI brute | CORE.md |
| P53 | nodemon réapplique les migrations à chaque écriture de fichier sous `server/` — scripts de vérif en `node -e` inline uniquement | CORE.md |
| P54 | Toujours vérifier `knex_migrations` avant un appel manuel à `up()`/`down()` — jamais deux `up()` sans `down()` entre les deux | CORE.md |
| P55 | Compétence réservée `(X)` : `isLearned` doit couvrir 3 cas (déblocage, bonus d'origine, `isPro`) — oublier `isPro` plante en `-Infinity` | COMBAT.md |
| P56 | `DICE_RESULT` ne porte jamais `dieType` — tout consommateur hors SessionPage doit le reconstruire lui-même | DICE.md |
| PE2 | `socket.data.role` pour `fetchSockets()` | CORE.md |
| PE4 | face null = invisible | ASSETS.md |
| PE11 | fallback `states[0]` si `current_state_id` invalide | ENTITES.md |
| PE12 | `clearTimeout pendingEntityActions` à la résolution | ENTITES.md |
| PE13 | touche R = ghost OU entité sous curseur | ENTITES.md |
| PE14 | `pos_y` base = Z Three.js, `pos_z` base = Y Three.js | VOXELS.md |
| PE16 | `e.code` pour Alt | REACT.md |
| PE17 | `usage_hint` = hint de tri, jamais exclusif | CONVENTIONS.md |
| PE18 | `blueprint.pack_id` nullable — guard obligatoire | ASSETS.md |
| PE21 | `r` tokens = 0-7 — `rotation.y = r * Math.PI / 4` | ENTITES.md |
| PE22 | mouvement rigide : `excludeOccupantIds = [tokenId, entityId]` dans l'index d'occupation | ENTITES.md |
| PE26 | `resolveEntityState` : `.returning()` doit inclure `battlemap_id` | ENTITES.md |
| PE27 | moveType calculé client (feedback) ET recalculé serveur (validation) | ENTITES.md |
| PE29 | acteur et objet validés pas à pas sur supports stables, barrières et occupants du snapshot | ENTITES.md |
| PE34 | token `world-feet` : `pos_z` est directement l'altitude Y de ses pieds | VOXELS.md |
| PC41 | Express 5 : routes sans `/` initial → 404 silencieux — toujours `'/:id/foo'` | CONVENTIONS.md |
| PEF1 | `pack_id` obligatoire sur blueprint | ASSETS.md |
| PEF2 | fakeTexObj : `{ id, pack_id, faces }` | ASSETS.md |
| PEF3 | `entityTextureMaterials` indexé par `blueprint.id` UUID | ASSETS.md |
| PEF4 | `face_overrides` = chemins PNG | ASSETS.md |
| PEF5 | blueprint sans `pack_id` → skip + magenta | ASSETS.md |
| PEF6 | Canvas3D : chargements voxels et entités séparés | ASSETS.md |
| PI1 | Container 'Sac' : dispo seulement si ≥1 item `ref_location='D'` — `isContainerAvailable()` | BLESSURES.md |
| PI2 | Équipement `slot≠null` → container 'Sac' obligatoire — 400 si indispo | BLESSURES.md |
| PI3 | Items équipés comptés dans poids — seul `container='Coffre'` exclut | BLESSURES.md |
| PI4 | `calcEncumbrancePenalty` requiert FOR nette = `base_level + pc_modifier` | BLESSURES.md |
| PI5 | Items manuels (`equipment_id null`) → exclus du calcul poids | BLESSURES.md |
| PI6 | LOCATION_TO_SLOT : BG/BD/JG/JD indépendants | BLESSURES.md |
| PI7 | refCode (B/J) pour lookup — slotCode (BG/BD) pour equip/unequip | BLESSURES.md |
| PI8 | POST `/inventory` : LIKE query pour multi-slot | BLESSURES.md |
| PI11 | `polarisRound` : source unique `shared/polarisUtils.js` — jamais redéfinir localement | REACT.md |
| PC27 | `!token.character_id` = Entité — jamais PNJ. PNJ = `character.type === 'pnj'` | COMBAT.md |
| PC28 | `state_character.is_rushed` → lire depuis `combat_roster`, jamais depuis `combat_actions` | COMBAT.md |
| PC29 | `activeSlotIdx` indexe le roster **trié DESC initiative** — toujours `[...roster].sort((a,b) => b.initiative - a.initiative)` | COMBAT.md |
| PC39 | `state_character` JSONB : merge par `||` — jamais écraser, jamais stocker `false` | COMBAT.md |
| PI9 | Format erreur serveur : `{ error: { status, message } }` → toujours `.error.message` (pas `.error` brut) | CONVENTIONS.md |
| PI10 | `2_seed_equipment.js` — ne jamais rejouer après migration 53 (doublon silencieux, pas de UNIQUE sur name) | CONVENTIONS.md |
