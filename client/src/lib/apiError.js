// i18nKey optionnel (AppError.js, errorHandler.js) — résolu ici en priorité, fallback sur le message
// brut serveur pour toutes les AppError non encore migrées (docs/EN_COURS.md, 2026-08-12). Extrait de
// WizardCreation.jsx (seul appelant jusqu'ici, 4 sites internes) pour éviter de dupliquer cette même
// logique dans un second composant (GameTimeWidget.jsx, GAMETIME-WIDGET-SWALLOWS-ERRORS, 2026-10-13).
// L'appelant est responsable de passer un `t` lié au namespace de l'`i18nKey` que sa route peut
// renvoyer (ex. `useTranslation('creation')` pour les clés `wizard.errors.*`) — un `t` au mauvais
// namespace ne lèvera pas, mais résoudra silencieusement sur la clé brute au lieu du texte traduit.
export const extractErrorMessage = (err, t) => {
  const i18nKey = err.response?.data?.error?.i18nKey
  if (i18nKey) return t(i18nKey)
  return err.response?.data?.error?.message
    || err.response?.data?.message
    || `Erreur ${err.response?.status ?? 'réseau'}`
}
