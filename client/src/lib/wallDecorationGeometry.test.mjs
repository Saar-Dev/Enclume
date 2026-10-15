import test from 'node:test'
import assert from 'node:assert/strict'

import {
  findWallDecorationPanel,
  wallDecorationPlacement,
  DECOR_EYE_HEIGHT_M,
} from './wallDecorationGeometry.js'
import {
  getRoomBoundaryWallRuns,
  roomsWallSegments,
  makeWallDecorationFromWallPoint,
  getWallRenderBox,
} from './surfaceData.js'

function emptySurface(patch = {}) {
  return {
    version: 12, fine: 4, storyHeight: 2.5,
    rooms: {}, floors: {}, walls: {}, ceilings: {}, stairs: {}, connectors: {},
    ...patch,
  }
}
function room(id, level, patch = {}) {
  return {
    id, minX: 0, maxX: 1, minZ: 0, maxZ: 1, level, y: level * 2.5, heightLevels: 1,
    cells: ['0:0', '1:0', '0:1', '1:1'], wallThickness: 1,
    ...patch,
  }
}

const ASSET_ID = '11111111-1111-4111-8111-111111111111'
function poseNorthWallDecoration(baseRoom, roomId = baseRoom.id) {
  const north = getRoomBoundaryWallRuns(baseRoom).find(w => w.side === 'north')
  const surface = emptySurface({ rooms: { [roomId]: baseRoom } })
  const panel = roomsWallSegments(surface.rooms).find(p => p.sourceEdgeKeys?.some(k => north.edgeKeys.includes(k)))
  const wallPoint = { fx: (Number(panel.x0) + Number(panel.x1)) / 2, fz: (Number(panel.z0) + Number(panel.z1)) / 2 }
  const geo = makeWallDecorationFromWallPoint(surface, wallPoint, { selectedRoomId: roomId, level: 0 })
  const decoration = { ...geo, id: 'decor-1', assetId: ASSET_ID, widthM: 0.5, heightM: 0.5, mirror: false }
  return { surface, panel, decoration }
}

test('wallDecorationPlacement colle le quad sur la face intérieure, dans le sens de la normale stockée', () => {
  // Vérifié empiriquement (pas supposé) avant d'écrire ce test : pour une salle seule, sans
  // voisine, `interiorNormalSignsByRoom.roomA` vaut déjà +1 et la normale stockée par
  // `makeWallDecorationFromWallPoint` pointe déjà vers l'intérieur — aucune inversion nécessaire
  // dans ce cas simple (la correction §N ne joue que pour les cas qui en ont vraiment besoin, voir
  // le test de retournement ci-dessous).
  const { panel, decoration } = poseNorthWallDecoration(room('roomA', 0))
  assert.equal(panel.interiorNormalSignsByRoom?.roomA, 1)
  const placement = wallDecorationPlacement(decoration, panel)
  assert.ok(placement)
  const [x, y, z] = placement.position
  const dx = x - Number(decoration.anchorX)
  const dz = z - Number(decoration.anchorZ)
  const box = getWallRenderBox(panel)
  const expectedOffset = box.args[2] / 2 + 0.015
  assert.ok(Math.abs(Math.hypot(dx, dz) - expectedOffset) < 1e-6, 'décalage attendu : demi-épaisseur de mur + marge')
  assert.ok(
    dx * Number(decoration.normalX) + dz * Number(decoration.normalZ) > 0,
    'le décalage doit pointer dans le sens de la normale stockée (vers l’intérieur)',
  )
  // Hauteur par défaut (mur de 2,5 m, décor de 0,5 m) : la hauteur « yeux » (1,5 m) tient sans
  // dépasser le mur, donc la pose l'utilise telle quelle.
  assert.ok(Math.abs(y - (Number(decoration.y) + DECOR_EYE_HEIGHT_M)) < 1e-6)
})

test('wallDecorationPlacement plafonne la hauteur de pose sur un mur bas (jamais la constante brute)', () => {
  const { panel, decoration } = poseNorthWallDecoration(room('roomA', 0))
  // Mur abaissé à 0,6 m (simule un mur bas déjà présent dans le monde) — la hauteur réelle du
  // panneau vient de `wall.height` (surfaceGeometry.js, repli 2,5 m sinon) : on la force ici.
  const lowPanel = { ...panel, height: 0.6 }
  const placement = wallDecorationPlacement(decoration, lowPanel)
  assert.ok(placement)
  const half = decoration.heightM / 2
  const centerOffset = placement.position[1] - Number(decoration.y)
  assert.ok(Math.abs(centerOffset - (0.6 - half)) < 1e-6, `centerOffset attendu ${0.6 - half}, obtenu ${centerOffset}`)
})

test('wallDecorationPlacement utilise anchorY (position libre) quand il est fourni, au lieu de la hauteur des yeux', () => {
  const { panel, decoration } = poseNorthWallDecoration(room('roomA', 0))
  const atKnee = { ...decoration, anchorY: 0.4 }
  const placement = wallDecorationPlacement(atKnee, panel)
  const half = decoration.heightM / 2
  const centerOffset = placement.position[1] - Number(decoration.y)
  assert.ok(Math.abs(centerOffset - 0.4) < 1e-6, `centerOffset attendu 0.4, obtenu ${centerOffset}`)
  assert.ok(centerOffset !== DECOR_EYE_HEIGHT_M - half + half, 'ne doit plus retomber sur la hauteur des yeux par défaut')
})

