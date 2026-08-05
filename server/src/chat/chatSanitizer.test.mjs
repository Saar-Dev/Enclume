// Lancement manuel : node --env-file=../../.env --test server/src/chat/chatSanitizer.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'

import { sanitizeMessageText } from './chatSanitizer.js'

test('échappe le HTML brut', () => {
  assert.equal(
    sanitizeMessageText('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;',
  )
})

test('gras **texte**', () => {
  assert.equal(sanitizeMessageText('**fort**'), '<strong>fort</strong>')
})

test('italique *texte*', () => {
  assert.equal(sanitizeMessageText('*faible*'), '<em>faible</em>')
})

test('code `texte`', () => {
  assert.equal(sanitizeMessageText('`const x = 1`'), '<code>const x = 1</code>')
})

test('citation en début de ligne', () => {
  assert.equal(sanitizeMessageText('> une citation'), '<blockquote>une citation</blockquote>')
})

test('le contenu code n\'est jamais réinterprété comme gras/italique', () => {
  assert.equal(sanitizeMessageText('`a*b*c`'), '<code>a*b*c</code>')
})

test('un faux tag injecté dans du texte gras reste échappé', () => {
  assert.equal(
    sanitizeMessageText('**<img src=x onerror=alert(1)>**'),
    '<strong>&lt;img src=x onerror=alert(1)&gt;</strong>',
  )
})

test('combinaison gras + italique + code dans un seul message', () => {
  assert.equal(
    sanitizeMessageText('**gras** et *italique* et `code`'),
    '<strong>gras</strong> et <em>italique</em> et <code>code</code>',
  )
})
