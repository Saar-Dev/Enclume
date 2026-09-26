// shared/world/importGuard.js
// Garde structurelle d'un document de carte reçu d'un tiers (fichier importé) — segment S0 du chantier « éditeur de
// carte » : docs/PLANS/PLAN_EXPORT_CARTE.md §6 et §12 (L1a-2).
//
// ORDRE D'UTILISATION (à respecter) :
//   1. scanJsonStructure  — forme générale du JSON, sans aucune récursion ;
//   2. checkSurfaceLimits — plafonds du document de surface ;
//   3. (types stricts, L1a-3) ;
//   4. validateSurfaceData / prepareSurfaceData — seulement pour un document qui a passé 1 et 2.
// Raison : `validateSurfaceData` appelle déjà des fonctions qui énumèrent toutes les cases d'une salle et recalcule le
// contour pour CHAQUE arrondi déclaré. Un document non borné peut donc le bloquer avant même la compilation.
//
// Ces fonctions sont pures et ne lèvent pas d'exception : elles renvoient `{ ok, errors, truncated }`, où chaque erreur
// est `{ code, params }` — jamais de texte français (la traduction se fait côté client, règles i18n du projet).
// La géométrie n'est appelée (`roomBoundaryEdges`) qu'APRÈS les contrôles arithmétiques, pour les seules salles dont la
// taille est déjà bornée.

import { MAP_LIMITS } from './mapLimits.js'
import { createCollector, isPlainObject } from './guardErrors.js'
import { roomBoundaryEdges } from './roomGeometry.js'

export const IMPORT_GUARD_CODES = Object.freeze([
  // scanJsonStructure
  'json_too_deep',
  'json_too_many_nodes',
  'string_too_long',
  'key_too_long',
  'forbidden_key',
  'control_character',
  'non_finite_number',
  'unsupported_type',
  // checkSurfaceLimits
  'not_object',
  'too_many_items',
  'room_bounds_invalid',
  'room_extent_exceeded',
  'room_coordinate_out_of_range',
  'too_many_cells',
  'too_many_total_cells',
  'too_many_arcs',
  'too_many_profiles',
  'too_many_clip_rooms',
  'too_many_slices',
  'slice_too_many_points',
  'slice_too_many_walls',
  'too_many_open_walls',
  'room_boundary_too_complex',
  'boundary_complexity_exceeded',
  'room_geometry_unreadable',
])

// Collection de `surface_data` → plafond de MAP_LIMITS qui borne son nombre d'éléments.
export const IMPORT_GUARD_COLLECTION_LIMITS = Object.freeze({
  rooms: 'maxRooms',
  floors: 'maxFloors',
  walls: 'maxWalls',
  ceilings: 'maxCeilings',
  stairs: 'maxStairs',
  connectors: 'maxConnectors',
})

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
// NUL et caractères de contrôle C0 (sauf tabulation, saut de ligne, retour chariot) et DEL. PostgreSQL rejette NUL
// dans un jsonb alors que JSON.parse l'accepte.
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/

function pathOf(entry) {
  const parts = []
  for (let current = entry; current && current.parent; current = current.parent) {
    parts.push(typeof current.key === 'number' ? `[${current.key}]` : `.${current.key}`)
  }
  return `$${parts.reverse().join('')}`
}

