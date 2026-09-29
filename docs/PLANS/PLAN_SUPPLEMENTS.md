# PLAN — Sources de contenu (catalogues de référence)

> Statut (2026-09-29) : **Lot A (exo-armures) codé et testé. Lot B (équipement) codé et testé** —
> les deux exécutés le même jour, à la demande de Saar (« Go lot B »), après un audit complet des
> points d'écriture (§2.5) qui a corrigé le backfill prévu (7 lignes déjà Guide Technique de fait,
> voir §2.5) avant d'écrire la première migration. **Lot C (illustrations, §7) codé.** Reste
> différé, par décision explicite : le filtrage en lecture de `GET /api/equipment` (§2.5).
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

### 2.5 Lot B — `ref_equipment.source_id` [EXÉCUTÉ 2026-09-29, audit complet avant code]

Audit d'écriture complet réalisé (agent d'exploration + vérifications directes en base) avant
d'écrire la première migration — plus de « non vérifié à ce jour ». Deux trouvailles ont changé le
plan initial :

**Trouvaille 1 — le backfill « tout vers ldb » était faux.** `347_ref_equipment_guidetech_programs_
seed.js` a déjà inséré 7 lignes authentiquement Guide Technique (`Alerte, Bouclier, Darter, Masque,
Phalanx, Recherche, SkyMarshall`, toutes `family='Logiciels', category='specialise'`, noms vérifiés
uniques en base) **en les traitant comme du contenu de base**, avant même que ce chantier existe.
Un backfill uniforme vers `'ldb'` aurait figé cette confusion. Le backfill matche donc par la clé
naturelle `name` (jamais un `id`, cf. §6.5) : ces 7 noms exacts → nouvelle source
`guide_technique` (ajoutée à `ref_sources`, `is_core=false`), les 790 lignes restantes → `ldb`.
Vérifié : 797 lignes actuelles, 0 doublon de `name` (inchangé depuis la vérification du 2026-09-29
initiale), les 7 noms GT sans collision avec une autre ligne de famille différente.

**Trouvaille 2 — l'audit d'écriture du Lot A ne portait que sur les routes exo.** Élargi à tout le
dépôt (`server/src/routes/**`, `server/src/services/**`) : 8 points d'écriture posent réellement un
`equipment_id`/`ref_equipment_id` **choisi librement par l'appelant** (candidats à la vérification
de source active), tous dans `char-sheet.js` sauf le dernier :
  - `POST /:characterId/inventory` (ajout d'objet, `inventoryService.addItem`) — garde de base
    (owner/GM) ;
  - `POST /:characterId/quick-equip` — GM uniquement ;
  - `POST /:characterId/drone/programs` — `droneIsGmOrOwner` ;
  - `POST /:characterId/drone/weapons` — `droneIsGmOrOwner` ;
  - `POST /:characterId/exo/systems` — `exoIsGmOrOwnerOrPilot` ;
  - `POST /:characterId/exo/weapons` — `exoIsGmOrOwnerOrPilot` ;
  - `POST /:characterId/exo/programs` — `exoIsGmOrOwnerOrPilot` ;
  - `POST /api/campaigns/:campaignId/merchants/:mid/buy` (`tradeService.buyFromMerchant`) — tout
    membre de la campagne.

  **Deux routes exclues à dessein**, pas oubliées : `POST /:characterId/inventory/:itemId/reload`
  (`current_ammo`) et `POST /:characterId/moding/install` (`char_inventory_mods.equipment_id`)
  n'acceptent pas un `ref_equipment_id` choisi librement — la valeur est dérivée d'une ligne
  `char_inventory` **déjà possédée** par le personnage (donc déjà vérifiée à son ajout), jamais un
  nouveau choix de catalogue. Vérifier la source à cette étape reviendrait à revalider une donnée
  déjà validée.
  `POST /:characterId/exo/computers` confirmé sans référence catalogue (champs scalaires) —
  toujours hors périmètre.

  Vérification faite : **une seule** fixture de test insère dans `ref_equipment` sans `source_id`
  (`exoTemplateService.test.mjs:230-232`) — corrigée dans ce commit, contre 3 fichiers pour le Lot A.

**Décisions de conception (2026-09-29) :**
- **Fonction de vérification partagée** (`server/src/lib/sourceService.js`,
  `assertSourceActive(db, campaignId, sourceId, sourceName)`) au lieu de dupliquer la logique 8 fois
  — `applyExoTemplate` (Lot A) est refactorée pour l'utiliser aussi : même invariant, une seule
  autorité (`.claude/rules/core.md`, « une propriété métier = une autorité unique »). Refactorer du
  code déjà commité n'est pas « retoucher une migration » (interdit) — seules les migrations déjà
  appliquées ne se retouchent jamais.
- **Filtrage en lecture (`GET /api/equipment`) volontairement différé**, pas silencieusement
  oublié : contrairement à `GET /api/exo-templates` (un seul appelant client), cette route est lue
  par `InventoryPanel`, `MerchantsPage` et `DroneWindow` sans contexte de campagne/personnage
  transmis aujourd'hui — l'ajouter demanderait de toucher les 3 composants. Le Lot B tel qu'exécuté
  couvre l'écriture (personne ne peut ATTACHER un objet d'une source désactivée) ; le filtrage
  d'affichage (ne pas MONTRER ces objets dans les sélecteurs) reste un fast-follow, sans risque de
  sécurité en attendant puisque l'écriture est déjà gardée.
