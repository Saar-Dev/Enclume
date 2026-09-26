import test from 'node:test'
import assert from 'node:assert/strict'

import { reviewTrace, reviewTraceLines, reviewTraceError, shortId, isReviewTraceEnabled } from './reviewTrace.js'

// Capture la console pendant `run` ; restaure toujours (test pur, aucune base).
function capture(run) {
  const logs = []
  const errors = []
  const original = { log: console.log, error: console.error }
  console.log = (...args) => logs.push(args.join(' '))
  console.error = (...args) => errors.push(args.join(' '))
  try { run() } finally { console.log = original.log; console.error = original.error }
  return { logs, errors }
}

async function withEnv(value, run) {
  const previous = process.env.REVIEW_TRACE
  if (value === undefined) delete process.env.REVIEW_TRACE
  else process.env.REVIEW_TRACE = value
  try { return await run() } finally {
    if (previous === undefined) delete process.env.REVIEW_TRACE
    else process.env.REVIEW_TRACE = previous
  }
}

test('allumée par défaut : une ligne préfixée [REVUE hh:mm:ss.mmm]', () => withEnv(undefined, () => {
  assert.equal(isReviewTraceEnabled(), true)
  const { logs } = capture(() => reviewTrace('bonjour'))
  assert.equal(logs.length, 1)
  assert.match(logs[0], /^\[REVUE \d{2}:\d{2}:\d{2}\.\d{3}\] bonjour$/)
}))

test('REVIEW_TRACE=0 coupe les traces d\'information ET n\'évalue pas le message (aucun coût éteinte)', () => withEnv('0', () => {
  assert.equal(isReviewTraceEnabled(), false)
  let evaluated = false
  const { logs } = capture(() => {
    reviewTrace(() => { evaluated = true; return 'x' })
    reviewTraceLines(['a', 'b'])
  })
  assert.deepEqual(logs, [])
  assert.equal(evaluated, false)
}))

test('une erreur sort TOUJOURS, interrupteur coupé compris, avec la pile', () => withEnv('0', () => {
  const { errors } = capture(() => reviewTraceError('handler en échec', new Error('boum')))
  assert.match(errors[0], /^\[REVUE \d{2}:\d{2}:\d{2}\.\d{3}\] ERREUR — handler en échec : boum$/)
  assert.ok(errors.length >= 2, 'la pile suit le message')
}))

test('une trace ne fait jamais échouer l\'appelant : message qui lève → ligne « illisible », pas d\'exception', () => withEnv(undefined, () => {
  const { logs } = capture(() => reviewTrace(() => { throw new Error('format cassé') }))
  assert.equal(logs.length, 1)
  assert.match(logs[0], /trace illisible : format cassé/)
}))

test('plusieurs lignes ; les valeurs vides n\'écrivent rien', () => withEnv(undefined, () => {
  const { logs } = capture(() => {
    reviewTraceLines(['un', '', null, 'deux'])
    reviewTrace(null)
    reviewTrace('')
  })
  assert.equal(logs.length, 2)
  assert.match(logs[0], /\] un$/)
  assert.match(logs[1], /\] deux$/)
}))

test('shortId : 8 premiers caractères, « — » si absent', () => {
  assert.equal(shortId('8f14e45f-ceea-467f-a9b2-3c9d8a1b0c7e'), '8f14e45f')
  assert.equal(shortId(null), '—')
  assert.equal(shortId(undefined), '—')
})
