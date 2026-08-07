import { RateLimiterMemory } from 'rate-limiter-flexible'

// Rate limiting brute-force login/register (SECU-1, docs/AUDIT.md).
// Login : deux paliers combinés (recette officielle rate-limiter-flexible, adaptée email+escalade
// — décision Saar 2026-08-07) :
//   - par compte ciblé (email+IP) : 5 échecs bloque 1h ; toute récidive après ce blocage bloque 24h.
//   - par IP (volumétrique, tous comptes confondus) : 10 échecs/24h bloque l'IP 24h ; récidive → 7j.
//   - remise à zéro complète (compteur + indicateur d'escalade) des deux paliers sur tout succès.
// Register : un seul palier IP, non escalade — le REGISTRATION_CODE reste la vraie barrière (SECU-2).
const DAY = 24 * 60 * 60

// `points: N` autorise N échecs sans blocage ; le blocage se déclenche au dépassement strict,
// donc le (N+1)-ième échec. Pour que « 5 échecs bloque » corresponde bien au 5e échec, `points`
// est fixé à N-1 (4 et 9 ci-dessous) — décalage documenté du comportement natif de la lib, pas un
// choix arbitraire (vérifié par test, cf. authRateLimit.test.mjs).
//
// Mémoire longue (compteur d'échecs email+IP + indicateurs d'escalade) : la doc officielle de
// rate-limiter-flexible (wiki "Memory") plafonne `duration`/`blockDuration` à 2 147 483s (~24,8j)
// pour RateLimiterMemory — au-delà, le timer de nettoyage interne (setTimeout) overflow un entier
// 32 bits et se déclenche après 1ms au lieu de la durée demandée (`TimeoutOverflowWarning` observé
// avec `duration: 30 * DAY` en test), effaçant compteur/indicateur presque immédiatement. Une
// `duration: 0` (jamais d'auto-expiration) contourne ce bug mais en ouvre un autre : plus aucun
// nettoyage automatique, donc une entrée par clé qui ne connaîtra jamais de succès (IP d'attaque)
// reste en mémoire indéfiniment — un attaquant distribué sur des milliers d'IP peut ainsi faire
// grossir la Map sans limite. `LONG_MEMORY_SEC` (20j, sous la limite avec marge) évite les deux :
// pas d'overflow, et auto-nettoyage après 20 jours d'inactivité totale sur une clé (au-delà d'un
// succès). Concession documentée : l'historique n'est plus littéralement "infini jusqu'au succès"
// mais borné à 20 jours d'inactivité — raisonnable pour un groupe fermé, pas une attaque distribuée
// à l'échelle d'Internet. Persister au-delà nécessiterait un store distribué (Redis/Valkey/SQL),
// recommandé par la lib elle-même — hors périmètre, pas de Redis dans ce projet (confirmé absent de
// server/package.json).
const LONG_MEMORY_SEC = 20 * DAY

const loginFailsByEmailAndIp = new RateLimiterMemory({ points: 4, duration: LONG_MEMORY_SEC, blockDuration: 60 * 60 })
const loginEscalationByEmailAndIp = new RateLimiterMemory({ points: 1, duration: LONG_MEMORY_SEC })
const EMAIL_IP_ESCALATED_BLOCK_SEC = DAY

const loginFailsByIp = new RateLimiterMemory({ points: 9, duration: DAY, blockDuration: DAY })
const loginEscalationByIp = new RateLimiterMemory({ points: 1, duration: LONG_MEMORY_SEC })
const IP_ESCALATED_BLOCK_SEC = 7 * DAY

const registerFailsByIp = new RateLimiterMemory({ points: 9, duration: 60 * 60, blockDuration: 60 * 60 })

function emailIpKey(ipAddr, email) {
  return `${String(email).toLowerCase()}_${ipAddr}`
}

// Secondes avant déblocage si `key` est actuellement bloquée sur `limiter`, sans consommer de
// point. `consumedPoints > limiter.points` (pas `remainingPoints <= 0`, qui devient vrai un cran
// trop tôt) est le même test que celui utilisé en interne par consume() pour déclencher le blocage.
async function getBlockedRetrySecs(limiter, key) {
  const res = await limiter.get(key)
  if (res && res.consumedPoints > limiter.points) return Math.round(res.msBeforeNext / 1000) || 1
  return 0
}

// Enregistre un échec sur `failsLimiter`. Si `key` a déjà déclenché un premier blocage (indicateur
// posé sur `escalationLimiter`) sans succès depuis, ce nouvel échec force directement le blocage
// aggravé `escalatedBlockSec` au lieu de repasser par le compteur normal.
async function recordFailure(failsLimiter, escalationLimiter, key, escalatedBlockSec) {
  const escalated = await escalationLimiter.get(key)
  if (escalated) {
    await failsLimiter.block(key, escalatedBlockSec)
    return
  }
  try {
    await failsLimiter.consume(key)
  } catch (rejOrErr) {
    if (rejOrErr instanceof Error) throw rejOrErr
    await escalationLimiter.consume(key).catch(() => {})
  }
}

export async function getLoginBlockRetrySecs(ipAddr, email) {
  const [emailIpRetrySecs, ipRetrySecs] = await Promise.all([
    getBlockedRetrySecs(loginFailsByEmailAndIp, emailIpKey(ipAddr, email)),
    getBlockedRetrySecs(loginFailsByIp, ipAddr),
  ])
  return Math.max(emailIpRetrySecs, ipRetrySecs)
}

// Compte inexistant : ne consommer que le palier IP, pas email+IP (sinon une énumération massive
// d'emails aléatoires crée une clé mémoire par tentative pour rien).
export async function recordLoginFailure(ipAddr, email, { userExists }) {
  const tasks = [recordFailure(loginFailsByIp, loginEscalationByIp, ipAddr, IP_ESCALATED_BLOCK_SEC)]
  if (userExists) {
    tasks.push(recordFailure(
      loginFailsByEmailAndIp, loginEscalationByEmailAndIp, emailIpKey(ipAddr, email), EMAIL_IP_ESCALATED_BLOCK_SEC
    ))
  }
  await Promise.all(tasks)
}

export async function resetLoginLimiters(ipAddr, email) {
  const key = emailIpKey(ipAddr, email)
  await Promise.all([
    loginFailsByEmailAndIp.delete(key),
    loginEscalationByEmailAndIp.delete(key),
    loginFailsByIp.delete(ipAddr),
    loginEscalationByIp.delete(ipAddr),
  ])
}

export async function getRegisterBlockRetrySecs(ipAddr) {
  return getBlockedRetrySecs(registerFailsByIp, ipAddr)
}

export async function recordRegisterFailure(ipAddr) {
  await registerFailsByIp.consume(ipAddr).catch(() => {})
}
