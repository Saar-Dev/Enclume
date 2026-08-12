export class AppError extends Error {
  // i18nKey optionnel (namespace `creation`, clés `wizard.errors.*`) — même convention que
  // WIZARD_ERROR côté socket (socketWizard.js). Rétrocompatible : tous les appels existants sans 3e
  // argument continuent de ne porter que `message` (affiché brut côté client, comportement inchangé).
  constructor(statusCode, message, i18nKey) {
    super(message)
    this.statusCode = statusCode
    if (i18nKey) this.i18nKey = i18nKey
  }
}