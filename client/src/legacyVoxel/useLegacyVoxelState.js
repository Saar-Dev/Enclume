import { useCallback, useEffect, useRef, useState } from 'react'

// Reliquat du système Voxel (carte éditée case par case), remplacé par Surface/Salle/Mur — candidat
// à suppression complète, cf. docs/PLANS/PLAN_PURGE_VOXEL.md. Isolé ici SANS rien retirer (Lot 1 de ce
// plan, garde-fous §0 : étapes réversibles et petites, d'abord ce qui est déjà inerte et prouvé) :
// si tout continue de fonctionner identique, ce dossier entier (client/src/legacyVoxel/) devient
// supprimable d'un bloc. La sauvegarde voxel elle-même est déjà confirmée morte (ticket
// VOXEL-SAVE-INERT1 : `isDirty` n'est plus jamais mis à `true` depuis la suppression de l'ancien
// composant d'édition voxel) — gardée ici à l'identique, jamais retirée tant que Saar ne le demande
// pas explicitement.
//
// Extrait de Editor3D.jsx (§ PLAN_PURGE_VOXEL.md, PLAN_WORLD_BUILDER_REWORK.md §16.11) — comportement
// inchangé, même refs, mêmes noms de fonctions internes.
export function useLegacyVoxelState(battlemap, battlemapRef, setBattlemap) {
  const [voxels, setVoxels] = useState({})
  const isDirty = useRef(false)
  const voxelSaveQueueRef = useRef(Promise.resolve())
  const voxelSaveRevisionRef = useRef(0)
  // voxelsRef — miroir de voxels pour accès dans le cleanup useEffect (évite le stale closure)
  const voxelsRef = useRef(voxels)
  useEffect(() => { voxelsRef.current = voxels }, [voxels])

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
    // Synchronise voxels sur battlemap.id, relocalisé tel quel (§16, PLAN_WORLD_BUILDER_REWORK.md ;
    // PLAN_PURGE_VOXEL.md) — pas de changement de comportement voulu dans ce lot d'isolement.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVoxels(map)
  }, [battlemap?.id])

  // ─── Helper save synchrone — fire-and-forget ────────────────────────────
  // Utilisé dans les contextes où async ne peut pas être attendu
  // (cleanup useEffect, setInterval).
  // Construit le payload et lance fetch sans await — le navigateur complète
  // la requête en arrière-plan même après le démontage React.
  // [CONFIRMÉ MORT] `isDirty.current` n'est jamais mis à `true` nulle part dans le client (ticket
  // VOXEL-SAVE-INERT1) — cette fonction fait donc toujours un early-return silencieux. Gardée pour ne
  // rien changer au comportement observable de ce lot d'isolement.
  const saveVoxelsFireAndForget = useCallback((currentVoxels) => {
    const bm = battlemapRef.current
    if (!isDirty.current || !bm?.id) return
    const battlemapId = bm.id
    const revision = voxelSaveRevisionRef.current + 1
    voxelSaveRevisionRef.current = revision
    const payload = {}
    for (const [key, v] of Object.entries(currentVoxels)) {
      payload[key] = { tex: v.tex, geo: v.geo, r: v.r }
    }

    voxelSaveQueueRef.current = voxelSaveQueueRef.current
      .catch(() => {})
      .then(() => {
        const currentBattlemap = battlemapRef.current
        return fetch(`${import.meta.env.VITE_API_URL}/api/battlemaps/${battlemapId}/voxels`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            voxel_data: payload,
            voxel_revision: currentBattlemap?.voxel_revision ?? 0,
          }),
        })
      })
      .then(async response => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `Sauvegarde voxels HTTP ${response.status}`)
        return data
      })
      .then(data => {
        const isLatest = revision === voxelSaveRevisionRef.current
        const nextBattlemap = {
          ...battlemapRef.current,
          world_revision: Math.max(
            Number(battlemapRef.current?.world_revision || 0),
            Number(data.world_revision || 0),
          ),
          voxel_revision: data.voxel_revision,
          ...(isLatest ? { voxel_data: payload } : {}),
        }
        battlemapRef.current = nextBattlemap
        setBattlemap(nextBattlemap)
        if (isLatest) isDirty.current = false
      })
      .catch(err => console.error('[Editor3D] Sauvegarde échouée :', err))
  }, [battlemapRef, setBattlemap])

  return { voxels, voxelsRef, saveVoxelsFireAndForget }
}
