# PLAN — Sources de contenu (catalogues de référence)

> Statut : décisions de cadrage actées avec Saar (2026-09-29) — voir §0. **Lot A (exo-armures)**
> prêt à passer en code. **Lot B (équipement)** planifié dans le détail mais **exécution
> différée** — décision explicite de Saar : « OK pour exécuter la migration `ref_equipment` plus
> tard, mais planification maintenant : on ne reporte pas par convenance, si c'est carré maintenant,
> pas de risque d'erreur. »
>
> Origine : chantier de nettoyage RAW `docs/REGLES/GUIDE_TECHNIQUE_ARMURES.md`. En comparant les
> fiches transcrites avec la base réelle (`ref_exo_templates`), on a trouvé que 15 modèles
> d'exo-armures existent en deux versions concurrentes — Livre de Base et Guide Technique — avec des
> valeurs différentes, et que la table ne porte aujourd'hui **que** la version Livre de Base, sans
> aucun champ pour le savoir ni basculer vers une autre source. Saar anticipe que d'autres sources
> viendront (équipement, et au-delà).
>
> Méthode : conformément à la consigne déjà appliquée au chantier Exo-Armures lui-même
> (« Improvisation interdite… architecture validée contre des dépôts pro réels avant tout code »,
> `PLAN_EXOARMURE.md` en-tête), l'architecture est confrontée à 3 précédents réels avant toute
> proposition de schéma — Foundry VTT, MekHQ (déjà cités comme référence sur ce projet) et Comp/Con
> (l'outil de référence pour Lancer, un jeu de mechs très proche du sous-système exo-armures).

---

## 0. Décisions actées avec Saar (2026-09-29)

1. **Le Livre de Base n'est pas désactivable.** C'est la base du jeu, pas une source parmi
   d'autres. `is_core` reste dans le modèle : le LdB est actif par construction, sans ligne dans la
   table de jointure d'activation. Ça referme la question « ligne explicite ou implicite » (ancien
   §5-Q1, cf. §6.3) : ce sera toujours implicite pour le LdB, explicite pour toute autre source.
2. **Lot B (`ref_equipment`) : planifié maintenant, exécuté plus tard.** Le sous-plan (§2.5) est
   vérifié et détaillé au même niveau que le Lot A, pas juste esquissé — pour qu'il n'y ait aucun
   risque d'erreur ni d'improvisation le jour de l'exécution.
3. **Nommage : `source`, pas `supplement` ni `content_source`.** Appliqué dans tout ce document :
   `ref_supplements` → `ref_sources`, `supplement_id` → `source_id`, `campaign_enabled_supplements`
   → `campaign_enabled_sources`.

---

## 1. Précédents étudiés

### 1.1 Foundry VTT — modules & compendiums

