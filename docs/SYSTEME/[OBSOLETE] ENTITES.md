# SYSTEME/ENTITES.md — Occupation, rotation et déplacement des entités
> Mis à jour : 2026-07-22 — `WorldSnapshot`, placement éditeur et positions `world-feet`.
> Source : SYSTEME.md §12–§13–§15
> Lire pour : occupation dynamique, déplacement entités/tokens, rotation tokens, interpolation 300 ms

---

## Autorité spatiale actuelle

```text
PostgreSQL                         = positions et états durables
surface_data v13                  = définition statique du monde
WorldSnapshot                     = supports, barrières, colliders et occluders
tokens + entities PostgreSQL      = occupants dynamiques
world_revision/runtime_revision   = invalidation des snapshots et graphes
```

Le hash de collision Redis des sessions 39–43 a été retiré. Une mutation spatiale ne doit jamais
réintroduire `buildCollisionMap`, `isCaseOccupied` ou un helper `collision*`.

### Coordonnées runtime

PE14 ne vit plus que dans l'adaptateur DB :

```javascript
const point = dbPositionToWorldPoint(row)
// { x: row.pos_x, y: row.pos_z, z: row.pos_y }

const dbPosition = worldPointToDbPosition(point)
// { pos_x: point.x, pos_y: point.z, pos_z: point.y }
```

Un token moteur doit avoir `position_space = 'world-feet'` : son point stocké est directement le
contact de ses pieds avec le support. Un token `legacy-cell` doit être replacé par le MJ avant tout
déplacement autoritaire. Les entités utilisent le même point monde, sans colonne `position_space`.

### Occupants dynamiques

`server/src/services/worldMovementService.js` construit les occupants depuis les lignes courantes :

- les tokens `world-feet` sont inclus, sauf ceux de la couche `gm` ;
- une entité est incluse si son état courant est bloquant ;
- son rayon et sa hauteur viennent du collider de l'état ou de la géométrie du blueprint ;
- `state.transform.scale` est normalisé par `shared/world/entityTransform.js` et appliqué à
  l'empreinte comme au rendu ;
- `createOccupancyIndex()` vérifie l'occupation, tandis que `createSpatialIndex(snapshot)` vérifie
  les barrières et colliders statiques.

Créer, déplacer, redimensionner, supprimer ou changer l'état physique d'une entité incrémente la
`runtime_revision`. Le graphe de navigation est indexé par `world_revision` et `runtime_revision` :
il ne faut pas conserver un second cache spatial côté client ou dans Redis.

---

## Rotation des tokens — PE21

```javascript
// tokens.r = 0..7 — huit orientations par pas de 45°
rotation.y = token.r * Math.PI / 4
```

Flux `TOKEN_ROTATE` :

1. le client envoie uniquement l'identifiant du token ;
2. le serveur vérifie le propriétaire (`character.user_id`) ou le rôle MJ ;
3. le serveur enregistre `r = (r + 1) % 8` ;
4. `TOKEN_UPDATED` est diffusé à la campagne.

Un token sans personnage ne peut être tourné que par le MJ.

---

## Déplacement forcé d'une entité par un acteur

### Intention client et règles serveur

```text
RadialMenu / Canvas3D
  -> ENTITY_MOVE_REQUEST { entityId, tokenId, interactionId, moveType, destX, destZ }
  -> validation ownership, interaction et portée en mètres
  -> jet d'attribut et calcul Polaris du MR côté serveur
  -> Dmax = modifier + 1 en cas de réussite, sinon 0
  -> executeBattlemapRigidPairMovement(...)
  -> WORLD_RUNTIME_UPDATED + ENTITY_MOVED + TOKEN_MOVED
  -> ENTITY_MOVE_RESULT vers le demandeur
```

`moveType` est calculé côté client pour le retour visuel, puis recalculé côté serveur avec le produit
scalaire. `destX` est X monde et `destZ` est Z monde ; leurs noms historiques reflètent le payload,
pas un second espace de coordonnées.

```javascript
const modifier = getModifier(mrTable, mr)
const dmax = isSuccess ? modifier + 1 : 0
const stepsMax = Math.min(dmax, stepsTarget)
```

### Exécution physique

`server/src/services/worldForcedMovementService.js` déplace le couple acteur/objet rigidement :

1. verrouille la carte, ses tokens et ses entités dans une transaction ;
2. charge le snapshot, les états runtime et le graphe de navigation courants ;
3. avance par pas de `snapshot.metrics.worldUnitsPerCell` dans l'une des huit directions ;
4. recale chaque candidat sur un support stable ;
5. vérifie chaque segment avec l'index spatial puis chaque destination avec l'index d'occupation ;
6. exclut `[tokenId, entityId]` de l'occupation pour permettre au couple de se déplacer ensemble ;
7. s'arrête au premier obstacle, persiste la dernière position atteinte et incrémente la
   `runtime_revision` ;
8. enregistre les événements d'effets traversés et synchronise un éventuel ascenseur.

L'apparence GLB, les voxels legacy et la destination demandée par le client ne sont jamais des
autorités de collision.

---

## États, interactions et animations

- `states[0]` reste le fallback si `current_state_id` est absent ou invalide (PE11).
- Une interaction avec `target_state_id` met à jour l'état en base, incrémente la révision runtime et
  diffuse `ENTITY_UPDATED` puis `WORLD_RUNTIME_UPDATED`.
- `pendingEntityActions` est une instance partagée hors `initSocket`; son timeout doit toujours être
  annulé à la résolution (PE12).
- Les clips GLB reflètent l'état visuel via `useModelStateAnimation`; ils ne retardent ni ne pilotent
  la mise à jour de la physique.

## Interpolation visuelle 300 ms

Les positions serveur sont interpolées dans `TokenMesh` et `EntityMesh` avec une constante de temps
de `0.1`, soit environ 95 % du trajet en 300 ms :

```javascript
useFrame((_, delta) => {
  if (!groupRef.current) return
  const alpha = 1 - Math.exp(-delta / 0.1)
  lerpPos.current.x += (targetRef.current.x - lerpPos.current.x) * alpha
  lerpPos.current.y += (targetRef.current.y - lerpPos.current.y) * alpha
  lerpPos.current.z += (targetRef.current.z - lerpPos.current.z) * alpha
  groupRef.current.position.set(lerpPos.current.x, lerpPos.current.y, lerpPos.current.z)
})
```

Le `useFrame` reste dans un sous-composant monté sous le Canvas R3F. L'interpolation est purement
visuelle et ne constitue jamais une position intermédiaire autoritaire.

---

## Pièges entités — référence rapide

| Code | Description |
|---|---|
| PE11 | Fallback `states[0]` si `current_state_id` est invalide ou nul |
| PE12 | `clearTimeout(pendingEntityActions.get(key))` obligatoire à la résolution |
| PE13 | Touche R dans l'éditeur : ghost ou entité sous le curseur, jamais interception globale |
| PE21 | `tokens.r` vaut 0–7 ; `rotation.y = r * Math.PI / 4` |
| PE22 | Mouvement rigide : `excludeOccupantIds = [tokenId, entityId]` |
| PE26 | `resolveEntityState().returning()` inclut `battlemap_id` pour la révision runtime |
| PE27 | `moveType` est prévisualisé client puis recalculé serveur |
| PE29 | Acteur et objet sont contrôlés pas à pas sur supports, barrières et occupants du snapshot |
| PE30 | L'éditeur refuse pose, glisser et rotation si le volume chevauche mur, structure ou entité |
