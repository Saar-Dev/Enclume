// roughness/metalness = base PBR (0=miroir/non-metal .. 1=diffus/metal), avant modulation par pixel
// (usure, rouille, saleté — voir generateProceduralMaterialTexture). Seule source de verite pour le
// rendu Three.js : SurfaceDungeonScene.jsx lit ces champs, aucune valeur dupliquee ailleurs.
import { sampleDisplacementMap, isDisplacementMapReady, onDisplacementMapReady } from './displacementMaps.js'
const MATERIAL_PRESETS = [
  {
    id: 'steel',
    label: 'Acier',
    substrate: [122, 130, 132],
    dark: [46, 52, 55],
    light: [190, 198, 198],
    rust: true,
    roughness: 0.55,
    metalness: 0.42,
  },
  {
    id: 'plastic',
    label: 'Plastique',
    substrate: [82, 88, 98],
    dark: [36, 40, 48],
    light: [190, 196, 208],
    rust: false,
    roughness: 0.62,
    metalness: 0.02,
  },
  {
    id: 'wood',
    label: 'Bois',
    substrate: [132, 82, 42],
    dark: [72, 42, 24],
    light: [190, 128, 72],
    rust: false,
    roughness: 0.78,
    metalness: 0.02,
  },
  {
    id: 'concrete',
    label: 'Beton',
    substrate: [118, 120, 116],
    dark: [64, 66, 64],
    light: [170, 172, 166],
    rust: false,
    roughness: 0.88,
    metalness: 0.01,
  },
  {
    id: 'stainless_steel',
    label: 'Acier inoxydable',
    substrate: [150, 156, 160],
    dark: [70, 76, 82],
    light: [210, 215, 218],
    rust: false,
    roughness: 0.32,
    metalness: 0.85,
  },
  {
    id: 'aluminum',
    label: 'Aluminium',
    substrate: [172, 176, 180],
    dark: [96, 100, 104],
    light: [225, 228, 230],
    rust: false,
    roughness: 0.28,
    metalness: 0.82,
  },
  {
    id: 'titanium',
    label: 'Titane',
    substrate: [120, 118, 116],
    dark: [55, 52, 50],
    light: [175, 172, 168],
    rust: false,
    roughness: 0.42,
    metalness: 0.78,
  },
  {
    id: 'anticorrosion_coating',
    label: 'Revetement anticorrosion',
    substrate: [96, 108, 98],
    dark: [42, 50, 44],
    light: [150, 164, 150],
    rust: false,
    // Revetement = peinture protectrice, pas un metal nu : quasi non-metallique.
    roughness: 0.65,
    metalness: 0.05,
  },
]

