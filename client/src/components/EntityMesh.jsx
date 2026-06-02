import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useSessionStore } from '../stores/sessionStore';

// --- Constantes ---
const ICON_INTERACTION = '⚙';

// --- EntityMesh (composant principal) ---
export default function EntityMesh({
  entity,
  blueprint,
  entityTextureMaterials,
  altPressed = false,
  isGmOnly = false,
  onHover,
  onEntityClick,
}) {
  if (!blueprint) return null;

  const { geometry, states, glb_url } = blueprint;
  const stateList = states || [];
  const currentState = stateList[entity.current_state_id] ?? stateList[0] ?? null;

  // Coordonnées (PE14)
  const posX = (entity.pos_x ?? 0) + (geometry?.width ?? 1) / 2;
  const posY = (entity.pos_z ?? 0) + (geometry?.height ?? 1) / 2;
  const posZ = (entity.pos_y ?? 0) + (geometry?.depth ?? 1) / 2;
  const rot = (entity.r || 0) * (Math.PI / 2);
  const stateOpacity = currentState?.visual_override?.opacity ?? 1.0;

  // URL absolue pour useGLTF
  const glbUrl = glb_url
    ? `${import.meta.env.VITE_API_URL}/api/assets/${glb_url}`
    : null;

  return glbUrl ? (
    <EntityMeshGlb
      entity={entity}
      blueprint={blueprint}
      glbUrl={glbUrl}
      posX={posX} posY={posY} posZ={posZ}
      width={geometry?.width ?? 1}
      height={geometry?.height ?? 1}
      depth={geometry?.depth ?? 1}
      rot={rot}
      stateOpacity={stateOpacity}
      altPressed={altPressed}
      isGmOnly={isGmOnly}
      onHover={onHover}
      onEntityClick={onEntityClick}
    />
  ) : (
    <EntityMeshVoxel
      entity={entity}
      blueprint={blueprint}
      entityTextureMaterials={entityTextureMaterials}
      currentState={currentState}
      posX={posX} posY={posY} posZ={posZ}
      width={geometry?.width ?? 1}
      height={geometry?.height ?? 1}
      depth={geometry?.depth ?? 1}
      rot={rot}
      stateOpacity={stateOpacity}
      altPressed={altPressed}
      isGmOnly={isGmOnly}
      onHover={onHover}
      onEntityClick={onEntityClick}
    />
  );
}

