import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
    },
    lng: 'fr',
    fallbackLng: 'fr',
    supportedLngs: ['fr'], // Pour ajouter EN : importer en.json, ajouter resources.en et 'en' ici
    interpolation: {
      escapeValue: false, // React gère déjà l'échappement XSS
    },
  })

export default i18n
