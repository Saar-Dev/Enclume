import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'
import { SkeletonUtils } from 'three-stdlib'

// ─── EntityMesh ────────────────────────────────────────────────────────────────
// Composant partagé Canvas3D (lecture) et EntityEditor (édition).
// Analogue à Voxel.jsx — même conventions P23, P32, PE14.
//
// Props :
//   entity           : instance complète (pos_x, pos_y, pos_z, r, current_state_id, etc.)
//   blueprint        : blueprint résolu (depuis entityStore.blueprints)
//   textureMaterials : { [voxelTextureId]: { faceMaterials } } — depuis loadVoxelTextures
//   altPressed       : boolean — affiche le liseré de surbrillance (touche Alt)
//   isGmOnly         : boolean — overlay distinctif pour les entités gm_only
//   onHover          : callback (entity, isHovered) — pour l'icône Html flottante
//   onEntityClick    : callback (entity, clientX, clientY) — clic sur l'icône Html
//
// PE14 : pos_y = profondeur (Z Three.js), pos_z = altitude (Y Three.js)
// PE11 : fallback states[0] si current_state_id invalide
// PE4  : face null = face invisible, guard avant tout accès aux matériaux

const ICON_INTERACTION = '⚙'  // Icône affichée au survol sur les entités interactables

export default function EntityMesh({
  entity,
  blueprint,
  entityTextureMaterials,
  altPressed = false,
  isGmOnly = false,
  onHover,
  onEntityClick,
}) {
  if (!blueprint) return null

  const { geometry, states, glb_url } = blueprint

  // ─── Résolution de l'état courant (PE11) ──────────────────────────────────
  // Si current_state_id est hors limites (blueprint modifié après pose), fallback sur 0.
  const stateList = states || []
  const currentState = stateList[entity.current_state_id] ?? stateList[0] ?? null

  // ─── Dimensions depuis geometry ───────────────────────────────────────────
  const width  = geometry?.width  ?? 1
  const height = geometry?.height ?? 1
  const depth  = geometry?.depth  ?? 1

  // ─── Positionnement Three.js ──────────────────────────────────────────────
  // PE14 : pos_y = Z Three.js (profondeur), pos_z = Y Three.js (altitude)
  // +dimension/2 pour centrer dans la case (même logique que Voxel +0.5)
  const posX = (entity.pos_x ?? 0) + width  / 2
  const posY = (entity.pos_z ?? 0) + height / 2   // altitude : pos_z en base → Y Three.js
  const posZ = (entity.pos_y ?? 0) + depth  / 2   // profondeur : pos_y en base → Z Three.js

  const rot = (entity.r || 0) * (Math.PI / 2)

  // ─── Opacité depuis visual_override de l'état courant ────────────────────
  const stateOpacity = currentState?.visual_override?.opacity ?? 1.0

  // ─── GLB path ─────────────────────────────────────────────────────────────
  const glbUrl = glb_url
    ? `${import.meta.env.VITE_API_URL}/api/assets/${glb_url}`
    : null

  return glbUrl
    ? <EntityMeshGlb
        entity={entity}
        blueprint={blueprint}
        glbUrl={glbUrl}
        posX={posX} posY={posY} posZ={posZ}
        width={width} height={height} depth={depth}
        rot={rot}
        stateOpacity={stateOpacity}
        altPressed={altPressed}
        isGmOnly={isGmOnly}
        onHover={onHover}
        onEntityClick={onEntityClick}
      />
    : <EntityMeshVoxel
        entity={entity}
        blueprint={blueprint}
        entityTextureMaterials={entityTextureMaterials}
        currentState={currentState}
        posX={posX} posY={posY} posZ={posZ}
        width={width} height={height} depth={depth}
        rot={rot}
        stateOpacity={stateOpacity}
        altPressed={altPressed}
        isGmOnly={isGmOnly}
        onHover={onHover}
        onEntityClick={onEntityClick}
      />
}

