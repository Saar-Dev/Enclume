// ASSETS-ROUTE-NO-AUTH — jetons signés pour /api/assets/*.
//
// Pourquoi pas le cookie de session (requireAuth) seul : vérifié dans three.js (pas supposé) que
// GLTFLoader (FileLoader) appelle fetch() avec credentials:'same-origin' par défaut, et que
// TextureLoader/useTexture (ImageLoader) pose crossOrigin='anonymous' par défaut — les deux
// EXCLUENT le cookie dès que le port diffère (dev ET Kiwi ont client/serveur sur des ports
// différents). Seul un <img src> brut s'en sort avec le cookie seul. Patcher chaque loader un par
// un (setWithCredentials/crossOrigin='use-credentials') est une rustine qui recasse silencieusement
// au premier nouveau point d'appel oublié — jamais fait ici (AGENTS.md « jamais de rustine »).
//
// Patron retenu — identique dans l'esprit aux URLs présignées S3/GCS/Firebase Storage : le jeton
// voyage DANS la valeur du champ URL elle-même (signé à la source, par le serveur, au moment où il
// répond une fiche personnage/carte/campagne déjà protégée par requireAuth). Aucun consommateur
// (<img>, GLTFLoader, TextureLoader, un futur loader quelconque) n'a besoin de rien configurer —
// le problème de transport ne se pose plus, par construction, pas par discipline à retenir.
//
// Lié au CHEMIN exact, jamais à un utilisateur précis : ces assets sont déjà partagés entre tous
// les membres d'une campagne (portrait, GLB, image de carte) — l'appartenance a déjà été vérifiée
// par la route REST qui signe le lien (requireAuth + logique métier existante), pas rejouée à
// chaque lecture d'asset. Risque assumé : un lien copié hors de l'app reste lisible jusqu'à
// expiration, comme tout lien presigné classique — acceptable pour des assets de jeu, jamais pour
// une donnée sensible.
//
// Réutilise jsonwebtoken + JWT_SECRET (déjà l'autorité de signature du cookie de session,
// server/src/middleware/auth.js) — une seule mécanique de signature dans tout le projet.
import jwt from 'jsonwebtoken'

const TOKEN_TTL = '6h'

// Noms de champs DB/REST connus pour porter un chemin /api/assets/<folder>/<filePath> (cache-
// busting ?v=<timestamp> déjà stocké dans la valeur elle-même, préservé ici, jamais réinterprété).
export const ASSET_URL_FIELDS = [
  'glb_url', 'portrait_url', 'image_url', 'cover_url',
  'default_token_glb_url', 'default_token_glb_url_drone', 'default_token_glb_url_exo',
]

// Signe le chemin PUR (sans le ?v=... déjà présent) — c'est exactement ce qu'assets.js reconstruit
// depuis :folder/*filePath (les query params n'entrent jamais dans le routage Express).
function signPath(purePath) {
  return jwt.sign({ p: purePath }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL })
}

export function signAssetFieldValue(rawValue) {
  if (!rawValue || typeof rawValue !== 'string') return rawValue
  const [purePath, existingQuery] = rawValue.split('?')
  const token = signPath(purePath)
  const query = existingQuery ? `${existingQuery}&t=${token}` : `t=${token}`
  return `${purePath}?${query}`
}

// Parcours récursif borné — vérifié (pas supposé) que les réponses réelles de ces routeurs
// n'exposent JAMAIS ces champs à plat (toujours enveloppées : `{ character }`, `{ battlemap,
// tokens }`, `{ entities: [{ ..., blueprint: { glb_url } }] }`...). Une passe à un seul niveau
// aurait manqué `blueprint.glb_url` — corrigé après relecture réelle de entities.js. Profondeur
// plafonnée (gros documents sans rapport, ex. `surface_data`, n'ont aucune raison métier de porter
// ces noms de champs, mais autant borner le coût). Seuls objets/tableaux « plats » (littéraux JSON,
// jamais une Date ou un Buffer) sont traversés.
const MAX_DEPTH = 5

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && value.constructor === Object
}

function signDeep(value, depth = 0) {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(v => signDeep(v, depth + 1))
  if (!isPlainObject(value)) return value // Date, Buffer, etc. — jamais traversés
  const out = { ...value }
  for (const key of Object.keys(out)) {
    out[key] = ASSET_URL_FIELDS.includes(key) ? signAssetFieldValue(out[key]) : signDeep(out[key], depth + 1)
  }
  return out
}

// Middleware — à poser une fois par routeur (après requireAuth, qui garantit que la réponse est
// déjà autorisée pour req.user) : enveloppe res.json pour signer les champs connus avant l'envoi,
// quelle que soit leur profondeur dans le corps de la réponse.
export function signAssetFieldsMiddleware() {
  return (req, res, next) => {
    const originalJson = res.json.bind(res)
    res.json = (body) => originalJson(signDeep(body))
    next()
  }
}

// Vérification côté assets.js — le jeton doit être valide ET porter exactement ce chemin (jamais
// un jeton valide pour UN AUTRE asset accepté pour celui-ci).
export function verifyAssetToken(filePath, token) {
  if (!token) return false
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    return payload?.p === filePath
  } catch {
    return false
  }
}