test('wallDecorationPlacement plafonne anchorY à la hauteur réelle du mur, ne le laisse jamais dépasser', () => {
  const { panel, decoration } = poseNorthWallDecoration(room('roomA', 0))
  const tooHigh = { ...decoration, anchorY: 10 }
  const lowPanel = { ...panel, height: 0.6 }
  const placement = wallDecorationPlacement(tooHigh, lowPanel)
  const half = decoration.heightM / 2
  const centerOffset = placement.position[1] - Number(decoration.y)
  assert.ok(Math.abs(centerOffset - (0.6 - half)) < 1e-6, `centerOffset attendu ${0.6 - half}, obtenu ${centerOffset}`)
})

test('wallDecorationPlacement retombe sur la hauteur des yeux quand anchorY est null (décor posé avant la position libre)', () => {
  const { panel, decoration } = poseNorthWallDecoration(room('roomA', 0))
  const legacy = { ...decoration, anchorY: null }
  const placement = wallDecorationPlacement(legacy, panel)
  const centerOffset = placement.position[1] - Number(decoration.y)
  assert.ok(Math.abs(centerOffset - DECOR_EYE_HEIGHT_M) < 1e-6)
})

test('wallDecorationPlacement inverse le sens de la normale selon interiorNormalSignsByRoom', () => {
  const { panel, decoration } = poseNorthWallDecoration(room('roomA', 0))
  const sameSidePanel = { ...panel, interiorNormalSignsByRoom: { roomA: 1 } }
  const flippedPanel = { ...panel, interiorNormalSignsByRoom: { roomA: -1 } }
  const placementSame = wallDecorationPlacement(decoration, sameSidePanel)
  const placementFlipped = wallDecorationPlacement(decoration, flippedPanel)

  const dx = placementFlipped.position[0] - placementSame.position[0]
  const dz = placementFlipped.position[2] - placementSame.position[2]
  // Les deux positions s'écartent du même point d'ancrage dans des sens opposés.
  assert.ok(Math.hypot(dx, dz) > 0.01, 'le décalage doit changer de sens')
  const diffRotation = Math.abs(placementFlipped.rotationY - placementSame.rotationY)
  const normalizedDiff = Math.min(diffRotation, Math.abs(diffRotation - 2 * Math.PI))
  assert.ok(Math.abs(normalizedDiff - Math.PI) < 1e-6, 'les deux rotations doivent différer de π (quad retourné)')
})

test('findWallDecorationPanel départage par position quand plusieurs panneaux partagent les mêmes sourceEdgeKeys (découpe par porte, §P JOURNALANALYSE.md)', () => {
  // `cloneWallPiece` (SurfaceDungeonScene.jsx) ne recadre jamais `sourceEdgeKeys` lors d'une découpe
  // par porte : les morceaux issus de la même découpe partagent tous la liste complète d'origine.
  // On simule ce comportement réel sans importer le fichier .jsx (JSX, non chargeable par node:test).
  const bigRoom = room('roomA', 0, { maxX: 5, cells: Array.from({ length: 6 }, (_, x) => `${x}:0`) })
  const north = getRoomBoundaryWallRuns(bigRoom).find(w => w.side === 'north')
  const surface = emptySurface({ rooms: { roomA: bigRoom } })
  const panel = roomsWallSegments(surface.rooms).find(p => p.sourceEdgeKeys?.some(k => north.edgeKeys.includes(k)))

  // Décor posé près du début du mur (premier quart).
  const wallPoint = { fx: Number(panel.x0) + 0.5, fz: Number(panel.z0) }
  const geo = makeWallDecorationFromWallPoint(surface, wallPoint, { selectedRoomId: 'roomA', level: 0 })
  const decoration = { ...geo, id: 'decor-1', assetId: ASSET_ID, widthM: 0.5, heightM: 0.5, mirror: false }

  // Découpe simulée : deux morceaux du MÊME panneau, mêmes sourceEdgeKeys, spans disjoints — l'un
  // contient le point d'ancrage du décor, l'autre non (comme après la pose d'une porte ailleurs sur
  // le même mur).
  const midX = (Number(panel.x0) + Number(panel.x1)) / 2
  const before = { ...panel, id: `${panel.id}:cut:before`, x1: midX }
  const after = { ...panel, id: `${panel.id}:cut:after`, x0: midX }

  const found = findWallDecorationPanel([after, before], decoration)
  assert.equal(found?.id, before.id, 'doit retrouver le morceau qui contient réellement le point d’ancrage, pas le premier du tableau')
})

test('findWallDecorationPanel retourne null sans sourceEdgeKeys ou sans panneau correspondant', () => {
  assert.equal(findWallDecorationPanel([{ id: 'x', sourceEdgeKeys: ['a'] }], { sourceEdgeKeys: [] }), null)
  assert.equal(findWallDecorationPanel([], { sourceEdgeKeys: ['a'] }), null)
})