const PATTERN_PRESETS = [
  // Les motifs procéduraux dessinés à la main (lignes/cercles) ont été retirés (§14.2, 2026-09-30,
  // Saar : « on peut les dégager ») — les motifs importés ci-dessous (vrai relief) les remplacent
  // tous. 'none' reste : c'est un état (pas de relief), pas un motif à comparer aux autres.
  { id: 'none', label: 'Aucun motif', group: 'Procédural' },

  // ─── Motifs importés (relief réel, PLAN_WORLD_BUILDER_REWORK.md §13) ───
  // Height maps fournies par Saar (ambientCG et équivalents, licence CC0), recadrées 512px, hors
  // dossier SOURCE/ (originaux 1K/4K, jamais servis par le client). `src` = seule différence
  // structurelle avec un motif procédural — voir IMPORTED_PATTERN_SRC plus bas.
  { id: 'img_metal_box_profile', label: 'Tôle profilée (relief réel)', group: 'Métal', src: '/textures/displacement/metal/box_profile_metal_sheet_512.png' },
  { id: 'img_metal_chainmail', label: 'Cotte de mailles (relief réel)', group: 'Métal', src: '/textures/displacement/metal/chainmail_512.png' },
  { id: 'img_metal_corrugated', label: 'Tôle ondulée (relief réel)', group: 'Métal', src: '/textures/displacement/metal/corrugated_iron_512.png' },
  { id: 'img_metal_fence', label: 'Grillage (relief réel)', group: 'Métal', src: '/textures/displacement/metal/fence_512.png' },
  { id: 'img_metal_rust', label: 'Métal rouillé (relief réel)', group: 'Métal', src: '/textures/displacement/metal/metal_rust_512.png' },
  { id: 'img_metal_rusty', label: 'Tôle rouillée 1 (relief réel)', group: 'Métal', src: '/textures/displacement/metal/rusty_metal_512.png' },
  { id: 'img_metal_rusty_02', label: 'Tôle rouillée 2 (relief réel)', group: 'Métal', src: '/textures/displacement/metal/rusty_metal_02_512.png' },
  { id: 'img_metal_rusty_shutter', label: 'Rideau métallique rouillé (relief réel)', group: 'Métal', src: '/textures/displacement/metal/rusty_metal_shutter_512.png' },
  { id: 'img_metal_worn_shutter', label: 'Rideau métallique usé (relief réel)', group: 'Métal', src: '/textures/displacement/metal/worn_shutter_512.png' },

  { id: 'img_tiles_black_metal_2', label: 'Tôle noire 1 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/black_metal_2_512.png' },
  { id: 'img_tiles_black_metal_3', label: 'Tôle noire 2 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/black_metal_3_512.png' },
  { id: 'img_tiles_metal_6', label: 'Tôle 6 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/metal_6_512.png' },
  { id: 'img_tiles_grate_rusty', label: 'Grille rouillée (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/metal_grate_rusty_512.png' },
  { id: 'img_tiles_plate_02', label: 'Plaque métallique 2 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/metal_plate_02_512.png' },
  { id: 'img_tiles_plate', label: 'Plaque métallique 1 (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/metal_plate_512.png' },
  { id: 'img_tiles_rusty_grid', label: 'Grille rouillée fine (relief réel)', group: 'Tôles et grilles', src: '/textures/displacement/metal-tiles/rusty_metal_grid_512.png' },

  { id: 'img_concrete_asphalt', label: 'Asphalte (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/asphalt_512.png' },
  { id: 'img_concrete_asphalt_clean', label: 'Asphalte propre (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/clean_asphalt_512.png' },
  { id: 'img_concrete_brushed', label: 'Béton brossé (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/brushed_concrete_512.png' },
  { id: 'img_concrete_floor_damaged', label: 'Sol béton endommagé (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/concrete_floor_damaged_512.png' },
  { id: 'img_concrete_floor_worn', label: 'Sol béton usé (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/concrete_floor_worn_512.png' },
  { id: 'img_concrete_slab_wall', label: 'Mur en dalles de béton (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/concrete_slab_wall_512.png' },
  { id: 'img_concrete_wall', label: 'Mur béton (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/concrete_wall_512.png' },
  { id: 'img_concrete_painted', label: 'Béton peint (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/painted_concrete_512.png' },
  { id: 'img_concrete_plastered_wall', label: 'Mur enduit (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/plastered_wall_512.png' },
  { id: 'img_concrete_worn_floor', label: 'Sol béton usé 2 (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/worn_concrete_floor_512.png' },
  { id: 'img_concrete_mossy_plaster', label: 'Mur enduit moussu (relief réel)', group: 'Béton', src: '/textures/displacement/concrete/worn_mossy_plasterwall_512.png' },

  { id: 'img_plaster_1', label: 'Plâtre 1 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_1_512.png' },
  { id: 'img_plaster_2', label: 'Plâtre 2 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_2_512.png' },
  { id: 'img_plaster_3', label: 'Plâtre 3 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_3_512.png' },
  { id: 'img_plaster_3b', label: 'Plâtre 3 — variante (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_3_height-1K.png' },
  { id: 'img_plaster_4', label: 'Plâtre 4 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_4_512.png' },
  { id: 'img_plaster_5', label: 'Plâtre 5 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_5_512.png' },
  { id: 'img_plaster_6', label: 'Plâtre 6 (relief réel)', group: 'Plâtre', src: '/textures/displacement/plaster/plaster_6_512.png' },

  { id: 'img_plastic_rubber_tiles', label: 'Dalles caoutchouc (relief réel)', group: 'Plastique/caoutchouc', src: '/textures/displacement/plastic/rubber_tiles_512.png' },
  { id: 'img_plastic_running_track', label: 'Revêtement piste (relief réel)', group: 'Plastique/caoutchouc', src: '/textures/displacement/plastic/running_track_512.png' },
]

const IMPORTED_PATTERN_SRC = Object.fromEntries(
  PATTERN_PRESETS.filter(preset => preset.src).map(preset => [preset.id, preset.src]),
)

