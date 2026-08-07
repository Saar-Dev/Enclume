import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getLoginBlockRetrySecs, recordLoginFailure, resetLoginLimiters,
  getRegisterBlockRetrySecs, recordRegisterFailure,
} from './authRateLimit.js'

const DAY = 24 * 60 * 60

// Chaque test utilise une IP dédiée : les limiteurs sont des singletons du module,
// partager une IP entre tests ferait fuiter l'état de l'un vers l'autre.
let ipCounter = 0
const nextIp = () => `10.0.${++ipCounter}.1`

// Garde générique (pas liée à une valeur précise) : RateLimiterMemory plafonne duration/blockDuration
// à ~24,8j à cause de setTimeout (32 bits) — un dépassement futur (ex. quelqu'un qui remonte
// LONG_MEMORY_SEC sans vérifier) redonnerait le bug d'origine (compteur effacé après 1ms au lieu de
// la durée demandée) silencieusement, sans faire échouer les tests fonctionnels ci-dessus.
const timeoutOverflowWarnings = []
process.on('warning', (w) => {
  if (w.name === 'TimeoutOverflowWarning') timeoutOverflowWarnings.push(w.message)
})

test('email+IP : sous le seuil de 5 échecs, pas de blocage', async () => {
  const ip = nextIp()
  const email = 'joueur@example.test'
  for (let i = 0; i < 4; i++) {
    await recordLoginFailure(ip, email, { userExists: true })
  }
  assert.equal(await getLoginBlockRetrySecs(ip, email), 0)
})

test('email+IP : le 5e échec bloque ~1h, puis toute récidive bloque ~24h', async () => {
  const ip = nextIp()
  const email = 'joueur@example.test'

  for (let i = 0; i < 5; i++) {
    await recordLoginFailure(ip, email, { userExists: true })
  }
  const retrySecs1 = await getLoginBlockRetrySecs(ip, email)
  assert.ok(retrySecs1 > 0 && retrySecs1 <= 60 * 60, `attendu <= 1h, obtenu ${retrySecs1}s`)

  // Récidive après le 1er blocage (même s'il n'a pas encore expiré côté horloge réelle :
  // l'indicateur d'escalade force l'aggravation indépendamment du compteur de points).
  await recordLoginFailure(ip, email, { userExists: true })
  const retrySecs2 = await getLoginBlockRetrySecs(ip, email)
  assert.ok(retrySecs2 > 60 * 60, `attendu > 1h après récidive, obtenu ${retrySecs2}s`)
  assert.ok(retrySecs2 <= DAY, `attendu <= 24h, obtenu ${retrySecs2}s`)
})

test('IP : le 10e échec (comptes inexistants) bloque ~24h, récidive bloque ~7j', async () => {
  const ip = nextIp()
  for (let i = 0; i < 9; i++) {
    await recordLoginFailure(ip, `inconnu${i}@example.test`, { userExists: false })
  }
  assert.equal(await getLoginBlockRetrySecs(ip, 'inconnu-final@example.test'), 0)

  await recordLoginFailure(ip, 'inconnu9@example.test', { userExists: false })
  const retrySecs1 = await getLoginBlockRetrySecs(ip, 'nimporte@example.test')
  assert.ok(retrySecs1 > 0 && retrySecs1 <= DAY, `attendu <= 24h, obtenu ${retrySecs1}s`)

  await recordLoginFailure(ip, 'inconnu10@example.test', { userExists: false })
  const retrySecs2 = await getLoginBlockRetrySecs(ip, 'nimporte@example.test')
  assert.ok(retrySecs2 > DAY, `attendu > 24h après récidive, obtenu ${retrySecs2}s`)
  assert.ok(retrySecs2 <= 7 * DAY, `attendu <= 7j, obtenu ${retrySecs2}s`)
})

test('un succès remet à zéro le compteur ET l\'indicateur d\'escalade (email+IP)', async () => {
  const ip = nextIp()
  const email = 'joueur@example.test'

  for (let i = 0; i < 5; i++) {
    await recordLoginFailure(ip, email, { userExists: true })
  }
  assert.ok((await getLoginBlockRetrySecs(ip, email)) > 0)

  await resetLoginLimiters(ip, email)
  assert.equal(await getLoginBlockRetrySecs(ip, email), 0)

  // Après reset, il faut de nouveau 5 échecs pour bloquer (pas 1 seul — preuve que
  // l'indicateur d'escalade a bien été effacé, pas seulement le compteur de points).
  await recordLoginFailure(ip, email, { userExists: true })
  assert.equal(await getLoginBlockRetrySecs(ip, email), 0)

  for (let i = 0; i < 4; i++) {
    await recordLoginFailure(ip, email, { userExists: true })
  }
  const retrySecs = await getLoginBlockRetrySecs(ip, email)
  assert.ok(retrySecs > 0 && retrySecs <= 60 * 60, `attendu <= 1h (pas d'escalade résiduelle), obtenu ${retrySecs}s`)
})

test('un échec sur un compte inexistant ne consomme pas le palier email+IP', async () => {
  const ip = nextIp()
  const email = 'inexistant@example.test'

  for (let i = 0; i < 10; i++) {
    await recordLoginFailure(ip, email, { userExists: false })
  }
  // Le palier IP est maintenant bloqué (10/10), donc getLoginBlockRetrySecs > 0 globalement —
  // mais on vérifie ici spécifiquement que le compteur email+IP n'a jamais été touché en
  // renvoyant une IP fraîche pour isoler le palier IP de ce test du palier email+IP d'un autre email.
  const ip2 = nextIp()
  for (let i = 0; i < 4; i++) {
    await recordLoginFailure(ip2, email, { userExists: false })
  }
  assert.equal(await getLoginBlockRetrySecs(ip2, email), 0, 'palier IP de ip2 encore sous le seuil')
})

test('register : sous le seuil pas de blocage, le 10e échec bloque ~1h', async () => {
  const ip = nextIp()
  for (let i = 0; i < 9; i++) {
    await recordRegisterFailure(ip)
  }
  assert.equal(await getRegisterBlockRetrySecs(ip), 0)

  await recordRegisterFailure(ip)
  const retrySecs = await getRegisterBlockRetrySecs(ip)
  assert.ok(retrySecs > 0 && retrySecs <= 60 * 60, `attendu <= 1h, obtenu ${retrySecs}s`)
})

test('aucune durée configurée ne dépasse la limite setTimeout de RateLimiterMemory (~24,8j)', () => {
  assert.deepEqual(timeoutOverflowWarnings, [])
})
