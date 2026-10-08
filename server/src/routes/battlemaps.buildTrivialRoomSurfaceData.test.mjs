import test from 'node:test'
import assert from 'node:assert/strict'

import { buildTrivialRoomSurfaceData } from './battlemaps.js'
import { AppError } from '../lib/AppError.js'

// Fonction pure (aucune base) — lancement : node --test server/src/routes/battlemaps.buildTrivialRoomSurfaceData.test.mjs
// SURFACE-DOC-NO-BOUNDS : la salle triviale d'une carte 2D (POST / et PUT /:id, battlemaps.js) vient
// de image_width/image_height/grid_size envoyés par le client — avant ce correctif, aucun plafond ne
// bornait la salle construite, seule porte d'entrée que le correctif principal du ticket (PUT
// /:id/surface, commit 70872d10) n'avait pas couverte.

test('buildTrivialRoomSurfaceData — une image et une grille normales construisent une salle', () => {
  const surfaceData = buildTrivialRoomSurfaceData({
    battlemapId: 'bm-test', gridSize: 64, imageWidth: 1280, imageHeight: 960,
  })
  const room = surfaceData.rooms.main
  assert.equal(room.maxX - room.minX + 1, 20)
  assert.equal(room.maxZ - room.minZ + 1, 15)
})

test('buildTrivialRoomSurfaceData — une image énorme est rejetée, jamais énumérée', () => {
  assert.throws(
    () => buildTrivialRoomSurfaceData({
      battlemapId: 'bm-test', gridSize: 64, imageWidth: 1e12, imageHeight: 1e12,
    }),
    (error) => error instanceof AppError && error.statusCode === 400,
  )
})

test('buildTrivialRoomSurfaceData — une grille minuscule face à une image normale est rejetée, jamais énumérée', () => {
  assert.throws(
    () => buildTrivialRoomSurfaceData({
      battlemapId: 'bm-test', gridSize: 0.0001, imageWidth: 2000, imageHeight: 2000,
    }),
    (error) => error instanceof AppError && error.statusCode === 400,
  )
})