// Pas de préchargement massif ici (36 fichiers à chaque chargement de l'app, coûteux et inutile
// pour des motifs non utilisés) — chargement paresseux, déclenché par sampleDisplacementMap() au
// premier échantillonnage réel. Ces deux fonctions permettent à un appelant (SurfaceDungeonScene.jsx)
// de savoir si un motif est prêt et de réagir quand il le devient, sans connaître le mécanisme de
// cache interne à displacementMaps.js.
export function isImportedPatternReady(patternId) {
  const src = IMPORTED_PATTERN_SRC[patternId]
  return !src || isDisplacementMapReady(src)
}

export function onImportedPatternReady(patternId, callback) {
  const src = IMPORTED_PATTERN_SRC[patternId]
  if (!src) return () => {}
  return onDisplacementMapReady(src, callback)
}

export const PROCEDURAL_MATERIAL_PRESETS = MATERIAL_PRESETS
export const PROCEDURAL_PATTERN_PRESETS = PATTERN_PRESETS

// Regroupe les motifs par `group` (ordre de première apparition) pour un <select> en <optgroup> —
// calculé une fois ici plutôt que dans chaque composant qui affiche la liste.
export const PROCEDURAL_PATTERN_GROUPS = (() => {
  const order = []
  const byGroup = new Map()
  for (const preset of PATTERN_PRESETS) {
    const group = preset.group || 'Procédural'
    if (!byGroup.has(group)) {
      byGroup.set(group, [])
      order.push(group)
    }
    byGroup.get(group).push(preset)
  }
  return order.map(group => ({ group, patterns: byGroup.get(group) }))
})()

export const DEFAULT_PROCEDURAL_MATERIAL = {
  label: 'Acier peint - plaques',
  material: 'steel',
  paint: '#6f7f8e',
  pattern: 'metal_panels',
  wear: 35,
  dirt: 25,
  relief: 70,
  realRelief: true,
  categoryLabel: 'Sol',
  seed: 'enclume',
  patternScale: 1,
}

export const DEFAULT_SURFACE_MATERIAL_PRESET = {
  material: DEFAULT_PROCEDURAL_MATERIAL.material,
  paint: DEFAULT_PROCEDURAL_MATERIAL.paint,
  pattern: 'none',
  wear: 0,
  dirt: 0,
  relief: 0,
  realRelief: true,
  seed: DEFAULT_PROCEDURAL_MATERIAL.seed,
  patternScale: 1,
}

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function mixColor(a, b, t) {
  return [
    lerp(a[0], b[0], t),
    lerp(a[1], b[1], t),
    lerp(a[2], b[2], t),
  ]
}

function rgbToCss(rgb, alpha = 1) {
  return `rgba(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])}, ${alpha})`
}

function paintCoverageFor(material) {
  if (material.id === 'wood') return 0.35
  if (material.id === 'concrete') return 0.45
  // Metal brut (non revetu) : laisse davantage voir la teinte propre du materiau sous la peinture.
  if (material.id === 'stainless_steel' || material.id === 'aluminum' || material.id === 'titanium') return 0.55
  return 0.78
}

function hexToRgb(value) {
  const hex = String(value || '#ffffff').replace('#', '')
  const full = hex.length === 3
    ? hex.split('').map(c => c + c).join('')
    : hex.padEnd(6, '0').slice(0, 6)
  return [
    Number.parseInt(full.slice(0, 2), 16),
    Number.parseInt(full.slice(2, 4), 16),
    Number.parseInt(full.slice(4, 6), 16),
  ]
}

function hashString(value) {
  let hash = 2166136261
  const str = String(value)
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function makeRng(seed) {
  let state = hashString(seed) || 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) / 4294967296)
  }
}

