# SYSTEME/VOXELS.md — Coordonnées, voxels, PE14
> Source : SYSTEME.md §7–§8
> Dernière mise à jour : 2026-08-26 — audit de compréhension approfondie (PE34 réécrit : calibration
> `Y_OFFSET=0.5`/session 61 périmée depuis le 2026-08-01, formule réelle dépend de
> `position_space` via `tokenFeetPoint()` ; référence migration voxel_data corrigée).
> Lire pour : tout code touchant les voxels, coordonnées 3D, tokens (pos_x/y/z), overlays canvas

---

## Flux voxels — coordonnées et format

### Coordonnées voxel
```javascript
// Base = entiers bruts
// Rendu Three.js = brut + 0.5 (centrage dans la case)
// Ne jamais mélanger (P5)
```

### Format voxel_data
```javascript
// Base (colonne jsonb créée dans 3_battlemaps.js — corrigé 2026-08-26, "migration 30" pointe
// aujourd'hui vers 30_combat_actions.js, sans rapport) :
{ "x:y:z": { "tex": N, "geo": "cube", "r": 0 } }
// Clé "x:y:z" = convention Three.js brute (y=altitude, z=profondeur)

// Mémoire React :
{ "x:y:z": { x, y, z, tex, geo, r } }

// save() payload — jamais l'objet mémoire entier (P16) :
payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
```

### Collision — SUPPRIMÉ, corrigé (audit 2026-08-26)

**Ce document décrivait une collision map Redis (`buildCollisionMap`/`collisionAddVoxel`/
`collisionRemoveVoxel`, PE28) qui n'existe plus dans le code** — zéro occurrence vérifiée dans
`server/src`, `client/src`, `shared/`. `.claude/rules/core.md` : *"Ne pas créer de stockage spatial
Redis"* ; `.claude/rules/voxels.md` : *"Aucun calcul de collision [...] ne dépend des voxels"*.

**Autorité réelle aujourd'hui** : `shared/world/spatialIndex.js` + le `WorldSnapshot` compilé par
`shared/world/worldCompiler.js` (voir `docs/SYSTEME/MOTEUR_MONDE.md`, autorité unique collision/
navigation/LOS/occupation). Redis ne porte plus aucune donnée spatiale sur ce projet — `voxel_data`
(PostgreSQL, format ci-dessus) reste la seule source durable, jamais dupliquée dans un cache
autoritaire séparé.

---

## Coordonnées entités — PE14

```javascript
// Base de données → Three.js (rendu dans EntityMesh)
posX = entity.pos_x + width/2
posY = entity.pos_z + height/2   // pos_z base = altitude Y Three.js
posZ = entity.pos_y + depth/2    // pos_y base = profondeur Z Three.js

// Three.js → base de données (pose depuis Editor3D)
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }
// Identique à threeToDb() — jamais inline
```

**Règle PE14 résumée :**
| Colonne DB | Signification Three.js |
|---|---|
| `pos_x` | axe X (inchangé) |
| `pos_y` | axe Z (profondeur) |
| `pos_z` | axe Y (altitude) |

S'applique à : tokens, entités (PE14 = convention base de données). Ne s'applique PAS aux clés voxel_data en base (Three.js brut).

---

## PE34 — Altitude pieds token en Three.js — corrigé 2026-08-26

**Périmé.** Cette section décrivait la calibration `Y_OFFSET = 0.5` (session 61) : un corps flottant
au-dessus du centre du voxel, pieds calculés à `pos_z + 1.0`. Le code actuel
(`client/src/components/Canvas3D.jsx`) a changé cette calibration le 2026-08-01 (retour Saar, voir
commentaire ligne 114) — `Y_OFFSET = 0`, le corps du token est rendu directement à l'origine du
groupe, sans flottement.

La formule réelle dépend de `tokens.position_space` (voir `MOTEUR_MONDE.md` §2.9), via l'unique
fonction `tokenFeetPoint()` (`Canvas3D.jsx:73`, seule source consommée pour positionner le groupe
Three.js d'un token — lignes 242, 397, 1099-1100) :

```javascript
function tokenFeetPoint(token) {
  const legacyOffset = token?.position_space === 'world-feet' ? 0 : 0.5
  return {
    x: (Number(token?.pos_x) || 0) + legacyOffset,
    y: (Number(token?.pos_z) || 0) + legacyOffset,   // altitude Three.js
    z: (Number(token?.pos_y) || 0) + legacyOffset,
  }
}
```

- Token canonique (`position_space === 'world-feet'`, toute nouvelle position depuis Phase 2) :
  **`feetY = token.pos_z`** — `pos_z` stocke déjà l'altitude réelle des pieds en mètres, aucun décalage.
- Token historique (`position_space === 'legacy-cell'`, jamais replacé par un MJ depuis) :
  `feetY = token.pos_z + 0.5` — ancienne convention case, conservée uniquement en lecture tant que
  la position n'est pas migrée explicitement (`MOTEUR_MONDE.md` §2.9).

Aucun overlay client (anneau de sélection `TokenRing`, disque actif `TokenActiveDisk`) ne recalcule
plus un `pos_z + 1.0 + 0.05` global : ces éléments sont rendus en enfants du groupe token, positionnés
en coordonnées locales (`baseY = 0.1`) relatives au point pieds déjà résolu par `tokenFeetPoint`.

`getVoxelSurfaceTop()` (`Canvas3D.jsx:84`, `v.y + 1.0` pour un cube) reste un calcul distinct et
toujours actif : il sert à poser un token sur le dessus d'un voxel lors d'une création/replacement,
pas à l'affichage courant d'un token déjà positionné en `world-feet`.

---

## Pièges voxels — référence rapide

| Code | Description |
|---|---|
| ~~P12~~ | Retiré (2026-08-26) — décrivait un guard dans le handler serveur `VOXEL_ADD`. Ticket `bug_tickets`/`AUDIT-SYSTEME` résolu : l'unique émetteur (`EditorScene`, fonction locale à `Editor3D.jsx`) n'était lui-même jamais rendu — code mort supprimé (fonction + helpers + les 6 constantes `VOXEL_*` de `shared/events.js`). Plus aucune trace du guard ni de l'événement, détail `docs/SYSTEME/ARCHITECTURE_SOCKET.md` |
| P17 | Séparateur clé voxel = `":"` — `"x:y:z"` NON NÉGOCIABLE. Jamais `"x,y,z"` ni `"x-y-z"`. |
| P22 | `voxel_textures.id` = integer — exception UUID du projet. `increments()` intentionnel. |
| P26 | `blocksReady = true` même si 0 textures — ne pas conditionner sur la longueur du tableau |
| P32 | Ordre faces `BoxGeometry` (Three.js) : east(0), west(1), top(2), bottom(3), south(4), north(5) — index matériaux fixes |
