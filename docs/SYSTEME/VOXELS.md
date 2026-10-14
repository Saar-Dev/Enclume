# SYSTEME/VOXELS.md — Rendu du bloc texturé « voxel » (catalogue), pas la carte voxel (morte)
> Source : SYSTEME.md §7–§8
> Dernière mise à jour : 2026-10-14 — PLAN_PURGE_VOXEL.md Lot 6. Ce document décrivait à l'origine le
> format de carte voxel (`voxel_data`, coordonnées, collision) ET des conventions générales mal
> rangées sous « voxel » par accident historique. Le format de carte est mort (Lots 1-3 du plan :
> aucune carte à voxels n'existe, le code de sauvegarde/rendu correspondant a été retiré). Les
> conventions générales ont été relocalisées : PE14 (conversion base↔Three.js, toutes entités/tokens)
> vit dans `docs/SYSTEME/ENTITES.md` §8.1 ; PE34 (`tokenFeetPoint`, altitude des pieds d'un token) vit
> dans `docs/SYSTEME/MOTEUR_MONDE.md` §2.9. Ce qui reste ici concerne uniquement le rendu d'un bloc
> texturé isolé (`client/src/components/Voxel.jsx`), encore utilisé par le catalogue de textures
> (`VoxelBuilderTab.jsx`, aperçu 3D d'une entrée `surface_textures`) — « voxel » y désigne une forme
> cubique/bloc, pas le format de carte.
> Lire pour : tout code touchant `Voxel.jsx` ou l'aperçu 3D du catalogue de textures.

---

## Rendu d'un bloc texturé isolé — `Voxel.jsx`

Composant partagé entre l'aperçu du catalogue (`VoxelBuilderTab.jsx`) et, historiquement, le rendu de
carte voxel (mort, retiré). Rendu seul aujourd'hui pour l'aperçu catalogue.

### Coordonnées

```javascript
// Base = entiers bruts
// Rendu Three.js = brut + 0.5 (centrage dans la case)
// Ne jamais mélanger (P5)
```

---

## Pièges — référence rapide

| Code | Description |
|---|---|
| P22 | `surface_textures.id` = integer — exception UUID du projet (ex-`voxel_textures.id`, renommage Lot 4). `increments()` intentionnel. |
| P26 | `blocksReady = true` même si 0 textures — ne pas conditionner sur la longueur du tableau (`Editor3D.jsx`, chargement de la palette). |
| P32 | Ordre faces `BoxGeometry` (Three.js) : east(0), west(1), top(2), bottom(3), south(4), north(5) — index matériaux fixes, consommé par `Voxel.jsx`. |

---

## Historique (format de carte voxel, mort — pour mémoire uniquement)

Le format `voxel_data` (`{ "x:y:z": { tex, geo, r } }`, séparateur `:` — ancien P17) et son pipeline de
sauvegarde/rendu (`PUT /battlemaps/:id/voxels`, `CulledVoxelScene`, `DungeonTerrainScene`) ont été
retirés par `PLAN_PURGE_VOXEL.md` (Lots 1-3, 2026-09-30 → 2026-10-14) — aucun chemin d'interface ne
pouvait plus l'atteindre depuis la suppression de l'éditeur voxel interactif (audit 2026-08-26, ticket
`VOXEL-SAVE-INERT1`). Aucun calcul de collision, navigation, occupation, LOS ou couverture n'en a
jamais dépendu — autorité réelle : `shared/world/spatialIndex.js` + `WorldSnapshot`
(`shared/world/worldCompiler.js`, voir `docs/SYSTEME/MOTEUR_MONDE.md`). Les colonnes base
(`battlemaps.voxel_data`/`voxel_revision`/`voxel_scale`) restent présentes, inertes, en attendant une
migration destructive (Lot 5 du même plan, après sauvegarde vérifiée).
