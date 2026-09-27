// roughness/metalness = base PBR (0=miroir/non-metal .. 1=diffus/metal), avant modulation par pixel
// (usure, rouille, saleté — voir generateProceduralMaterialTexture). Seule source de verite pour le
// rendu Three.js : SurfaceDungeonScene.jsx lit ces champs, aucune valeur dupliquee ailleurs.
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
  { id: 'none', label: 'Aucun motif' },
  { id: 'metal_panels', label: 'Plaques rivetees' },
  { id: 'tile_grid', label: 'Dalles jointes' },
  { id: 'planks', label: 'Planches' },
  { id: 'diamond_plate', label: 'Tole striee' },
  { id: 'rough_surface', label: 'Surface rugueuse' },
  { id: 'ribbed_panels', label: 'Panneaux nervures' },
  { id: 'corrugated', label: 'Tole ondulee' },
  { id: 'longitudinal_stripes', label: 'Bandes longitudinales' },
  { id: 'rivet_rings', label: 'Anneaux boulonnes' },
  { id: 'hex_grid', label: 'Trame hexagonale' },
  { id: 'offset_plates', label: 'Plaques superposees' },
  { id: 'concrete_formwork', label: 'Beton coffre' },
  { id: 'concrete_segments', label: 'Beton segmente' },
  { id: 'weld_seams', label: 'Plaques soudees' },
  { id: 'paint_blisters', label: 'Peinture cloquee' },
]

export const PROCEDURAL_MATERIAL_PRESETS = MATERIAL_PRESETS
export const PROCEDURAL_PATTERN_PRESETS = PATTERN_PRESETS

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

// Les traits de motif (soudures, rivets, aretes...) doivent lire comme "ce materiau creuse/brille",
// jamais une couleur universelle : sinon le motif remplace le materiau au lieu de s'y adapter.
function patternGrooveColor(material, alpha) {
  return rgbToCss(mixColor(material.dark, [0, 0, 0], 0.35), alpha)
}
function patternHighlightColor(material, alpha) {
  return rgbToCss(mixColor(material.light, [255, 255, 255], 0.35), alpha)
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

function lowerRect(height, size, x0, y0, w, h, delta) {
  const minX = Math.max(0, Math.floor(x0))
  const maxX = Math.min(size - 1, Math.ceil(x0 + w))
  const minY = Math.max(0, Math.floor(y0))
  const maxY = Math.min(size - 1, Math.ceil(y0 + h))
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      height[y * size + x] += delta
    }
  }
}

function strokeInsetRect(ctx, size, width, color) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.strokeRect(width / 2, width / 2, size - width, size - width)
  ctx.restore()
}

const METAL_PANEL_EDGE_WIDTH_FACTOR = 0.8

function metalPanelLineWidths(size, snapToPixels = false) {
  const rawDetailLine = Math.max(1, size * 0.028 * 0.55)
  const detailLine = snapToPixels ? Math.max(1, Math.round(rawDetailLine)) : rawDetailLine
  return {
    // Deux bords de tuiles se rejoignent : chacun porte moins d'un demi-trait.
    edgeLine: detailLine * METAL_PANEL_EDGE_WIDTH_FACTOR / 2,
    detailLine,
  }
}

function applyMetalPanels(ctx, height, size, relief, material) {
  const { edgeLine, detailLine } = metalPanelLineWidths(size, true)
  strokeInsetRect(ctx, size, edgeLine, patternGrooveColor(material, 0.78))
  lowerRect(height, size, 0, 0, size, edgeLine, -0.28 * relief)
  lowerRect(height, size, 0, size - edgeLine, size, edgeLine, -0.28 * relief)
  lowerRect(height, size, 0, 0, edgeLine, size, -0.28 * relief)
  lowerRect(height, size, size - edgeLine, 0, edgeLine, size, -0.28 * relief)

  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.42)
  ctx.lineWidth = detailLine
  ctx.beginPath()
  ctx.moveTo(size / 2, edgeLine)
  ctx.lineTo(size / 2, size - edgeLine)
  ctx.moveTo(edgeLine, size / 2)
  ctx.lineTo(size - edgeLine, size / 2)
  ctx.stroke()
  ctx.restore()
  lowerRect(height, size, size / 2 - detailLine / 2, edgeLine, detailLine, size - edgeLine * 2, -0.12 * relief)
  lowerRect(height, size, edgeLine, size / 2 - detailLine / 2, size - edgeLine * 2, detailLine, -0.12 * relief)
}