Chaque extension de contenu (module) embarque ses propres « compendium packs » (recueils
d'items/acteurs/etc.), identifiés par leur module d'origine. Le MJ active ou désactive des modules
au niveau du monde (l'équivalent d'une campagne) ; le contenu d'un module désactivé disparaît des
recherches sans que les données soient supprimées ou fusionnées avec autre chose.

**Ce que ça confirme :** le contenu doit être tagué par sa source d'origine, et l'activation se
fait au niveau de l'instance de jeu (campagne) — jamais de fusion automatique entre sources
concurrentes.

Sources : [Module Management](https://foundryvtt.com/article/modules/),
[Compendium Packs](https://foundryvtt.com/article/compendium/)

### 1.2 Comp/Con (Lancer RPG) — Lancer Content Packages (LCP)

Le contenu de base (Core book) est chargé par défaut dans l'application. Tout contenu
supplémentaire — officiel ou homebrew — est un fichier `.lcp` installé explicitement, qui ajoute
ses propres entrées identifiées par leur pack d'origine. Un pack homebrew peut coexister avec une
entrée du Core sans jamais l'écraser silencieusement.

**Ce que ça confirme :** le contenu additionnel est un **ajout explicite et nommé**, jamais un
patch implicite d'une table existante — exactement le problème qu'on a manqué de créer en
proposant, plus tôt dans ce chantier, d'importer les fiches Guide Technique par-dessus les fiches
Livre de Base du même nom.

Source : [Homebrew Content Packs (wiki Comp/Con)](https://github.com/massif-press/compcon/wiki/Homebrew-Content-Packs)

### 1.3 MekHQ (BattleTech) — TechAdvancement

Chaque pièce d'équipement porte des métadonnées temporelles et factionnelles (dates
d'introduction/extinction, disponibilité par faction). La disponibilité effective est
**recalculée dynamiquement** par un service (`CompositeTechLevel`) à partir des options de
campagne (année, faction) — jamais figée en base au moment du seed.

**Ce que ça confirme :** le filtrage « qu'est-ce qui est visible dans cette campagne » doit être
une requête/un service exécuté à la lecture, pas une donnée pré-calculée stockée sur chaque ligne
de contenu.

Source : [Faction.java (MegaMek/mekhq)](https://github.com/MegaMek/mekhq/blob/master/MekHQ/src/mekhq/campaign/universe/Faction.java)

### 1.4 Constat interne à ce projet

`ref_exo_templates` et `ref_equipment` n'ont aujourd'hui aucune notion de source. `campaigns` a
déjà un mécanisme d'options de campagne (`settings` jsonb + `campaignSettingsService.js`,
`SETTINGS_SCHEMA`), mais conçu pour des réglages scalaires (ambiance, mode de rechargement…), pas
pour une relation N:N avec des entités référencées par clé étrangère. La littérature générale sur
PostgreSQL est unanime sur ce point : une relation structurée qui doit garantir l'intégrité
référentielle et être filtrée par jointure SQL est le cas d'école de la table de jointure
classique, pas du JSONB (impossible de poser une contrainte FK à l'intérieur d'un document JSON).

Source : [When To Avoid JSONB In A PostgreSQL Schema (Heap)](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema)

---

## 2. Architecture retenue

### 2.1 Table `ref_sources` (nouvelle, extensible sans migration future)

Une source = une ligne, pas une valeur d'enum figée dans le code (patron Comp/Con : chaque LCP est
une entrée nommée, pas une case dans une liste fixe).

Colonnes : `id` (uuid, généré par Postgres — jamais codé en dur, cf. §6.5), `code` (text, unique,
ex. `ldb`, `guide_technique`), `name` (affichage), `description`, `is_core` (bool — vrai
uniquement pour le Livre de Base, cf. §0.1), `created_at`.

Ajouter une future source = une ligne insérée, jamais une migration de schéma.

### 2.2 `ref_exo_templates.source_id` (FK vers `ref_sources`) — Lot A

- Backfill des 15 lignes existantes avec `source_id = 'ldb'` — confirmé par comparaison exhaustive
  (Exo-Force des 15 modèles vs `SEEDEXO.md` : 15/15 correspondances exactes, aucune ne correspond
  au Guide Technique).
- Séquence sûre (expand/contract) : colonne nullable → backfill → `ALTER … SET NOT NULL` +
  `UNIQUE (name, source_id)`, dans le **même commit** que la mise à jour de
  `exo-templates-tool.html` (imposé par `.claude/rules/migrations.md`, pas une option — cf. §6.1).
- Les fiches Guide Technique de Mentor/Moloch/etc. deviennent des **lignes supplémentaires** avec
  `source_id = 'guide_technique'`, jamais un `UPDATE` des lignes existantes.

### 2.3 Table de jointure `campaign_enabled_sources`

`campaign_id` (FK `campaigns`), `source_id` (FK `ref_sources`), PK sur les deux. Une ligne =
source active pour cette campagne. **Le LdB n'a jamais de ligne ici** (§0.1) : la requête de
filtrage est donc `ref_sources.is_core = true OR EXISTS (SELECT 1 FROM campaign_enabled_sources
WHERE campaign_id = ? AND source_id = ref_exo_templates.source_id)`, pas une jointure pure.

Pourquoi une table de jointure et pas une clé dans `campaigns.settings` (jsonb) : intégrité
référentielle, filtrage par `JOIN`/`EXISTS` SQL direct, cohérent avec le patron MekHQ (filtre
calculé à la lecture par une requête, pas stocké sur chaque ligne de contenu).

**Routes de gestion (manquantes dans une version antérieure de ce plan, ajoutées ici §6.10)** —
sans elles la table de jointure n'est jamais atteignable depuis l'API, un mécanisme de bascule qu'on
ne peut jamais basculer. Dans `campaigns.js`, même patron que les routes GM existantes
(`requireAuth, requireRole('gm')`) :
- `GET /api/campaigns/:id/sources` — liste `ref_sources` avec un booléen `enabled` par ligne
  (`is_core OR EXISTS(...)`) ;
- `POST /api/campaigns/:id/sources/:sourceId` — active une source (insert), rejette avec 400 si
  `is_core` (toujours actif, une activation explicite n'a pas de sens) ;
- `DELETE /api/campaigns/:id/sources/:sourceId` — désactive (delete), même garde `is_core`.

### 2.4 Application du filtre — 1 lecture + 1 écriture — Lot A [CORRIGÉ 2026-09-29, voir §6.10]

- **Lecture** (`GET /api/exo-templates`) : la condition `is_core OR EXISTS(...)` du §2.3, plus une
  jointure sur `ref_sources` pour exposer `source.name` par ligne — nécessaire pour distinguer deux
  fiches du même nom si LdB et Guide Technique sont actifs en même temps (ex. deux « Mentor »).
  Filtrage appliqué **seulement si** un `characterId` est fourni en query (résolution de la campagne
  côté serveur, jamais un `campaignId` transmis par le client — cf. §6.10) ; sans lui, retour non
  filtré (chemin emprunté par `exo-templates-tool.html`, outil admin qui gère tout le catalogue).
- **Écriture** — la même vérification (« le `template_id` appartient à une source active de la
  campagne du personnage, ou au LdB ») s'applique au **seul** point d'écriture qui référence
  `ref_exo_templates` : `applyExoTemplate` (`exoTemplateService.js:~77`). Les 4 routes
  `char-sheet.js` (`exo/systems`, `exo/weapons`, `exo/computers`, `exo/programs`) référencent
  `ref_equipment`, pas `ref_exo_templates` — leur vérification relève du Lot B (source_id sur
  `ref_equipment`, pas encore posée), pas de celui-ci. Voir §6.10 pour la correction complète.

### 2.5 Lot B — `ref_equipment.source_id` : planifié maintenant, exécution différée

Vérification faite **maintenant**, pas reportée (2026-09-29) : `ref_equipment` compte **797
lignes**, et la requête `SELECT name, count(*) FROM ref_equipment GROUP BY name HAVING count(*) >
1` renvoie **0 ligne** — aucun doublon de `name`. `UNIQUE (name, source_id)` peut donc être ajouté
sans risque de collision sur les données actuelles ; ce point aurait pu faire échouer la migration
si on l'avait découvert le jour de l'exécution plutôt que maintenant.

Plan complet, même niveau de détail que le Lot A, exécution différée :

- **Backfill** : les 797 lignes actuelles vers `source_id = 'ldb'` — le chantier Guide Technique
  n'a pour l'instant produit que des fiches d'exo-armures, aucune fiche d'équipement générique n'a
  été transcrite ni comparée, donc aucune ligne actuelle ne peut être du Guide Technique.
- **Même séquence expand/contract** que le Lot A (nullable → backfill → `NOT NULL` +
  `UNIQUE(name, source_id)`), même exigence de commit unique avec le code consommateur.
- **Points d'écriture identifiés (2026-09-29, lecture directe de `char-sheet.js`)** — ce sont en
  fait ceux d'abord attribués au Lot A par erreur (§6.4 avant correction, voir §6.10) : trois routes
  référencent bien `ref_equipment`, une n'y référence rien du tout :
  - `POST /:characterId/exo/systems` (`char-sheet.js:~2475`) — `ref_equipment_id`, family filter
    `≠ 'Exo-arme'` ;
  - `POST /:characterId/exo/weapons` (`char-sheet.js:~2597`) — `ref_equipment_id`, family filter
    `≠ 'Exo-systeme'` ;
  - `POST /:characterId/exo/programs` (`char-sheet.js:~2776`) — `equipment_id` (nom de champ
    différent), family filter `= 'Logiciels'` ;
  - `POST /:characterId/exo/computers` (`char-sheet.js:~2679`) — **aucune référence catalogue** :
    champs scalaires (`role`, `gen`, `nt`, `blindage_iem`…), rien à vérifier ici, à ne pas compter
    dans l'audit du Lot B.
  Reste à auditer avant exécution du Lot B : le CRUD admin de `ref_equipment` (`equipment.js`,
  protégé par `requireAdmin`) et tout point d'attache de `ref_equipment_id` hors exo-armure
  (inventaire standard) — non vérifiés à ce jour.
- **Pas de numéro de migration réservé maintenant** : le numéro se prend au prochain entier libre
  constaté sur le système de fichiers *et* `knex_migrations` au moment de l'exécution, jamais
  anticipé (`.claude/rules/migrations.md`).

---

## 3. Hors périmètre

- Fusion ou priorité automatique entre deux versions actives simultanément du même nom (si LdB et
  Guide Technique sont actifs ensemble, « Mentor » apparaît deux fois dans la liste — au MJ de
  choisir, comme Comp/Con qui ne fusionne jamais deux packs silencieusement).
- Filtrage temporel/factionnel façon MekHQ (dates d'introduction, progression technologique par
  campagne) — le déclencheur ici est binaire (actif/inactif), pas chronologique.
- Migration rétroactive d'une exo-armure déjà possédée par un personnage si sa source est
  désactivée après coup — le filtre ne joue qu'à la sélection, jamais sur l'existant.
- L'audit des points d'écriture du Lot B (§2.5) — listé comme travail à faire avant l'exécution du
  Lot B, pas fait dans ce PLAN.

## 4. Fichiers touchés

### Lot A — exo-armures (prêt à exécuter)

- Nouvelle migration : `ref_sources` (table + constraints + seed `ldb` avec `is_core = true`,
  `id` généré par Postgres).
- Nouvelle migration : `ref_exo_templates.source_id` + backfill + `UNIQUE(name, source_id)`, **dans
  le même commit** que la mise à jour de `server/src/admin/exo-templates-tool.html` (champ source
  dans le formulaire).
- Nouvelle migration : `campaign_enabled_sources` (table + constraints).
- `server/src/routes/exoTemplates.js` : filtrage `is_core OR EXISTS(...)` sur `GET`, actif seulement
  si `?characterId=` est fourni (résolution de `campaign_id` côté serveur), plus jointure
  `ref_sources` pour exposer `source.name` par ligne.
- `server/src/lib/exoTemplateService.js` (`applyExoTemplate`) : vérification serveur de la source
  active avant application (le seul point d'écriture concerné, §2.4/§6.10).
- `server/src/routes/campaigns.js` : routes `GET/POST/DELETE /:id/sources` (§2.3) pour que le GM
  puisse effectivement activer/désactiver une source par campagne.
- `client/src/character/ExoSheetWindow.jsx:162` : passer `characterId` à l'appel
  `api.get('/exo-templates')` pour que le filtre serveur s'applique réellement dans le seul
  consommateur actuel de cette route.
- `docs/VOCABULARY.md` : ajouter **Source (de contenu)**.

### Lot B — équipement (planifié, exécution différée)

- Migration `ref_equipment.source_id` + backfill (797 lignes → `ldb`, doublons de `name` déjà
  vérifiés absents) + `UNIQUE(name, source_id)` — numéro et date d'exécution non fixés.
- Audit préalable (non fait) des points d'écriture équivalents aux 5 du Lot A, avant de coder quoi
  que ce soit sur ce lot.

---

## 5. Questions ouvertes

Aucune — les 3 questions posées initialement sont closes par §0.

---

## 6. Analyse à charge (2026-09-29)

Relecture critique de l'architecture avant code. Conservée ici pour traçabilité, avec les
résolutions.

### 6.1 [CORRIGÉ 2026-09-29, lecture directe du fichier] — rollout de `NOT NULL source_id`

Correction : `exo-templates-tool.html` ne crée aucun template (vérifié en le lisant) — il liste les
lignes existantes et permet d'uploader une illustration par ligne, rien d'autre ; les templates
n'existent que via seed (`307_ref_exo_templates_seed.js`). Il n'y a donc pas de formulaire de
création à faire évoluer. Le « code consommateur » du même commit (`.claude/rules/migrations.md`)
se limite ici à une colonne d'affichage `Source` dans le tableau de cet outil (visibilité, aucune
ambiguïté fonctionnelle à résoudre puisque Lot A ne fait qu'étiqueter `ldb` sur les lignes
existantes, sans encore introduire de doublon de nom).

### 6.2 [INTÉGRÉ AU §2.4] — désambiguïsation de deux fiches du même nom côté API/UI

`GET /api/exo-templates` doit exposer `source.name` par ligne (jointure sur `ref_sources`), sinon
deux « Mentor » actifs simultanément sont indiscernables dans l'UI. Intégré au §2.4, plus une
zone grise.

### 6.3 [RÉSOLU par Saar, §0.1] — le Livre de Base n'est pas désactivable

Décision actée : `is_core` reste dans le modèle, le LdB est toujours actif, sans ligne de
jointure. La question « ligne explicite ou implicite » ne se pose donc que pour les sources non
core — toujours explicite pour elles.

### 6.4 [RÉSOLU, vérification factuelle] — `ref_equipment` peut être attaché à une exo-armure hors template

Confirmé (2026-09-29) : `exo_systems`/`exo_weapons` ont une FK `ref_equipment_id`
(`239_exo_systems_foreign_keys.js:6`, `240_exo_weapons_foreign_keys.js:6`), et
`char-sheet.js` expose 4 groupes de routes pièce par pièce (`exo/systems`, `exo/weapons`,
`exo/computers`, `exo/programs`, lignes ~2475-2776), indépendants d'`applyExoTemplate`. Intégré au
§2.4 (5 points d'écriture, pas 1). Sans cette vérification, coder le plan initial aurait laissé un
trou sur 4 routes d'écriture sur 5.

### 6.5 Anti-pattern à ne pas reproduire dans les migrations de ce lot

Le §1.4 critique le hardcodage d'UUID inter-migrations (`307`→`308`/`309` sur
`ref_exo_templates`). Les nouvelles migrations de ce PLAN doivent donc : laisser Postgres générer
l'`id` de `ref_sources` (jamais de valeur codée en dur), et faire référencer ce `code` par toute
migration/seed ultérieure via un lookup (`SELECT id FROM ref_sources WHERE code = 'ldb'`), jamais
un `id` recopié.

### 6.6 Ordre des migrations et validation attendue (Lot A)

Ordre imposé par les FK : `ref_sources` → `ref_exo_templates.source_id` (+ backfill + `UNIQUE`) →
`campaign_enabled_sources` (dépend de `ref_sources` et de `campaigns`, déjà en place). Validation
attendue une fois codé : tests ciblés avec la base locale (round-trip `up()`/`down()`, cf.
`.claude/rules/migrations.md`) et un scénario réel (créer une exo-armure via un template d'une
source désactivée doit échouer), pas seulement `node --check`.

### 6.7 Devenir documentaire

Ce PLAN est temporaire (`RegleDocumentaire.md` Règle 10). Une fois le Lot A codé, son contenu
durable (le concept de **Source**, son fonctionnement) devra migrer vers un document SYSTEM
(`docs/SYSTEME/SOURCES.md`, à créer) plutôt que de rester dans un PLAN archivé.

### 6.8 Alternative plus simple envisagée et écartée

Une colonne texte `source` sans FK et un tableau `enabled_sources` dans `campaigns.settings` (au
lieu de la table de jointure) demanderaient zéro nouvelle table. Écartée pour trois raisons
concrètes : (1) aucune intégrité référentielle — une faute de frappe dans un tableau JSONB ne casse
rien visiblement, une FK invalide si — (2) pas d'endroit pour porter les métadonnées d'une source
(nom affiché, description) sans les dupliquer à chaque ligne de contenu — (3) contredit le
précédent MekHQ (filtrage par requête/jointure, pas par égalité de chaîne).

### 6.9 Ce qui tient : le choix « pas de fusion automatique » résout déjà le cas d'usage fin

Activer deux sources simultanément fait apparaître les deux « Mentor » séparément (une fois §2.4
réglé) et le MJ choisit le `template_id` précis par armure. Le tout-ou-rien n'est qu'à l'échelle de
la source, pas à l'échelle de chaque armure — la sélection fine existe déjà au niveau du choix de
template.

### 6.10 [CORRECTION, lecture directe du code au moment de coder Lot A — 2026-09-29] — deux trous trouvés avant le premier fichier écrit

Avant d'écrire la première migration, relecture des 4 routes `char-sheet.js` citées en §2.4/§6.4 et
du fichier §4 dans son ensemble. Deux faits vérifiés changent le périmètre :

1. **Les « 5 points d'écriture » de §2.4/§6.4 mélangeaient deux tables.** `applyExoTemplate` porte
   sur `template_id` → `ref_exo_templates` (Lot A). Les 4 routes `char-sheet.js` portent sur
   `ref_equipment_id`/`equipment_id` → `ref_equipment` (Lot B, `source_id` pas encore posé —
   décision Saar : exécution différée). Vérifier une source active sur `ref_equipment` dans ces 4
   routes aujourd'hui n'a pas de sens : la colonne n'existe pas. Corrigé : Lot A n'a qu'**un seul**
   point d'écriture (`applyExoTemplate`), les 4 routes basculent dans l'audit du Lot B (§2.5) — et
   en les lisant réellement, une seule des quatre n'existe même pas : `exo/computers` ne référence
   aucune table catalogue (champs scalaires uniquement), donc le Lot B en aura 3, pas 4.
2. **Aucune route n'exposait `campaign_enabled_sources` en écriture.** Le §4 listait la migration de
   la table de jointure et le filtrage en lecture/écriture, mais jamais le moyen, pour un MJ, de
   réellement insérer/supprimer une ligne — la bascule décrite en §0/§1 aurait été construite sans
   interrupteur. Corrigé : ajout de `GET/POST/DELETE /api/campaigns/:id/sources` (§2.3/§4), même
   patron `requireRole('gm')` que le reste de `campaigns.js`.

Une troisième vérification (pas une erreur, une précision nécessaire) : `GET /api/exo-templates`
n'a aujourd'hui aucun contexte de campagne (ni `characterId` ni `campaignId` en entrée), et son seul
appelant client (`ExoSheetWindow.jsx:162`) ne connaît que `character.id`. Le filtre ne peut donc
s'activer que si la route accepte `?characterId=` et résout `campaign_id` **elle-même** côté serveur
(jamais un `campaignId` envoyé tel quel par le client — un utilisateur pourrait alors prétendre
appartenir à n'importe quelle campagne). Sans `characterId` (cas de l'outil admin), pas de filtrage :
comportement actuel préservé pour la gestion du catalogue complet.

---

**Bilan final** : toutes les décisions de conception sont actées (§0). Le Lot A a son point
d'écriture unique identifié et vérifié (§2.4/§6.10), sa route de bascule GM (§2.3/§6.10), un ordre
de migration explicite (§6.6), et aucune question ouverte. Le Lot B est spécifié au même niveau de
détail, doublons de `name` déjà exclus par vérification directe (797 lignes, 0 doublon), et son
audit des points d'écriture est maintenant partiellement fait (3 points identifiés en §2.5, reste le
CRUD admin `ref_equipment` et l'inventaire standard) — l'exécution elle-même reste différée, par
choix explicite de Saar, pas par oubli.

---

## 7. Lot C — Illustrations par défaut des exo-armures (chantier distinct, suivi ici)

> **Cause racine différente de A et B — pas le même invariant, pas le même commit.** Le Lot A/B
> répondent à « quelle source de contenu est active dans cette campagne ». Celui-ci répond à
> « comment une illustration de catalogue devient l'image par défaut d'une fiche possédée,
> modifiable ensuite par le joueur ». Suivi dans ce document à la demande de Saar (2026-09-29),
> mais migration(s) et commit(s) séparés de A et B.

### 7.1 État vérifié (2026-09-29)

- **Côté catalogue** (`ref_exo_templates.illustration_url`, migration `71`) : la colonne existe
  déjà, ainsi qu'une route admin `POST /api/exo-templates/:id/illustration` (upload MinIO,
  `requireAdmin`). **Rien à migrer ici.** Reste à peupler les 15-16 lignes existantes avec les PNG
  RAW disponibles (`docs/Illustration/exo-armure/`).
- **Côté fiche possédée** (`exo_sheet`) : **aucune colonne illustration** (vérifié sur le schéma
  complet, migration `44` + toutes les migrations `exo_sheet_*` ultérieures). `applyExoTemplate`
  (`exoTemplateService.js:40-46`, `COPIED_FROM_TEMPLATE_COLUMNS`) copie 19 champs du template vers
  la fiche mais pas `illustration_url` — un joueur qui applique un template avec image n'en hérite
  pas aujourd'hui.
- **Aucune route joueur** pour modifier l'illustration d'une exo-armure après coup. `GET
  /:characterId/exo` expose le `illustration_url` du template en lecture seule
  (`char-sheet.js:2195`, alias `template_illustration_url`), et la whitelist d'édition
  (`EXO_BASE_WHITELIST_FIELDS`) ne contient aucun champ illustration.
- **Patron directement réutilisable, pas à réinventer** : `characters.portrait_url` +
  `POST /:id/portrait` (`characters.js:327-358`) — permission propriétaire/MJ (`req.isGm ||
  req.isOwner`, pas `requireAdmin`), upload MinIO, nom d'objet fixe `characters/<id>/illustration`,
  cache-busting par `?v=timestamp`.

### 7.2 Périmètre du Lot C

- Migration : `exo_sheet.illustration_url` (nullable, pas de backfill nécessaire — une fiche sans
  template n'a simplement pas d'image par défaut).
- `exoTemplateService.js` : ajouter `illustration_url` à `COPIED_FROM_TEMPLATE_COLUMNS` — copie
  automatique à l'application d'un template, comme les 19 autres champs.
- Nouvelle route joueur, calquée sur `POST /:id/portrait` de `characters.js` : permission
  propriétaire/MJ (pas admin), upload MinIO, écrit sur `exo_sheet.illustration_url` — c'est ensuite
  cette valeur (et non plus celle du template) qui prime pour l'affichage, une fois définie par le
  joueur.
- Peuplement des `illustration_url` de `ref_exo_templates` avec les PNG déjà disponibles — tâche de
  contenu, pas de code, indépendante du reste.

### 7.3 Questions ouvertes (Lot C)

1. Si le joueur n'a jamais uploadé d'image et que le template n'en a pas non plus (les 15-16 lignes
   actuelles ont `illustration_url = null`) : quel visuel par défaut côté client — silhouette
   générique, rien, autre ? Question UI, pas bloquante pour la migration.
2. Séquencement : Lot C avant, après, ou indépendamment de A/B ? N'a aucune dépendance technique
   sur `ref_sources`/`campaign_enabled_sources` — peut se faire dans n'importe quel ordre.