// ─── Rendu voxel (géométrie + textures par faces) ─────────────────────────────
function EntityMeshVoxel({
  entity, blueprint, entityTextureMaterials, currentState,
  posX, posY, posZ, width, height, depth, rot,
  stateOpacity, altPressed, isGmOnly, onHover, onEntityClick,
}) {
  const hasInteractions = (blueprint.interactions || []).length > 0
  const [hovered, setHovered] = React.useState(false)
  // Timer de délai — évite que l'icône disparaisse quand le curseur monte vers elle
  const leaveTimerRef = useRef(null)
  const handlePointerEnter = () => {
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
    setHovered(true)
    onHover?.(entity, true)
  }
  const handlePointerLeave = () => {
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false)
      onHover?.(entity, false)
      leaveTimerRef.current = null
    }, 600)
  }
  useEffect(() => () => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current) }, [])

  // Résolution du jeu de matériaux selon l'état courant
  // Fallback sur base si l'état n'a pas de face_overrides chargés (PE11)
  const buckets = entityTextureMaterials?.[blueprint.id]
  const mats = currentState
    ? (buckets?.states?.[currentState.id] ?? buckets?.base)
    : buckets?.base

  // Ordre BoxGeometry Three.js : east(+X), west(-X), top(+Y), bottom(-Y), south(+Z), north(-Z) (P32)
  const faceOrder = ['east', 'west', 'top', 'bottom', 'south', 'north']

  return (
    <group
      position={[posX, posY, posZ]}
      rotation={[0, rot, 0]}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* ── Mesh visuel ──────────────────────────────────────────────────── */}
      <mesh userData={{ isEntity: true, entityId: entity.id }}>
        <boxGeometry args={[width, height, depth]} />
        {faceOrder.map((faceName, i) => {
          // PE4 : face null dans geometry.faces = face invisible
          const baseFaceVal = blueprint.geometry?.faces?.[faceName]
          if (baseFaceVal === null) {
            return (
              <meshBasicMaterial
                key={i}
                attach={`material-${i}`}
                transparent
                opacity={0}
              />
            )
          }
          // Accès direct via le jeu de matériaux résolu (base ou état courant)
          const mat = mats?.faceMaterials?.[i]
          if (!mat) {
            // Texture non chargée — fallback magenta pour débogage (PEF5)
            return (
              <meshBasicMaterial
                key={i}
                attach={`material-${i}`}
                color={0xFF00FF}
                transparent
                opacity={stateOpacity * (isGmOnly ? 0.5 : 1)}
              />
            )
          }
          return (
            <meshLambertMaterial
              key={i}
              attach={`material-${i}`}
              {...mat}
              transparent={true}
              opacity={stateOpacity * (isGmOnly ? 0.5 : 1)}
            />
          )
        })}
      </mesh>

      {/* ── Liseré de surbrillance (touche Alt — PE16) ───────────────────── */}
      {altPressed && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#00ffff" side={THREE.BackSide} />
        </mesh>
      )}

      {/* ── Overlay gm_only — contour violet permanent ───────────────────── */}
      {isGmOnly && (
        <mesh scale={[1.03, 1.03, 1.03]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#a855f7" side={THREE.BackSide} wireframe />
        </mesh>
      )}

      {/* ── Hitbox invisible — raycasting uniforme (P23 adapté) ──────────── */}
      {/* Élargie ×1.4 en X et Z, +0.8 en Y décalée +0.4 pour englober         */}
      {/* la zone au-dessus de l'entité où apparaît l'icône Html.               */}
      <mesh
        position={[0, 0.4, 0]}
        visible={false}
        userData={{ isEntity: true, entityId: entity.id }}
      >
        <boxGeometry args={[width * 1.4, height + 0.8, depth * 1.4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* ── Icône Html flottante (toujours montée si interactions, visibilité CSS) */}
      {/* Toujours montée pour éviter le cycle montage/démontage qui perturbe    */}
      {/* le raycaster R3F via les pointer events du portail DOM drei Html.       */}
      {hasInteractions && (
        <HoverIcon
          entity={entity}
          height={height}
          hovered={hovered}
          onEntityClick={onEntityClick}
        />
      )}
    </group>
  )
}

