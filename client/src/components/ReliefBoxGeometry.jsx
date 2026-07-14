import { useEffect, useMemo } from 'react'
import {
  createReliefBoxGeometry,
  hasRealRelief,
  normalizeFaceProfiles,
  reliefProfileKey,
} from '../lib/reliefGeometry.js'

export default function ReliefBoxGeometry({
  args = [1, 1, 1],
  profile = null,
  faceProfiles = null,
  faceMask = null,
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
  const enabled = hasRealRelief(profiles, faceMask)

  const geometry = useMemo(() => {
    if (!enabled) return null
    return createReliefBoxGeometry({
      width,
      height,
      depth,
      faceProfiles: profiles,
      faceMask,
      segmentsPerUnit,
      maxSegments,
    })
  }, [width, height, depth, profiles, profileKey, faceMask, enabled, segmentsPerUnit, maxSegments])

  useEffect(() => () => {
    geometry?.dispose()
  }, [geometry])

  if (!enabled) return <boxGeometry args={[width, height, depth]} />

  return <primitive object={geometry} attach="geometry" />
}
