// server/src/lib/reviewTrace.js — Traces de la REVUE DES GUÉRISONS dans la console du serveur (PLAN_REVUE_GUERISON.md, demande de Saar 2026-09-26 :
// « rendre le serveur bavard pour vérifier dans le détail »). Module FEUILLE (aucune dépendance) : importable par le moteur d'échéances, les services
// de blessures et de temps sans cycle.
//
// Règles :
//   - un seul interrupteur : `REVIEW_TRACE=0` dans `.env` coupe les traces d'INFORMATION (par défaut : allumées) ;
//   - une trace ne change JAMAIS un résultat : le message peut être une fonction, évaluée seulement si les traces sont allumées (aucun coût éteintes),
//     et toute erreur de formatage est avalée ici (une trace ne fait pas échouer une revue) ;
//   - les traces qui décrivent un résultat sont écrites APRÈS la validation de la transaction (jamais une ligne « appliqué » pour une écriture
//     annulée) ; seules les ERREURS sortent tout de suite ;
//   - une ERREUR (`reviewTraceError`) sort toujours, interrupteur ou non : une erreur avalée en silence est un défaut, pas une option.

export const isReviewTraceEnabled = () => process.env.REVIEW_TRACE !== '0'

const pad = (value, width = 2) => String(value).padStart(width, '0')

function timestamp(now = new Date()) {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`
}

// Identifiant raccourci lisible (8 premiers caractères d'un UUID).
export const shortId = (id) => (id ? String(id).slice(0, 8) : '—')

// `message` : texte, ou fonction qui le produit (évaluée seulement si allumé). Une valeur `null`/`undefined`/'' n'écrit rien.
export function reviewTrace(message) {
  if (!isReviewTraceEnabled()) return
  try {
    const text = typeof message === 'function' ? message() : message
    if (text) console.log(`[REVUE ${timestamp()}] ${text}`)
  } catch (err) {
    console.log(`[REVUE ${timestamp()}] (trace illisible : ${err?.message ?? err})`)
  }
}

// Plusieurs lignes d'un coup (une par élément), même horodatage de préfixe.
export function reviewTraceLines(lines) {
  if (!isReviewTraceEnabled()) return
  for (const line of lines ?? []) reviewTrace(line)
}

// Erreur : toujours écrite, avec la pile (le message seul ne dit pas OÙ).
export function reviewTraceError(message, err) {
  try {
    console.error(`[REVUE ${timestamp()}] ERREUR — ${message}${err ? ` : ${err.message ?? err}` : ''}`)
    if (err?.stack) console.error(err.stack)
  } catch { /* une trace ne fait jamais échouer l'appelant */ }
}
