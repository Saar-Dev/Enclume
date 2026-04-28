# PLAN_WORKSHOP.md — Chantier Atelier du GM
> Rédigé session 33 — 2026-04-21
> Chantier 9D terminé ✅ — document mis à jour pour refléter l'état réel.
> Pour l'historique des décisions : voir JOURNAL.md session 33.

---

## Contexte

`TexturePacksPage.jsx` était un fichier monolithique (717 lignes) gérant à la fois
le shell et le constructeur voxel. Ce chantier l'a restructuré en fichiers séparés
et a ajouté l'onglet Éléments interactifs.

---

## Décisions actées ✅

| Sujet | Décision |
|---|---|
| Nom du shell | `WorkshopPage.jsx` |
| Nom onglet matériaux | `VoxelBuilderTab.jsx` |
| Nom onglet entités | `EntityBuilderTab.jsx` |
| Route | `/texture-packs` → `/workshop` (redirect en place) |
| Lien Dashboard | "Packs de textures" → "Atelier du GM" |
| Onglets — ordre définitif | Textures / Matériaux / Éléments interactifs |
| Composants | `client/src/components/` — pas `pages/` |

---

## Architecture finale

```
WorkshopPage.jsx (pages/)             ← shell : header, liste packs, onglets, état partagé
├── VoxelBuilderTab.jsx (components/) ← onglet Matériaux
├── EntityBuilderTab.jsx (components/)← onglet Éléments interactifs
└── Onglet Textures inline             ← PNG bruts — inline dans WorkshopPage
```

---

## Ce que WorkshopPage gère (shell)

- Chargement des packs (`loadPacks`) et état `packs[]`
- Chargement du détail pack (`loadPackDetail`) — `packDetail`, `packFiles`, `detailLoading`
- `entityCount` state + callback `onCountChange` pour le compteur onglet Éléments interactifs
- Header : "Atelier du GM", boutons import ZIP, créer pack
- Liste packs à gauche (colonne 200px)
- Onglets dans l'ordre : Textures / Matériaux / Éléments interactifs
- `selectedPack`, `isOwner`
- Modales : création pack, suppression pack
- Gestion erreurs globales

## Props VoxelBuilderTab

```javascript
{
  selectedPack,      // { id, name, label, tile_size, created_by }
  packDetail,        // { pack, categories, textures } — voxel_textures[]
  setPackDetail,     // mise à jour après création/modification voxel (PW1)
  setPacks,          // mise à jour compteur texture_count
  packFiles,         // fichiers PNG bruts du pack
  isOwner,           // boolean
}
```

## Props EntityBuilderTab

```javascript
{
  selectedPack,      // { id, name, label, tile_size, created_by }
  packDetail,        // { pack, categories, textures }
  setPacks,          // cohérence avec VoxelBuilderTab
  packFiles,         // fichiers PNG bruts — SOURCE des faces (PW3)
  isOwner,           // boolean
  onCountChange,     // callback(n) — notifie WorkshopPage du nombre de blueprints
}
```

---

## Formulaire blueprint — implémentation finale

**Section 1 — Identité**
- Champ `label`
- Champs `width`, `height`, `depth` (dimensions libres — décision 1×1×1 annulée)
- Toggle `appearance` : Voxel | GLB

**Section 2 — Apparence**
- Si Voxel : grille 6 faces (top, bottom, north, south, east, west)
  - Clic → picker de fichiers PNG depuis `packFiles`
  - Stocke le chemin PNG relatif au pack (string) — PAS d'integer voxel_texture_id (PW3)
  - Aperçu 3D : fakeTexObj + loadVoxelTextures, BoxGeometry(w,h,d), caméra dynamique
- Si GLB : upload direct via `POST /api/entity-blueprints/:id/upload-glb`
  → MinIO `glb/<blueprint_id>.glb?v=timestamp` (P19)

**Section 3 — États**
- Par état : `name`, `opacity`, `face_overrides` (même picker PNG que section 2)
- Suppression bloquée si état référencé dans une interaction (avertissement)

**Section 4 — Interactions**
- Par interaction : `id`, `action_label`
- `skill_id` : select depuis `GET /api/char-ref/skills` (label affiché, id stocké)
- `difficulty_dc`, `required_state_ids[]` (checkboxes états), `target_state_id`, `range`

---

## Pièges actifs

| Code | Description |
|---|---|
| PW1 | `VoxelBuilderTab` reçoit `setPackDetail` — ne jamais appeler l'API directement |
| PW2 | `EntityBuilderTab` n'a PAS `setPackDetail` — blueprints ont leur propre state local |
| PW3 | Picker faces EntityBuilderTab stocke chemins PNG strings — jamais integers |
| PW5 | VoxelBuilderTab = extraction chirurgicale de TexturePacksPage — pas de réécriture |
| PE17 | `usage_hint` = hint de tri uniquement — jamais exclusif |
| PE18 | `blueprint.pack_id` nullable — guard obligatoire |
| PEF1-PEF6 | Format faces PNG — voir SYSTEME.md section 6 |

---

# PLAN_WORKSHOP.md — Chantier Atelier du GM
> Rédigé session 33 — 2026-04-21
> Chantier 9D terminé ✅ — document mis à jour session 35.
> Pour l'historique des décisions : voir JOURNAL.md sessions 33 et 35.

---

## Contexte