function applyTileGrid(ctx, height, size, relief, material) {
  const seam = Math.max(2, Math.round(size * 0.035))
  const lines = [0, size / 2, size]
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.72)
  ctx.lineWidth = seam
  for (const x of lines) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
    lowerRect(height, size, x - seam / 2, 0, seam, size, -0.22 * relief)
  }
  for (const y of lines) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
    lowerRect(height, size, 0, y - seam / 2, size, seam, -0.22 * relief)
  }
  ctx.restore()
}

function applyPlanks(ctx, height, size, relief, seed, material) {
  const seam = Math.max(2, Math.round(size * 0.02))
  const boards = 4
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.62)
  ctx.lineWidth = seam
  for (let i = 1; i < boards; i += 1) {
    const x = (size / boards) * i + (valueNoise(i, 0, 1, seed) - 0.5) * seam
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
    lowerRect(height, size, x - seam / 2, 0, seam, size, -0.2 * relief)
  }
  ctx.restore()
}

function applyDiamondPlate(ctx, height, size, relief, material) {
  const step = Math.max(16, Math.round(size / 5))
  const line = Math.max(1, Math.round(size * 0.01))
  ctx.save()
  ctx.strokeStyle = patternHighlightColor(material, 0.38)
  ctx.lineWidth = line
  for (let y = -size; y <= size * 2; y += step) {
    for (let x = -size; x <= size * 2; x += step) {
      const x0 = x
      const y0 = y
      const x1 = x + step * 0.6
      const y1 = y + step * 0.45
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
      drawLineHeight(height, size, x0, y0, x1, y1, line * 2, 0.12 * relief)
    }
  }
  ctx.restore()
}

// ─── Lot 1 (2026-09-27) — motifs bon marche / cout modere, validés par Saar ───

function applyRoughSurface(ctx, height, size, relief, seed) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const n = fractalNoise(x, y, Math.max(2, size / 3), `${seed}:rough`)
      height[y * size + x] += (n - 0.5) * 0.09 * relief
    }
  }
}
function sampleRoughSurfaceHeight(x, y, size, relief, seed) {
  const n = fractalNoise(x, y, Math.max(2, size / 3), `${seed}:rough`)
  return (n - 0.5) * 0.09 * relief
}

function applyRibbedPanels(ctx, height, size, relief, material) {
  const ribCount = 5
  const ribWidth = Math.max(2, size * 0.03)
  ctx.save()
  ctx.strokeStyle = patternHighlightColor(material, 0.05)
  ctx.lineWidth = ribWidth
  for (let i = 0; i < ribCount; i += 1) {
    const x = (size / ribCount) * (i + 0.5)
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
    lowerRect(height, size, x - ribWidth / 2, 0, ribWidth, size, 0.16 * relief)
  }
  ctx.restore()
}
function sampleRibbedPanelsHeight(x, size, relief) {
  const ribCount = 5
  const ribWidth = Math.max(2, size * 0.03)
  let h = 0
  for (let i = 0; i < ribCount; i += 1) {
    const lineX = (size / ribCount) * (i + 0.5)
    h += 0.16 * relief * lineFalloff(Math.abs(x - lineX), ribWidth / 2)
  }
  return h
}

