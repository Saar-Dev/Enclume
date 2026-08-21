import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const envDir = path.resolve(__dirname, '..')
  const env = loadEnv(mode, envDir, '')
  const apiProxyTarget = env.API_PROXY_TARGET || 'http://127.0.0.1:3001'

  return {
    plugins: [
      react(),
      // PWA minimale (docs/PLANS/PLAN_FICHE_HORSLIGNE.md, Lot B) — consultation hors-ligne de la
      // fiche personnage (route Lot B0, `CampaignCharacterSheetPage.jsx`/`VaultCharacterPage.jsx`).
      // Mise en cache par préfixe (`char-sheet`/`char-ref`/`equipment`/`campaigns`/`characters`)
      // plutôt qu'une liste figée d'endpoints : tracé depuis les appels réels de `CharacterSheet.jsx`
      // et ses panneaux (`api.get` — SkillsPanel/InventoryPanel/AdvantagesPanel/ArmorWoundPanel),
      // pour que tout nouvel endpoint ajouté sous ces préfixes soit mis en cache automatiquement,
      // sans retoucher cette config à chaque évolution du modèle de données personnage.
      // `NetworkFirst` : toujours la donnée la plus fraîche si le réseau répond, bascule sur le
      // cache seulement si le réseau échoue — cohérent avec "rendu hors-ligne fidèle à la dernière
      // visite en ligne" (§1 du plan), jamais une donnée périmée servie alors qu'une fraîche existe.
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: { enabled: true },
        manifest: {
          name: 'Enclume',
          short_name: 'Enclume',
          description: 'Table de jeu virtuelle — Polaris',
          theme_color: '#1a1a2e',
          background_color: '#1a1a2e',
          display: 'standalone',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          ],
        },
        workbox: {
          // Le bundle client actuel (~4 Mo, tout l'app inclus — battlemap/Three.js compris, pas
          // seulement la fiche personnage) dépasse la limite par défaut de Workbox (2 Mio) : sans
          // ceci, le build échoue purement et simplement. Découper le bundle (code-splitting) réglerait
          // la cause racine mais c'est un chantier à part (touche tout le build, pas seulement la
          // fiche hors-ligne) — hors périmètre de ce lot, à ne pas mélanger.
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          // Sans ceci, une navigation DIRECTE hors-ligne vers une route React Router (favori,
          // rafraîchissement, nouvel onglet — ex. /campaigns/:id/characters/:id/sheet, Lot B0)
          // échoue : seul `index.html` est précaché, pas chaque chemin client-side. `navigateFallback`
          // n'est pas activé par défaut par `generateSW` (vérifié, `workbox-build` types) — sans lui,
          // la mise en cache des appels API ci-dessous ne sert à rien puisque la page elle-même ne
          // charge jamais. Exclut `/api/` par prudence (les requêtes API ne sont de toute façon jamais
          // en mode `navigate`, mais explicite vaut mieux qu'implicite ici).
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: /\/api\/(char-sheet|char-ref|equipment|campaigns|characters)(\/|\?|$)/,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'enclume-character-api',
                networkTimeoutSeconds: 3,
                cacheableResponse: { statuses: [0, 200] },
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
            // Lot C — écritures hors-ligne (blessures/équipement/expérience). `NetworkOnly` +
            // `backgroundSync` (workbox-background-sync, déjà transitif via ce plugin) : la requête est
            // tentée normalement ; si le réseau échoue, elle est stockée en IndexedDB puis rejouée dans
            // l'ordre (FIFO) au retour du réseau — sur Chrome/Edge via la vraie Background Sync API, sur
            // Safari/Firefox (API absente) via un repli intégré au démarrage suivant du service worker
            // (vérifié dans le code source `workbox-background-sync/Queue.ts`, pas la doc). "Dernier
            // arrivé écrase" (décision Saar) découle naturellement de l'ordre FIFO du rejeu, sans code
            // de fusion à écrire. Une entrée par action (pas un motif combiné) : plus verbeux, mais
            // chaque route reste indépendante et lisible si une évolue seule plus tard. `NetworkOnly`
            // relance toujours l'erreur réseau à la page même quand la mise en file a réussi
            // (vérifié dans `workbox-strategies/NetworkOnly` — comportement voulu, pas contournable
            // ici) : `client/src/lib/api.js::isOfflineQueuedError` distingue ce cas côté appelant pour
            // ne pas afficher un faux message d'échec (`LocationPanel.jsx`).
            {
              urlPattern: /\/api\/char-sheet\/[^/]+\/wounds$/,
              method: 'POST',
              handler: 'NetworkOnly',
              options: { backgroundSync: { name: 'enclume-wounds-add', options: { maxRetentionTime: 60 * 24 * 7 } } },
            },
            {
              urlPattern: /\/api\/char-sheet\/[^/]+\/wounds\/[^/]+\/stabilize$/,
              method: 'PUT',
              handler: 'NetworkOnly',
              options: { backgroundSync: { name: 'enclume-wounds-stabilize', options: { maxRetentionTime: 60 * 24 * 7 } } },
            },
            {
              urlPattern: /\/api\/char-sheet\/[^/]+\/wounds\/[^/]+$/,
              method: 'DELETE',
              handler: 'NetworkOnly',
              options: { backgroundSync: { name: 'enclume-wounds-remove', options: { maxRetentionTime: 60 * 24 * 7 } } },
            },
            {
              urlPattern: /\/api\/char-sheet\/[^/]+\/inventory\/[^/]+$/,
              method: 'PUT',
              handler: 'NetworkOnly',
              options: { backgroundSync: { name: 'enclume-equip', options: { maxRetentionTime: 60 * 24 * 7 } } },
            },
            {
              urlPattern: /\/api\/char-sheet\/[^/]+\/skills\/buy$/,
              method: 'POST',
              handler: 'NetworkOnly',
              options: { backgroundSync: { name: 'enclume-skill-buy', options: { maxRetentionTime: 60 * 24 * 7 } } },
            },
          ],
        },
      }),
    ],
    envDir, // .env à la racine du monorepo
    server: {
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true,
        },
        '/socket.io': {
          target: apiProxyTarget,
          changeOrigin: true,
          ws: true,
        },
      },
    },
  }
})