export function scanJsonStructure(value, limits = MAP_LIMITS) {
  const collector = createCollector(limits.maxErrors)
  // Pile explicite : aucune récursion, donc aucun dépassement de pile quelle que soit la profondeur du document.
  const stack = [{ value, depth: 0, parent: null, key: null }]
  let visited = 0

  while (stack.length > 0 && !collector.isFull) {
    const entry = stack.pop()
    const current = entry.value
    visited += 1
    if (visited > limits.maxJsonNodes) {
      collector.add('json_too_many_nodes', { limit: limits.maxJsonNodes })
      break
    }

    if (current === null || typeof current === 'boolean') continue

    if (typeof current === 'number') {
      if (!Number.isFinite(current)) collector.add('non_finite_number', { path: pathOf(entry) })
      continue
    }

    if (typeof current === 'string') {
      if (current.length > limits.maxStringLength) {
        collector.add('string_too_long', { path: pathOf(entry), limit: limits.maxStringLength, length: current.length })
      } else if (CONTROL_CHARACTERS.test(current)) {
        collector.add('control_character', { path: pathOf(entry) })
      }
      continue
    }

    const isArray = Array.isArray(current)
    if (!isArray && !isPlainObject(current)) {
      collector.add('unsupported_type', { path: pathOf(entry), type: typeof current })
      continue
    }

    const depth = entry.depth + 1
    if (depth > limits.maxJsonDepth) {
      collector.add('json_too_deep', { path: pathOf(entry), limit: limits.maxJsonDepth })
      continue
    }

    const keys = isArray ? null : Object.keys(current)
    const childCount = isArray ? current.length : keys.length
    // Ne jamais empiler plus d'éléments que le budget de nœuds restant : un tableau de dix millions d'entrées
    // ne doit pas remplir la mémoire avant d'être refusé.
    if (visited + stack.length + childCount > limits.maxJsonNodes) {
      collector.add('json_too_many_nodes', { limit: limits.maxJsonNodes })
      break
    }

    if (isArray) {
      for (let index = childCount - 1; index >= 0; index -= 1) {
        stack.push({ value: current[index], depth, parent: entry, key: index })
      }
    } else {
      for (let index = childCount - 1; index >= 0; index -= 1) {
        const key = keys[index]
        if (FORBIDDEN_KEYS.has(key)) {
          collector.add('forbidden_key', { path: pathOf(entry), key })
          continue
        }
        if (key.length > limits.maxKeyLength) {
          collector.add('key_too_long', { path: pathOf(entry), limit: limits.maxKeyLength, length: key.length })
          continue
        }
        if (CONTROL_CHARACTERS.test(key)) {
          collector.add('control_character', { path: pathOf(entry), inKey: true })
          continue
        }
        stack.push({ value: current[key], depth, parent: entry, key })
      }
    }
  }

  if (collector.isFull && stack.length > 0) collector.markTruncated()
  return collector.result()
}

function boundsExtent(room) {
  const minX = Math.trunc(Math.min(room.minX, room.maxX))
  const maxX = Math.trunc(Math.max(room.minX, room.maxX))
  const minZ = Math.trunc(Math.min(room.minZ, room.maxZ))
  const maxZ = Math.trunc(Math.max(room.minZ, room.maxZ))
  return { minX, maxX, minZ, maxZ, width: maxX - minX + 1, depth: maxZ - minZ + 1 }
}

function arrayLength(value) {
  return Array.isArray(value) ? value.length : 0
}