function applyCorrugated(ctx, height, size, relief, material) {
  const waveCount = 10
  const amp = 0.14 * relief
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      height[y * size + x] += Math.sin((x / size) * Math.PI * 2 * waveCount) * amp
    }
  }
  ctx.save()
  ctx.globalAlpha = 0.06
  ctx.fillStyle = patternGrooveColor(material, 1)
  for (let i = 0; i < waveCount; i += 1) {
    const x = (size / waveCount) * (i + 0.5)
    ctx.fillRect(x - (size / waveCount) * 0.2, 0, (size / waveCount) * 0.4, size)
  }
  ctx.restore()
}
function sampleCorrugatedHeight(x, size, relief) {
  const waveCount = 10
  return Math.sin((x / size) * Math.PI * 2 * waveCount) * 0.14 * relief
}

function applyLongitudinalStripes(ctx, height, size, relief, material) {
  const stripeCount = 8
  const stripeWidth = Math.max(1, size * 0.01)
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.18)
  ctx.lineWidth = stripeWidth
  for (let i = 1; i < stripeCount; i += 1) {
    const x = (size / stripeCount) * i
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
    lowerRect(height, size, x - stripeWidth / 2, 0, stripeWidth, size, -0.1 * relief)
  }
  ctx.restore()
}
function sampleLongitudinalStripesHeight(x, size, relief) {
  const stripeCount = 8
  const stripeWidth = Math.max(1, size * 0.01)
  let h = 0
  for (let i = 1; i < stripeCount; i += 1) {
    const lineX = (size / stripeCount) * i
    h -= 0.1 * relief * lineFalloff(Math.abs(x - lineX), stripeWidth / 2)
  }
  return h
}

function applyRivetRings(ctx, height, size, relief, material) {
  const spacing = size / 5
  const r = Math.max(3, size * 0.018)
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.55)
  ctx.lineWidth = Math.max(1, r * 0.35)
  for (let gy = spacing / 2; gy < size; gy += spacing) {
    for (let gx = spacing / 2; gx < size; gx += spacing) {
      ctx.beginPath()
      ctx.arc(gx, gy, r, 0, Math.PI * 2)
      ctx.stroke()
      drawCircleHeight(height, size, gx, gy, r * 1.3, 0.1 * relief)
      drawCircleHeight(height, size, gx, gy, r * 0.7, -0.05 * relief)
    }
  }
  ctx.restore()
}
function sampleRivetRingsHeight(x, y, size, relief) {
  const spacing = size / 5
  const r = Math.max(3, size * 0.018)
  let h = 0
  for (let gy = spacing / 2; gy < size; gy += spacing) {
    for (let gx = spacing / 2; gx < size; gx += spacing) {
      const dist = Math.hypot(x - gx, y - gy)
      h += 0.1 * relief * lineFalloff(Math.abs(dist - r * 1.3), r * 0.5)
      h -= 0.05 * relief * lineFalloff(dist, r * 0.7)
    }
  }
  return h
}

// Approximation bon marche d'une trame hexagonale : 3 familles de droites a 60 degres
// (les aretes d'un pavage hexagonal sont exactement ces 3 directions) — pas de vraie
// geometrie de cellule, mais visuellement correct pour une texture tuilee.
function hexGridHeightAt(x, y, size, relief) {
  const step = size / 6
  const lineWidth = Math.max(1, size * 0.008)
  let h = 0
  const angles = [0, Math.PI / 3, (2 * Math.PI) / 3]
  for (const angle of angles) {
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)
    const normalX = -dz
    const normalZ = dx
    const proj = x * normalX + y * normalZ
    const nearest = Math.round(proj / step) * step
    h -= 0.14 * relief * lineFalloff(Math.abs(proj - nearest), lineWidth * 0.8)
  }
  return h
}
function applyHexGrid(ctx, height, size, relief, material) {
  const step = size / 6
  const lineWidth = Math.max(1, size * 0.008)
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.55)
  ctx.lineWidth = lineWidth
  const angles = [0, Math.PI / 3, (2 * Math.PI) / 3]
  for (const angle of angles) {
    const dx = Math.cos(angle)
    const dz = Math.sin(angle)
    const normalX = -dz
    const normalZ = dx
    for (let k = -size; k <= size * 2; k += step) {
      const cx = size / 2 + normalX * k
      const cz = size / 2 + normalZ * k
      const x0 = cx - dx * size * 1.5
      const z0 = cz - dz * size * 1.5
      const x1 = cx + dx * size * 1.5
      const z1 = cz + dz * size * 1.5
      ctx.beginPath()
      ctx.moveTo(x0, z0)
      ctx.lineTo(x1, z1)
      ctx.stroke()
      drawLineHeight(height, size, x0, z0, x1, z1, lineWidth * 1.6, -0.14 * relief)
    }
  }
  ctx.restore()
}
function sampleHexGridHeight(x, y, size, relief) {
  return hexGridHeightAt(x, y, size, relief)
}

