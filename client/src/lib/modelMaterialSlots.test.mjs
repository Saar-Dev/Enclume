import test from 'node:test'
import assert from 'node:assert/strict'

import { connectorModelMaterialSlots } from './modelMaterialSlots.js'

test('une fenêtre-écran intégrée récupère le slot charnières par convention GLB', () => {
  const slots = connectorModelMaterialSlots({
    type: 'screen-window',
    modelBuiltinKey: 'structural_windows/screen_window_2pan_1level',
    modelGeometry: {
      materialSlots: [
        { id: 'frame', code: 'SLOT_01', label: 'Cadre', defaultHex: '#17252d' },
        { id: 'glass', code: 'SLOT_05', label: 'Verre', defaultHex: '#6edcff' },
      ],
    },
  })

  assert.deepEqual(slots.map(slot => slot.code), ['SLOT_01', 'SLOT_03', 'SLOT_05'])
  assert.equal(slots.find(slot => slot.code === 'SLOT_03').label, 'Charnières')
})

test('un modèle libre ne reçoit aucun slot structurel implicite', () => {
  assert.deepEqual(connectorModelMaterialSlots({
    type: 'screen-window',
    modelBuiltinKey: 'custom/screen_window',
    modelGeometry: { materialSlots: [] },
  }), [])
})
