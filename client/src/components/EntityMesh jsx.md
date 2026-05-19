import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

// --- EntityMesh ---
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

  // URL absolue pour useGLTF (correction 1/2)
  const glbUrl = glb_url
    ? `${import.meta.env.VITE_API_URL}/api/assets/${glb_url}`
    : null;

  return glbUrl ? (
    <EntityMeshGlb
      entity={entity}
      blueprint={blueprint}
      glbUrl={glbUrl}  // ✅ Passe l'URL absolue
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
  glbUrl,  // ✅ Reçoit l'URL absolue
  posX, posY, posZ,
  width, height, depth, rot,
  stateOpacity, altPressed, isGmOnly,
  onHover, onEntityClick,
}) {
  const hasInteractions = (blueprint.interactions || []).length > 0;
  const [hovered, setHovered] = React.useState(false);
  const leaveTimerRef = useRef(null);

  // Chargement du GLB avec l'URL absolue (correction 2/2)
  const { scene } = useGLTF(glbUrl);  // ✅ glbUrl = URL absolue

  // Applique les modifications d'opacité DIRECTEMENT sur la scène chargée
  useEffect(() => {
    if (scene) {
      scene.traverse((child) => {
        if (child.isMesh && child.material) {
          // ✅ Ne clone PAS les matériaux (conserve les textures embeddées)
          if (isGmOnly || stateOpacity < 1) {
            child.material.transparent = true;  // PE19
            child.material.opacity = stateOpacity * (isGmOnly ? 0.5 : 1);
            child.material.needsUpdate = true;  // Force la mise à jour
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
      {/* ✅ Utilise la scène ORIGINALE (non clonée) */}
      <primitive object={scene} />

      {/* Hitbox invisible (inchangé) */}
      <mesh position={[0, 0.4, 0]} visible={false}>
        <boxGeometry args={[width * 1.4, height + 0.8, depth * 1.4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Liseré Alt (inchangé) */}
      {altPressed && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#00ffff" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Overlay GM (inchangé) */}
      {isGmOnly && (
        <mesh scale={[1.03, 1.03, 1.03]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#a855f7" side={THREE.BackSide} wireframe />
        </mesh>
      )}

      {/* Icône Html (inchangé) */}
      {hasInteractions && (
        <HoverIcon entity={entity} height={height} hovered={hovered} onEntityClick={onEntityClick} />
      )}
    </group>
  );
}

// --- EntityMeshVoxel (INCHANGÉ) ---
// ... (votre code existant pour les voxels, sans modification)

// --- HoverIcon (INCHANGÉ) ---
// ... (votre code existant)