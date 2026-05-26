# SYSTEME/ASSETS.md — MinIO, textures, faces entités, Atelier GM
> Source : SYSTEME.md §5–§6–§9
> Lire pour : uploads MinIO, textures voxel/entité, WorkshopPage, chemins assets

---

## Flux Atelier du GM — WorkshopPage (session 33)

### Route
`/workshop` remplace `/texture-packs`. Redirect en place pour les bookmarks.

### Onglets
```
Textures    → PNG bruts uploadés dans le pack
Matériaux   → VoxelBuilderTab — voxel_textures (géométrie + faces PNG)
Éléments interactifs → EntityBuilderTab — entity_blueprints (apparence + comportement)
```

### Workflow GM
```
1. Uploader PNG (onglet Textures)
2A. Créer un Matériau → voxel_textures.faces = { all: "uuid.png" }
    Utilisé sur la carte : voxel_data[key].tex = voxel_textures.id
2B. Créer un Élément interactif → blueprint.geometry.faces = { east: "uuid.png", ... }
    Les deux partent du même PNG brut — aucune dépendance entre eux.
```

### Ownership packs
`pack.created_by === req.user.id` — `requireRole` inutilisable (hors session).

### Upload GLB blueprint
```
POST /api/entity-blueprints/:id/upload-glb
  multerGlb.single('glb')
  → MinIO: glb/<blueprint_id>.glb
  → blueprint.glb_url = "glb/<id>.glb?v=<timestamp>"  (P19)
```

---

## Format faces entités — chemins PNG

### Format geometry.faces
```json
{
  "width": 1, "height": 2, "depth": 1,
  "faces": {
    "east":   "uuid1.png",
    "west":   "uuid1.png",
    "top":    "uuid2.png",
    "bottom": null,
    "south":  "uuid1.png",
    "north":  "uuid1.png"
  }
}
```
- Chemins PNG relatifs au pack — `pack_id` obligatoire sur le blueprint (PEF1)
- `null` = face invisible (PE4)

### Format states.visual_override.face_overrides
```json
{ "north": "uuid3.png", "top": null }
```

### Chargement Canvas3D — entityTextureMaterials
```javascript
fakeTexObjs.push({ id: `${bp.id}__base`, pack_id: bp.pack_id, faces: bp.geometry.faces })
// + un fakeTexObj par état avec face_overrides fusionnés

// Restructuration :
entityTextureMaterials = {
  [bp.id]: {
    base: { faceMaterials: [...6 mats...] },
    states: { [stateId]: { faceMaterials: [...6 mats...] } }
  }
}
```

### Pièges format faces
| Code | Description |
|---|---|
| PEF1 | pack_id obligatoire sur blueprint — guard si null avant chargement |
| PEF2 | fakeTexObj conforme : `{ id, pack_id, faces }` — faces = chemins PNG |
| PEF3 | entityTextureMaterials indexé par `blueprint.id` UUID — jamais par faceId |
| PEF4 | face_overrides états = même format chemin PNG |
| PEF5 | Blueprints sans pack_id → skip + rendu magenta (debug) |
| PEF6 | Canvas3D : deux zones séparées — voxels via `/voxel-textures?ids=`, entités via fakeTexObjs |

---

## Flux assets MinIO

```
GET /api/assets/:folder/*filePath
  → client.statObject(bucket, filePath)
  → Content-Type = stat.metaData['content-type'] || getContentType(filePath)
  → stream.pipe(res)

cover_url campaign = "campaigns/<campaign_id>/cover"
portrait_url char  = "characters/<id>/illustration"
glb_url char       = "characters/<id>/model3D?v=<timestamp>"
glb_url blueprint  = "glb/<blueprint_id>.glb?v=<timestamp>"
textures pack      = "textures/<pack_uuid>/<fichier>.png"
URL client         : ${VITE_API_URL}/api/assets/${cover_url}
URL client         : ${VITE_API_URL}/api/assets/${glb_url}
URL textures       : ${VITE_API_URL}/api/textures/${pack_id}/${path}
```

### Convention arborescence campagne (actée session 45)
Tous les assets d'une campagne ont `campaigns/<campaign_id>/` comme racine MinIO :
- `campaigns/<campaign_id>/cover` — illustration de la campagne (Dashboard)
- `campaigns/<campaign_id>/characters/<character_id>/illustration` — **(cible future migration)**
- `campaigns/<campaign_id>/maps/`, `campaigns/<campaign_id>/tokens/` — (réservé)

**Migration future (non codée) :** `characters/<id>/illustration` → `campaigns/<campaign_id>/characters/<id>`
Raison : les characters existants ont été créés hors campagne. Migration complexe, chantier dédié.

### P43 — textures MinIO : chemin par UUID de pack
`textures/<pack_uuid>/<fichier>.png` — **jamais `textures/<pack_name>/`**.
Le `pack_name` est mutable (P44). L'UUID est la clé stable.

### P44 — name du pack immuable
`texture_packs.name` ne doit jamais être renommé après création — des assets peuvent y être référencés.
Le changement de nom est interdit côté route (guard obligatoire dans `PUT /texture-packs/:id`).

### Règle P18 — chemins MinIO en base
`cover_url`, `portrait_url`, `glb_url` stockent le chemin MinIO relatif (pas une URL complète).
Le client reconstruit : `${VITE_API_URL}/api/assets/${url}`

### Règle P25 — MinIO avant base
Toujours écrire dans MinIO en premier, puis en base. Jamais l'inverse.
