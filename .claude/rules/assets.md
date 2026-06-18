---
paths:
  - "server/src/lib/minio.js"
  - "server/src/routes/assets.js"
  - "server/src/routes/texture-packs.js"
  - "server/src/routes/entity-blueprints.js"
  - "client/src/pages/WorkshopPage.jsx"
  - "client/src/lib/voxelTextures.js"
---
# Domaine : MinIO, Assets & Atelier GM

**Spec technique → `docs/SYSTEME/ASSETS.md`**

## Pièges critiques

**P43 — MinIO textures : chemin par pack_uuid**
Le chemin MinIO inclut le `pack_uuid` — pas uniquement le nom de texture.
Bucket unique — pas de sous-buckets par campagne.

**P44 — name pack immuable**
Le nom d'un texture pack ne peut pas changer après création (clé référencée en DB).

**P47 — pack_id dans SELECT JOIN entities**
`pack_id` doit figurer dans le SELECT du GET `/battlemaps/:id/entities`
et dans le payload `ENTITY_CREATED` socket — sinon `blueprint.pack_id` null côté client (PE18).

**P19 — GLB URL avec ?v=timestamp**
`glb_url` servi avec `?v=timestamp` pour forcer le rechargement du cache navigateur.

**P46 — route spécifique avant paramétrique**
Express : déclarer `/specific` avant `/:id` — sinon la route paramétrique capture silencieusement.

**WorkshopPage — crash import invalide (WS1)**
`err.response?.data?.error` → peut throw si `err.response` est undefined.
Guard : `err?.response?.data?.error ?? err.message` (dette active basse priorité).
