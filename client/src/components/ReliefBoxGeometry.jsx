import { useMemo } from 'react'
import {
  createReliefBoxGeometry,
  hasRealRelief,
  normalizeFaceProfiles,
  reliefUvOffsetKey,
  reliefProfileKey,
  reliefUvScaleKey,
} from '../lib/reliefGeometry.js'

const reliefGeometryCache = new Map()

function cachedReliefGeometry(key, options) {
  if (!reliefGeometryCache.has(key)) {
    reliefGeometryCache.set(key, createReliefBoxGeometry(options))
  }
  return reliefGeometryCache.get(key)
}

export default function ReliefBoxGeometry({
  args = [1, 1, 1],
  profile = null,
  faceProfiles = null,
  faceMask = null,
  faceUvScales = null,
  faceUvOffsets = null,
  segmentsPerUnit = 24,
  maxSegments = 32,
}) {
  const width = Number(args?.[0]) || 1
  const height = Number(args?.[1]) || 1
  const depth = Number(args?.[2]) || 1
  const profiles = useMemo(
    () => normalizeFaceProfiles(faceProfiles || profile),
    [faceProfiles, profile],
  )
  const profileKey = useMemo(() => reliefProfileKey(profiles, faceMask), [profiles, faceMask])
  const uvScaleKey = useMemo(() => reliefUvScaleKey(faceUvScales), [faceUvScales])
  const uvOffsetKey = useMemo(() => reliefUvOffsetKey(faceUvOffsets), [faceUvOffsets])
  const enabled = hasRealRelief(profiles, faceMask)

  const geometry = useMemo(() => {
    if (!enabled) return null
    const geometryKey = JSON.stringify({
      width,
      height,
      depth,
      profileKey,
      uvScaleKey,
      uvOffsetKey,
      segmentsPerUnit,
      maxSegments,
    })
    return cachedReliefGeometry(geometryKey, {
      width,
      height,
      depth,
      faceProfiles: profiles,
      faceMask,
      faceUvScales,
      faceUvOffsets,
      segmentsPerUnit,
      maxSegments,
    })
  }, [width, height, depth, profiles, profileKey, faceMask, faceUvScales, faceUvOffsets, uvScaleKey, uvOffsetKey, enabled, segmentsPerUnit, maxSegments])

  if (!enabled) return <boxGeometry args={[width, height, depth]} />

  return <primitive object={geometry} attach="geometry" />
}
