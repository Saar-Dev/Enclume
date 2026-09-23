# PLAN ENCYCLOPEDIA

> Fenêtre « Encyclopédie » du projet Enclume — présentation du RAW du LdB Polaris
> en articles navigables, fidèle au livre, zéro dérive avec les données de l'app.
> Dernière mise à jour : 2026-09-23 (accès in-game — fenêtre + glossaire intégré)

---

## 1. Objectif

Offrir une fenêtre de consultation du Livre de base Polaris (RAW), organisée
en articles navigables, avec navigation type wiki et référencement croisé.
Contenu figé (pas d'édition utilisateur). Rendu suivant le design system Enclume.

Usage principal : consultation d'un point de règle spécifique, en session
ou hors session. Granularité fine motivée par cet usage.

---

## 2. Invariants

- Aucune valeur de règle dupliquée — source unique dans `shared/`.
- Import runtime des données via whitelist `dataSources.js` (créé Phase 3).
- Contenu figé — pas d'édition utilisateur.
- Structure par langue dès maintenant (`fr/` peuplé, `en/` prévu).
- Un fichier par article (granularité fine).
- Contenu ≠ i18n — l'i18n sert uniquement à l'interface.
- Le texte éditorial vit dans le JSON ; les valeurs de règle viennent de `shared/`.
- Les catalogues SQL sont référencés, jamais copiés.

---

## 3. Structure de données

    client/src/components/encyclopedia/
      fr/
        _index.json
        terms.json              ← libellés de tableaux (cf. CONVERSION §4.9)
        livre-4/
          combat/             (21 articles, dont introduction)
          tests-et-actions/   (9 articles, dont introduction)
          etats-de-sante/     (26 articles, dont introduction)
          force-polaris/      (14 articles dont introduction, 1 corrompu — voir §6)
          experience/         (à convertir)
      en/                     (vide)

Le `_index.json` porte la carte de navigation complète, y compris les
articles non encore convertis (visibles dans la nav, non cliquables
fonctionnellement tant que le fichier n'existe pas).

**Plus de fichier `_chapter.json`** (supprimé 2026-09-23) : la citation/texte de cadrage de chaque
chapitre est un article normal comme un autre (`<chapitre>.introduction`), toujours en première
position dans `articles[]`. Avant, `_chapter.json` portait `title`/`pageStart`/`pageEnd` (déjà
dupliqués dans `_index.json`) et `intro` (affiché en plus du premier article, jamais comme un article
à part) — le tout retiré, `_index.json` seul porte désormais la nav.

---

## 4. Architecture client

    client/src/components/encyclopedia/
      EncyclopediaPage.jsx           ← route standalone (habillage plein écran)
      EncyclopediaViewer.jsx         ← contenu réel (nav + article), extrait 2026-09-23
      EncyclopediaWindow.jsx         ← fenêtre en jeu (Sidebar > Outils), monte le Viewer
      GlossaryPage.jsx               ← route standalone glossaire (habillage)
      GlossaryViewer.jsx             ← contenu réel du glossaire, extrait 2026-09-23
      ChapterList.jsx                ← nav 3 niveaux, réductible, `embedded` prop
      ArticleView.jsx                ← vue article (+ scroll sur ancre)
      BlockRenderer.jsx              ← dispatcher de blocs
      contentLoader.js               ← getIndex, loadArticle, loadGlossary,
                                       findArticleMeta, resolveWikiTarget
      inlineParser.jsx               ← liens wiki + gras/italique
      dataSources.js                 ← whitelist des sources shared/ (+ transforms)
      encyclopedia.css
      blocks/
        HeadingBlock.jsx
        ParagraphBlock.jsx
        ListBlock.jsx
        CalloutBlock.jsx
        DataTableBlock.jsx           ← réel depuis Phase 3
      fr/                            ← données
      en/                            ← données (vide)

Routes : `/encyclopedia` et `/encyclopedia/glossary` dans `App.jsx`,
protégées par `ProtectedRoute`. Accès in-game (sans route, overlay) : Sidebar > Outils >
Encyclopédie → `EncyclopediaWindow.jsx`, monté dans `SessionPage.jsx` — voir §7 Phase 2quater.

i18n : namespace `encyclopedia` dans `i18n.js` + `locales/encyclopedia.json`.

---

## 5. Types de blocs

Actifs :
- `heading` (niveaux 2-5, avec id d'ancre)
- `paragraph` (avec `[[...]]` et `**gras**` / `*italique*`)
- `list` (ordonnée ou non, label + sous-blocs récursifs)
- `callout` (variants : sidebar, example, optional, rule, note, quote)
- `dataTable` (résolu — sources via `dataSources.js`)

Différés :
- `table` (éditorial pur) — décision : on garde dataTable placeholder
- `dataList`, `entityCard` (catalogues SQL) — Phase 6
- `reference` (bibliographique) — non prioritaire

---

## 6. Avancement

### Livre 4

| Chapitre | Statut |
|---|---|
| Tests et actions | ✔ 9/9 (dont introduction) |
| Combat | ✔ 21/21 (dont introduction) |
| États de santé | ✔ 26/26 (segmenté depuis 31 le 2026-09-22, voir §7 Phase 2bis ; + introduction 2026-09-23) |
| Force Polaris | 13/14 articles structurellement sains (dont introduction), **audit complet fait 2026-09-22** (voir détail ci-dessous) — **1 fichier corrompu** (`maitrise-force-polaris.json`) + 1 dette de segmentation (`liste-pouvoirs.json`). Le bug des 8 tableaux invisibles est résolu (voir plus bas). |
| Expérience | Index posé, 0 article |

**Total converti : voir `node tools/validate-encyclopedia.mjs`** (compte les articles réels à chaque
exécution — ne plus maintenir de nombre en dur ici, c'est exactement ce qui a désynchronisé cette
section en premier lieu).

### Livres 1-2-3

Non communiqués. Non bloquant.

### Audit Force Polaris (2026-09-22)

Premier audit qualité complet de ce chapitre (les autres l'avaient déjà eu — bilan initial pour États
de santé, relecture visuelle de Saar pour Combat/Tests et actions). Trois trouvailles :

1. **`maitrise-force-polaris.json` corrompu** (déjà connu) — contient mot pour mot le texte de
   `choc-polaris.json` (même id/slug/titre au champ page près). L'article « Maîtriser l'effet Polaris »
   (RAW p.252) n'a en réalité jamais été rédigé. Bloqué sur le texte RAW (pas encore fourni par Saar).
2. **Résolu 2026-09-22** : 8 blocs `dataTable` (`incidents-polaris.json`, `table-liberation-
   accidentelle.json`, 6× `liste-pouvoirs.json`) utilisaient un schéma `columns`/`rows` en dur — la
   forme « éditoriale pure » déjà anticipée par `ENCYCLOPEDIA_CONVERSION.md` §3 mais jamais
   implémentée côté composant (`DataTableBlock.jsx` ne rendait que le schéma `source`-driven, retour
   `null` silencieux sinon). `DataTableBlock.jsx` porte désormais un second chemin de rendu
   (`EditorialDataTable`, `block.columns`/`block.rows`, gère aussi `row.subItems` pour la ligne « 100
   et + » d'Incidents Polaris). Les 8 tables vérifiées structurellement (script jetable :
   colonnes/lignes cohérentes, aucune ambiguïté avec `source`) + `tools/validate-encyclopedia.mjs`
   (mêmes 2 erreurs préexistantes, aucune nouvelle) + build client vert. **Non testé** : rendu visuel
   réel en navigateur (à valider par Saar). `tools/validate-encyclopedia.mjs` ne détecte toujours pas
   ce genre de cas (il valide index/fichiers/liens, pas le schéma interne d'un bloc) — limite connue,
   pas corrigée ici.
3. **`liste-pouvoirs.json` : 44 pouvoirs dans un seul fichier (1350 lignes)** — même défaut de
   granularité qui a motivé la segmentation d'États de santé (31→25 articles), jamais appliqué ici.
   Chaque pouvoir a son propre `heading` niveau 2 + id d'ancre, donc le découpage en un article par
   pouvoir serait mécanique, mais pas fait.

Reste sain : les 6 articles de mécanique (Maîtriser/Libérer-contrôler/Utiliser un pouvoir/Choc
Polaris/Pouvoir incontrôlé/Libération involontaire) et les 3 articles de lore (Flux Polaris/Géographie
du Flux/Entités) — aucune désync, aucun lien mort, aucune valeur RAW dupliquant `shared/` (le chapitre
n'a aucun équivalent moteur à ce jour).

### Tables `shared/` — chapitre États de santé

Toutes les tables RAW connues sont branchées : Seuils, Compteur, Effets (déplacement/Choc),
Choc (durée), Durée de guérison et soins, Séquelles (×11, toutes localisations). Détail des sources
et du statut : `docs/ENCYCLOPEDIA_SHARED_INVENTORY.md`.

---

## 7. Phases

**Phase 0 — Cadrage** : TERMINÉ

**Phase 1 — Vertical slice** : TERMINÉ

**Phase 2 — Conversion chapitre par chapitre** : EN COURS
- Chapitres complets : Tests et actions, Combat, États de santé (segmenté 2026-09-22)
- Prochain : Force Polaris — audité 2026-09-22 (voir §6). (a) fix rendu `DataTableBlock.jsx` (schéma
  éditorial) **fait 2026-09-22**. Restent : (b) réécriture `maitrise-force-polaris.json` (attend le
  RAW p.252 de Saar), (c) segmentation `liste-pouvoirs.json`

**Phase 2bis — Segmentation États de santé** : TERMINÉE (2026-09-22)
- 31 → 25 articles (6 fusions de fratries mono-page, 3 renommages de cohérence maladies-*→toxiques-*)
- Séparateurs de groupe non interactifs dans la nav (`_index.json:articles[].group`,
  `ChapterList.jsx`) — décision actée : pas de 4ᵉ niveau d'accordéon
- Outil pérenne `tools/validate-encyclopedia.mjs` (index/fichiers + liens `[[...]]`, à relancer après
  tout renommage futur)

**Phase 2ter — Intro de chapitre → article à part entière** : TERMINÉE (2026-09-23)
- Déclenché en préparant l'accès in-game (fenêtre encyclopédie) : le patron « h1 chapitre + intro
  affichés en plus du premier article » ne passait pas à l'échelle d'une petite fenêtre, et dupliquait
  déjà `title`/`pageStart`/`pageEnd` entre `_chapter.json` et `_index.json`.
- 4 nouveaux articles `<chapitre>.introduction` (citation + texte de cadrage RAW, déplacés tels quels,
  aucune réécriture sauf 2 apostrophes droites → typographiques sur Force Polaris, déjà la norme
  documentée §CONVERSION §4), en première position de `articles[]`. Titre **« Introduction »** pour
  les 4 (pas le nom du chapitre — corrigé après relecture Saar : « Combat » comme titre de chapitre
  ET comme titre de son premier article était redondant et sans valeur informative dans la nav).
- **Correction de contenu (Combat)** : le chapitre Combat était le seul des 4 sans citation
  d'ouverture — signal qui aurait dû être interrogé avant d'écrire le fichier (les 3 autres en ont une,
  pas de raison RAW pour que Combat fasse exception) plutôt que recopié tel quel comme si l'absence
  était normale. Saar a fourni le texte manquant (BARAL FAADHI, instructeur de combat) — ajouté, avec
  normalisation des 2 césures PDF visibles dans le texte source (« suffi t » → « suffit », « fl ingue »
  → « flingue ») et de l'attribution (`--` → `—`, apostrophes droites → typographiques), conforme aux
  standards déjà en vigueur (`ENCYCLOPEDIA_CONVERSION.md` §4).
- `_chapter.json` supprimé (4 fichiers) ainsi que tout le code qui ne servait qu'à ça :
  `loadChapterMeta`/`CHAPTER_META_MODULES`/`findChapterMeta` (`contentLoader.js`), état `chapterMeta`
  + effet de chargement + memo `isFirstArticle` (`EncyclopediaPage.jsx`, retire au passage un des deux
  `react-hooks/set-state-in-effect` déjà connus comme dette), CSS mortes `.encyclo-chapter-title`/
  `.encyclo-intro`.
- **Changement de comportement assumé** (validé Saar) : arriver sur un chapitre affiche désormais
  seulement l'introduction, plus le premier article de fond en même temps qu'avant — un clic
  supplémentaire est nécessaire. Les liens wiki vers un chapitre entier (`[[Combat|combat|222]]` etc.,
  déjà présents dans le corpus) atterrissent désormais sur l'introduction plutôt que sur l'ancien
  premier article — cohérent avec le nouveau comportement.
- Vérifié : `tools/validate-encyclopedia.mjs` (mêmes 2 erreurs préexistantes, 69 articles au lieu de
  65), `eslint`, `npm run build`.

**Phase 2quater — Accès in-game (fenêtre)** : TERMINÉE, version minimale (2026-09-23)
- Déclencheur : l'Encyclopédie n'avait aucun point d'entrée dans l'app hors l'URL directe
  (`bug_tickets` `ENCYCLOPEDIE-NOT-INTEGRATED`, priorité basse — le cœur de la trouvaille est
  résolu, ticket à clore par Saar).
- `EncyclopediaViewer.jsx`/`GlossaryViewer.jsx` extraits de `EncyclopediaPage.jsx`/
  `GlossaryPage.jsx` (contenu réel, réutilisable) — les pages standalone deviennent de simples
  habillages autour, comportement inchangé pour l'usage hors session.
- `EncyclopediaWindow.jsx` : overlay in-app (jamais de popup navigateur), 80% de la zone
  playground (sidebar exclue, `sidebarWidth` — même valeur déjà envoyée à `CombatOverlay`),
  recalculée au redimensionnement navigateur, z-index 9000 (aligné sur `CharacterWindow.jsx`).
  Pas de barre de titre (redondante avec le titre déjà porté par `ChapterList.jsx`) — seul un ✕
  flottant, patron identique au bouton de fermeture de la Sidebar principale.
- **Version minimale assumée** : taille fixe, pas de drag/resize/réduction de la fenêtre
  elle-même. Conception détaillée déjà actée pour une passe ultérieure (redimensionnable +
  mémoire de taille/article jusqu'à fermeture, sans `localStorage` + réduction en pastille par
  double-clic sur l'en-tête, coin bas-droit de la zone playground) — pas codée, pas prioritaire
  tant que cette version n'a pas été suffisamment éprouvée en jeu réel.
- Branchement : `Sidebar.jsx` (item « Encyclopédie » dans le dropdown Outils déjà existant, à
  côté de Commerce — accessible à tous les joueurs, pas réservé MJ) → `SessionPage.jsx` (état +
  montage conditionnel, même schéma que `TradeWindow`).
- Fix CSS générique posé au passage : `.encyclo-nav` utilisait `max-height: calc(100vh - ...)`
  (viewport-relatif), cassait dans une fenêtre bornée. Remplacé par une variable CSS
  `--encyclo-scroll-height` (défaut `100vh`, la fenêtre la redéfinit à sa propre hauteur) — zéro
  changement pour la page standalone.
- Nav réductible (`ChapterList.jsx`) : bouton « avant le titre, réduit à un rail de 40px avec
  juste le bouton » pour réagrandir (jamais de disparition complète). État éphémère, non
  persisté. S'applique aux deux contextes (composant partagé).
- **Glossaire intégré à la fenêtre** (pas juste masqué, un vrai deuxième round après retour
  Saar « on ne peut pas l'intégrer inGame ? ») : `EncyclopediaViewer` porte un état interne
  `showGlossary`, la section cliquée résout via `resolveWikiTarget()` (même mécanisme que les
  liens wiki cross-article) et pose le hash manuellement (pas de `<a href>` natif ici) —
  `ArticleView` scrolle ensuite normalement, rien de dupliqué.
- **Bug préexistant trouvé et corrigé au passage** : les liens du glossaire vers un article
  (`/encyclopedia#id`) n'avaient jamais vraiment fonctionné, en session comme hors session —
  rien ne résolvait le hash de l'URL au montage d'`EncyclopediaViewer` (toujours le premier
  article par défaut, indépendamment de la section cliquée) ; `ArticleView` cherchait ensuite
  l'ancre dans le mauvais article et ne la trouvait jamais. `EncyclopediaViewer` résout
  désormais ce hash au montage (`computeInitialSelection`, réutilise `resolveWikiTarget`) — un
  lien direct vers `/encyclopedia#chapitre.article.section` fonctionne enfin, standalone comme
  en jeu.
- Vérifié : `tools/validate-encyclopedia.mjs` (mêmes 2 erreurs préexistantes), `eslint`
  (dette `set-state-in-effect` préexistante déplacée avec son effet, sinon propre — une
  erreur `react-hooks/preserve-manual-memoization` transitoire, corrigée en remplaçant un
  `useMemo` sur une lecture impure de `window.location.hash` par des initialiseurs paresseux
  `useState`), `npm run build`.
- **Non testé par Claude** : rendu réel navigateur — testé et confirmé par Saar au fil de la
  construction (bouton, réduction nav, positions ✕/titre, chevauchement ✕/contenu). Le
  glossaire intégré (round 2) reste à confirmer par Saar.

**Phase 3 — Injection données shared/** : TERMINÉE pour États de santé (2026-09-22)
- Vertical slice terminée :
  - `dataSources.js` (whitelist + transform MR_TABLE)
  - `DataTableBlock` réel (+ `kind: 'silhouette'`, réutilise `BodySilhouetteSvg`)
  - `terms.json` (fr/)
  - Ancres fonctionnelles (headings + callouts avec id), extraction glossaire **récursive**
    (callouts/listes imbriqués — corrigé 2026-09-22, invisibles au glossaire avant)
  - Glossaire (`/encyclopedia/glossary`, extraction automatique)
  - Styles complétés (`heading-5`, `callout-quote`, `datatable-*`, titre de callout en `h4`)
- Toutes les tables RAW connues d'États de santé branchées (voir §6)
- Reste : Combat (audit paramètres moteur non tranché — Préparations/Enchaînement/modificateurs de
  contact, voir mémoire de session), Froid/Feu (constantes partielles ou absentes, à investiguer)

**Phase 4 — Élargissement**
- Force Polaris, Expérience (Livre 4)
- Livres 1-2-3 (texte à obtenir)

**Phase 5 — Éditeur par blocs (Chemin C)**
- Chantier séparé
- Servira également pour l'éditeur de changelog
- Permettra l'édition manuelle des articles

**Phase 6 — Catalogues SQL + API**
- Endpoint `/api/encyclopedia/refs`
- Blocs `entityList` / `entityCard`
- Deep-linking vers entités d'app

**Phase 7 — Fonctionnalités avancées**
- Recherche plein-texte
- Vue impression
- Deep-linking URL (route par article)

**Phase 8 — Nettoyage i18n transverse**
- Textes en dur dans le Glossaire et la nav
- `fr.json`, `ExoIdentityPanel.jsx`, autres composants utilisant le namespace par défaut

---

## 8. Méthode de travail

- **Un fichier par échange**, sauf changement d'interface → tous les consommateurs ensemble.
- **Cartographie préalable** avant tout nouveau chapitre (voir `ENCYCLOPEDIA_CONVERSION.md` §4.8).
- **Granularité fine** : un fichier = un concept autonome.
- **Standards typographiques uniformisés** (voir `ENCYCLOPEDIA_CONVERSION.md` §3).
- **Test de fidélité** régulier entre le JSON produit et le texte RAW source.
- **Pauses de consolidation** régulières, à la demande.

---

## 9. Pièges connus

- `.app-shell` pose `overflow:hidden` → casse `position: sticky`.
  Override : `.encyclo-viewer.app-shell { overflow: visible }`.
- `import.meta.glob` est résolu au démarrage Vite → restart parfois nécessaire
  après création de nouveaux dossiers/fichiers.
- Chemins d'import relatifs cassent silencieusement au déplacement.
- Casse Windows/Linux : `polarisUtils.js` (minuscule).
- Bug récursion (résolu) : `BlockRenderer` appelé sans wrapper `{block}`.
- Callouts avec juste un titre mais sans contenu = bug silencieux possible.
- Ancres et chargement asynchrone : le navigateur traite le hash avant que
  l'article soit dans le DOM. Fix : scroll manuel dans `ArticleView` après
  rendu (`setTimeout 0`).
- Double `return` dans un objet littéral : erreur de syntaxe silencieuse,
  le module ne se charge pas, l'ancienne version reste active via HMR.
- Un bloc `dataTable` sans `headers` ne rend aucun `<thead>` (`DataTableBlock.jsx` ne teste que
  `block.headers?.length`) — bug silencieux trouvé 3 fois (choc.json, soins-guerison.json,
  sequelles.json) avant d'en faire un réflexe de vérification systématique à chaque nouvelle table.
- **Résolu 2026-09-22** : les liens wiki `[[...]]` ne résolvaient la navigation cross-article nulle
  part — corrigé par `resolveWikiTarget()` (`contentLoader.js`) + handler de clic délégué
  (`EncyclopediaPage.jsx`). Un id/ancre structurellement valide (vérifié par le validateur) résout
  désormais réellement au clic.
- Désync index/contenu : un article listé dans `_index.json` peut pointer vers un fichier au contenu
  différent (mauvais id/titre/page à l'intérieur, voire contenu d'un tout autre article — vécu deux
  fois, `blessures-description`/`blessures-effets` et `force-polaris.maitrise-force-polaris`). Toujours
  vérifier avec `tools/validate-encyclopedia.mjs`, jamais supposer qu'un fichier présent = fichier
  correct.
- **Résolu 2026-09-22** : un bloc `dataTable` éditorial (`columns`/`rows`, sans `source`) ne rendait
  rien (`DataTableBlock.jsx` ne testait que `block.source`, retour `null` silencieux sinon) — trouvé
  en auditant Force Polaris (8 tables invisibles sur 3 fichiers). `DataTableBlock.jsx` porte désormais
  un second chemin de rendu pour ce schéma (`EditorialDataTable`). Le validateur ne détecte toujours
  pas ce genre de cas (il ne valide pas le schéma interne d'un bloc) — toujours vérifier visuellement
  qu'un `dataTable` fraîchement écrit s'affiche réellement, pas seulement que le JSON est valide.
- **Résolu 2026-09-23** : un lien vers `/encyclopedia#chapitre.article.section` (glossaire ou tout
  lien externe direct) n'a jamais réellement fonctionné — rien ne résolvait le hash de l'URL au
  montage d'`EncyclopediaViewer`, toujours le premier article par défaut quel que soit le hash ;
  `ArticleView` cherchait ensuite l'ancre dans le mauvais article. Corrigé par
  `computeInitialSelection()` (réutilise `resolveWikiTarget`) en initialiseur paresseux des `useState`
  de sélection — jamais un `useMemo` ici, le React Compiler refuse de memoizer une lecture impure de
  `window.location.hash` (`react-hooks/preserve-manual-memoization`).

---

## 10. Sources de vérité

- `client/src/components/encyclopedia/**/*` — le code et les données
- `docs/ENCYCLOPEDIA_CONTEXT.md` — mémoire externe du chantier
- `docs/ENCYCLOPEDIA_CONVERSION.md` — règles de conversion
- `docs/PLANS/PLAN_ENCYCLOPEDIA.md` — ce fichier
- `docs/ENCYCLOPEDIA_SHARED_INVENTORY.md` — mapping table RAW ↔ constante `shared/`
- `tools/validate-encyclopedia.mjs` — vérificateur pérenne (index/fichiers/liens), à lancer après
  toute modification structurelle (renommage, fusion, nouvel article)
- `shared/*.js` — les valeurs de règle
- `client/src/index.css` — le design system