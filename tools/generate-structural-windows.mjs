import fs from 'node:fs/promises'
import path from 'node:path'
import * as THREE from '../client/node_modules/three/build/three.module.js'
import { GLTFExporter } from '../client/node_modules/three/examples/jsm/exporters/GLTFExporter.js'

if (!globalThis.FileReader) {
  globalThis.FileReader = class FileReader {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then(result => { this.result = result; this.onloadend?.() })
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then(buffer => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`
        this.onloadend?.()
      })
    }
  }
}

const root = path.resolve('output/structural_windows')
const glbRoot = path.join(root, 'glb')
await fs.mkdir(glbRoot, { recursive: true })

const material = (name, color, options = {}) => {
  const value = new THREE.MeshStandardMaterial({ color, ...options })
  value.name = name
  return value
}

function box(parent, name, size, position, mat) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat)
  mesh.name = name
  mesh.position.set(...position)
  parent.add(mesh)
  return mesh
}

function cylinder(parent, name, radius, depth, position, rotation, mat) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, 16), mat)
  mesh.name = name
  mesh.position.set(...position)
  mesh.rotation.set(...rotation)
  parent.add(mesh)
  return mesh
}

function wallWindowScene({ key, pans, levels, screen }) {
  const scene = new THREE.Scene()
  scene.name = key
  const width = pans
  const height = levels * 1.5
  const frameDepth = screen ? 0.12 : 0.09
  const frame = material(`${key}__SLOT_01__Primary_Frame`, screen ? '#142b36' : '#17252d', { metalness: 0.72, roughness: 0.3 })
  const hinges = material(`${key}__SLOT_03__Hinges`, '#070c10', { metalness: 0.82, roughness: 0.24 })
  const hardware = material(`${key}__FIXED__Dark_Hardware`, '#070c10', { metalness: 0.82, roughness: 0.24 })
  const glass = material(`${key}__SLOT_05__Transparent_Glass`, '#6edcff', {
    transparent: true, opacity: 0.3, metalness: 0.08, roughness: 0.14,
    depthWrite: false, side: THREE.DoubleSide,
  })
  const reflection = material(`${key}__FIXED__Glass_Reflection`, '#dff8ff', {
    transparent: true, opacity: 0.22, metalness: 0.1, roughness: 0.05, depthWrite: false,
  })
  const accent = material(`${key}__SLOT_04__Accent`, '#2dd4bf', { emissive: '#0b5751', emissiveIntensity: 0.45, metalness: 0.45, roughness: 0.3 })
  const border = 0.1
  box(scene, 'Frame_Bottom', [width, border, frameDepth], [0, border / 2, 0], frame)
  box(scene, 'Frame_Top', [width, border, frameDepth], [0, height - border / 2, 0], frame)
  box(scene, 'Frame_Left', [border, height - border * 2, frameDepth], [-width / 2 + border / 2, height / 2, 0], frame)
  box(scene, 'Frame_Right', [border, height - border * 2, frameDepth], [width / 2 - border / 2, height / 2, 0], frame)
  box(scene, 'Glass_Surface', [width - border * 2, height - border * 2, 0.025], [0, height / 2, 0], glass)
  const stripeWidth = Math.max(0.035, width * 0.08)
  const stripe = box(scene, 'Reflection_Stripe', [stripeWidth, height * 0.62, 0.008], [-width * 0.22, height * 0.56, frameDepth * 0.18], reflection)
  stripe.rotation.z = -0.18
  if (screen) {
    const hingeRadius = 0.07
    for (const side of [-1, 1]) {
      for (const ratio of [0.2, 0.5, 0.8]) {
        cylinder(scene, `Hinge_${side < 0 ? 'Left' : 'Right'}_${ratio}`, hingeRadius, 0.22,
          [side * (width / 2 + hingeRadius * 0.35), height * ratio, 0], [0, 0, 0], hinges)
        box(scene, `Hinge_Brace_${side}_${ratio}`, [0.16, 0.07, 0.17],
          [side * (width / 2 - 0.025), height * ratio, 0], hinges)
      }
    }
    box(scene, 'Control_Front_Box', [0.16, 0.24, 0.11], [width / 2 + 0.16, height * 0.34, frameDepth * 0.62], hardware)
    box(scene, 'Control_Front_Status', [0.045, 0.045, 0.008], [width / 2 + 0.16, height * 0.39, frameDepth * 1.22], accent)
  }
  return { scene, width, height, depth: screen ? 0.16 : 0.1 }
}

function skylightScene({ key, width, depth }) {
  const scene = new THREE.Scene()
  scene.name = key
  const frameHeight = 0.1
  const frame = material(`${key}__SLOT_01__Primary_Frame`, '#17252d', { metalness: 0.72, roughness: 0.3 })
  const glass = material(`${key}__SLOT_05__Transparent_Glass`, '#6edcff', {
    transparent: true, opacity: 0.3, metalness: 0.08, roughness: 0.14, depthWrite: false, side: THREE.DoubleSide,
  })
  const reflection = material(`${key}__FIXED__Glass_Reflection`, '#e8fbff', { transparent: true, opacity: 0.2, roughness: 0.05, depthWrite: false })
  const border = 0.09
  box(scene, 'Frame_North', [width, frameHeight, border], [0, 0, -depth / 2 + border / 2], frame)
  box(scene, 'Frame_South', [width, frameHeight, border], [0, 0, depth / 2 - border / 2], frame)
  box(scene, 'Frame_West', [border, frameHeight, depth - border * 2], [-width / 2 + border / 2, 0, 0], frame)
  box(scene, 'Frame_East', [border, frameHeight, depth - border * 2], [width / 2 - border / 2, 0, 0], frame)
  box(scene, 'Glass_Surface', [width - border * 2, 0.025, depth - border * 2], [0, 0.015, 0], glass)
  const stripe = box(scene, 'Reflection_Stripe', [width * 0.12, 0.008, depth * 0.72], [-width * 0.2, 0.035, 0], reflection)
  stripe.rotation.y = -0.22
  return { scene, width, depth, height: frameHeight }
}

async function exportGlb(scene, filePath) {
  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(scene, { binary: true, onlyVisible: true })
  await fs.writeFile(filePath, Buffer.from(result))
}

const assets = []
for (const screen of [false, true]) {
  for (const levels of [1, 2]) {
    for (const pans of [1, 2, 3, 4]) {
      const key = `${screen ? 'screen_window' : 'window'}_${pans}pan_${levels}level`
      const label = `${screen ? 'Fenêtre écran' : 'Fenêtre'} ${pans} pan${pans > 1 ? 's' : ''} · ${levels} étage${levels > 1 ? 's' : ''}`
      const fileName = `${key}.glb`
      const model = wallWindowScene({ key, pans, levels, screen })
      await exportGlb(model.scene, path.join(glbRoot, fileName))
      assets.push({
        name: key, label, catalog_file: fileName, category: 'Fenêtres',
        placement_mode: 'connector', origin: 'floor-center', connector_type: screen ? 'screen-window' : 'window',
        footprint_width_m: model.width, footprint_depth_m: model.depth, height_m: model.height,
        opening_width_m: model.width, wall_cut_width_m: model.width, wall_cut_height_m: model.height,
        opening_bottom_m: levels * 0.5, span_levels: levels,
        allowed_states: screen ? ['transparent', 'opaque', 'mirror'] : ['transparent'],
        editor_color_slots: [
          { id: 'frame', code: 'SLOT_01', label: 'Cadre', default_hex: '#17252D', transparent: false, material_names: [`${key}__SLOT_01__Primary_Frame`] },
          ...(screen ? [{ id: 'hinges', code: 'SLOT_03', label: 'Charnières', default_hex: '#070C10', transparent: false, material_names: [`${key}__SLOT_03__Hinges`] }] : []),
          { id: 'glass', code: 'SLOT_05', label: 'Verre', default_hex: '#6EDCFF', transparent: true, material_names: [`${key}__SLOT_05__Transparent_Glass`] },
        ],
      })
    }
  }
}

for (const [size, width, depth] of [['1x1', 1, 1], ['2x1', 2, 1], ['2x2', 2, 2], ['3x3', 3, 3]]) {
  const key = `skylight_${size}`
  const fileName = `${key}.glb`
  const model = skylightScene({ key, width, depth })
  await exportGlb(model.scene, path.join(glbRoot, fileName))
  assets.push({
    name: key, label: `Verrière ${size}`, catalog_file: fileName, category: 'structural_windows',
    placement_mode: 'connector', origin: 'floor-center', connector_type: 'skylight', skylight_size: size,
    footprint_width_m: width, footprint_depth_m: depth, height_m: model.height,
    allowed_states: ['transparent'],
    editor_color_slots: [
      { id: 'frame', code: 'SLOT_01', label: 'Cadre', default_hex: '#17252D', transparent: false, material_names: [`${key}__SLOT_01__Primary_Frame`] },
      { id: 'glass', code: 'SLOT_05', label: 'Verre', default_hex: '#6EDCFF', transparent: true, material_names: [`${key}__SLOT_05__Transparent_Glass`] },
    ],
  })
}

await fs.writeFile(path.join(root, 'manifest.json'), `${JSON.stringify({
  format_version: 1,
  unit: 'enclume_world_unit',
  placement_mode_default: 'connector',
  origin_default: 'floor-center',
  assets,
}, null, 2)}\n`)

console.log(`Pack structural_windows généré : ${assets.length} modèles`)
