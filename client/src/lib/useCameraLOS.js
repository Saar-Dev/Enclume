import { useRef, useState, useEffect, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import api from './api.js'
import { dbPositionToWorldPoint } from '../../../shared/world/worldMetrics.js'
import { actorEyePoint } from '../../../shared/world/visibility.js'

const CAM_SHOULDER_BACK  = 3.0
const CAM_SHOULDER_RIGHT = 1.5
const CAM_SHOULDER_UP    = 2.0

/**
 * useCameraLOS — service complet LOS + caméra "épaule droite".
 * Canvas3D.jsx n'expose que les 4 callables retournés — zéro logique LOS dans le composant.
 * Doit être appelé depuis l'intérieur du contexte R3F (<Canvas>) — useThree() requis.
 */
export function useCameraLOS(losMode, orbitRef, tokensRef, battlemapId, onLosResult, onLosCancel) {
  const { camera } = useThree()

  const savedCameraRef = useRef(null)

  // P40 — miroirs stables pour éviter les stale closures dans les useCallbacks
  const losModeRef = useRef(losMode)
  losModeRef.current = losMode
  const onLosResultRef = useRef(onLosResult)
  onLosResultRef.current = onLosResult
  const onLosCancelRef = useRef(onLosCancel)
  onLosCancelRef.current = onLosCancel

  // P-LOS13 : flag posé sur pointerDown clic cible, consommé sur pointerUp
  const justHandledTargetRef = useRef(false)

  const [losLine, setLosLine] = useState(null)

  // Nouveau check LOS → efface le résultat précédent
  useEffect(() => {
    if (losMode?.active) setLosLine(null)
  }, [losMode])

  // Sauvegarder la caméra à la première activation du mode LOS
  useEffect(() => {
    if (losMode?.active && orbitRef.current && !savedCameraRef.current) {
      savedCameraRef.current = {
        position: camera.position.clone(),
        target:   orbitRef.current.target.clone(),
      }
    }
  }, [losMode?.active, camera, orbitRef])

  // P4 — moveCameraToShoulder déclaré avant onTokenClick
  const moveCameraToShoulder = useCallback((src, tgt) => {
    if (!savedCameraRef.current || !orbitRef.current) return
    const source = actorEyePoint(dbPositionToWorldPoint(src))
    const target = actorEyePoint(dbPositionToWorldPoint(tgt))
    const srcEye = new THREE.Vector3(source.x, source.y, source.z)
    const tgtEye = new THREE.Vector3(target.x, target.y, target.z)
    const fwd   = tgtEye.clone().sub(srcEye).normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()
    const camPos = srcEye.clone()
      .addScaledVector(fwd,  -CAM_SHOULDER_BACK)
      .addScaledVector(right, CAM_SHOULDER_RIGHT)
      .add(new THREE.Vector3(0, CAM_SHOULDER_UP, 0))
    camera.position.copy(camPos)
    orbitRef.current.target.copy(tgtEye)
    orbitRef.current.update()
  }, [camera, orbitRef])

  // P4 — restoreCamera déclaré avant clearLine et onPointerUp
  const restoreCamera = useCallback(() => {
    if (!savedCameraRef.current || !orbitRef.current) return
    camera.position.copy(savedCameraRef.current.position)
    orbitRef.current.target.copy(savedCameraRef.current.target)
    orbitRef.current.update()
    savedCameraRef.current = null
  }, [camera, orbitRef])

  // P4 — onTokenClick déclaré après moveCameraToShoulder
  const onTokenClick = useCallback(async (tgt) => {
    const src = tokensRef.current.find(t => t.id === losModeRef.current?.sourceTokenId)
    if (!src || !tgt) { onLosCancelRef.current?.(); return }
    if (tgt.id === src.id) return  // P-LOS5 — clic sur soi-même
    justHandledTargetRef.current = true
    try {
      const res = await api.post(`/battlemaps/${battlemapId}/world-visibility`, {
        source_token_id: src.id,
        target_token_id: tgt.id,
      })
      const visibility = res.data?.visibility
      if (!visibility?.line) return
      const from = [visibility.line.from.x, visibility.line.from.y, visibility.line.from.z]
      const to = [visibility.line.to.x, visibility.line.to.y, visibility.line.to.z]
      setLosLine({ from, to, clear: visibility.line.clear })
      onLosResultRef.current?.({
        clear: visibility.line.clear,
        coverageModifier: visibility.coverage?.modifier ?? 0,
        interceptors: visibility.interceptors ?? [],
      })
      onLosCancelRef.current?.()
      moveCameraToShoulder(src, tgt)
    } catch (error) {
      console.error('Erreur ligne de vue monde :', error)
      setLosLine(null)
      onLosCancelRef.current?.()
    }
  }, [battlemapId, moveCameraToShoulder, tokensRef])

  // P4 — clearLine déclaré après restoreCamera
  const clearLine = useCallback(() => {
    setLosLine(null)
    restoreCamera()
  }, [restoreCamera])

  // P4 — onPointerUp déclaré après restoreCamera
  const onPointerUp = useCallback((isDragging) => {
    if (justHandledTargetRef.current) {
      justHandledTargetRef.current = false
      return true
    }
    if (losModeRef.current?.active && !isDragging) {
      onLosCancelRef.current?.()
      setLosLine(null)
      restoreCamera()
      return true
    }
    if (!isDragging) {
      setLosLine(null)
      restoreCamera()
      return false
    }
    return false
  }, [restoreCamera])

  return { losLine, onTokenClick, onPointerUp, clearLine }
}