function hash2(x, y, seed) {
  let h = hashString(seed)
  h ^= Math.imul(Math.floor(x), 374761393)
  h ^= Math.imul(Math.floor(y), 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function smoothstep(t) {
  return t * t * (3 - 2 * t)
}

function valueNoise(x, y, scale, seed) {
  const sx = x / scale
  const sy = y / scale
  const x0 = Math.floor(sx)
  const y0 = Math.floor(sy)
  const fx = smoothstep(sx - x0)
  const fy = smoothstep(sy - y0)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fy)
}

function fractalNoise(x, y, size, seed) {
  const coarse = valueNoise(x, y, Math.max(8, size / 4), `${seed}:coarse`)
  const medium = valueNoise(x, y, Math.max(4, size / 12), `${seed}:medium`)
  const fine = valueNoise(x, y, Math.max(2, size / 32), `${seed}:fine`)
  return coarse * 0.5 + medium * 0.35 + fine * 0.15
}

function materialBase(material, x, y, size, seed) {
  const n = fractalNoise(x, y, size, `${seed}:base`)
  if (material.id === 'wood') {
    const grain = Math.sin((x / size) * Math.PI * 16 + valueNoise(x, y, size / 5, `${seed}:grain`) * 8)
    const t = clamp(0.45 + grain * 0.22 + n * 0.18)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.48 + grain * 0.025 + n * 0.035,
    }
  }

  if (material.id === 'concrete') {
    const t = clamp(0.42 + n * 0.32 + (hash2(x, y, `${seed}:speckle`) - 0.5) * 0.16)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.48 + (n - 0.5) * 0.06,
    }
  }

  if (material.id === 'plastic' || material.id === 'anticorrosion_coating') {
    // Peinture/revetement lisse : pas de metal brut sous-jacent, donc pas de stries d'usinage.
    const t = clamp(0.48 + n * 0.16)
    return {
      color: mixColor(material.dark, material.light, t),
      height: 0.5 + (n - 0.5) * 0.025,
    }
  }

  const brushed = Math.sin((y / size) * Math.PI * 46 + valueNoise(x, y, size / 8, `${seed}:brushed`) * 3)
  const t = clamp(0.45 + n * 0.22 + brushed * 0.08)
  return {
    color: mixColor(material.dark, material.light, t),
    height: 0.5 + brushed * 0.018 + (n - 0.5) * 0.035,
  }
}

function drawLineHeight(height, size, x1, y1, x2, y2, width, delta) {
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - width - 1))
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + width + 1))
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - width - 1))
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + width + 1))
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = Math.max(0.0001, dx * dx + dy * dy)

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const t = clamp(((x - x1) * dx + (y - y1) * dy) / lenSq)
      const px = x1 + dx * t
      const py = y1 + dy * t
      const dist = Math.hypot(x - px, y - py)
      if (dist > width) continue
      const k = 1 - dist / width
      height[y * size + x] += delta * k
    }
  }
}

function drawCircleHeight(height, size, cx, cy, radius, delta) {
  const minX = Math.max(0, Math.floor(cx - radius))
  const maxX = Math.min(size - 1, Math.ceil(cx + radius))
  const minY = Math.max(0, Math.floor(cy - radius))
  const maxY = Math.min(size - 1, Math.ceil(cy + radius))

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dist = Math.hypot(x - cx, y - cy)
      if (dist > radius) continue
      const k = 1 - smoothstep(dist / radius)
      height[y * size + x] += delta * k
    }
  }
}

// Motif importé (§14) : échantillonne une vraie height map au lieu de dessiner des lignes/cercles
// à la main — la valeur brute (0..1) est recentrée autour de 0 pour rester compatible avec le
// même buffer `height` que tous les motifs procéduraux (un delta, pas une hauteur absolue).
// `scale` (§18) DIVISE u,v avant l'appel (`sampleDisplacementMap` tuile déjà en modulo) : un facteur
// >1 fait apparaître le motif plus grand (on n'en voit qu'une fraction sur la tuile), <1 le fait
// paraître plus petit/dense (plusieurs répétitions) — sens choisi pour matcher la lecture naturelle
// de « Échelle ×N » (plus grand nombre = motif plus grand), trouvé inversé en testant (Saar, 2026-09-30).
function sampleImportedPatternHeight(src, x, y, size, relief, scale = 1) {
  const raw = sampleDisplacementMap(src, (x / size) / scale, (y / size) / scale)
  return (raw - 0.5) * 0.5 * relief
}

function applyImportedPattern(height, size, src, relief, scale) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      height[y * size + x] += sampleImportedPatternHeight(src, x, y, size, relief, scale)
    }
  }
}

function patternScaleOf(options) {
  const scale = Number(options?.patternScale)
  return scale > 0 ? scale : 1
}

function applyPattern(height, options, size) {
  const relief = clamp(options.relief / 100)
  const importedSrc = IMPORTED_PATTERN_SRC[options.pattern]
  if (importedSrc) {
    applyImportedPattern(height, size, importedSrc, relief, patternScaleOf(options))
  }
}

function lineFalloff(distance, halfWidth) {
  if (distance >= halfWidth) return 0
  return 1 - smoothstep(distance / halfWidth)
}