// ─── Rendu GLB ────────────────────────────────────────────────────────────────
function EntityMeshGlb({
  entity, blueprint,
  glbUrl,
  posX, posY, posZ, width, height, depth, rot,
  stateOpacity, altPressed, isGmOnly, onHover, onEntityClick,
}) {
  const hasInteractions = (blueprint.interactions || []).length > 0
  const [hovered, setHovered] = React.useState(false)
  const leaveTimerRef = useRef(null)
  const handlePointerEnter = () => {
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null }
    setHovered(true)
    onHover?.(entity, true)
  }
  const handlePointerLeave = () => {
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false)
      onHover?.(entity, false)
      leaveTimerRef.current = null
    }, 600)
  }
  useEffect(() => () => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current) }, [])
  const { scene: gltfScene } = useGLTF(glbUrl)

  const clonedScene = useMemo(() => {
    if (!gltfScene) return null
    const clone = SkeletonUtils.clone(gltfScene)
    clone.traverse((child) => {
      if (child.isMesh && child.material) {
        // P20 — clone obligatoire avant mutation de matériau
        const cloneMat = (mat) => {
          const m = mat.clone()
          if (isGmOnly || stateOpacity < 1) {
            m.transparent = true
            m.opacity = stateOpacity * (isGmOnly ? 0.5 : 1)
          }
          m.needsUpdate = true
          return m
        }
        if (Array.isArray(child.material)) {
          child.material = child.material.map(cloneMat)
        } else {
          child.material = cloneMat(child.material)
        }
      }
    })
    return clone
  }, [gltfScene, isGmOnly, stateOpacity])

  if (!clonedScene) return null

  return (
    <group
      position={[posX, posY, posZ]}
      rotation={[0, rot, 0]}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <primitive object={clonedScene} />

      {/* ── Hitbox invisible sur les dimensions déclarées (PE3 — GLB = hitbox seule) */}
      {/* Élargie ×1.4 en X et Z, +0.8 en Y décalée +0.4 pour englober              */}
      {/* la zone au-dessus de l'entité où apparaît l'icône Html.                    */}
      <mesh
        position={[0, 0.4, 0]}
        visible={false}
        userData={{ isEntity: true, entityId: entity.id }}
      >
        <boxGeometry args={[width * 1.4, height + 0.8, depth * 1.4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* ── Liseré Alt ────────────────────────────────────────────────────── */}
      {altPressed && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#00ffff" side={THREE.BackSide} />
        </mesh>
      )}

      {/* ── Overlay gm_only ───────────────────────────────────────────────── */}
      {isGmOnly && (
        <mesh scale={[1.03, 1.03, 1.03]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#a855f7" side={THREE.BackSide} wireframe />
        </mesh>
      )}

      {/* ── Icône Html flottante ──────────────────────────────────────────── */}
      {/* Toujours montée — même pattern que EntityMeshVoxel (voir commentaire) */}
      {hasInteractions && (
        <HoverIcon
          entity={entity}
          height={height}
          hovered={hovered}
          onEntityClick={onEntityClick}
        />
      )}
    </group>
  )
}

// ─── Icône Html flottante — toujours montée, visibilité contrôlée par CSS ────
// Toujours présente dans le DOM pour éviter les cycles montage/démontage qui
// perturbent le raycaster R3F (issue drei #319, #460).
// Invisible et non-interactive quand !hovered via visibility+opacity+pointerEvents.
// Clic → onEntityClick(entity, clientX, clientY) → RadialMenu dans SessionPage.
function HoverIcon({ entity, height, hovered, onEntityClick }) {
  return (
    <Html
      position={[0, height / 2 + 0.4, 0]}
      center
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation()
          onEntityClick?.(entity, e.clientX, e.clientY)
        }}
        style={{
          background: 'rgba(91,141,238,0.85)',
          border: '1px solid #5b8dee',
          borderRadius: '50%',
          width: '24px',
          height: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
          // Visibilité CSS — jamais démonté pour éviter perturbation raycaster
          visibility: hovered ? 'visible' : 'hidden',
          opacity: hovered ? 1 : 0,
          pointerEvents: hovered ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
        title={entity.label_override || ''}
      >
        {ICON_INTERACTION}
      </div>
    </Html>
  )
}
