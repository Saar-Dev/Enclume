const HEX_COLOR_RE = /^#[0-9a-f]{6}$/i

function normalizeSlotCode(value) {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const match = raw.match(/SLOT[_ -]?(\d+)/i)
  if (match) return `SLOT_${String(match[1]).padStart(2, '0')}`
  return raw.toUpperCase()
}

function normalizeHex(value, fallback = '#ffffff') {
  const raw = String(value || '').trim()
  return HEX_COLOR_RE.test(raw) ? raw : fallback
}

function normalizeMaterialNames(slot) {
  const names = [
    ...(Array.isArray(slot?.materialNames) ? slot.materialNames : []),
    ...(Array.isArray(slot?.material_names) ? slot.material_names : []),
  ]
  return [...new Set(names.map(name => String(name || '').trim()).filter(Boolean))]
}

export function normalizeModelMaterialSlots(geometryOrSlots) {
  const rawSlots = Array.isArray(geometryOrSlots)
    ? geometryOrSlots
    : (
        geometryOrSlots?.materialSlots
        || geometryOrSlots?.material_slots
        || geometryOrSlots?.editorColorSlots
        || geometryOrSlots?.editor_color_slots
        || geometryOrSlots?.colorSlots
        || []
      )

  return rawSlots
    .map((slot, index) => {
      const code = normalizeSlotCode(slot?.code || slot?.slot || slot?.name || slot?.id || `SLOT_${index + 1}`)
      if (!code) return null
      const id = String(slot?.id || code.toLowerCase()).trim()
      const defaultHex = normalizeHex(slot?.defaultHex || slot?.default_hex || slot?.color || slot?.hex, '#ffffff')
      return {
        id,
        code,
        label: String(slot?.label || code).trim(),
        defaultHex,
        transparent: Boolean(slot?.transparent),
        materialNames: normalizeMaterialNames(slot),
      }
    })
    .filter(Boolean)
}

export function connectorModelMaterialSlots(connector) {
  const slots = normalizeModelMaterialSlots(connector?.modelGeometry)
  const modelIdentity = `${connector?.modelBuiltinKey || ''} ${connector?.modelGlbUrl || ''}`.toLowerCase()
  const isBuiltinScreenWindow = connector?.type === 'screen-window'
    && modelIdentity.includes('structural_windows')
    && modelIdentity.includes('screen_window')
  if (!isBuiltinScreenWindow || slots.some(slot => slot.code === 'SLOT_03')) return slots
  return [
    ...slots,
    {
      id: 'hinges',
      code: 'SLOT_03',
      label: 'Charnières',
      defaultHex: '#070c10',
      transparent: false,
      materialNames: [],
    },
  ].sort((left, right) => left.code.localeCompare(right.code))
}

export function materialSlotDisplayValue(overrides, slot) {
  const raw = overrides?.[slot.code] ?? overrides?.[slot.id] ?? overrides?.[slot.code.toLowerCase()]
  if (typeof raw === 'string') return { color: normalizeHex(raw, slot.defaultHex) }
  if (raw && typeof raw === 'object') {
    return {
      color: normalizeHex(raw.color || raw.hex || raw.value, slot.defaultHex),
      opacity: Number.isFinite(Number(raw.opacity)) ? Math.max(0, Math.min(1, Number(raw.opacity))) : undefined,
    }
  }
  return { color: slot.defaultHex }
}

export function setMaterialSlotOverride(overrides, slot, patch) {
  const next = { ...(overrides || {}) }
  const current = materialSlotDisplayValue(next, slot)
  next[slot.code] = {
    ...current,
    ...patch,
  }
  return next
}

export function clearMaterialSlotOverride(overrides, slot) {
  const next = { ...(overrides || {}) }
  delete next[slot.code]
  delete next[slot.id]
  delete next[slot.code.toLowerCase()]
  return next
}

function materialMatchesSlot(materialName, slot) {
  const name = String(materialName || '')
  if (!name) return false
  if (slot.materialNames.includes(name)) return true
  return name.includes(`__${slot.code}__`) || name.includes(slot.code)
}

function findSlotForMaterial(material, slots) {
  const name = material?.name || ''
  return slots.find(slot => materialMatchesSlot(name, slot)) || null
}

function hasExplicitOverride(overrides, slot) {
  return Boolean(
    overrides
    && (
      Object.prototype.hasOwnProperty.call(overrides, slot.code)
      || Object.prototype.hasOwnProperty.call(overrides, slot.id)
      || Object.prototype.hasOwnProperty.call(overrides, slot.code.toLowerCase())
    )
  )
}

export function applyMaterialSlotOverrides(material, slots, overrides) {
  if (!material || !slots?.length || !overrides) return material
  const slot = findSlotForMaterial(material, slots)
  if (!slot || !hasExplicitOverride(overrides, slot)) return material

  const value = materialSlotDisplayValue(overrides, slot)
  if (value.color && material.color?.set) {
    material.color.set(value.color)
  }

  if (Number.isFinite(Number(value.opacity))) {
    material.opacity = Math.max(0, Math.min(1, Number(value.opacity)))
    material.transparent = material.opacity < 0.999 || material.transparent || slot.transparent
    material.depthWrite = material.opacity >= 0.999
  }

  material.needsUpdate = true
  return material
}