function mixPixel(data, index, color, amount) {
  const t = clamp(amount)
  data[index] = lerp(data[index], color[0], t)
  data[index + 1] = lerp(data[index + 1], color[1], t)
  data[index + 2] = lerp(data[index + 2], color[2], t)
}

function samplePatternHeight(pattern, x, y, size, relief, scale) {
  const importedSrc = IMPORTED_PATTERN_SRC[pattern]
  if (!importedSrc) return 0
  return sampleImportedPatternHeight(importedSrc, x, y, size, relief, scale)
}

export function makeProceduralMaterialDescriptor(options) {
  return {
    type: 'procedural-material',
    version: 1,
    material: options.material || DEFAULT_PROCEDURAL_MATERIAL.material,
    paint: options.paint || DEFAULT_PROCEDURAL_MATERIAL.paint,
    pattern: options.pattern || DEFAULT_PROCEDURAL_MATERIAL.pattern,
    wear: Number(options.wear) || 0,
    dirt: Number(options.dirt) || 0,
    relief: Number(options.relief) || 0,
    realRelief: options.realRelief !== false,
    seed: options.seed || DEFAULT_PROCEDURAL_MATERIAL.seed,
    patternScale: patternScaleOf(options),
  }
}

export function sampleProceduralMaterialHeight(u, v, options) {
  const descriptor = makeProceduralMaterialDescriptor(options || {})
  const relief = clamp(descriptor.relief / 100)
  if (relief <= 0.001) return 0.5

  const size = 128
  const material = MATERIAL_PRESETS.find(preset => preset.id === descriptor.material) || MATERIAL_PRESETS[0]
  const wrappedU = ((Number(u) || 0) % 1 + 1) % 1
  const wrappedV = ((Number(v) || 0) % 1 + 1) % 1
  const x = wrappedU * size
  const y = wrappedV * size
  const wear = clamp(descriptor.wear / 100)
  const dirt = clamp(descriptor.dirt / 100)
  const seed = `${descriptor.seed}:${material.id}:${descriptor.pattern}:${descriptor.paint}`

  const base = materialBase(material, x, y, size, seed)
  const wearField = fractalNoise(x, y, size, `${seed}:wearmask`)
  const reveal = clamp((wearField - (1 - wear * 0.75)) / Math.max(0.02, wear * 0.75))

  let height = 0.5 + (base.height - 0.5) * relief
  height -= reveal * 0.035 * relief
  height += samplePatternHeight(descriptor.pattern, x, y, size, relief, descriptor.patternScale)
  height += (fractalNoise(x, y, size, `${seed}:real-dirt`) - 0.5) * dirt * relief * 0.035

  return height
}

function applyWear(ctx, height, roughness, material, options, size, seed) {
  const wear = clamp(options.wear / 100)
  if (wear <= 0.01) return
  const rng = makeRng(`${seed}:wear`)
  const scratchCount = Math.round(wear * size * 0.75)

  ctx.save()
  ctx.lineCap = 'round'
  for (let i = 0; i < scratchCount; i += 1) {
    const x = rng() * size
    const y = rng() * size
    const len = size * (0.08 + rng() * 0.35)
    const angle = (rng() - 0.5) * Math.PI * 0.45
    const x2 = x + Math.cos(angle) * len
    const y2 = y + Math.sin(angle) * len
    const width = 0.5 + rng() * Math.max(1, size * 0.006)
    ctx.strokeStyle = rng() > 0.5 ? 'rgba(245, 248, 248, 0.32)' : 'rgba(0, 0, 0, 0.28)'
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    drawLineHeight(height, size, x, y, x2, y2, width * 2, -0.08 * wear)
    // Une rayure expose le metal nu : plus brillant que la peinture autour.
    drawLineHeight(roughness, size, x, y, x2, y2, width * 2, -0.22 * wear)
  }
  ctx.restore()

  const chipCount = Math.round(wear * 18)
  for (let i = 0; i < chipCount; i += 1) {
    const cx = rng() * size
    const cy = rng() * size
    const r = size * (0.015 + rng() * 0.055) * wear
    ctx.save()
    ctx.fillStyle = rgbToCss(material.substrate, 0.55)
    ctx.beginPath()
    const points = 8
    for (let p = 0; p <= points; p += 1) {
      const a = (p / points) * Math.PI * 2
      const rr = r * (0.65 + rng() * 0.55)
      const x = cx + Math.cos(a) * rr
      const y = cy + Math.sin(a) * rr
      if (p === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.restore()
    drawCircleHeight(height, size, cx, cy, r, -0.1 * wear)
    drawCircleHeight(roughness, size, cx, cy, r, -0.2 * wear)
  }

  if (material.rust) {
    const image = ctx.getImageData(0, 0, size, size)
    const data = image.data
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const i = (y * size + x) * 4
        const n = fractalNoise(x, y, size, `${seed}:rust-field`)
        const pores = hash2(x, y, `${seed}:rust-pores`)
        const openPaint = clamp((n - (0.7 - wear * 0.28)) / Math.max(0.08, wear * 0.55))
        const rust = clamp((openPaint * 0.72 + pores * 0.08 - 0.18) * wear)
        if (rust <= 0.01) continue
        mixPixel(data, i, mixColor([72, 28, 12], [185, 88, 30], pores), rust * 0.72)
        height[y * size + x] += rust * 0.03
        // La rouille est mate : elle efface le brillant du metal, meme sous une rayure fraiche.
        roughness[y * size + x] += rust * 0.35
      }
    }
    ctx.putImageData(image, 0, 0)
  }
}