function checkRoom(id, room, limits, collector, runningCells) {
  const path = `$.rooms.${id}`
  let geometrySafe = true

  const boundsValid = ['minX', 'maxX', 'minZ', 'maxZ'].every(field => {
    const valid = typeof room[field] === 'number' && Number.isFinite(room[field])
    if (!valid) collector.add('room_bounds_invalid', { path, field })
    return valid
  })

  let cellCount = 0
  if (boundsValid) {
    const extent = boundsExtent(room)
    const extentWithinLimit = extent.width <= limits.maxExtentCells && extent.depth <= limits.maxExtentCells
    if (!extentWithinLimit) {
      collector.add('room_extent_exceeded', {
        path, limit: limits.maxExtentCells, width: extent.width, depth: extent.depth,
      })
      geometrySafe = false
    }
    const farthest = Math.max(
      Math.abs(extent.minX), Math.abs(extent.maxX), Math.abs(extent.minZ), Math.abs(extent.maxZ),
    )
    if (farthest > limits.maxAbsCoordinate) {
      collector.add('room_coordinate_out_of_range', { path, limit: limits.maxAbsCoordinate, actual: farthest })
      geometrySafe = false
    }
    // Une salle sans cases explicites est énumérée sur ses bornes : sa surface est celle du rectangle (comptée
    // seulement si l'étendue est dans le plafond, sinon l'erreur d'étendue suffit et le total n'est pas gonflé).
    if (Array.isArray(room.cells) && room.cells.length > 0) cellCount = room.cells.length
    else if (extentWithinLimit) cellCount = extent.width * extent.depth
  } else {
    geometrySafe = false
  }

  if (Array.isArray(room.cells) && room.cells.length > limits.maxTotalCells) {
    collector.add('too_many_cells', { path, limit: limits.maxTotalCells, actual: room.cells.length })
    geometrySafe = false
    // Erreur déjà signalée pour cette salle : elle ne gonfle pas le total de la carte (pas de double signalement).
    cellCount = 0
  }

  if (arrayLength(room.boundaryArcs) > limits.maxArcsPerRoom) {
    collector.add('too_many_arcs', { path, limit: limits.maxArcsPerRoom, actual: room.boundaryArcs.length })
  }
  const profileCount = arrayLength(room.wallElevationProfiles) + arrayLength(room.wallAppearanceProfiles)
  if (profileCount > limits.maxProfilesPerRoom) {
    collector.add('too_many_profiles', { path, limit: limits.maxProfilesPerRoom, actual: profileCount })
  }
  if (arrayLength(room.geometryClipRoomIds) > limits.maxClipRoomsPerRoom) {
    collector.add('too_many_clip_rooms', {
      path, limit: limits.maxClipRoomsPerRoom, actual: room.geometryClipRoomIds.length,
    })
  }
  if (arrayLength(room.openWallEdgeKeys) > limits.maxBoundaryEdgesPerRoom) {
    collector.add('too_many_open_walls', {
      path, limit: limits.maxBoundaryEdgesPerRoom, actual: room.openWallEdgeKeys.length,
    })
  }

  const slices = room.verticalProfile?.slices
  if (Array.isArray(slices)) {
    if (slices.length > limits.maxVerticalSlices) {
      collector.add('too_many_slices', { path, limit: limits.maxVerticalSlices, actual: slices.length })
    } else {
      slices.forEach((slice, sliceIndex) => {
        if (!isPlainObject(slice)) return
        const slicePath = `${path}.verticalProfile.slices.${sliceIndex}`
        let points = 0
        for (const polygon of Array.isArray(slice.footprint) ? slice.footprint : []) {
          for (const ring of Array.isArray(polygon) ? polygon : []) points += arrayLength(ring)
        }
        if (points > limits.maxRingPoints) {
          collector.add('slice_too_many_points', { path: slicePath, limit: limits.maxRingPoints, actual: points })
        }
        if (arrayLength(slice.wallPaths) > limits.maxWalls) {
          collector.add('slice_too_many_walls', { path: slicePath, limit: limits.maxWalls, actual: slice.wallPaths.length })
        }
      })
    }
  }

  // Le nombre d'arêtes de contour vient de la géométrie (autorité unique de « arête de contour »), mais seulement pour
  // une salle dont la taille est déjà bornée, et tant que le total de cases de la carte reste dans le plafond.
  let complexity = 0
  if (geometrySafe && runningCells + cellCount <= limits.maxTotalCells) {
    try {
      const edgeCount = roomBoundaryEdges(room).length
      if (edgeCount > limits.maxBoundaryEdgesPerRoom) {
        collector.add('room_boundary_too_complex', {
          path, limit: limits.maxBoundaryEdgesPerRoom, actual: edgeCount,
        })
      } else {
        // Le budget de la carte ne compte que les salles qui n'ont pas déjà été refusées (pas de double signalement).
        complexity = edgeCount * edgeCount
      }
    } catch {
      collector.add('room_geometry_unreadable', { path })
    }
  }

  return { cellCount, complexity }
}

export function checkSurfaceLimits(surface, limits = MAP_LIMITS) {
  const collector = createCollector(limits.maxErrors)
  if (!isPlainObject(surface)) {
    collector.add('not_object', { path: '$' })
    return collector.result()
  }

  // Comptes par collection. Une collection qui n'est pas un objet est laissée au validateur (il la signalera).
  const tooMany = new Set()
  for (const [collection, limitName] of Object.entries(IMPORT_GUARD_COLLECTION_LIMITS)) {
    const record = surface[collection]
    if (!isPlainObject(record)) continue
    const count = Object.keys(record).length
    if (count > limits[limitName]) {
      collector.add('too_many_items', { collection, limit: limits[limitName], actual: count })
      tooMany.add(collection)
    }
  }

  // Les salles ne sont parcourues que si leur nombre est dans le plafond.
  if (isPlainObject(surface.rooms) && !tooMany.has('rooms')) {
    let totalCells = 0
    let totalComplexity = 0
    for (const [id, room] of Object.entries(surface.rooms)) {
      if (collector.isFull) {
        collector.markTruncated()
        break
      }
      if (!isPlainObject(room)) continue
      const checked = checkRoom(id, room, limits, collector, totalCells)
      totalCells += checked.cellCount
      totalComplexity += checked.complexity
    }
    if (totalCells > limits.maxTotalCells) {
      collector.add('too_many_total_cells', { limit: limits.maxTotalCells, actual: totalCells })
    }
    if (totalComplexity > limits.maxBoundaryComplexity) {
      collector.add('boundary_complexity_exceeded', { limit: limits.maxBoundaryComplexity, actual: totalComplexity })
    }
  }

  return collector.result()
}