function applyOffsetPlates(ctx, height, size, relief, material) {
  const cols = 4
  const rows = 3
  const cw = size / cols
  const rh = size / rows
  const seam = Math.max(2, size * 0.012)
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.6)
  ctx.lineWidth = seam
  for (let row = 0; row <= rows; row += 1) {
    const y = row * rh
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(size, y)
    ctx.stroke()
    lowerRect(height, size, 0, y - seam / 2, size, seam, -0.13 * relief)
  }
  for (let row = 0; row < rows; row += 1) {
    const offset = (row % 2) * (cw / 2)
    for (let col = -1; col <= cols; col += 1) {
      const x = col * cw + offset
      ctx.beginPath()
      ctx.moveTo(x, row * rh)
      ctx.lineTo(x, (row + 1) * rh)
      ctx.stroke()
      lowerRect(height, size, x - seam / 2, row * rh, seam, rh, -0.13 * relief)
    }
  }
  ctx.restore()
}
function sampleOffsetPlatesHeight(x, y, size, relief) {
  const cols = 4
  const rows = 3
  const cw = size / cols
  const rh = size / rows
  const seam = Math.max(2, size * 0.012)
  let h = 0
  for (let row = 0; row <= rows; row += 1) {
    h -= 0.13 * relief * lineFalloff(Math.abs(y - row * rh), seam / 2)
  }
  const rowIndex = Math.min(rows - 1, Math.max(0, Math.floor(y / rh)))
  const offset = (rowIndex % 2) * (cw / 2)
  const localX = (((x - offset) % cw) + cw) % cw
  const distToEdge = Math.min(localX, cw - localX)
  h -= 0.13 * relief * lineFalloff(distToEdge, seam / 2)
  return h
}

function applyConcreteFormwork(ctx, height, size, relief, seed, material) {
  const boards = 6
  const seam = Math.max(1, size * 0.008)
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.32)
  ctx.lineWidth = seam
  for (let i = 1; i < boards; i += 1) {
    const x = (size / boards) * i + (valueNoise(i, 10, 1, seed) - 0.5) * seam * 2
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, size)
    ctx.stroke()
    lowerRect(height, size, x - seam / 2, 0, seam, size, -0.07 * relief)
  }
  ctx.restore()
}
function sampleConcreteFormworkHeight(x, size, relief, seed) {
  const boards = 6
  const seam = Math.max(1, size * 0.008)
  let h = 0
  for (let i = 1; i < boards; i += 1) {
    const lineX = (size / boards) * i + (valueNoise(i, 10, 1, seed) - 0.5) * seam * 2
    h -= 0.07 * relief * lineFalloff(Math.abs(x - lineX), seam / 2)
  }
  return h
}

