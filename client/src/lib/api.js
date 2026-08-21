import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  withCredentials: true,
})

export default api

// docs/PLANS/PLAN_FICHE_HORSLIGNE.md, Lot C — une écriture hors-ligne (blessures/équipement/XP,
// `vite.config.js` runtimeCaching + workbox-background-sync) échoue toujours côté page : `NetworkOnly`
// relance l'erreur réseau même quand la requête a été mise en file avec succès pour rejeu au retour
// réseau (vérifié dans le code source de `workbox-strategies/NetworkOnly` — comportement voulu de
// Workbox, pas un bug). Sans cette distinction, l'appelant affiche "échec" alors que l'action a été
// acceptée et sera appliquée plus tard — un mensonge à l'utilisateur, pas un simple manque de finition
// (décision Saar : corriger ce cas précis, ne rien construire de plus — pas de file d'attente visible,
// pas de statut de synchronisation).
// `!error.response` = aucune réponse serveur reçue (échec réseau, pas une erreur HTTP applicative qui
// aurait un `response` avec un statut) ; combiné à `!navigator.onLine`, distingue une vraie coupure
// réseau d'une erreur serveur (500) ou CORS survenue alors qu'on est en ligne.
export function isOfflineQueuedError(error) {
  return !error.response && !navigator.onLine
}