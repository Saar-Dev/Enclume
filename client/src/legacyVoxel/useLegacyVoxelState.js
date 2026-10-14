import { useEffect, useState } from 'react'

// Reliquat du système Voxel (carte éditée case par case), remplacé par Surface/Salle/Mur —
// cf. docs/PLANS/PLAN_PURGE_VOXEL.md. Lot 2 de ce plan : le pipeline de sauvegarde voxel (route PUT
// /battlemaps/:id/voxels, saveVoxelsFireAndForget et ses refs de file/révision/isDirty) a été retiré —
// ticket VOXEL-SAVE-INERT1 clos, `isDirty` n'était plus jamais mis à `true` depuis la suppression de
// l'ancien composant d'édition voxel, donc cette fonction ne faisait jamais rien d'observable. `voxelsRef`
// est parti avec elle (seul consommateur : les effets de sauvegarde retirés). Reste la lecture seule de
// `battlemap.voxel_data` (`voxels`) : encore consommée par le repli de rendu sur carte sans surface_data
// (catégorie B du plan, Lot 3 à venir) — pas retirée ici.
export function useLegacyVoxelState(battlemap) {
  const [voxels, setVoxels] = useState({})

  // ─── Initialisation voxels depuis battlemap.voxel_data ──────────────────
  // Format base après migration 30 : { "x:y:z": { tex, geo, r } }
  // Format mémoire React : { "x:y:z": { x, y, z, tex, geo, r } }
  useEffect(() => {
    if (!battlemap?.voxel_data) return
    const map = {}
    for (const [key, val] of Object.entries(battlemap.voxel_data)) {
      const [x, y, z] = key.split(':').map(Number)
      map[key] = { x, y, z, tex: val.tex, geo: val.geo, r: val.r }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoxels(map)
  }, [battlemap?.id])

  return { voxels }
}