function concreteSegmentsRingHeightAt(x, y, size, relief) {
  const ringCount = 4
  const seam = Math.max(1, size * 0.01)
  const cx = size / 2
  const cy = size * 1.4
  const dist = Math.hypot(x - cx, y - cy)
  let h = 0
  for (let i = 1; i <= ringCount; i += 1) {
    const r = ((size * 1.6) / ringCount) * i
    h -= 0.09 * relief * lineFalloff(Math.abs(dist - r), seam)
  }
  return h
}
function applyConcreteSegments(ctx, height, size, relief, material) {
  const ringCount = 4
  const seam = Math.max(1, size * 0.01)
  const cx = size / 2
  const cy = size * 1.4
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.35)
  ctx.lineWidth = seam
  for (let i = 1; i <= ringCount; i += 1) {
    const r = ((size * 1.6) / ringCount) * i
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      height[y * size + x] += concreteSegmentsRingHeightAt(x, y, size, relief)
    }
  }
}
function sampleConcreteSegmentsHeight(x, y, size, relief) {
  return concreteSegmentsRingHeightAt(x, y, size, relief)
}

function applyWeldSeams(ctx, height, size, relief, seed, material) {
  const seamCount = 3
  const segments = 24
  ctx.save()
  ctx.strokeStyle = patternGrooveColor(material, 0.5)
  ctx.lineCap = 'round'
  ctx.lineWidth = size * 0.02
  for (let i = 0; i < seamCount; i += 1) {
    const y = (size / (seamCount + 1)) * (i + 1)
    ctx.beginPath()
    for (let s = 0; s <= segments; s += 1) {
      const x = (size / segments) * s
      const wobble = (valueNoise(s, i * 10, 1.5, `${seed}:weld`) - 0.5) * size * 0.01
      if (s === 0) ctx.moveTo(x, y + wobble)
      else ctx.lineTo(x, y + wobble)
    }
    ctx.stroke()
    for (let s = 0; s <= segments; s += 1) {
      const x = (size / segments) * s
      const wobble = (valueNoise(s, i * 10, 1.5, `${seed}:weld`) - 0.5) * size * 0.01
      drawCircleHeight(height, size, x, y + wobble, size * 0.014, 0.09 * relief)
    }
  }
  ctx.restore()
}
function sampleWeldSeamsHeight(x, y, size, relief, seed) {
  const seamCount = 3
  const segments = 24
  let h = 0
  for (let i = 0; i < seamCount; i += 1) {
    const seamY = (size / (seamCount + 1)) * (i + 1)
    const s = clamp((x / size) * segments, 0, segments)
    const wobble = (valueNoise(Math.round(s), i * 10, 1.5, `${seed}:weld`) - 0.5) * size * 0.01
    h += 0.09 * relief * lineFalloff(Math.abs(y - (seamY + wobble)), size * 0.014)
  }
  return h
}

// Bulles de peinture cloquee : placement aleatoire sequentiel (meme famille que l'ecaillage
// de applyWear) — pas d'echantillonnage ponctuel possible sans rejouer la sequence, comme
// applyWear/applyDirt deja dans ce fichier n'en ont pas non plus. Coherent avec l'existant.
function applyPaintBlisters(ctx, height, size, relief, seed, material) {
  const rng = makeRng(`${seed}:blisters`)
  const count = Math.round(size * size * 0.0009)
  for (let i = 0; i < count; i += 1) {
    const x = rng() * size
    const y = rng() * size
    const r = size * (0.008 + rng() * 0.02)
    ctx.save()
    ctx.fillStyle = patternHighlightColor(material, 0.05)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    drawCircleHeight(height, size, x, y, r, 0.12 * relief)
  }
}

