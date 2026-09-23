# ENCYCLOPEDIA_CONVERSION — Règles de conversion RAW → JSON

> Référence précise pour convertir un texte RAW brut (LdB Polaris) en article JSON de l'Encyclopédie.
> Ce fichier était, jusqu'au 2026-09-22, une copie octet-pour-octet de `PLAN_ENCYCLOPEDIA.md` — le
> contenu ci-dessous n'avait jamais été écrit malgré les sections qui le référençaient
> (`ENCYCLOPEDIA_CONTEXT.md` §10, `PLAN_ENCYCLOPEDIA.md` §8). Reconstitué depuis les décisions déjà
> actées ailleurs, sans rien inventer de nouveau.
>
> Dernière mise à jour : 2026-09-22.

---

## 1. Format de texte brut idéal (pour la dépose initiale)

- `-- cadre -` / `-- fin cadre -` (ou `-- cadre --`/`-- fin cadre --`) pour délimiter un callout.
- `-- table à importer --` / `-- fin table --` avec une note explicite quand une table RAW doit être
  transcrite en `shared/` plutôt qu'en JSON.
- Césures PDF visibles (ex. `gué-rison`) — normalisées à la conversion, jamais recopiées telles
  quelles.
- `Note user` pour signaler une correspondance avec une constante `shared/` déjà connue.

## 2. Processus en 3 passes

1. **Dépôt brut** — texte RAW copié tel quel dans un fichier `.txt` de travail (temporaire, hors
   dépôt — supprimé après usage).
2. **Mise en forme + liens** — découpage en blocs JSON (heading/paragraph/list/callout), typographie
   uniformisée (§4), liens wiki `[[...]]` posés vers les articles/ancres déjà convertis.