function applyDirt(ctx, height, roughness, options, size, seed) {
  const dirt = clamp(options.dirt / 100)
  if (dirt <= 0.01) return
  const rng = makeRng(`${seed}:dirt`)

  const image = ctx.getImageData(0, 0, size, size)
  const data = image.data
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      const edgeDistance = Math.min(x, y, size - x, size - y)
      const edge = lineFalloff(edgeDistance, size * 0.18)
      const field = fractalNoise(x, y, size, `${seed}:grime-field`)
      const patches = clamp((field - 0.36) / 0.48)
      const fine = hash2(x, y, `${seed}:dust-fine`)
      const grime = clamp(dirt * (patches * 0.28 + edge * 0.2 + (fine - 0.5) * 0.07))
      if (grime <= 0.002) continue
      const dust = fine > 0.78
        ? [134, 124, 98]
        : [32, 28, 22]
      mixPixel(data, i, dust, grime * (fine > 0.78 ? 0.35 : 0.58))
      height[y * size + x] -= grime * 0.055
      // La crasse est mate : elle noie le brillant du materiau sous-jacent.
      roughness[y * size + x] += grime * 0.3
    }
  }
  ctx.putImageData(image, 0, 0)

  ctx.save()
  ctx.globalCompositeOperation = 'multiply'
  ctx.lineCap = 'round'
  const streakCount = Math.round(dirt * 9)
  for (let i = 0; i < streakCount; i += 1) {
    const x = rng() * size
    const y = rng() * size * 0.35
    const len = size * (0.18 + rng() * 0.55)
    const width = Math.max(1, size * (0.008 + rng() * 0.018))
    const alpha = 0.08 + dirt * 0.12 * rng()
    ctx.strokeStyle = `rgba(34, 28, 20, ${alpha})`
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.bezierCurveTo(x + (rng() - 0.5) * size * 0.08, y + len * 0.35, x + (rng() - 0.5) * size * 0.08, y + len * 0.7, x + (rng() - 0.5) * size * 0.05, y + len)
    ctx.stroke()
  }
  ctx.restore()

  const speckles = Math.round(size * size * dirt * 0.003)
  ctx.save()
  for (let i = 0; i < speckles; i += 1) {
    const x = rng() * size
    const y = rng() * size
    const r = 0.35 + rng() * Math.max(0.9, size * 0.004)
    ctx.fillStyle = rng() > 0.35 ? 'rgba(18, 14, 10, 0.18)' : 'rgba(190, 178, 140, 0.12)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function makeNormalMap(height, size, strength) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  const data = image.data
  const scale = clamp(strength / 100, 0, 1) * 5.5

  const sample = (x, y) => {
    const sx = (x + size) % size
    const sy = (y + size) % size
    return height[sy * size + sx]
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * scale
      const dy = (sample(x, y - 1) - sample(x, y + 1)) * scale
      const dz = 1
      const inv = 1 / Math.hypot(dx, dy, dz)
      const i = (y * size + x) * 4
      data[i] = Math.round((dx * inv * 0.5 + 0.5) * 255)
      data[i + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255)
      data[i + 2] = Math.round((dz * inv * 0.5 + 0.5) * 255)
      data[i + 3] = 255
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

// Une creuse (arete de plaque, rivet, soudure...) accumule la poussiere/graisse et disperse la
// lumiere plus qu'un plat : meme principe que la normal map (gradient de hauteur), applique a la
// rugosite au lieu de l'orientation. Generique : couvre les 15 motifs sans toucher chacun un par un.
function applyEdgeRoughness(height, roughness, size) {
  const scale = 3.2
  const gain = 0.9
  const maxBoost = 0.4

  const sample = (x, y) => {
    const sx = (x + size) % size
    const sy = (y + size) % size
    return height[sy * size + sx]
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (sample(x - 1, y) - sample(x + 1, y)) * scale
      const dy = (sample(x, y - 1) - sample(x, y + 1)) * scale
      const magnitude = Math.hypot(dx, dy)
      roughness[y * size + x] += Math.min(maxBoost, magnitude * gain)
    }
  }
}

// Les effets (usure, rouille, salete, aretes) s'additionnent librement pixel par pixel, mais ne
// doivent jamais effacer l'identite du materiau : de l'acier raye reste un metal terne, jamais un
// miroir ; de la rouille reste rugueuse, jamais totalement mate a 1.0. Bande physique bornee autour
// de la rugosite de base plutot qu'un clamp [0,1] brut — sinon l'accumulation d'effets independants
// (constate sur l'Acier : rouille + usure au maximum par defaut) produit des extremes irrealistes.
function clampRoughnessBand(roughness, size, material) {
  const min = material.roughness * 0.5
  const max = Math.min(1, material.roughness + 0.4)
  for (let i = 0; i < size * size; i += 1) {
    roughness[i] = clamp(roughness[i], min, max)
  }
}

function makeRoughnessMap(roughness, size) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  const data = image.data

  for (let i = 0; i < size * size; i += 1) {
    const v = Math.round(clamp(roughness[i]) * 255)
    const o = i * 4
    data[o] = v
    data[o + 1] = v
    data[o + 2] = v
    data[o + 3] = 255
  }

  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

export function generateProceduralMaterialTexture(options) {
  const size = Math.max(32, Math.min(512, Number(options.size) || 128))
  const material = MATERIAL_PRESETS.find(preset => preset.id === options.material) || MATERIAL_PRESETS[0]
  const paint = hexToRgb(options.paint)
  const wear = clamp(options.wear / 100)
  const seed = `${options.seed || 'enclume'}:${material.id}:${options.pattern}:${options.paint}`
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const image = ctx.createImageData(size, size)
  const data = image.data
  const height = new Float32Array(size * size)
  const roughness = new Float32Array(size * size).fill(material.roughness)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const base = materialBase(material, x, y, size, seed)
      const wearField = fractalNoise(x, y, size, `${seed}:wearmask`)
      const reveal = clamp((wearField - (1 - wear * 0.75)) / Math.max(0.02, wear * 0.75))
      const paintCoverage = paintCoverageFor(material)
      let color = mixColor(base.color, paint, paintCoverage)
      color = mixColor(color, base.color, reveal * 0.82)

      const grime = (hash2(x, y, `${seed}:pixel`) - 0.5) * 18
      const i = (y * size + x) * 4
      data[i] = clamp(color[0] + grime, 0, 255)
      data[i + 1] = clamp(color[1] + grime, 0, 255)
      data[i + 2] = clamp(color[2] + grime, 0, 255)
      data[i + 3] = 255
      height[y * size + x] = base.height - reveal * 0.035
      // Le metal expose par l'usure est plus brillant que la peinture qu'il remplace.
      roughness[y * size + x] -= reveal * 0.25
    }
  }

  ctx.putImageData(image, 0, 0)
  applyPattern(height, options, size)
  applyWear(ctx, height, roughness, material, options, size, seed)
  applyDirt(ctx, height, roughness, options, size, seed)
  applyEdgeRoughness(height, roughness, size)
  clampRoughnessBand(roughness, size, material)

  return {
    albedoDataUrl: canvas.toDataURL('image/png'),
    normalDataUrl: makeNormalMap(height, size, options.relief),
    roughnessDataUrl: makeRoughnessMap(roughness, size),
    procedural: makeProceduralMaterialDescriptor(options),
    material,
    pattern: PATTERN_PRESETS.find(pattern => pattern.id === options.pattern) || PATTERN_PRESETS[0],
  }
}
