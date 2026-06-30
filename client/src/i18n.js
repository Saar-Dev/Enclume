import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr.json'
import creation from './locales/creation.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      fr: {
        translation: fr,
        creation: creation,
      },
    },
    lng: 'fr',
    fallbackLng: 'fr',
    supportedLngs: ['fr'],
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n