3. **Injection shared/** — les tables RAW identifiées en passe 1 sont vérifiées contre `shared/`
   (déjà branchée, à créer, ou à laisser en texte — voir `ENCYCLOPEDIA_SHARED_INVENTORY.md` pour la
   règle de décision table vs texte).

## 3. Schéma des blocs JSON

### Actifs

| Type | Champs | Notes |
|---|---|---|
| `heading` | `level` (2-5), `id`, `title` | h1 = chapitre (posé par le composant parent, pas dans le JSON), h2 = article, h3+ = sections. `id` = ancre, format `<chapitre>.<article>[.<section>]`. |
| `paragraph` | `text` | Supporte `[[...]]` et `**gras**`/`*italique*` (voir §5). |
| `list` | `ordered`, `items[]` (chaque item : `label?`, `blocks[]`) | Récursif — un item peut contenir n'importe quel bloc, y compris un autre `list` ou `dataTable`. |
| `callout` | `variant`, `label?`, `title?`, `id?`, `blocks[]` | Titre rendu en vrai `h4` (pas un `<div>`, corrigé 2026-09-22) — poser un `id` si le callout doit être ciblable/listé au glossaire. `blocks[]` récursif comme `list`. Retourne `null` (rien de rendu) si ni label, ni titre, ni contenu. |
| `dataTable` | `source`, `caption?`, `headers?` — **ou** `columns`, `rows`, `caption?` | Deux schémas distincts, jamais les deux à la fois. **Sourcé** : `source` = nom de constante whitelisté dans `dataSources.js` ; `headers` obligatoire pour tout rendu de colonnes visible (un bloc sans `headers` ne plante pas mais n'affiche aucun `<thead>`, bug silencieux vécu 3 fois). **Éditorial pur** (table narrative sans valeur de règle moteur, ex. jet 1D100 aléatoire) : `columns` = `[{ key, label }]`, `rows` = `[{ [key]: string, subItems?: string[] }]` (`subItems` pour un jet secondaire imbriqué dans une ligne). Rendu par `EditorialDataTable` dans `DataTableBlock.jsx` (ajouté 2026-09-22 — ce chemin était déjà décidé ci-dessous mais jamais implémenté, 8 tables restées invisibles sur Force Polaris avant correction). |

Variants de callout : `sidebar`, `example`, `optional`, `rule`, `note`, `quote`.

### Différés

- `dataList`, `entityCard` (catalogues SQL — armes, compétences, carrières, pouvoirs) — Phase 6.
- `reference` (bibliographique) — non prioritaire.

## 4. Standards typographiques (uniformisation assumée)

Écarts volontaires par rapport au texte RAW brut, appliqués systématiquement :

| RAW brut | Converti |
|---|---|
| Tiret d'incise `–` | `—` |
| Phrase tronquée ou valeur courte sans point final | Point final ajouté |
| `Seuils/Effets` | `Seuils / Effets` (espaces autour des `/` dans les libellés) |
| `x` (multiplication) | `×` |
| Guillemets `« … »` imbriqués dans une citation | Guillemets anglais `"…"` |
| `20°C` | `20 °C` (espace insécable avant l'unité) |
| Césures PDF (`gué-\nrison`) | Mot reconstitué, jamais la césure recopiée |
| Apostrophe droite `'` | Apostrophe typographique `’` |

## 5. Syntaxe inline (`inlineParser.jsx`)

- Lien wiki : `[[Label|cible]]` ou `[[Label|cible|page]]` — `cible` = id d'article
  (`chapitre.article`), id d'ancre (`chapitre.article.section`), ou slug de chapitre seul (lien vers
  un chapitre entier, pas un article précis). `[[Label]]` sans cible = lien cassé, signalé
  visuellement (`.encyclo-link-broken`), jamais silencieux.
- Gras `**texte**`, italique `*texte*` — pas de nesting entre les deux, ni lien dans un gras (v1, non
  supporté, documenté pas géré).
- **Résolu 2026-09-22** : un lien `[[...]]` valide structurellement change désormais bien d'article au
  clic (pas seulement l'ancre dans l'article déjà chargé) — `resolveWikiTarget()`
  (`contentLoader.js`) + handler de clic délégué (`EncyclopediaPage.jsx`).
- Valeurs de règle `{{source.path}}` — syntaxe évoquée en cadrage initial, jamais implémentée ; les
  valeurs de règle passent exclusivement par le bloc `dataTable`, pas par une interpolation inline.

## 6. Zéro dérive — règle d'or

- Aucune valeur de règle (nombre, dé, seuil, modificateur) écrite en dur dans un fichier `.json`
  d'article. Toute valeur vient de `shared/*.js`, importée via la whitelist `dataSources.js`.
- Une table RAW qui n'a pas encore de constante `shared/` correspondante : soit elle est créée
  (si c'est une vraie donnée de règle indépendante), soit le contenu reste en texte/liens éditoriaux
  si la donnée est déjà portée ailleurs (ex. les indicateurs « Aggravation : Infection » d'un article
  sont déductibles des clés de `WOUND_INFECTION`, pas besoin d'une table dédiée — décision du
  2026-09-22, voir `blessures-description.json`).
- Les libellés français des clés de table (ex. `legere` → « Légère ») vivent dans
  `client/src/components/encyclopedia/fr/terms.json`, jamais recopiés en dur dans `dataSources.js`
  ni dans l'article.
- Les catalogues SQL (armes, compétences, carrières, pouvoirs) sont référencés, jamais copiés —
  différé Phase 6 (deep-linking vers les entités d'app).

## 7. Cartographie préalable

Avant toute conversion d'un nouveau chapitre : lister tous les articles attendus (titres, pages,
tables RAW présentes) dans `_index.json` en premier, même avant que les fichiers existent (visibles
dans la nav, non cliquables tant que le fichier n'existe pas). Ça évite de découvrir la structure au
fil de la conversion et de devoir réorganiser après coup.

## 8. Méthode de travail

- **Un fichier par échange**, sauf changement d'interface (ex. ajout d'un champ à `dataSources.js`)
  → tous les consommateurs modifiés ensemble.
- **Granularité** : un fichier = un concept autonome — mais pas au prix de scinder une paire qui n'a
  aucune raison mécanique d'être séparée (vécu : `stabilisation`/`soins-stabiliser` fusionnés
  2026-09-22, ni l'un ni l'autre n'était un concept vraiment autonome de l'autre).
- **Vérification après toute modification structurelle** (renommage, fusion, nouvel article) :
  `node tools/validate-encyclopedia.mjs` — jamais supposer qu'un renommage n'a rien cassé.
- **Test de fidélité** : comparer le JSON produit au texte RAW source ligne à ligne pour toute table,
  pas seulement une relecture visuelle — la méthode qui a servi tout du long du 2026-09-22
  (constante → script `.mjs` jetable qui imprime le rendu → comparaison manuelle avec le texte collé).
