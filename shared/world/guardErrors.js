// shared/world/guardErrors.js
// Collecteur d'erreurs commun aux gardes d'un document de carte importé (importGuard.js, surfaceFieldTypes.js) — segment S0 :
// docs/PLANS/PLAN_EXPORT_CARTE.md §12. Chaque erreur est `{ code, params }` : jamais de texte français (la traduction se fait
// côté client), au plus `maxErrors` erreurs, avec un drapeau `truncated` quand l'analyse n'a pas tout listé.

export function createCollector(maxErrors) {
  const errors = []
  let truncated = false
  return {
    add(code, params = {}) {
      if (errors.length >= maxErrors) {
        truncated = true
        return
      }
      errors.push(Object.freeze({ code, params: Object.freeze({ ...params }) }))
    },
    get isFull() { return errors.length >= maxErrors },
    // À appeler quand on arrête l'analyse parce que le plafond d'erreurs est atteint alors qu'il restait du travail :
    // le résultat ne liste alors pas forcément toutes les erreurs.
    markTruncated() { truncated = true },
    result() {
      return Object.freeze({ ok: errors.length === 0, errors: Object.freeze([...errors]), truncated })
    },
  }
}

export function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
