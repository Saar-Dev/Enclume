# ENCYCLOPEDIA — Mémoire externe de conversation

> Fichier de référence stable pour le chantier « Encyclopédie » du projet Enclume.
> Dernière mise à jour : 2026-09-23 (chapitre Personnages et statistiques ; précédemment : audit qualité + segmentation États de santé + tables restantes)

---

## 1. Le projet Enclume — vue d'ensemble

Type : application web JDR — système Polaris (LdB).
Structure : monorepo, dossiers client/, server/ et shared/.
Cible : PWA, jouable en session VTT + hors session.

### Stack client

React 19 + Vite 8, React Router v7, Zustand, Axios (via lib/api.js),
i18next + react-i18next, Quill 2, @react-three/fiber + drei, @dnd-kit, motion, socket.io-client.
Polices : Inter, Share Tech Mono, Caveat, Venus Rising.

### Arborescence

    shared/                  ← 90+ fichiers JS, source de vérité des règles
    client/src/
      App.jsx, main.jsx, i18n.js, index.css
      lib/api.js, stores/, locales/, pages/, components/<domaine>/, hooks/

### Conventions

- Code : anglais. Commentaires : français, structurés (description + réf. doc + décision datée).
- Doc projet : docs/PLANS/PLAN_*.md, docs/ROADMAP.md, docs/EN_COURS.md, docs/BUG_*.md.
- Chaque feature a un plan numéroté, découpé en lots.
- Routes en anglais (/encyclopedia, /equipment, /vault…).

### Règle d'or Enclume

Aucune valeur de règle n'est dupliquée dans l'Encyclopédie. Toute valeur provient
de shared/ par import runtime via whitelist (client/src/components/encyclopedia/dataSources.js
— créé Phase 3). Seuls les textes éditoriaux vivent dans le JSON.

---

## 2. Design system (client/src/index.css)

### Tokens primitifs — préfixe --wiz-*

    --wiz-bg-1/2/3, --wiz-blue-bright, --wiz-blue-mid, --wiz-cyan
    --wiz-white, --wiz-metal-1, --wiz-metal-3
    --wiz-shadow, --wiz-glass, --wiz-glass-border, --wiz-radius

