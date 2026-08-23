# PLAN_FICHE_HORSLIGNE — Fiche personnage utilisable hors connexion (PWA)

> 2026-08-16 · Remplace `docs/Old/[OBSOLETE] PLAN_EXPORTEXCEL.md` et
> `docs/Old/[OBSOLETE] PLAN_EXPORTHTML.md` (deux tentatives d'export vers un format tiers/un fichier
> autonome, abandonnées — voir ces fichiers pour l'historique complet).
> Statut : 🟡 LOTS A/B0/B/C/D CODÉS ET VÉRIFIÉS (build/lint/serveur) — **non testé en navigateur réel**
> (comportement hors-ligne effectif, rejeu au retour réseau, rendu de la vue d'impression). Rien
> commité pour l'instant.

---

## 0. Contexte et décisions actées

Objectif inchangé : un joueur doit pouvoir consulter et faire vivre sa fiche personnage sans
connexion réseau (à table, sans accès au serveur Enclume).

Deux approches précédentes abandonnées :
1. Export vers le classeur Excel de référence — défauts structurels du format (styles détruits,
   commentaires non supportés, fonctions modernes mal encodées par l'export Google Sheets → Excel,
   case à cocher colorée et cliquable mutuellement exclusives).
2. Fiche HTML autonome (fichier unique, catalogue embarqué, recalcul JS) — bloquée par une limite de
   plateforme : une page web ne peut pas réécrire son propre fichier à la fermeture sans l'API
   `File System Access`, elle-même limitée à Chrome/Edge (absente de Firefox/Safari).

**Décision finale (2026-08-16)** : transformer Enclume lui-même en application installable (PWA) au
lieu d'exporter vers un format ou un fichier tiers. La fiche personnage déjà existante
(`CharacterSheet.jsx` et les panneaux associés) reste l'unique source de vérité et de logique métier
— aucune réimplémentation, aucun format à négocier.

Portée actée avec Saar, dans l'ordre des échanges :
- Consultation hors-ligne des champs de création (identité, attributs, compétences de base) —
  indispensable.
- **Pas vraiment "lecture seule"** : blessures, équipement (armes/armures par emplacement) et
  expérience doivent rester modifiables hors connexion, et ces changements doivent **persister**
  (survivre à la fermeture de l'app/du navigateur), pas seulement tenir en mémoire.
- Synchronisation au retour du réseau : **dernier arrivé écrase** (pas de fusion, pas de détection de
  conflit). Décision explicite de Saar : "OSEF, ce n'est pas de notre ressort, MJ et joueur doivent
  communiquer."
- **Aucune autorisation hors-ligne** : hors connexion, impossible de vérifier qui est l'auteur d'une
  modification (MJ ou joueur) — décision de Saar : pas de distinction de rôle hors-ligne, n'importe
  qui avec la page en cache peut tout modifier (blessures, équipement, XP). Les vérifications de rôle
  actuelles ne s'appliquent qu'en ligne. **Précision de sécurité (analyse à charge, 2e passe)** : ça
  ne veut PAS dire que le serveur doit sauter ses propres contrôles de droits au moment du rejeu —
  invariant du projet, jamais négociable (`.claude/rules/core.md`). Une action mise en file hors-ligne
  qui se révèle non autorisée au retour réseau est simplement refusée par le serveur comme n'importe
  quelle requête non autorisée ; c'est la vérification côté client pendant la déconnexion qui manque,
  pas la vérification côté serveur au moment de la synchronisation.
- **Comportement en cas d'échec au retour réseau (rejeu d'une action invalide, appareil qui purge le
  stockage local avant synchronisation, deux appareils du même joueur qui divergent hors-ligne) :
  hors scope, volontairement.** Décision explicite de Saar : "C'est une fiche hors-ligne. Point. Comme
  un fichier PDF téléchargé. On ne gère rien de plus." Aucune reprise sur erreur, aucune sauvegarde de
  secours, aucune réconciliation multi-appareil à concevoir.
- **Précondition inhérente à la mise en cache** (pas un choix, une conséquence technique) : le mode
  hors-ligne ne fonctionne qu'après une première visite en ligne de la fiche sur cet appareil précis —
  un service worker ne peut mettre en cache que ce qu'il a déjà vu passer.
- Impression possible (feuille de style dédiée).

---

## 1. Architecture envisagée

- **PWA** (service worker + manifeste) ajoutée au client existant (Vite — `vite-plugin-pwa` disponible,
  aucune infrastructure PWA actuelle dans le projet, vérifié : ni `manifest.json` ni service worker).
- **Cache de consultation** : la page de fiche personnage et les données déjà vues (identité,
  attributs, compétences, catalogue équipement/compétences pertinent) sont mises en cache pour un
  rendu hors-ligne fidèle à la dernière visite en ligne.
- **File d'écriture hors-ligne** pour les 3 actions concernées (cocher une blessure, changer un objet
  équipé par emplacement, gagner de l'expérience) : stockage local (IndexedDB) pendant la
  déconnexion, rejeu vers les endpoints existants d'Enclume dès le retour du réseau, dans l'ordre,
  sans détection de conflit (le dernier écrit gagne, comportement déjà celui du serveur pour deux
  écritures successives).
- **Impression** : feuille de style `@media print` sur la vue fiche personnage existante.

---

## 2. Ce qui est réutilisé sans modification

- Tous les composants et services de la fiche personnage vivante (`CharacterSheet.jsx`,
  `SkillsPanel.jsx`, `ArmorWoundPanel.jsx`, `inventoryService.js`, `characterExportService.js` si
  encore utile pour une vue agrégée) — aucune logique dupliquée, le hors-ligne ne fait qu'ajouter un
  mécanisme de cache/rejeu autour de l'existant.

## 3. Ce qui est définitivement abandonné

- Tout ce qui restait de la piste Excel : `server/src/db/seed-assets/polaris-export/`,
  `docs/PLANS/Fiche Polaris Online - Vierge.xlsx`, `server/src/services/excelExportWriter.js`,
  `excelExportAssembler.js`, `tools/audit-excel-named-ranges.js`, la route et le bouton associés
  (`char-sheet.js`, `CharacterWindow.jsx`).
- Migrations 244/245 : conservées telles quelles (déjà appliquées, convention du projet de ne jamais
  supprimer une migration jouée) — une migration de nettoyage (retrait de l'objet MinIO devenu
  inutile) sera ajoutée au moment du retrait effectif du code, pas avant.

---

## 4. Reste à concevoir (prochaines étapes, séquentielles — un lot à la fois)

- **Lot A** ✅ **Fait et vérifié (2026-08-16)** — Retrait du code Excel abandonné (§3) + migration de
  nettoyage MinIO (`246_remove_polaris_export_template.js`, appliquée, objet MinIO confirmé absent).
  Supprimés : `excelExportWriter.js`, `excelExportAssembler.js`, `tools/audit-excel-named-ranges.js`,
  les deux copies du gabarit `.xlsx`, la route et le bouton associés, les clés i18n orphelines,
  dépendances `xlsx-populate` (racine + serveur) et `jszip` (racine seulement — gardée côté serveur,
  encore utilisée par `texture-packs.js`, vérifié avant suppression). `xlsx` (racine, script
  d'extraction archivé sans rapport) volontairement non touché — hors périmètre. `characterExportService.js`
  conservé (Lot 1, aucune dépendance vers les fichiers supprimés, vérifié). Vérifié : build client OK,
  démarrage serveur OK, aucune référence morte restante (recherche exhaustive côté client et serveur).
- **Lot B0** ✅ **Fait et vérifié (2026-08-16)** — Route autonome pour un personnage de campagne
  (`/campaigns/:campaignId/characters/:characterId/sheet`, `CampaignCharacterSheetPage.jsx`, patron
  `VaultCharacterPage.jsx`). Différence clé assumée : `isGm` n'est pas figé à `false` (contrairement
  au Coffre, où c'est sans risque) — calculé depuis `GET /api/campaigns/:campaignId` (`members`,
  réutilise le même calcul que `characterStore.js:setMembers`), une vraie propriété d'appartenance à
  la campagne, pas du personnage. `GET /api/char-sheet/:characterId` (`char-sheet.js`) étendu pour
  renvoyer `character: req.character` (déjà résolu par `router.param`, jamais exposé avant — ajout
  pur, rétrocompatible). Deux clés i18n ajoutées (`character.sheetLoadError`, `character.back`).
  Vérifié : build client OK, lint propre (zéro problème introduit, vérifié spécifiquement sur les
  fichiers touchés), démarrage serveur OK.
- **Lot B** ✅ **Fait et vérifié (2026-08-16)** — `vite-plugin-pwa` (Workbox), configuré dans
  `client/vite.config.js`. Mise en cache par **préfixe d'URL** (`/api/(char-sheet|char-ref|equipment|
  campaigns|characters)`) plutôt qu'une liste figée d'endpoints — tracé depuis les appels réels de
  `CharacterSheet.jsx` et ses panneaux (`SkillsPanel`/`InventoryPanel`/`AdvantagesPanel`/
  `ArmorWoundPanel`), pour qu'un futur endpoint sous ces préfixes soit couvert automatiquement.
  Stratégie `NetworkFirst` (donnée fraîche si le réseau répond, cache seulement si le réseau échoue —
  jamais de donnée périmée servie par confort). `registerType: 'autoUpdate'`, `devOptions.enabled`
  pour tester en dev. Icône manifeste : `favicon.svg` existant réutilisé tel quel (pas de PNG dédié
  généré — cosmétique, non bloquant, à améliorer plus tard si besoin).
  **Point technique rencontré et résolu** : le bundle client (~4 Mo, toute l'app — battlemap/Three.js
  compris, pas seulement la fiche) dépasse la limite par défaut de précache Workbox (2 Mio) ; build en
  échec sans ajustement. `maximumFileSizeToCacheInBytes` relevé à 5 Mo — un vrai découpage du bundle
  réglerait la cause racine mais c'est un chantier à part (tout le build, pas la fiche hors-ligne),
  volontairement hors périmètre ici.
  Vérifié : build production (précache 6 entrées confirmées, `sw.js`/`manifest.webmanifest`/lien
  `<link rel="manifest">`/script d'enregistrement générés), dev server (mêmes artefacts en mode dev),
  lint propre sur `vite.config.js`. `dev-dist` ajouté au `.gitignore` client (artefact de build,
  jamais vu jusqu'ici puisque le mode dev de ce plugin n'existait pas avant).

  **Correction (analyse à charge, 2e passe, 2026-08-16)** : `navigateFallback` n'est **pas** activé
  par défaut par `generateSW` (vérifié dans les types `workbox-build`). Sans lui, une navigation
  *directe* hors-ligne vers une route React Router (favori, rafraîchissement de page, nouvel onglet —
  précisément le cas de la route du Lot B0) ne trouve pas ce chemin exact dans le précache — seul
  `index.html` y est, pas chaque route client-side. Toute la mise en cache API du Lot B ne servait à
  rien tant que la page elle-même ne pouvait pas charger hors-ligne. Corrigé : `navigateFallback:
  '/index.html'` + `navigateFallbackDenylist: [/^\/api\//]` (exclusion par prudence, les requêtes API
  ne sont de toute façon jamais en mode `navigate`). Vérifié dans le `sw.js` généré :
  `NavigationRoute`/`createHandlerBoundToURL("/index.html")`/`denylist: [/^\/api\//]` bien présents.
- **Lot C** ✅ **Fait et vérifié (2026-08-16)** — Pas de file IndexedDB maison : `workbox-background-
  sync` (déjà transitif via `vite-plugin-pwa`/Lot B) fait exactement ça nativement. 5 routes
  `runtimeCaching` dédiées (`vite.config.js`), une par action réelle plutôt qu'un motif combiné
  (lisibilité/évolutivité) : ajout blessure (`POST .../wounds`), stabilisation (`PUT
  .../wounds/:id/stabilize`), suppression (`DELETE .../wounds/:id`), équipement (`PUT
  .../inventory/:itemId`), achat de compétence (`POST .../skills/buy`) — endpoints tracés depuis les
  appels réels (`LocationPanel.jsx`, `inventoryMutations.js`, `SkillsPanel.jsx`), pas supposés.
  `NetworkOnly` + `backgroundSync` par action : tentative réseau normale, mise en file (IndexedDB,
  géré par Workbox) si échec, rejeu FIFO au retour réseau — "dernier arrivé écrase" (décision Saar)
  découle naturellement de l'ordre FIFO, aucun code de fusion à écrire. Compatibilité vérifiée dans le
  code source (`workbox-background-sync/Queue.ts`, pas la doc) : vraie Background Sync API sur
  Chrome/Edge, repli intégré au démarrage suivant du service worker sur Safari/Firefox (dégradation
  gracieuse, pas un mur dur comme l'aurait été la piste `File System Access API` écartée plus tôt).

  **Problème trouvé et corrigé (vérifié dans le code source `workbox-strategies/NetworkOnly`)** :
  même mise en file avec succès, la requête échouée relance toujours une erreur à la page (comportement
  voulu de Workbox). Sans correctif, `LocationPanel.jsx` aurait affiché "échec d'équipement" pour une
  action en réalité acceptée et différée — un mensonge à l'utilisateur. Décision Saar : corriger ce cas
  précis, ne rien construire de plus (pas de file visible, pas de statut de synchronisation). Ajouté :
  `isOfflineQueuedError()` (`client/src/lib/api.js`, `!error.response && !navigator.onLine`), utilisé
  dans les deux `catch` de `LocationPanel.jsx` (équiper/déséquiper) pour afficher un message honnête
  (`containerPanel.offlineQueued`) au lieu du message d'erreur générique. Les deux autres actions
  (ajout/retrait de blessure, achat de compétence) échouaient déjà silencieusement (`console.error`,
  jamais de message visible) — pas de mensonge à corriger là, volontairement laissées telles quelles
  (pas de nouveau feedback ajouté où il n'y en avait pas, cohérent avec "ne rien construire de plus").

  Vérifié : build client OK (5 noms de file distincts confirmés dans le `sw.js` généré, aucune
  collision), lint propre sur les 3 fichiers touchés (`vite.config.js`, `api.js`, `LocationPanel.jsx`),
  dev server OK. **Non testé : navigateur réel** (couper le réseau, agir, rétablir le réseau, confirmer
  le rejeu effectif) — hors de portée de ce que je peux vérifier moi-même.
- **Lot D** ✅ **Fait et vérifié (2026-08-16)** — Pas la route du Lot B0 finalement (elle calcule
  `isGm` réel, inutile pour imprimer) : nouvelle route indépendante `/characters/:characterId/print`
  (`CharacterPrintPage.jsx`), pas de dépendance à `campaignId` — fonctionne uniformément pour un
  personnage de campagne ou du Coffre. Autorisation déjà couverte côté serveur
  (`char-sheet.js:router.param`), pas dupliquée côté route cliente.
  Nouveau composant `CharacterPrintView.jsx` : compose `CharacterSheet` (onglet "Fiche") et
  `ArmorWoundPanel`/`WeaponPanel`/`InventoryPanel`/`GaugesPanel` (onglet "Matériel") l'un sous l'autre,
  sans le chrome de fenêtre flottante de `CharacterWindow.jsx` (drag/resize/onglets, hors-sujet pour
  une page imprimée). Lecture seule via `isGm={false}`/`isOwner={false}` — pas un nouveau mode : état
  déjà exercé quand un joueur consulte la fiche d'un autre personnage en jeu (`canEdit = isGm ||
  isOwner`, vérifié `CharacterSheet.jsx:669`). `DndContext` sans capteurs pour satisfaire
  `useDraggable`/`useDroppable` (dnd-kit) sans activer de glisser-déposer réel.
  Feuille de style d'impression (`index.css`, `@media print`) : fond blanc/texte noir forcés (le thème
  sombre de l'appli gâche l'encre et devient illisible en noir et blanc), bouton "Imprimer" masqué à
  l'impression (`.print-only-hidden`). Lien "Imprimer" ajouté dans `CharacterWindow.jsx` (onglet
  Paramètres, ouvre la route dans un nouvel onglet) — seul point d'entrée câblé pour l'instant, pas
  encore ajouté sur `VaultCharacterPage.jsx`/`CampaignCharacterSheetPage.jsx` (accessible par URL
  directe en attendant, fonctionnellement complet).
  Vérifié : build client OK, lint propre sur les 5 fichiers touchés (`CharacterPrintView.jsx`,
  `CharacterPrintPage.jsx`, `App.jsx`, `CharacterWindow.jsx`, `index.css` non concerné par ESLint).

  **Retour de Saar après premier test réel (2026-08-16), corrigé** :
  1. "Fonctionnel mais illisible couleur" — le thème sombre de l'appli (couleurs posées en style
     inline dans `CharacterSheet.jsx`/les panneaux, aucune variable CSS existante à redéfinir)
     illisible même à l'écran, pas seulement à l'impression papier. Corrigé : `.print-white-theme`
     (`index.css`, toujours actif sur cette vue, pas seulement `@media print`) force fond blanc/texte
     noir via `!important` sur toute la vue — seul moyen d'emporter sur des styles inline sans
     réécrire le thème des composants partagés (chantier à part, risque sur la fiche vivante en jeu,
     hors périmètre d'une vue d'impression). Couleurs de sévérité des blessures explicitement
     préservées (demande explicite de Saar) : `--severity-bg` posé en plus (pas à la place) du fond
     inline existant dans `LocationPanel.jsx` (2 endroits, ajout pur, zéro effet en usage normal),
     restauré par une règle plus spécifique dans `index.css`. Le remplissage du silhouette
     (`SilhouettePanel.jsx`) n'a rien demandé : c'est un attribut SVG `fill`, jamais touché par les
     propriétés `background`/`color` forcées — préservé sans y toucher.
  2. Disposition Armure/Arme demandée en deux colonnes (Armure 50% gauche, Arme puis Sac 50% droite,
     empilés) — `CharacterPrintView.jsx` restructuré en conséquence (flexbox, deux colonnes égales).

  Vérifié à nouveau : build + lint propres après ces deux correctifs.
  **Non testé : nouvel aperçu navigateur** (Saar n'a pas encore revu le rendu après ces deux
  correctifs).

## 5. Design — pas de nouvelle maquette, mais une vraie vue d'impression à composer

Pas de nouvelle maquette à concevoir : **le design, c'est `char_sheet` déjà existant**
(`CharacterSheet.jsx` et ses panneaux — attributs, compétences, blessures/protections, armes,
inventaire, avantages).

**Correction (analyse à charge)** : `CharacterWindow.jsx` ne monte que l'onglet actif
(`{activeTab === 'sheet' && (...)}`, vérifié) — Fiche/Matériel/Bio/Paramètres ne sont jamais dans le
DOM en même temps. Une feuille de style d'impression seule ne peut donc imprimer que l'onglet ouvert
au moment du clic, pas la fiche complète. Le Lot D doit composer une **vue d'impression dédiée** qui
assemble tous les panneaux existants ensemble (réutilise les mêmes sous-composants — `SkillsPanel`,
`ArmorWoundPanel`, etc. — mais dans une nouvelle disposition, pas juste du CSS sur l'existant).

**Bonne nouvelle (analyse à charge, 2e passe)** : pas besoin d'inventer une route légère indépendante
de la session VTT complète (carte 3D, WebSocket) pour cette vue — `client/src/pages/
VaultCharacterPage.jsx` existe déjà (route "hors session" du Coffre) et son propre commentaire
confirme que `CharacterWindow` fonctionne déjà sans `SocketProvider` (dégradé gracieusement). C'est le
patron à réutiliser pour la route hors-ligne/impression (Lot B/D), pas un nouveau mécanisme à
construire.

Structure fonctionnelle de la fiche officielle Polaris (`FDP_polaris_editable.pdf`, Black Book
Éditions — usage personnel uniquement, design non réutilisable) croisée avec l'existant : identité,
description physique, archétype, attributs, compétences, attributs secondaires, déplacements,
initiative, armes contact/tir, avantages/désavantages/mutations, équipement, blessures/protections,
tables de référence (localisation, marges de réussite) — **tout est déjà couvert par le modèle de
données Enclume actuel**, aucune lacune trouvée. Seul point à vérifier en cours de Lot B/D :
l'Initiative (échelle 0-25) est-elle déjà affichée telle quelle sur la fiche vivante, ou seulement
calculée en combat.

## 6. Points ouverts

Aucun bloquant restant pour lancer le Lot A. Reste à préciser en cours de Lot B (pas bloquant pour
démarrer) : rôle exact de `characterExportService.js` — probablement le point d'entrée unique pour
peupler le cache hors-ligne en un seul appel agrégé plutôt que mettre en cache des dizaines d'appels
API individuels, à confirmer au moment du Lot B.
