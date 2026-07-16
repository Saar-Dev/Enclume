import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { modelAnimationProgress } from '../../../shared/world/modelAnimation.js'

function setActionsAtProgress(mixer, actions, progress) {
  for (const action of actions) {
    action.enabled = true
    action.clampWhenFinished = true
    action.setLoop(THREE.LoopOnce, 1)
    action.play()
    action.paused = true
    action.time = Math.max(0, Math.min(action.getClip().duration, action.getClip().duration * progress))
  }
  mixer.update(0)
}

function startActionsTransition(actions, previous, target) {
  let duration = 0
  const direction = target > previous ? 1 : -1
  for (const action of actions) {
    const clipDuration = Math.max(0.001, Number(action.getClip().duration) || 0.001)
    action.reset()
    action.enabled = true
    action.clampWhenFinished = true
    action.setLoop(THREE.LoopOnce, 1)
    action.time = clipDuration * previous
    action.timeScale = direction
    action.paused = false
    action.play()
    duration = Math.max(duration, clipDuration * Math.abs(target - previous))
  }
  return duration
}

export function useModelStateAnimation(root, clips, state) {
  const mixerRef = useRef(null)
  const actionsRef = useRef([])
  const transitionRef = useRef(null)
  const previousProgressRef = useRef(null)
  const targetProgress = modelAnimationProgress(state)
  const targetProgressRef = useRef(targetProgress)

  useEffect(() => {
    targetProgressRef.current = targetProgress
  }, [targetProgress])

  useEffect(() => {
    if (!root || !Array.isArray(clips) || clips.length === 0) {
      mixerRef.current = null
      actionsRef.current = []
      transitionRef.current = null
      previousProgressRef.current = targetProgressRef.current
      return undefined
    }
    const mixer = new THREE.AnimationMixer(root)
    const actions = clips.map(clip => mixer.clipAction(clip, root))
    mixerRef.current = mixer
    actionsRef.current = actions
    transitionRef.current = null
    previousProgressRef.current = targetProgressRef.current
    setActionsAtProgress(mixer, actions, targetProgressRef.current)
    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(root)
      if (mixerRef.current === mixer) mixerRef.current = null
      if (actionsRef.current === actions) actionsRef.current = []
      transitionRef.current = null
    }
  }, [root, clips])

  useEffect(() => {
    const mixer = mixerRef.current
    const actions = actionsRef.current
    const previous = previousProgressRef.current
    previousProgressRef.current = targetProgress
    if (!mixer || actions.length === 0 || previous === null || Math.abs(previous - targetProgress) < 1e-6) return

    const duration = startActionsTransition(actions, previous, targetProgress)
    transitionRef.current = { remaining: duration, target: targetProgress }
  }, [targetProgress, root])

  useFrame((_, delta) => {
    const transition = transitionRef.current
    const mixer = mixerRef.current
    if (!transition || !mixer) return
    mixer.update(delta)
    transition.remaining -= delta
    if (transition.remaining > 0) return
    setActionsAtProgress(mixer, actionsRef.current, transition.target)
    transitionRef.current = null
  })
}