function applyPattern(ctx, height, options, size, seed, material) {
  const relief = clamp(options.relief / 100)
  switch (options.pattern) {
    case 'metal_panels':
      applyMetalPanels(ctx, height, size, relief, material)
      break
    case 'tile_grid':
      applyTileGrid(ctx, height, size, relief, material)
      break
    case 'planks':
      applyPlanks(ctx, height, size, relief, seed, material)
      break
    case 'diamond_plate':
      applyDiamondPlate(ctx, height, size, relief, material)
      break
    case 'rough_surface':
      applyRoughSurface(ctx, height, size, relief, seed)
      break
    case 'ribbed_panels':
      applyRibbedPanels(ctx, height, size, relief, material)
      break
    case 'corrugated':
      applyCorrugated(ctx, height, size, relief, material)
      break
    case 'longitudinal_stripes':
      applyLongitudinalStripes(ctx, height, size, relief, material)
      break
    case 'rivet_rings':
      applyRivetRings(ctx, height, size, relief, material)
      break
    case 'hex_grid':
      applyHexGrid(ctx, height, size, relief, material)
      break
    case 'offset_plates':
      applyOffsetPlates(ctx, height, size, relief, material)
      break
    case 'concrete_formwork':
      applyConcreteFormwork(ctx, height, size, relief, seed, material)
      break
    case 'concrete_segments':
      applyConcreteSegments(ctx, height, size, relief, material)
      break
    case 'weld_seams':
      applyWeldSeams(ctx, height, size, relief, seed, material)
      break
    case 'paint_blisters':
      applyPaintBlisters(ctx, height, size, relief, seed, material)
      break
    default:
      break
  }
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lenSq = Math.max(0.0001, dx * dx + dy * dy)
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq)
  return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t))
}

function lineFalloff(distance, halfWidth) {
  if (distance >= halfWidth) return 0
  return 1 - smoothstep(distance / halfWidth)
}

function patternAccumulationMask(pattern, x, y, size, seed) {
  let mask = 0

  if (pattern === 'metal_panels') {
    const { detailLine } = metalPanelLineWidths(size)
    const margin = Math.max(12, size * 0.13)
    const edgeDistance = Math.min(x, y, size - x, size - y)
    mask = Math.max(mask, lineFalloff(edgeDistance, detailLine * 2.2 * METAL_PANEL_EDGE_WIDTH_FACTOR) * 0.85)
    mask = Math.max(mask, lineFalloff(Math.abs(x - size / 2), detailLine * 2.2) * 0.45)
    mask = Math.max(mask, lineFalloff(Math.abs(y - size / 2), detailLine * 2.2) * 0.45)

    const r = Math.max(9, size * 0.095)
    const rivets = [
      [margin, margin],
      [size - margin, margin],
      [margin, size - margin],
      [size - margin, size - margin],
    ]
    for (const [cx, cy] of rivets) {
      const dist = Math.hypot(x - cx, y - cy)
      mask = Math.max(mask, lineFalloff(Math.abs(dist - r * 1.05), r * 1.8) * 0.65)
    }
  }

  if (pattern === 'tile_grid') {
    const seam = Math.max(2, size * 0.035)
    const lines = [0, size / 2, size]
    for (const line of lines) {
      mask = Math.max(mask, lineFalloff(Math.abs(x - line), seam * 2) * 0.7)
      mask = Math.max(mask, lineFalloff(Math.abs(y - line), seam * 2) * 0.7)
    }
  }

  if (pattern === 'planks') {
    const seam = Math.max(2, size * 0.02)
    const boards = 4
    for (let i = 1; i < boards; i += 1) {
      const lineX = (size / boards) * i + (valueNoise(i, 0, 1, seed) - 0.5) * seam
      mask = Math.max(mask, lineFalloff(Math.abs(x - lineX), seam * 2.2) * 0.62)
    }
  }

  return clamp(mask)
}

function mixPixel(data, index, color, amount) {
  const t = clamp(amount)
  data[index] = lerp(data[index], color[0], t)
  data[index + 1] = lerp(data[index + 1], color[1], t)
  data[index + 2] = lerp(data[index + 2], color[2], t)
}

