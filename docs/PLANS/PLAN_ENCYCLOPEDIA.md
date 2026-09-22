# PLAN ENCYCLOPEDIA

> Fenêtre « Encyclopédie » du projet Enclume — présentation du RAW du LdB Polaris
> en articles navigables, fidèle au livre, zéro dérive avec les données de l'app.
> Dernière mise à jour : 2026-09-22 (audit + segmentation États de santé + tables restantes)

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
          combat/             (20 articles + _chapter.json)
          tests-et-actions/   (8 articles + _chapter.json)
          etats-de-sante/     (31 articles + _chapter.json)
          force-polaris/      (statut à clarifier)
          experience/         (à convertir)
      en/                     (vide)

Le `_index.json` porte la carte de navigation complète, y compris les
articles non encore convertis (visibles dans la nav, non cliquables
fonctionnellement tant que le fichier n'existe pas).

---

## 4. Architecture client

    client/src/components/encyclopedia/
      EncyclopediaPage.jsx           ← page racine
      GlossaryPage.jsx               ← page glossaire (route dédiée)
      ChapterList.jsx                ← nav 3 niveaux
      ArticleView.jsx                ← vue article (+ scroll sur ancre)
      BlockRenderer.jsx              ← dispatcher de blocs
      contentLoader.js               ← getIndex, loadChapterMeta, loadArticle,
                                       loadGlossary, findChapterMeta, findArticleMeta,
                                       resolveWikiTarget
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
protégées par `ProtectedRoute`.

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
| Tests et actions | ✔ 8/8 |
| Combat | ✔ 20/20 |
| États de santé | ✔ 25/25 (segmenté depuis 31 le 2026-09-22, voir §7 Phase 2bis) |
| Force Polaris | 13/13 fichiers présents, **1 corrompu** : `maitrise-force-polaris.json` contient en réalité le texte de « Choc Polaris » (même id que `choc-polaris.json`) — l'article n'a jamais été rédigé. Confirmé 2026-09-22, doc précédente (« statut à clarifier ») obsolète. |
| Expérience | Index posé, 0 article |

**Total converti : voir `node tools/validate-encyclopedia.mjs`** (compte les articles réels à chaque
exécution — ne plus maintenir de nombre en dur ici, c'est exactement ce qui a désynchronisé cette
section en premier lieu).

### Livres 1-2-3

Non communiqués. Non bloquant.

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
- Prochain : Force Polaris (13/13 fichiers présents, 1 à corriger/réécrire — voir §6)

**Phase 2bis — Segmentation États de santé** : TERMINÉE (2026-09-22)
- 31 → 25 articles (6 fusions de fratries mono-page, 3 renommages de cohérence maladies-*→toxiques-*)
- Séparateurs de groupe non interactifs dans la nav (`_index.json:articles[].group`,
  `ChapterList.jsx`) — décision actée : pas de 4ᵉ niveau d'accordéon
- Outil pérenne `tools/validate-encyclopedia.mjs` (index/fichiers + liens `[[...]]`, à relancer après
  tout renommage futur)

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