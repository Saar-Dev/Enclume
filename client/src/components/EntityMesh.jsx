import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { useSessionStore } from '../stores/sessionStore';
import {
  createFlowSheetGeometry,
  createWaterMaterial,
  isContainedWaterMesh,
  isFlowMeshName,
  isWaterMeshName,
  isWaterSurfaceMesh,
  updateWaterMaterial,
} from '../lib/waterMaterials';
import { applyMaterialSlotOverrides, normalizeModelMaterialSlots } from '../lib/modelMaterialSlots.js';
import { normalizeEntityScale } from '../../../shared/world/entityTransform.js';

// --- Constantes ---
const ICON_INTERACTION = '⚙';

const ENTITY_FACE_ORDER = ['east', 'west', 'top', 'bottom', 'south', 'north'];
const PREVIEW_OPACITY = 0.42;
const DISABLE_RAYCAST = () => null;

function emitEntityClick(event, entity, onEntityClick) {
  if (!onEntityClick) return;
  event.stopPropagation();
  const pointerEvent = event.nativeEvent || event;
  onEntityClick(
    entity,
    pointerEvent.clientX ?? event.clientX ?? 0,
    pointerEvent.clientY ?? event.clientY ?? 0,
  );
}

function EntitySelectionHalo({ width, height, depth, y = 0 }) {
  return (
    <group position={[0, y, 0]} raycast={DISABLE_RAYCAST}>
      <mesh renderOrder={1000} scale={[1.06, 1.06, 1.06]} raycast={DISABLE_RAYCAST}>
        <boxGeometry args={[Math.max(0.05, width), Math.max(0.05, height), Math.max(0.05, depth)]} />
        <meshBasicMaterial
          color="#ffd34d"
          side={THREE.BackSide}
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh renderOrder={999} scale={[1.16, 1.16, 1.16]} raycast={DISABLE_RAYCAST}>
        <boxGeometry args={[Math.max(0.05, width), Math.max(0.05, height), Math.max(0.05, depth)]} />
        <meshBasicMaterial
          color="#ffb300"
          side={THREE.BackSide}
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <pointLight color="#ffd34d" intensity={0.55} distance={Math.max(width, height, depth) * 2.4} decay={2} />
    </group>
  );
}

// --- EntityMesh (composant principal) ---
export default function EntityMesh({
  entity,
  blueprint,
  entityTextureMaterials,
  altPressed = false,
  isGmOnly = false,
  onHover,
  onEntityClick,
  sceneOpacity = 1,
  isPreview = false,
  isSelected = false,
}) {
  if (!blueprint) return null;

  const { geometry, states, glb_url } = blueprint;
  const stateList = states || [];
  const currentState = stateList[entity.current_state_id] ?? stateList[0] ?? null;
  const scale = normalizeEntityScale(entity.state);

  // Coordonnées (PE14)
  const preservesAuthoredOrigin = geometry?.origin === 'floor-center' || geometry?.origin === 'wall-back-center';
  const posX = preservesAuthoredOrigin
    ? (entity.pos_x ?? 0)
    : (entity.pos_x ?? 0) + (geometry?.width ?? 1) * scale / 2;
  const posY = preservesAuthoredOrigin
    ? (entity.pos_z ?? 0)
    : (entity.pos_z ?? 0) + (geometry?.height ?? 1) * scale / 2;
  const posZ = preservesAuthoredOrigin
    ? (entity.pos_y ?? 0)
    : (entity.pos_y ?? 0) + (geometry?.depth ?? 1) * scale / 2;
  const rot = (entity.r || 0) * (Math.PI / 2);
  const stateOpacity = (currentState?.visual_override?.opacity ?? 1.0)
    * sceneOpacity
    * (isPreview ? PREVIEW_OPACITY : 1);

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
      currentState={currentState}
      rot={rot}
      scale={scale}
      stateOpacity={stateOpacity}
      altPressed={altPressed}
      isGmOnly={isGmOnly}
      onHover={onHover}
      onEntityClick={onEntityClick}
      isPreview={isPreview}
      isSelected={isSelected}
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
      scale={scale}
      stateOpacity={stateOpacity}
      altPressed={altPressed}
      isGmOnly={isGmOnly}
      onHover={onHover}
      onEntityClick={onEntityClick}
      isPreview={isPreview}
      isSelected={isSelected}
    />
  );
}