### Alias sémantiques (préférés)

    --bg-app, --bg-surface, --bg-elevated, --bg-input, --bg-button
    --color-primary, --color-primary-muted
    --color-success/danger/warning (+ variantes -soft)
    --color-gold (#f5c542)
    --text-primary/secondary/muted, --border-subtle/strong
    --radius-xs/sm/md/lg, --space-xs/sm/md/lg/xl

### Familles typographiques

    --font-display (Venus Rising), --font-ui (Inter),
    --font-mono (Share Tech Mono), --font-hand (Caveat)

### Patterns de fond

- .wiz-page, .wiz-shell, .app-shell (⚠ .app-shell contient overflow:hidden)

### Vocabulaire transverse

- .card (+ .card-danger), .btn (+ variantes), .badge (+ variantes)
- .doc-row, .has-tooltip
- .enc-eyebrow, .enc-mono (⚠ préfixe enc- pris)

---

## 3. i18n

### Init (client/src/i18n.js)

    resources: { fr: { translation, creation, combat, charSheet, builder, tickets, encyclopedia } }
    lng: 'fr', fallbackLng: 'fr', supportedLngs: ['fr']

### Convention

    const { t } = useTranslation('encyclopedia')
    t('nav.title')

### Nommage clés

camelCase hiérarchique, suffixé (xxxLabel, xxxButton, xxxError).
Interpolation {{xxx}}, pluriels _one / _other.

### Décision Encyclopédie

- Namespace dédié : encyclopedia
- Contenu NE PASSE PAS par i18n (données, pas UI)
- Marqueurs RAW (OPTIONNEL, RÈGLE AVANCÉE) → champ `label` dans les données

---

## 4. Chantier Encyclopédie — décisions actées

### Contenu

| Sujet | Décision |
|---|---|
| Nature | Figé — RAW du LdB uniquement |
| Traduction | Prévoir structure par langue dès maintenant |
| Format | JSON structuré en blocs typés |
| Découpage | Un dossier par chapitre, un fichier par article (granularité fine) |
| ID | Composite `<chapter_slug>.<article_slug>` |
| Page | Champ séparé (pas dans l'ID — collisions réelles p. 214) |
| Index | _index.json léger, contenu chargé à la demande (import.meta.glob) |
| Catalogues SQL | Armes, compétences, carrières, pouvoirs → BDD, différé Phase 6 |

### Rendering

- Style : base Wizard (.app-shell + .card)
- Préfixe CSS : encyclo-
- Nav : accordéon 3 niveaux, articles visibles uniquement dans chapitre actif
- Callouts : un seul mode dans le flux. Variants : sidebar, example, optional, rule, note, quote

### Syntaxe inline

- Liens wiki : [[Label|target]] ou [[Label|target|page]]
- Valeurs de règle : {{source.path}} — différé Phase 3
- Mise en forme : **gras**, *italique* uniquement
- Label callout : champ `label` (provient du RAW, jamais inventé)

### Types de blocs actifs

- heading (levels 2-5, avec id d'ancre)
- paragraph (avec [[...]] et **gras**/*italique*)
- list (ordonnée ou non, label + sous-blocs récursifs)
- callout (variants : sidebar, example, optional, rule, note, quote)
- dataTable (résolu — sources via dataSources.js, Phase 3)

### Types différés

- table (éditorial pur) — décision : on garde dataTable placeholder
- dataList / entityCard (catalogues SQL) — Phase 6
- reference (bibliographique) — différé

### Zéro dérive

- Import runtime depuis shared/ via whitelist (dataSources.js — créé Phase 3)
- Libellés de tableaux dans terms.json (fr/) — cf. CONVERSION §4.9
- Processus 3 passes : 1) dépôt brut / 2) mise en forme + liens / 3) injection shared/

### Méthode de travail

| Sujet | Décision |
|---|---|
| Approche | Vertical slice |
| Seed | Chemin A — JSON écrit à la main |
| Édition ultérieure | Chemin C — éditeur par blocs (chantier séparé) |
| Stockage | Fichiers JSON versionnés Git, pas de BDD |
| Règle principale | UN fichier par échange (sauf changement d'interface) |
| Granularité | 1 fichier = 1 concept autonome identifiable |
| Cartographie | Chapitre entier cartographié AVANT conversion |

### Format de texte brut idéal

- `-- cadre -` / `-- fin cadre -` pour délimiter les callouts
- `(tableau à importer)` avec note explicite
- Césures PDF visibles
- `Note user` pour signaler les correspondances avec shared/

### Standards typographiques (uniformisation assumée)

Voir `ENCYCLOPEDIA_CONVERSION.md` §3 pour la liste complète.
En résumé :
- Tiret d'incise `–` → `—`
- Point final ajouté aux phrases tronquées et valeurs courtes
- Espaces autour des `/` dans les labels (`Seuils / Effets`)
- `x` multiplication → `×`
- Guillemets imbriqués → anglais `"…"`
- Températures : `20°C` → `20 °C`

### Sources dataTable — état

**Résolues — Tests et actions, Combat, États de santé (complet 2026-09-22) :**
- DIFFICULTE_ACTION_MODIFICATEURS, DIFFICULTE_NON_ALEATOIRE_SEUILS (polarisUtils.js)
- MR_TABLE (polarisTestResolution.js)
- DEPLACEMENT_ACTION_MALUS, DISTANCES_DEPLACEMENT_SOL/EAU, COMBAT_MULTIPLE_ADVERSAIRES_MALUS
  (polarisUtils.js)
- DISTANCE_TIR_MODIFICATEURS, TAILLE_CIBLE_MODIFICATEURS, MODIFICATEURS_CIRCONSTANCES_TIR
  (combatSituationMods.js)
- LOCALISATION_DOMMAGES_TABLE, AIMED_LOCATION_MALUS (armorConstants.js — la seconde porte
  désormais une colonne silhouette, `DataTableBlock` `kind: 'silhouette'`)
- BLESSURE_SEUILS_TABLE, COMPTEUR_BLESSURES_TABLE, BLESSURE_EFFETS_TABLE, CHOC_DUREE_TABLE,
  DUREE_GUERISON_SOINS_TABLE (woundConstants.js — les 3 dernières créées 2026-09-22, n'existaient
  nulle part avant)
- SEQUELLES_* — 11 tables (pas 12, corrigé), `sequellesConstants.js` (nouveau fichier dédié,
  2026-09-22)
- FALL_DAMAGE_TABLE (fallDamageConstants.js — existait déjà côté moteur, jamais branchée avant)

**Non résolues, investigation nécessaire (pas un branchement direct) :**
- Froid (`dommages-froid.json`) — `coldExposureConstants.js` ne couvre que la cadence des Tests, pas
  la progression des dégâts physiques (probablement dans `coldExposureService.js`, serveur)
- Feu (`dommages-feu.json`) — aucune constante dédiée trouvée
- Combat : coûts de Préparation (« Les actions »), malus attaques multiples (« Enchaînement »),
  modificateurs Combat au contact/Contact tactique — pas confirmé si une vraie table moteur existe à
  dupliquer, ou si c'est délibérément des exemples RAW à discrétion du MJ
- ACCOMPLISSEMENT_CHANCE — vérifié 2026-09-22 avec Saar : pas de table manquante dans l'article
  Chance, ce point est clos (retiré de la liste)

### Éléments non stylés

Tous résolus en Phase 3 (variants `quote`, `heading level 5`,
classes `.encyclo-datatable-*`).

---

## 5. Le LdB Polaris

### Livre 4 (pages 201-271)

0. Personnages et statistiques (112-114) — CONVERTI (2026-09-23, 11 articles) ⚠ pages hors de la plage
   201-271 du livre : rangement sous `livre-4` à confirmer (voir `PLAN_ENCYCLOPEDIA.md` §7 Phase 2quinquies)
1. Tests et actions (201) — CONVERTI
2. Combat (212) — CONVERTI
3. États de santé (234) — CONVERTI
4. Force Polaris (252) — index posé, 0 article
5. Expérience (268) — index posé, 0 article

Livres 1-2-3 : non communiqués.

---

## 6. État d'avancement — voir `tools/validate-encyclopedia.mjs`

Ne plus maintenir de liste de slugs ni de compte total ici à la main — c'est exactement ce qui a
rendu cette section fausse (59 articles annoncés, États de santé listé 31/31 avec des fichiers qui
n'existaient plus). `node tools/validate-encyclopedia.mjs` donne le compte réel à chaque exécution et
signale toute désync.

### Chapitres complets

**Tests et actions (8/8)** — inchangé depuis la création.

**Combat (20/20)** — inchangé depuis la création.

**États de santé (25/25, segmenté depuis 31 le 2026-09-22)** — voir `docs/PLANS/PLAN_ENCYCLOPEDIA.md`
§7 Phase 2bis pour le détail des fusions/renommages. Toutes les tables RAW connues branchées.

**Personnages et statistiques (11/11, ajouté 2026-09-23)** — voir `PLAN_ENCYCLOPEDIA.md` §7 Phase
2quinquies. 4 tables branchées (`AN_TABLE`, `RD_TABLE`, `RES_NAT_TABLE` + `FORCE_MOD_DOMMAGES_TABLE`
créée, sans consommateur moteur).

**Force Polaris (13/13 fichiers, 1 corrompu)** — `maitrise-force-polaris.json` contient en réalité
le texte de « Choc Polaris » ; l'article n'a jamais été rédigé. À corriger avant de considérer ce
chapitre terminé.

### Squelette technique (Phase 3 — vertical slice terminée)

- EncyclopediaPage, ChapterList, ArticleView, BlockRenderer
- contentLoader (getIndex, loadChapterMeta, loadArticle, loadGlossary,
  findChapterMeta, findArticleMeta)
- inlineParser (liens wiki + gras/italique)
- blocks/HeadingBlock, ParagraphBlock, ListBlock, CalloutBlock, DataTableBlock
  (titre de callout en vrai `h4` depuis 2026-09-22, plus un `<div>`)
- dataSources.js (whitelist + transforms — un par famille de table, voir ENCYCLOPEDIA_SHARED_INVENTORY.md)
- GlossaryPage (route /encyclopedia/glossary)
- terms.json (fr/)
- encyclopedia.css
- Routes /encyclopedia et /encyclopedia/glossary (ProtectedRoute)
- Namespace `encyclopedia` dans i18n.js
- Ancres fonctionnelles (headings + callouts avec id), extraction glossaire **récursive** depuis
  2026-09-22 (callouts/listes imbriqués — invisibles au glossaire avant, corrigé)
- `tools/validate-encyclopedia.mjs` — vérificateur pérenne (index/fichiers/liens)

### Non commencé

- Résolution des sources dataTable restantes : Combat (audit paramètres moteur, pas confirmé comme
  un vrai gap), Froid/Feu (États de santé, investigation nécessaire)
- Force Polaris : réécrire `maitrise-force-polaris.json` (contenu corrompu)
- Bloc table éditorial
- Deep-linking URL (route par article)
- Recherche, impression
- Éditeur par blocs (Phase 5)
- Catalogues SQL + API (Phase 6)
- Nettoyage i18n transverse (Phase 8)

---

## 7. Plan de marche

- Phase 0 : Cadrage — TERMINÉ
- Phase 1 : Vertical slice — TERMINÉ
- Phase 2 : Conversion chapitre par chapitre — EN COURS
  - Terminés : Tests et actions, Combat, États de santé (segmenté 2026-09-22, 31→25 articles)
  - Prochain : Force Polaris — cartographie déjà faite par un autre agent (13 fichiers), mais
    `maitrise-force-polaris.json` à réécrire (contenu corrompu, voir §6)
- Phase 3 : Injection données shared/ — TERMINÉE pour États de santé (2026-09-22)
  - Vertical slice terminée (dataSources, DataTableBlock, terms.json, glossaire)
  - Reste : Combat (audit non tranché), Froid/Feu (États de santé, investigation nécessaire)
- Phase 4 : Élargissement (Force Polaris, Expérience, puis Livres 1-2-3)
- Phase 5 : Éditeur par blocs (chantier séparé — servira aussi pour changelog)
- Phase 6 : Catalogues SQL + API
- Phase 7 : Recherche, impression, deep-linking URL, ancres intra-article
- Phase 8 : Nettoyage i18n transverse

---

## 8. Pièges connus

- `.app-shell` pose `overflow:hidden` → casse `position: sticky`. Override : `.encyclo-viewer.app-shell { overflow: visible }`.
- `import.meta.glob` est résolu au démarrage Vite → restart parfois nécessaire.
- Chemins d'import relatifs cassent silencieusement au déplacement.
- Casse Windows/Linux : `polarisUtils.js` (minuscule).
- Bug récursion (résolu) : `BlockRenderer` appelé sans wrapper `{block}`. Fix : `(b) => <BlockRenderer block={b} />`.
- Callouts titre-seul sans contenu = bug silencieux possible.
- Réflexes de standardisation typographique non neutres → documentés dans `ENCYCLOPEDIA_CONVERSION.md` §3.
- Ancres et chargement asynchrone : le navigateur traite le hash avant que
  l'article soit dans le DOM. Fix : scroll manuel dans ArticleView après rendu
  (setTimeout 0).
- Double `return` dans un objet littéral : erreur de syntaxe silencieuse,
  le module ne se charge pas, l'ancienne version reste active via HMR. Le
  symptôme visible est un composant qui affiche l'ancien rendu.
- Bloc `dataTable` sans `headers` : ne rend aucun `<thead>`, bug silencieux (vécu 3 fois avant
  d'en faire une vérification systématique). Toujours vérifier `block.headers` en écrivant une
  nouvelle table.
- Désync index/contenu : `_index.json` peut référencer un fichier absent ou au contenu erroné
  (mauvais id à l'intérieur, voire contenu d'un tout autre article). Vécu deux fois
  (`blessures-description`/`blessures-effets`, `force-polaris.maitrise-force-polaris`/`choc-polaris`).
  `tools/validate-encyclopedia.mjs` le détecte — le lancer après toute modification structurelle,
  jamais supposer qu'un fichier présent est correct.
- **Résolu 2026-09-22** : les liens wiki `[[...]]` ne changeaient jamais d'article au clic (seulement
  l'ancre dans l'article déjà chargé) — corrigé par `resolveWikiTarget()` (`contentLoader.js`) +
  handler de clic délégué sur `.encyclo-content` (`EncyclopediaPage.jsx`). Corrigé directement, pas de
  ticket (le script préparé n'a jamais été inséré, supprimé).

---

## 9. Sources de vérité

- client/package.json
- client/src/App.jsx, i18n.js, index.css
- client/src/components/encyclopedia/**/*
- shared/*.js
- docs/PLANS/PLAN_*.md
- docs/PLANS/PLAN_ENCYCLOPEDIA.md — plan du chantier
- docs/ENCYCLOPEDIA_CONTEXT.md — ce fichier
- docs/PLANS/ENCYCLOPEDIA_CONVERSION.md — règles de conversion (typographie, schéma de blocs, process)
- docs/ENCYCLOPEDIA_SHARED_INVENTORY.md — mapping table RAW ↔ constante shared/
- tools/validate-encyclopedia.mjs — vérificateur pérenne, à lancer après toute modification
  structurelle

---

## 10. Note de reprise (nouvelle conversation)

Trois docs portent le projet pour une reprise à froid :
- `PLAN_ENCYCLOPEDIA.md` — vue d'ensemble, phases, méthode
- `ENCYCLOPEDIA_CONTEXT.md` (ce fichier) — tout ce qu'il faut savoir sur l'existant
- `ENCYCLOPEDIA_CONVERSION.md` — règles de conversion précises

Prochain travail (état 2026-09-22) :
- Force Polaris : audité 2026-09-22. Fixé : rendu `dataTable` éditorial (8 tables invisibles →
  visibles, `DataTableBlock.jsx`). Restent : réécrire `maitrise-force-polaris.json` corrompu (attend
  le RAW p.252 de Saar), segmenter `liste-pouvoirs.json` (44 pouvoirs/1350 lignes) — détail
  `PLAN_ENCYCLOPEDIA.md` §6
- Audit paramètres moteur Combat (Préparations, Enchaînement, modificateurs de contact) — pas encore
  tranché si c'est un vrai gap ou des exemples RAW appropriés en l'état
- Froid/Feu (États de santé) — investigation des constantes moteur avant tout branchement
- Chapitre Expérience (Livre 4) — jamais commencé