`TexturePacksPage.jsx` était un fichier monolithique (717 lignes) gérant à la fois
le shell et le constructeur voxel. Ce chantier l'a restructuré en fichiers séparés
et a ajouté l'onglet Éléments interactifs.

---

## Décisions actées ✅

| Sujet | Décision |
|---|---|
| Nom du shell | `WorkshopPage.jsx` |
| Nom onglet matériaux | `VoxelBuilderTab.jsx` |
| Nom onglet entités | `EntityBuilderTab.jsx` |
| Route | `/texture-packs` → `/workshop` (redirect en place) |
| Lien Dashboard | "Packs de textures" → "Atelier du GM" |
| Onglets — ordre définitif | Textures / Matériaux / Éléments interactifs |
| Composants | `client/src/components/` — pas `pages/` |

---

## Architecture finale

```
WorkshopPage.jsx (pages/)             ← shell : header, liste packs, onglets, état partagé
├── VoxelBuilderTab.jsx (components/) ← onglet Matériaux
├── EntityBuilderTab.jsx (components/)← onglet Éléments interactifs
└── Onglet Textures inline             ← PNG bruts — inline dans WorkshopPage
```

---

## Ce que WorkshopPage gère (shell)

- Chargement des packs (`loadPacks`) et état `packs[]`
- Chargement du détail pack (`loadPackDetail`) — `packDetail`, `packFiles`, `detailLoading`
- `entityCount` state + callback `onCountChange` pour le compteur onglet Éléments interactifs
- Header : "Atelier du GM", boutons import ZIP, créer pack
- Liste packs à gauche (colonne 200px)
- Onglets dans l'ordre : Textures / Matériaux / Éléments interactifs
- `selectedPack`, `isOwner`
- Modales : création pack, suppression pack
- Gestion erreurs globales

## Props VoxelBuilderTab

```javascript
{
  selectedPack,      // { id, name, label, tile_size, created_by }
  packDetail,        // { pack, categories, textures } — voxel_textures[]
  setPackDetail,     // mise à jour après création/modification voxel (PW1)
  setPacks,          // mise à jour compteur texture_count
  packFiles,         // fichiers PNG bruts du pack
  isOwner,           // boolean
}
```

## Props EntityBuilderTab

```javascript
{
  selectedPack,      // { id, name, label, tile_size, created_by }
  packDetail,        // { pack, categories, textures }
  setPacks,          // cohérence avec VoxelBuilderTab
  packFiles,         // fichiers PNG bruts — SOURCE des faces (PW3)
  isOwner,           // boolean
  onCountChange,     // callback(n) — notifie WorkshopPage du nombre de blueprints
}
```

---

## Formulaire blueprint — implémentation finale

**Section 1 — Identité**
- Champ `label`
- Champs `width`, `height`, `depth` (dimensions libres — décision 1×1×1 annulée)
- Toggle `appearance` : Voxel | GLB

**Section 2 — Apparence**
- Si Voxel : grille 6 faces (top, bottom, north, south, east, west)
  - Clic → picker de fichiers PNG depuis `packFiles`
  - Stocke le chemin PNG relatif au pack (string) — PAS d'integer voxel_texture_id (PW3)
  - Aperçu 3D : fakeTexObj + loadVoxelTextures, BoxGeometry(w,h,d), caméra dynamique
- Si GLB : upload direct via `POST /api/entity-blueprints/:id/upload-glb`
  → MinIO `glb/<blueprint_id>.glb?v=timestamp` (P19)

**Section 3 — États**
- Par état : `name`, `opacity`, `face_overrides` (même picker PNG que section 2)
- Suppression bloquée si état référencé dans une interaction (avertissement)

**Section 4 — Interactions**
- Par interaction : `id`, `action_label`
- `skill_id` : select depuis `GET /api/char-ref/skills` (label affiché, id stocké)
- `difficulty_dc`, `required_state_ids[]` (checkboxes états), `target_state_id`, `range`

---

## Pièges actifs

| Code | Description |
|---|---|
| PW1 | `VoxelBuilderTab` reçoit `setPackDetail` — ne jamais appeler l'API directement |
| PW2 | `EntityBuilderTab` n'a PAS `setPackDetail` — blueprints ont leur propre state local |
| PW3 | Picker faces EntityBuilderTab stocke chemins PNG strings — jamais integers |
| PW5 | VoxelBuilderTab = extraction chirurgicale de TexturePacksPage — pas de réécriture |
| PE17 | `usage_hint` = hint de tri uniquement — jamais exclusif |
| PE18 | `blueprint.pack_id` nullable — guard obligatoire |
| PEF1-PEF6 | Format faces PNG — voir SYSTEME.md section 6 |

---

## Ce qui reste à faire (post-session 35)

| Tâche | Priorité | Notes |
|---|---|---|
| `TexturePacksPage.jsx` inutilisé — à supprimer | faible | redirect en place, sans risque |
| Géométries `door` et `trapdoor` dans l'Atelier | moyenne | surface plane verticale / horizontale |
| Modification des faces d'un voxel existant (Bug B) | faible | hors scope pour l'instant |
| Export ZIP — inclure blueprints JSON + GLB | future | structure `entites/` + `glb/` dans ZIP |

**Terminé depuis session 33 :**
- ✅ Blueprints visibles dans palette éditeur (session 34)
- ✅ Interactions entités fonctionnelles en session (session 35)