- **`ref-equipment-tool.html`** (contrairement à l'outil exo-armures, celui-ci a un vrai formulaire
  de création/édition, vérifié en le lisant) : ajout d'un `<select name="source_id">` peuplé par une
  nouvelle route `GET /api/equipment/ref/sources`, et `source_id` ajouté à la validation "requis" de
  `POST`/`PUT /api/equipment` — même commit que la migration (`.claude/rules/migrations.md`).
- **`ref_exo_template_equipment.ref_equipment_id`** (loadout d'un template) reste hors périmètre :
  pas de route d'écriture REST (seed/admin uniquement), et le loadout d'un template est un paquet
  auteur lié à LA source du template lui-même (déjà gardée par le Lot A) — jamais un choix libre du
  joueur à l'exécution.

---

## 3. Hors périmètre

- Fusion ou priorité automatique entre deux versions actives simultanément du même nom (si LdB et
  Guide Technique sont actifs ensemble, « Mentor » apparaît deux fois dans la liste — au MJ de
  choisir, comme Comp/Con qui ne fusionne jamais deux packs silencieusement).
- Filtrage temporel/factionnel façon MekHQ (dates d'introduction, progression technologique par
  campagne) — le déclencheur ici est binaire (actif/inactif), pas chronologique.
- Migration rétroactive d'une exo-armure déjà possédée par un personnage si sa source est
  désactivée après coup — le filtre ne joue qu'à la sélection, jamais sur l'existant.
- Le filtrage en lecture de `GET /api/equipment` (InventoryPanel/MerchantsPage/DroneWindow) —
  différé par décision explicite (§2.5), pas oublié : l'écriture est gardée, l'affichage suivra.

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
- `client/src/components/campaignSettings/SectionSources.jsx` (nouveau) + `CampaignSettingsPage.jsx` :
  onglet « Sources de contenu » dans la Configuration de campagne, seul endroit qui consomme
  réellement ces routes — sans lui les routes ci-dessus n'étaient atteignables que par appel HTTP
  manuel (trouvaille Saar 2026-09-29, « Tu n'as pas codé OPTION DE CAMPAGNE »). Section autonome
  (patron `SectionPlayers.jsx`) : écrit immédiatement par bascule, jamais fondu dans le formulaire
  batché `campaigns.settings`.
- `client/src/character/ExoSheetWindow.jsx:162` : passer `characterId` à l'appel
  `api.get('/exo-templates')` pour que le filtre serveur s'applique réellement dans le seul
  consommateur actuel de cette route.
- `docs/VOCABULARY.md` : ajouter **Source (de contenu)**.

### Lot B — équipement [EXÉCUTÉ 2026-09-29]

- Migration : `ref_sources` — ajout de la ligne `guide_technique` (`is_core=false`).
- Migration : `ref_equipment.source_id` + backfill (7 lignes GT nommées → `guide_technique`, 790
  restantes → `ldb`) + `UNIQUE(name, source_id)`.
- Nouveau : `server/src/lib/sourceService.js` (`assertSourceActive`), partagé avec Lot A.
- `server/src/lib/exoTemplateService.js` : refactor pour utiliser `assertSourceActive` au lieu de sa
  vérification inline (aucun changement de comportement).
- `server/src/routes/equipment.js` : `GET /ref/sources` (nouveau, pour le formulaire admin) ;
  `source_id` requis sur `POST`/`PUT`.
- `server/src/admin/ref-equipment-tool.html` : champ `source_id` dans le formulaire.
- `server/src/routes/character/char-sheet.js` : `assertSourceActive` sur les 7 points d'écriture
  identifiés (§2.5) — inventaire, quick-equip, drone programs/weapons, exo systems/weapons/programs.
- `server/src/services/tradeService.js` : `assertSourceActive` sur `buyFromMerchant`.
- `server/src/lib/exoTemplateService.test.mjs` : fixture `ref_equipment` corrigée (`source_id`).
- `docs/VOCABULARY.md` : pas de nouvelle entrée (Source (de contenu) couvre déjà le concept,
  ajoutée au Lot A).

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

**Bilan final [mis à jour 2026-09-29, Lot B exécuté]** : toutes les décisions de conception sont
actées (§0). Le Lot A et le Lot B sont tous deux codés, testés et vérifiés en base — plus de lot
« planifié, exécution différée ». Le Lot A a son point d'écriture unique (`applyExoTemplate`) et sa
route de bascule GM (`campaigns.js`). Le Lot B a ses 8 points d'écriture identifiés et gardés
(§2.5), sa propre source `guide_technique` correctement rattachée aux 7 lignes qui l'étaient déjà de
fait (`347_ref_equipment_guidetech_programs_seed.js`, trouvaille faite en auditant plutôt qu'en
supposant), et une fonction de vérification (`assertSourceActive`, `sourceService.js`) partagée
entre les deux lots — refactor de `applyExoTemplate` inclus, une seule autorité pour l'invariant.
Seul reste différé, par décision explicite (pas un oubli) : le filtrage en lecture de
`GET /api/equipment` (3 composants client à toucher, aucun risque de sécurité en attendant puisque
l'écriture est déjà gardée).

---

## 7. Lot C — Illustrations par défaut des exo-armures (chantier distinct, suivi ici) [CODÉ 2026-09-29]

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

---

## 8. Tag de source dans l'UI [CODÉ 2026-09-29]

Demande Saar : un tag visible sur le contenu non-LdB, pour l'instant seulement le sélecteur
« Modèle » de la fiche Exo-armure (`ExoIdentityPanel.jsx`, consommateur du Lot A). Contrainte posée
par Saar : les tags n'apparaissent que si au moins un supplément est actif pour la campagne.

**Décision UX** (question ouverte de Saar, tranchée) : taguer uniquement le contenu non-core, jamais
le Livre de Base — le marquer aussi serait redondant (l'absence de tag signifie déjà « contenu de
base ») et ajouterait du bruit visuel sur l'immense majorité des lignes. Le texte du tag est le nom
réel de la source (`source_name`, ex. « Guide Technique »), jamais un « Supplément » générique — ça
tient sans redesign si une 3ᵉ source apparaît un jour.

**Contrainte technique trouvée avant de coder** : le sélecteur est un `<select>` HTML natif — un
`<option>` ne peut porter aucune couleur/badge (limite du navigateur, pas du CSS). Un vrai tag coloré
n'existe donc que dans l'affichage lecture seule (fiche non éditable) ; en mode édition, la
différenciation passe par `<optgroup>` (regroupement par source, libellé = donnée réelle, jamais
« Livre de Base » codé en dur).

- `server/src/routes/exoTemplates.js` : expose `source_is_core` (déjà `source_name`/`source_id`).
- `client/src/index.css` : `.badge.badge-source` (informationnel, couleur `--color-primary`, jamais
  success/danger/warning).
- `client/src/character/ExoIdentityPanel.jsx` : badge en lecture seule, `<optgroup>` en édition,
  les deux conditionnés à `hasSupplement = templates.some(t => !t.source_is_core)`.

Vérifié en base : le mécanisme est correct, mais aucun modèle `ref_exo_templates` n'est encore
rattaché à une source non-core aujourd'hui (Lot A n'a fait que ré-étiqueter les 16 lignes LdB
existantes) — le tag n'apparaîtra concrètement que le jour où une fiche Guide Technique sera
ajoutée au catalogue `ref_exo_templates` ET sa source activée pour une campagne. Pas un bug : le
mécanisme est prêt, la donnée pour l'exercer n'existe pas encore.

Hors périmètre pour l'instant (pas demandé) : le même tag sur les sélecteurs d'équipement
(systèmes/armes/programmes exo, inventaire) — même mécanisme (`source_is_core` déjà sur
`ref_equipment` depuis le Lot B) mais pas câblé côté client, à faire si Saar le demande.