function sampleMetalPanelHeight(x, y, size, relief) {
  const { edgeLine, detailLine } = metalPanelLineWidths(size)
  let height = 0

  const edgeDistance = Math.min(x, y, size - x, size - y)
  height -= 0.28 * relief * lineFalloff(edgeDistance, edgeLine)
  height -= 0.12 * relief * lineFalloff(Math.abs(x - size / 2), detailLine / 2)
  height -= 0.12 * relief * lineFalloff(Math.abs(y - size / 2), detailLine / 2)

  return height
}

function sampleTileGridHeight(x, y, size, relief) {
  const seam = Math.max(2, size * 0.035)
  const lines = [0, size / 2, size]
  let height = 0
  for (const line of lines) {
    height -= 0.22 * relief * lineFalloff(Math.abs(x - line), seam / 2)
    height -= 0.22 * relief * lineFalloff(Math.abs(y - line), seam / 2)
  }
  return height
}

function samplePlankHeight(x, y, size, relief, seed) {
  const seam = Math.max(2, size * 0.02)
  const boards = 4
  let height = 0
  for (let i = 1; i < boards; i += 1) {
    const lineX = (size / boards) * i + (valueNoise(i, 0, 1, seed) - 0.5) * seam
    height -= 0.2 * relief * lineFalloff(Math.abs(x - lineX), seam / 2)
  }
  return height
}

function sampleDiamondPlateHeight(x, y, size, relief) {
  const step = Math.max(16, size / 5)
  const line = Math.max(1, size * 0.01)
  let height = 0

  for (let gy = -size; gy <= size * 2; gy += step) {
    for (let gx = -size; gx <= size * 2; gx += step) {
      const dist = distanceToSegment(x, y, gx, gy, gx + step * 0.6, gy + step * 0.45)
      height += 0.12 * relief * lineFalloff(dist, line * 2)
    }
  }

  return height
}

function samplePatternHeight(pattern, x, y, size, relief, seed) {
  switch (pattern) {
    case 'metal_panels':
      return sampleMetalPanelHeight(x, y, size, relief)
    case 'tile_grid':
      return sampleTileGridHeight(x, y, size, relief)
    case 'planks':
      return samplePlankHeight(x, y, size, relief, seed)
    case 'diamond_plate':
      return sampleDiamondPlateHeight(x, y, size, relief)
    case 'rough_surface':
      return sampleRoughSurfaceHeight(x, y, size, relief, seed)
    case 'ribbed_panels':
      return sampleRibbedPanelsHeight(x, size, relief)
    case 'corrugated':
      return sampleCorrugatedHeight(x, size, relief)
    case 'longitudinal_stripes':
      return sampleLongitudinalStripesHeight(x, size, relief)
    case 'rivet_rings':
      return sampleRivetRingsHeight(x, y, size, relief)
    case 'hex_grid':
      return sampleHexGridHeight(x, y, size, relief)
    case 'offset_plates':
      return sampleOffsetPlatesHeight(x, y, size, relief)
    case 'concrete_formwork':
      return sampleConcreteFormworkHeight(x, size, relief, seed)
    case 'concrete_segments':
      return sampleConcreteSegmentsHeight(x, y, size, relief)
    case 'weld_seams':
      return sampleWeldSeamsHeight(x, y, size, relief, seed)
    default:
      return 0
  }
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
  height += samplePatternHeight(descriptor.pattern, x, y, size, relief, seed)
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
        const feature = patternAccumulationMask(options.pattern, x, y, size, seed)
        const openPaint = clamp((n - (0.7 - wear * 0.28)) / Math.max(0.08, wear * 0.55))
        const rust = clamp((feature * 0.58 + openPaint * 0.72 + pores * 0.08 - 0.18) * wear)
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
      const feature = patternAccumulationMask(options.pattern, x, y, size, seed)
      const fine = hash2(x, y, `${seed}:dust-fine`)
      const grime = clamp(dirt * (patches * 0.28 + edge * 0.2 + feature * 0.18 + (fine - 0.5) * 0.07))
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
  applyPattern(ctx, height, options, size, seed, material)
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
