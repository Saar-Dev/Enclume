import * as THREE from 'three'

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveStrength;
  uniform float uFlow;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWave;

  void main() {
    vec3 p = position;
    float waveA = sin((p.x * 3.1 + p.z * 2.3) + uTime * 1.15);
    float waveB = sin((p.x * -5.2 + p.z * 3.7) + uTime * 1.73);
    float flowWave = sin(p.y * 8.0 - uTime * 5.0 + p.x * 3.0);
    float wave = mix(waveA * 0.65 + waveB * 0.35, flowWave, uFlow);
    p += normal * wave * uWaveStrength;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPosition = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vWave = wave;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeepColor;
  uniform vec3 uShallowColor;
  uniform vec3 uFoamColor;
  uniform float uOpacity;
  uniform float uFlow;
  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying float vWave;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 2.4);
    vec2 flowUv = mix(vWorldPosition.xz, vec2(vWorldPosition.x, -vWorldPosition.y), uFlow);
    flowUv += vec2(uTime * 0.035, -uTime * mix(0.025, 0.42, uFlow));
    float detail = noise(flowUv * mix(4.0, 7.0, uFlow));
    detail = mix(detail, noise(flowUv * 13.0), 0.3);
    float foam = smoothstep(0.76, 0.98, detail + abs(vWave) * 0.16);
    foam *= mix(0.32, 0.72, uFlow);
    vec3 water = mix(uDeepColor, uShallowColor, 0.24 + detail * 0.38 + fresnel * 0.38);
    water = mix(water, uFoamColor, foam);
    float alpha = clamp(uOpacity + fresnel * 0.2 + foam * 0.25, 0.0, 0.96);
    gl_FragColor = vec4(water, alpha);
  }
`

function meshName(nodeOrName) {
  return typeof nodeOrName === 'string' ? nodeOrName : (nodeOrName?.name || '')
}

function waterRole(nodeOrName) {
  return typeof nodeOrName === 'string' ? '' : String(nodeOrName?.userData?.editor_water_role || '').toLowerCase()
}

export function isWaterMeshName(nodeOrName = '') {
  const role = waterRole(nodeOrName)
  return ['surface', 'flow', 'contained'].includes(role)
    || /(water[_ ]?surface|fluid[_ ]?(window|band)|waterfall|flow[_ ]?sheet)/i.test(meshName(nodeOrName))
}

export function isFlowMeshName(nodeOrName = '') {
  return waterRole(nodeOrName) === 'flow'
    || /(waterfall|flow[_ ]?sheet)/i.test(meshName(nodeOrName))
}

export function isContainedWaterMesh(nodeOrName = '') {
  return waterRole(nodeOrName) === 'contained'
    || /fluid[_ ]?(window|band)/i.test(meshName(nodeOrName))
}

export function isWaterSurfaceMesh(nodeOrName = '') {
  return waterRole(nodeOrName) === 'surface'
    || /water[_ ]?surface/i.test(meshName(nodeOrName))
}

export function createFlowSheetGeometry(sourceGeometry) {
  sourceGeometry.computeBoundingBox()
  const box = sourceGeometry.boundingBox
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  let geometry
  if (size.z <= size.x && size.z <= size.y) {
    geometry = new THREE.PlaneGeometry(size.x, size.y, 24, 16)
  } else if (size.y <= size.x && size.y <= size.z) {
    geometry = new THREE.PlaneGeometry(size.x, size.z, 24, 16)
    // PlaneGeometry regarde initialement vers +Z. Une rotation négative place
    // sa normale vers +Y (le dessus du bac) ; l'ancien signe la tournait vers
    // le fond et forçait un Fresnel maximal, donc une eau trop opaque/blanche.
    geometry.rotateX(-Math.PI / 2)
  } else {
    geometry = new THREE.PlaneGeometry(size.z, size.y, 24, 16)
    geometry.rotateY(Math.PI / 2)
  }
  geometry.translate(center.x, center.y, center.z)
  return geometry
}

export function createWaterMaterial({ algae = false, flow = false, contained = false, opacity } = {}) {
  const baseOpacity = opacity ?? (contained ? 0.44 : flow ? 0.68 : 0.58)
  const material = new THREE.ShaderMaterial({
    name: flow ? 'RuntimeWaterFlow' : 'RuntimeWaterSurface',
    uniforms: {
      uTime: { value: 0 },
      uWaveStrength: { value: contained ? 0.002 : flow ? 0.014 : 0.025 },
      uFlow: { value: flow ? 1 : 0 },
      uDeepColor: { value: new THREE.Color(algae ? '#102d20' : '#063746') },
      uShallowColor: { value: new THREE.Color(algae ? '#47713a' : '#22a9bd') },
      uFoamColor: { value: new THREE.Color(algae ? '#b7c994' : '#d9fbff') },
      uOpacity: { value: baseOpacity },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  material.userData.runtimeWater = true
  material.userData.baseWaterOpacity = baseOpacity
  return material
}

export function updateWaterMaterial(material, elapsedTime) {
  if (material?.userData?.runtimeWater && material.uniforms?.uTime) {
    material.uniforms.uTime.value = elapsedTime
  }
}