// --- EntityMeshGlb (CORRIGÉ) ---
function EntityMeshGlb({
  entity,
  blueprint,
  glbUrl,
  posX, posY, posZ,
  width, height, depth, currentState, rot, scale,
  stateOpacity, altPressed, isGmOnly,
  onHover, onEntityClick,
  isPreview, isSelected,
}) {
  const hasInteractions = (blueprint.interactions || []).length > 0;
  const { pendingEntityId } = useSessionStore();
  const isPending = pendingEntityId === entity.id;
  const [hovered, setHovered] = React.useState(false);
  const leaveTimerRef = useRef(null);

  // Chargement du GLB avec l'URL absolue
  const { scene: sourceScene } = useGLTF(glbUrl);
  const materialSlots = useMemo(() => normalizeModelMaterialSlots(blueprint?.geometry), [blueprint?.geometry]);
  const materialOverrides = useMemo(() => ({
    ...(currentState?.visual_override?.materialOverrides || currentState?.visual_override?.material_overrides || {}),
    ...(entity?.state?.materialOverrides || entity?.state?.material_overrides || {}),
  }), [
    currentState?.visual_override?.materialOverrides,
    currentState?.visual_override?.material_overrides,
    entity.state?.materialOverrides,
    entity.state?.material_overrides,
  ]);
  const scene = useMemo(() => {
    const clone = SkeletonUtils.clone(sourceScene);
    clone.traverse((child) => {
      if (!child.isMesh) return;
      child.userData = {
        ...child.userData,
        isEntity: true,
        entityId: entity.id,
      };
      if (isPreview) child.raycast = DISABLE_RAYCAST;
      if (!child.material) return;
      const cloneMaterial = (material) => applyMaterialSlotOverrides(material.clone(), materialSlots, materialOverrides);
      child.material = Array.isArray(child.material)
        ? child.material.map(cloneMaterial)
        : cloneMaterial(child.material);
    });
    return clone;
  }, [sourceScene, materialSlots, materialOverrides, entity.id, isPreview]);
  const waterMaterials = useMemo(() => {
    const materials = [];
    scene.traverse((child) => {
      if (!child.isMesh || !isWaterMeshName(child)) return;
      const material = createWaterMaterial({
        algae: child.userData?.editor_water_medium === 'algae'
          || /algae/i.test(child.name)
          || /algue/i.test(blueprint.name || ''),
        flow: isFlowMeshName(child),
        contained: isContainedWaterMesh(child),
      });
      if (isWaterSurfaceMesh(child)) {
        child.geometry = createFlowSheetGeometry(child.geometry);
        child.userData.runtimeWaterGeometry = true;
      }
      child.material = material;
      child.renderOrder = 15;
      materials.push(material);
    });
    return materials;
  }, [scene, blueprint.name]);

  useEffect(() => () => {
    waterMaterials.forEach(material => material.dispose());
    scene.traverse((child) => {
      if (child.isMesh && child.userData?.runtimeWaterGeometry) child.geometry.dispose();
    });
  }, [scene, waterMaterials]);

  // Applique les modifications d'opacité DIRECTEMENT sur la scène chargée
  useEffect(() => {
  if (scene) {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            const opacity = stateOpacity * (isGmOnly ? 0.5 : 1);
            child.material.forEach((material) => {
              if (material.userData?.runtimeWater) {
                material.transparent = true;
                material.depthWrite = false;
                if (material.uniforms?.uOpacity) {
                  material.uniforms.uOpacity.value = (material.userData.baseWaterOpacity ?? 0.58) * opacity;
                }
                return;
              }
              material.needsUpdate = true;
              material.transparent = opacity < 0.999;
              material.opacity = opacity;
              material.depthWrite = opacity >= 0.999;
            });
            return;
          }
          child.material.needsUpdate = true; // ✅ Force la mise à jour des textures
          const opacity = stateOpacity * (isGmOnly ? 0.5 : 1);
          if (child.material.userData?.runtimeWater) {
            child.material.transparent = true;
            child.material.depthWrite = false;
            if (child.material.uniforms?.uOpacity) {
              child.material.uniforms.uOpacity.value = (child.material.userData.baseWaterOpacity ?? 0.58) * opacity;
            }
            return;
          }
          child.material.transparent = opacity < 0.999;
          child.material.opacity = opacity;
          child.material.depthWrite = opacity >= 0.999;
        }
      }
    });
  }
}, [scene, isGmOnly, stateOpacity]);

  // Lerp pour le mouvement (P40)
  const groupRef = useRef();
  const lerpPos = useRef({ x: posX, y: posY, z: posZ });
  const targetRef = useRef({ x: posX, y: posY, z: posZ });

  useEffect(() => {
    targetRef.current = { x: posX, y: posY, z: posZ };
  }, [posX, posY, posZ]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;
    const alpha = 1 - Math.exp(-delta / 0.1);
    lerpPos.current.x += (targetRef.current.x - lerpPos.current.x) * alpha;
    lerpPos.current.y += (targetRef.current.y - lerpPos.current.y) * alpha;
    lerpPos.current.z += (targetRef.current.z - lerpPos.current.z) * alpha;
    groupRef.current.position.set(lerpPos.current.x, lerpPos.current.y, lerpPos.current.z);
    waterMaterials.forEach(material => updateWaterMaterial(material, state.clock.elapsedTime));
  });

  if (!scene) return null;

  return (
    <group
      ref={groupRef}
      rotation={[0, rot, 0]}
      scale={[scale, scale, scale]}
      onClick={!isPreview && onEntityClick ? event => emitEntityClick(event, entity, onEntityClick) : undefined}
      onPointerEnter={isPreview ? undefined : () => {
        if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
        setHovered(true);
        onHover?.(entity, true);
      }}
      onPointerLeave={isPreview ? undefined : () => {
        leaveTimerRef.current = setTimeout(() => {
          setHovered(false);
          onHover?.(entity, false);
        }, 600);
      }}
    >
      <primitive object={scene} />

      {/* Hitbox invisible */}
      <mesh
        position={[0, 0.4, 0]}
        visible={false}
        userData={{ isEntity: true, entityId: entity.id }}
        raycast={isPreview ? DISABLE_RAYCAST : undefined}
      >
        <boxGeometry args={[width * 1.4, height + 0.8, depth * 1.4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Liseré Alt */}
      {!isPreview && altPressed && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#00ffff" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Overlay GM */}
      {!isPreview && isGmOnly && (
        <mesh scale={[1.03, 1.03, 1.03]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#a855f7" side={THREE.BackSide} wireframe />
        </mesh>
      )}

      {!isPreview && isSelected && (
        <EntitySelectionHalo
          width={width}
          height={height}
          depth={depth}
          y={blueprint.geometry?.origin === 'floor-center' || blueprint.geometry?.origin === 'wall-back-center' ? height / 2 : 0}
        />
      )}

      {/* Icône Html */}
      {!isPreview && hasInteractions && (
        <HoverIcon entity={entity} height={height} hovered={hovered} onEntityClick={onEntityClick} />
      )}
      {!isPreview && <PendingWaitIcon height={height} isPending={isPending} />}
    </group>
  );
}

// --- EntityMeshVoxel (VOTRE VERSION ORIGINALE, INCHANGÉE) ---
function EntityMeshVoxel({
  entity, blueprint, entityTextureMaterials, currentState,
  posX, posY, posZ, width, height, depth, rot, scale,
  stateOpacity, altPressed, isGmOnly, onHover, onEntityClick,
  isPreview, isSelected,
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

  useEffect(() => {
    targetRef.current = { x: posX, y: posY, z: posZ };
  }, [posX, posY, posZ]);

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

  const geometryFaces = blueprint.geometry?.faces;
  const faceMaterials = useMemo(() => {
    const opacity = stateOpacity * (isGmOnly ? 0.5 : 1);
    return ENTITY_FACE_ORDER.map((faceName, i) => {
      const baseFaceVal = geometryFaces?.[faceName];
      if (baseFaceVal === null) {
        return new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
      }

      const source = mats?.faceMaterials?.[i];
      if (!source) {
        return new THREE.MeshBasicMaterial({
          color: 0xff00ff,
          transparent: true,
          opacity,
        });
      }

      const material = source.clone();
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = opacity >= 0.999;
      return material;
    });
  }, [geometryFaces, mats, stateOpacity, isGmOnly]);

  useEffect(() => () => {
    faceMaterials.forEach(material => material.dispose());
  }, [faceMaterials]);

  return (
    <group
      ref={groupRef}
      rotation={[0, rot, 0]}
      scale={[scale, scale, scale]}
      onClick={!isPreview && onEntityClick ? event => emitEntityClick(event, entity, onEntityClick) : undefined}
      onPointerEnter={isPreview ? undefined : handlePointerEnter}
      onPointerLeave={isPreview ? undefined : handlePointerLeave}
    >
      <mesh
        userData={{ isEntity: true, entityId: entity.id }}
        material={faceMaterials}
        raycast={isPreview ? DISABLE_RAYCAST : undefined}
      >
        <boxGeometry args={[width, height, depth]} />
      </mesh>

      {/* Liseré Alt */}
      {!isPreview && altPressed && (
        <mesh scale={[1.05, 1.05, 1.05]}>
          <boxGeometry args={[width, height, depth]} />
          <meshBasicMaterial color="#00ffff" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Overlay GM */}
      {!isPreview && isGmOnly && (
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
        raycast={isPreview ? DISABLE_RAYCAST : undefined}
      >
        <boxGeometry args={[width * 1.4, height + 0.8, depth * 1.4]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {!isPreview && isSelected && (
        <EntitySelectionHalo width={width} height={height} depth={depth} />
      )}

      {/* Icône Html */}
      {!isPreview && hasInteractions && (
        <HoverIcon entity={entity} height={height} hovered={hovered} onEntityClick={onEntityClick} />
      )}
      {!isPreview && <PendingWaitIcon height={height} isPending={isPending} />}
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
