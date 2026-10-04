// Test pur (aucune base) — nécessite JWT_SECRET en variable d'env (déjà requis par
// middleware/auth.js, partagé). Lancer : node --env-file=.env --test server/src/lib/assetUrlSigning.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signAssetFieldValue, verifyAssetToken, ASSET_URL_FIELDS } from './assetUrlSigning.js'

function tokenAndPureFrom(signedUrl) {
  const [purePath, query] = signedUrl.split('?')
  const token = new URLSearchParams(query).get('t')
  return { purePath, token }
}

test('signAssetFieldValue — ajoute ?t= quand aucune query existante', () => {
  const signed = signAssetFieldValue('tokens/default.glb')
  const { purePath, token } = tokenAndPureFrom(signed)
  assert.equal(purePath, 'tokens/default.glb')
  assert.ok(token && token.length > 0)
})

test('signAssetFieldValue — préserve le ?v=<timestamp> déjà stocké, ajoute &t=', () => {
  const signed = signAssetFieldValue('characters/abc/portrait.png?v=169999')
  assert.ok(signed.includes('?v=169999&t='), `attendu ?v=...&t=..., reçu: ${signed}`)
  const { purePath, token } = tokenAndPureFrom(signed)
  assert.equal(purePath, 'characters/abc/portrait.png')
  assert.ok(token)
})

test('signAssetFieldValue — passthrough sur valeur absente/non-string', () => {
  assert.equal(signAssetFieldValue(null), null)
  assert.equal(signAssetFieldValue(undefined), undefined)
  assert.equal(signAssetFieldValue(''), '')
})

test('verifyAssetToken — jeton valide pour SON chemin exact → true', () => {
  const signed = signAssetFieldValue('battlemaps/xyz/cover.png?v=42')
  const { purePath, token } = tokenAndPureFrom(signed)
  assert.equal(verifyAssetToken(purePath, token), true)
})

test('verifyAssetToken — jeton valide mais pour un AUTRE chemin → false (pas de réutilisation croisée)', () => {
  const signed = signAssetFieldValue('battlemaps/xyz/cover.png')
  const { token } = tokenAndPureFrom(signed)
  assert.equal(verifyAssetToken('battlemaps/AUTRE/cover.png', token), false)
})

test('verifyAssetToken — jeton absent ou invalide → false, jamais une exception', () => {
  assert.equal(verifyAssetToken('tokens/default.glb', undefined), false)
  assert.equal(verifyAssetToken('tokens/default.glb', 'garbage-not-a-jwt'), false)
})

// signAssetFieldsMiddleware n'est pas appelable hors d'un cycle Express req/res — testé
// indirectement ici via son cœur (signDeep n'est pas exporté : on vérifie le même résultat via
// le comportement observable, en reconstruisant un middleware minimal avec un faux res).
test('signAssetFieldsMiddleware — signe un champ niveau 1 ET niveau 2 (entities[].blueprint.glb_url), laisse le reste intact', async () => {
  const { signAssetFieldsMiddleware } = await import('./assetUrlSigning.js')
  const middleware = signAssetFieldsMiddleware()
  let captured = null
  const res = { json: (body) => { captured = body; return res } }
  middleware({}, res, () => {})
  res.json({
    entities: [
      { id: 'e1', blueprint: { label: 'Porte', glb_url: 'entities/porte.glb?v=1' } },
    ],
    character: { id: 'c1', portrait_url: 'characters/c1/portrait.png', name: 'Test' },
    unrelatedCount: 3,
  })

  const bp = captured.entities[0].blueprint
  assert.ok(bp.glb_url.includes('entities/porte.glb?v=1&t='), `reçu: ${bp.glb_url}`)
  assert.equal(captured.entities[0].id, 'e1')
  assert.equal(captured.entities[0].blueprint.label, 'Porte')

  const char = captured.character
  assert.ok(char.portrait_url.includes('characters/c1/portrait.png?t='), `reçu: ${char.portrait_url}`)
  assert.equal(char.name, 'Test')
  assert.equal(captured.unrelatedCount, 3)

  // Les deux jetons doivent être vérifiables contre leur propre chemin exact.
  const { purePath: bpPure, token: bpToken } = tokenAndPureFrom(bp.glb_url)
  assert.equal(verifyAssetToken(bpPure, bpToken), true)
  const { purePath: charPure, token: charToken } = tokenAndPureFrom(char.portrait_url)
  assert.equal(verifyAssetToken(charPure, charToken), true)
})

test('ASSET_URL_FIELDS — liste non vide, pas de doublon', () => {
  assert.ok(ASSET_URL_FIELDS.length > 0)
  assert.equal(new Set(ASSET_URL_FIELDS).size, ASSET_URL_FIELDS.length)
})
