import assert from 'node:assert/strict'
import test from 'node:test'
import { createCorsOriginValidator, parseClientOrigins } from './clientOrigins.js'

test('normalise et déduplique les origines LAN et publique', () => {
  assert.deepEqual(
    parseClientOrigins(' http://89.92.219.211:8393/, http://192.168.1.46:8393, http://89.92.219.211:8393 '),
    ['http://89.92.219.211:8393', 'http://192.168.1.46:8393'],
  )
})

test('refuse une URL qui n’est pas une origine HTTP stricte', () => {
  assert.throws(() => parseClientOrigins('ftp://example.test'), /Protocole/)
  assert.throws(() => parseClientOrigins('https://example.test/path'), /protocole, hôte et port/)
  assert.throws(() => parseClientOrigins(''), /au moins une origine/)
})

test('autorise les clients sans Origin et les origines déclarées seulement', () => {
  const validate = createCorsOriginValidator(['http://192.168.1.46:8393'])
  const result = (origin) => new Promise((resolve, reject) => {
    validate(origin, (error, allowed) => error ? reject(error) : resolve(allowed))
  })

  return Promise.all([
    assert.doesNotReject(async () => assert.equal(await result(undefined), true)),
    assert.doesNotReject(async () => assert.equal(await result('http://192.168.1.46:8393'), true)),
    assert.doesNotReject(async () => assert.equal(await result('http://example.test'), false)),
  ])
})