// --- EntityMeshGlb (CORRIGÉ) ---
function EntityMeshGlb({
  entity,
  blueprint,
  glbUrl,
  posX, posY, posZ,
  width, height, depth, rot,
  stateOpacity, altPressed, isGmOnly,
  onHover, onEntityClick,
}) {
  const hasInteractions = (blueprint.interactions || []).length > 0;
  const { pendingEntityId } = useSessionStore();
  const isPending = pendingEntityId === entity.id;
  const [hovered, setHovered] = React.useState(false);
  const leaveTimerRef = useRef(null);

  // Chargement du GLB avec l'URL absolue
  const { scene } = useGLTF(glbUrl);

  // Applique les modifications d'opacité DIRECTEMENT sur la scène chargée
  useEffect(() => {
  if (scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.material) {
          child.material.needsUpdate = true; // ✅ Force la mise à jour des textures
          if (isGmOnly || stateOpacity < 1) {
            child.material.transparent = true;
            child.material.opacity = stateOpacity * (isGmOnly ? 0.5 : 1);
          }
        }
      }
    });
  }
}, [scene, isGmOnly, stateOpacity]);

  // Lerp pour le mouvement (P40)
  const groupRef = useRef();
  const lerpPos = useRef({ x: posX, y: posY, z: posZ });
  const targetRef = useRef({ x: posX, y: posY, z: posZ });
  targetRef.current = { x: posX, y: posY, z: posZ };

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const alpha = 1 - Math.exp(-delta / 0.1);
    lerpPos.current.x += (targetRef.current.x - lerpPos.current.x) * alpha;
    lerpPos.current.y += (targetRef.current.y - lerpPos.current.y) * alpha;
    lerpPos.current.z += (targetRef.current.z - lerpPos.current.z) * alpha;
    groupRef.current.position.set(lerpPos.current.x, lerpPos.current.y, lerpPos.current.z);
  });

  if (!scene) return null;

  return (
    <group
      ref={groupRef}
      rotation={[0, rot, 0]}
      onPointerEnter={() => {
        if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
        setHovered(true);
        onHover?.(entity, true);
      }}
      onPointerLeave={() => {
        leaveTimerRef.current = setTimeout(() => {
          setHovered(false);
          onHover?.(entity, false);
        }, 600);
      }}
    >
      <primitive object={scene} />

      {/* Hitbox invisible */}
      <mesh position={[0, 0.4, 0]} visible={false}>
        <boxGeometry args={[width * 1.4, height + 0.8, depth * 1.4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Liseré Alt */}
      {altPressed && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#00ffff" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Overlay GM */}
      {isGmOnly && (
        <mesh scale={[1.03, 1.03, 1.03]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#a855f7" side={THREE.BackSide} wireframe />
        </mesh>
      )}

      {/* Icône Html */}
      {hasInteractions && (
        <HoverIcon entity={entity} height={height} hovered={hovered} onEntityClick={onEntityClick} />
      )}
      <PendingWaitIcon height={height} isPending={isPending} />
    </group>
  );
}

// --- EntityMeshVoxel (VOTRE VERSION ORIGINALE, INCHANGÉE) ---
function EntityMeshVoxel({
  entity, blueprint, entityTextureMaterials, currentState,
  posX, posY, posZ, width, height, depth, rot,
  stateOpacity, altPressed, isGmOnly, onHover, onEntityClick,
}) {
  const hasInteractions = (blueprint.interactions || []).length > 0;
  const { pendingEntityId } = useSessionStore();
  const isPending = pendingEntityId === entity.id;
  const [hovered, setHovered] = React.useState(false);
  const leaveTimerRef = useRef(null);

  const handlePointerEnter = () => {
    if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
    setHovered(true);
    onHover?.(entity, true);
  };

  const handlePointerLeave = () => {
    leaveTimerRef.current = setTimeout(() => {
      setHovered(false);
      onHover?.(entity, false);
      leaveTimerRef.current = null;
    }, 600);
  };

  useEffect(() => () => { if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current); }, []);

  // Lerp 300ms (P40)
  const groupRef = useRef();
  const lerpPos = useRef({ x: posX, y: posY, z: posZ });
  const targetRef = useRef({ x: posX, y: posY, z: posZ });
  targetRef.current = { x: posX, y: posY, z: posZ };

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const alpha = 1 - Math.exp(-delta / 0.1);
    lerpPos.current.x += (targetRef.current.x - lerpPos.current.x) * alpha;
    lerpPos.current.y += (targetRef.current.y - lerpPos.current.y) * alpha;
    lerpPos.current.z += (targetRef.current.z - lerpPos.current.z) * alpha;
    groupRef.current.position.set(lerpPos.current.x, lerpPos.current.y, lerpPos.current.z);
  });

  // Résolution des matériaux
  const buckets = entityTextureMaterials?.[blueprint.id];
  const mats = currentState
    ? (buckets?.states?.[currentState.id] ?? buckets?.base)
    : buckets?.base;

  const faceOrder = ['east', 'west', 'top', 'bottom', 'south', 'north'];

  return (
    <group
      ref={groupRef}
      rotation={[0, rot, 0]}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <mesh userData={{ isEntity: true, entityId: entity.id }}>
        <boxGeometry args={[width, height, depth]} />
        {faceOrder.map((faceName, i) => {
          const baseFaceVal = blueprint.geometry?.faces?.[faceName];
          if (baseFaceVal === null) {
            return (
              <meshBasicMaterial
                key={i}
                attach={`material-${i}`}
                transparent
                opacity={0}
              />
            );
          }
          const mat = mats?.faceMaterials?.[i];
          if (!mat) {
            return (
              <meshBasicMaterial
                key={i}
                attach={`material-${i}`}
                color={0xFF00FF}
                transparent
                opacity={stateOpacity * (isGmOnly ? 0.5 : 1)}
              />
            );
          }
          return (
            <meshLambertMaterial
              key={i}
              attach={`material-${i}`}
              {...mat}
              transparent={true}
              opacity={stateOpacity * (isGmOnly ? 0.5 : 1)}
            />
          );
        })}
      </mesh>

      {/* Liseré Alt */}
      {altPressed && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#00ffff" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Overlay GM */}
      {isGmOnly && (
        <mesh scale={[1.03, 1.03, 1.03]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#a855f7" side={THREE.BackSide} wireframe />
        </mesh>
      )}

      {/* Hitbox invisible */}
      <mesh
        position={[0, 0.4, 0]}
        visible={false}
        userData={{ isEntity: true, entityId: entity.id }}
      >
        <boxGeometry args={[width * 1.4, height + 0.8, depth * 1.4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Icône Html */}
      {hasInteractions && (
        <HoverIcon entity={entity} height={height} hovered={hovered} onEntityClick={onEntityClick} />
      )}
      <PendingWaitIcon height={height} isPending={isPending} />
    </group>
  );
}

// --- HoverIcon (VOTRE VERSION ORIGINALE, INCHANGÉE) ---
function HoverIcon({ entity, height, hovered, onEntityClick }) {
  return (
    <Html
      position={[0, height / 2 + 0.4, 0]}
      center
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div
        onClick={(e) => {
          e.stopPropagation();
          onEntityClick?.(entity, e.clientX, e.clientY);
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
  );
}

// --- PendingWaitIcon — sablier animé visible uniquement quand l'entité attend l'arbitrage GM ---
function PendingWaitIcon({ height, isPending }) {
  return (
    <Html
      position={[0, height / 2 + 1.0, 0]}
      center
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <span
        className="entity-pending"
        style={{ display: isPending ? 'inline-block' : 'none' }}
      >
        ⏳
      </span>
    </Html>
  );
}