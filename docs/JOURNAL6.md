# JOURNAL6.md — Historique sessions Enclume
> Créé Session 133 — 2026-07-05
> Suite de JOURNAL5.md (archivé dans docs/Old/)

---
## Session 133 — 2026-07-05 — Migration 105 (« 37-bis ») : consolidation ref_skills (3ᵉ révision) ✅

> Aboutissement de l'audit ligne par ligne (251 lignes `ref_skills` + 94 `ref_skill_requirements`) documenté intégralement dans `docs/Old/MIGRATION_37BIS.md`, mené sur plusieurs sessions (démarré Session 131 suite) suite à la corruption cumulée des migrations 37/74/103/103b. Objectif explicite de Saar : que ce soit la dernière révision de cette table.

### Bloc serveur
- `server/src/db/migrations/105_ref_skills_37bis.js` **NOUVEAU** :
  - Schéma : `ref_skills.attr_1` passe `NOT NULL` → nullable ; nouvelle colonne `ref_skills.is_category BOOLEAN NOT NULL DEFAULT false`.
  - **A.** Re-parentage des 8 `MUTATION_*` vers `CONTROLE_DES_MUTATIONS` (vraie catégorie LdB, orpheline) puis suppression de `MUTATION` (catégorie fantôme sans base LdB, ajoutée migration 74) et de `ARMES_SATELLITES` (absent du LdB comme Compétence autonome, capacité déjà couverte par `TACTIQUE_COMBAT_TERRESTRE`).
  - **B.** 11 corrections de `label` (fautes/incohérences : "Arme Lourde" → "Armes lourdes", etc.).
  - **C.** 4 corrections `attr_1`/`attr_2` hors catégories (`ENDURANCE` FOR/COO→CON/VOL, etc.).
  - **`is_category`** (17 lignes) : remplace le sentinel `attr_1='CHC'` utilisé par le client pour détecter les catégories UI. 9 lignes déjà `CHC` reçoivent leurs vrais attributs LdB (ex. `POUVOIRS_POLARIS` INT/VOL, `COMMERCE_TRAFIC` INT/PRE) sans perdre leur statut de catégorie ; 8 lignes oubliées par la corruption (`ARTS_MARTIAUX`, `CONNAISSANCE_MILIEU_NATUREL`, `LANGAGES_SPECIFIQUES`, `LANGUE_ANCIENNE`, `LANGUE_ETRANGERE`, `MANOEUVRE_DARMURE`, `MECANIQUE`, `TACTIQUE`) rejoignent le mécanisme de regroupement pour la première fois.
  - **D.** 113 corrections de `marker` (legacy `'S'` → vraie valeur LdB `(X)`/`(-3)`/`NULL`/`PN`, décompte vérifié par famille et par valeur cible). `ENSEIGNEMENT` reçoit son premier `marker='•'` réel (compétence limitative) + une description maison (absente du LdB officiel).
  - **E.** `ref_skill_requirements` : déplacement de 2 prérequis (`ATHLETISME 10`, `EDUCATION_CULTURE_GENERALE 10`) de `MECANIQUE_CHASSEURS_ATMOSPHERIQUES` vers `PILOTAGE__CHASSEURS_ATMOSPHERIQUES` (mix-up de migration 74).
  - `down()` symétrique complet, **testé en base réelle** : `up()` → vérification (249 lignes, 17 `is_category`) → `down()` → diff byte-à-byte contre le snapshot pré-migration (251 lignes, tous champs) → **identique à 100%** → `up()` ré-appliqué.
- Total final : 249 lignes `ref_skills` (251 − `MUTATION` − `ARMES_SATELLITES`).

### Bloc client
- `client/src/character/SkillsPanel.jsx` :
  - Lignes 196/201 : `skill.attr_1 === 'CHC'` → `skill.is_category` (le sentinel `attr_1` ne pilote plus le regroupement UI).
  - **Contre-proposition Saar appliquée** : le `<thead>` par famille affichait `t('skillsPanel.colName')` = "Compétence" en boucle (une fois par famille, redondant). Remplacé par le nom de la famille elle-même (ex. "APTITUDES PHYSIQUES"), avec le même style (`familyTitle` — gras, bleu, majuscules) et le chevron ▶/▼. Le bandeau de titre séparé (ancien `<div>` au-dessus de la table) est supprimé — fusionné dans le `<thead>`, qui reste **toujours rendu** (`isCollapsed` ne conditionne plus que le `<tbody>`) pour ne jamais perdre la possibilité de redéplier une famille repliée.
- `server/src/routes/character/ref.js` : aucun changement — `SELECT *` fait déjà remonter `is_category` automatiquement.

### Effet de bord identifié et validé (pas un bug)
- Après correction des marqueurs `'S'` corrompus vers `(X)` (Compétence réservée), toute compétence `(X)` non apprise (`char_skills.is_learned`) devient invisible en mode normal (règle de visibilité pré-existante, `SkillsPanel.jsx:161-164`). Sur le personnage de test ("Mr sourire", 0 compétence apprise en base), ça vide de nombreuses catégories (Langues, Sciences/Connaissances spécialisées, Pilotage, etc.) — comportement mécaniquement correct et identique à celui de `Pouvoirs Polaris` (déjà `(X)` avant 37-bis). Confirmé par Saar comme comportement voulu, pas une régression.

### Testé ✅
- Migration 105 : `up`/`down`/`up` en base réelle, round-trip byte-identique vérifié (249/251 lignes, 17 `is_category`, `ref_skill_requirements` déplacé).
- Navigateur : regroupement des 17 catégories (9 déjà groupées + 8 nouvellement groupées : `ARTS_MARTIAUX`, `CONNAISSANCE_MILIEU_NATUREL`, `LANGAGES_SPECIFIQUES`, `LANGUE_ANCIENNE`, `LANGUE_ETRANGERE`, `MANOEUVRE_DARMURE`, `MECANIQUE`, `TACTIQUE`) confirmé fonctionnel par Saar.
- Header de colonnes fusionné avec le nom de famille : repli/dépli testé dans les deux sens, confirmé fonctionnel.
- Effet de bord `(X)`/visibilité : confirmé compris et accepté par Saar.

### Non testé
- Bouton d'achat en mode Progression sur une compétence `(X)` nouvellement corrigée (coût `COUT_DEBLOCAGE_X`) — logique inchangée par cette session, non re-testée explicitement.
- Impact sur `ref_career_skills` (lots COUCHE 4b, non encore seedés) — dette déjà notée dans `JOURNALCOUCHE4.md`.

### Dettes ouvertes
- `ref_career_skills.skill_id` sans FK vers `ref_skills.id` — hors scope 37-bis, à reprendre COUCHE 4b.
- `SkillsPanel.jsx:155` (`isVisible`) contient encore `if (skill.attr_1 === 'CHC') return false` — code mort vérifié (jamais atteint avec une ligne catégorie vu les points d'appel actuels), non touché (hors du plan validé). Sans impact, nettoyage cosmétique possible plus tard.
- `server/src/routes/character/ref.js:38` — commentaire "234 skills" obsolète (la table est à 249 désormais) — cosmétique, non bloquant.

---
## Session 134 — 2026-07-05 — Migration 106 (lot 1 carrières) : correction `ref_career_skills` vs LdB ✅

> Suite de `docs/Old/PLAN_LOT1_CAREERS.md` (plan validé point par point 9/9, session précédente). Corrige les `skill_id` erronés/manquants de `100_seed_ref_careers.js` (5 carrières : artisan_artiste, assassin, barman, chasseur_primes, contrebandier) par rapport à `docs/Character/Creation/REGLE_PROFESSION.md`.

### Bloc serveur
- `server/src/db/migrations/106_fix_ref_career_skills_lot1.js` **NOUVEAU** — 9 corrections (A1/A2 artisan_artiste, B1/B2/B3 assassin, C1 barman, D1/D2 chasseur_primes, E1 contrebandier) : voir table détaillée dans `docs/Old/PLAN_LOT1_CAREERS.md`. Aucune suppression sur `ref_careers` (id stable, évite le CASCADE `char_careers`). Garde-fou `getCareerIds` — lève une erreur explicite si une carrière ne résout pas d'id.
- C3 (barman "Armes de poing **ou** Fusils/Armes d'épaule") volontairement hors scope — le champ `conditional:true` n'est qu'un label texte, aucun mécanisme de choix réel n'existe dans le wizard (34 occurrences dans les lots 2-6 non appliqués). Traitement séparé requis (Step4 UI) avant refonte complète.
- Total : 93 lignes `ref_career_skills` pour les 5 carrières (89 avant, +4 net : B1 −1+3, D2 +1, E1 +1).

### Incident et remédiation (à conserver — piège pour les sessions futures)
- Pour le test round-trip (même rigueur que migration 105), `npx knex migrate:down` a été lancé sans argument. Cette commande cible la migration par **tri lexical des noms de fichiers**, pas par la table `knex_migrations` : `99_char_advantages_v2.js` trie *après* `100_...` à `106_...` (le caractère `9` > `1`), donc c'est **cette migration qui a été rollback** au lieu de 106.
- `down()` de 99 fait `dropTableIfExists('char_advantages')` + `dropColumn('pc_postcreation')` sur `char_pc_ledger` → table et colonne supprimées. Table vide au moment de l'incident, confirmé par Saar (`Aucune perte n'est à déplorer`) — aucune donnée réelle perdue.
- Remédiation immédiate : schéma recréé à l'identique (code exact de la migration 99), bookkeeping `knex_migrations` réparé (ligne réinsérée), vérifié `char_advantages` + `pc_postcreation` restaurés, `knex migrate:list` propre.
- **Méthode de test corrigée** : round-trip down/up de la migration 106 refait via **appel direct des fonctions `up`/`down` du module** (import ESM du fichier de migration, pas la CLI `knex migrate:down`/`migrate:latest`) — élimine le risque de mauvaise cible. Nouveau piège consigné dans `CLAUDE.md` (P52).
- Note : le serveur dev (`src/index.js:103`, `db.migrate.latest()` au démarrage) applique automatiquement toute nouvelle migration dès que le fichier est créé et que nodemon redémarre — la migration 106 était donc déjà appliquée avant même le lancement manuel des tests.

### Testé ✅
- Les 9 corrections vérifiées présentes et correctes en base (`SELECT` direct, 93 lignes).
- Round-trip `down()` → 89 lignes → `up()` → 93 lignes, **byte-identique** à la snapshot post-migration originale (diff exit clean).
- Schéma `char_advantages`/`pc_postcreation` confirmé restauré après l'incident.
- Fonctionnel navigateur : wizard Step4, 5 carrières sélectionnées tour à tour, aucun ID orphelin affiché — confirmé par Saar (« all ok »).

### Non testé
- —

### Dettes ouvertes
- **CAR1** — mécanisme "au choix" (`conditional:true`) non implémenté dans le wizard (barman C3 + 34 occurrences lots 2-6) — nécessite un vrai bouton radio/toggle (MVP), tâche séparée Step4 UI, avant l'inventaire exhaustif puis la refonte complète.
- Lots 2-6 (32 carrières) restent à porter en migrations knex (107+), séquencés un lot = un plan = une validation.

---
## Session 134 suite — 2026-07-05 — Lots 2-6 carrières (32 carrières) + FK ref_career_skills ✅

> Suite directe de la migration 106. Séquence : lot 2 → découverte incohérence `skill_group` →
> correction architecturale FK → vérification complète lots 3-6 (demandée par Saar) → lots 3-6
> implantés. Détail complet des plans : `docs/Old/PLAN_LOT1_CAREERS.md` (déjà clos), `docs/Old/PLAN_CAREER_SKILLS_FK.md`,
> `docs/Old/PLAN_LOTS_3_6_CAREERS.md`.

### Migration 107 — découverte process (non planifiée)
- En créant le fichier de migration pour le lot 2, découverte que le numéro **107 était déjà pris**
  par `107_seed_ref_careers_illustration_lot1.js` (illustrations lot 1, déjà appliqué batch 72,
  travail non documenté dans `EN_COURS.md` au moment de la lecture début de session — probablement
  fait en parallèle). Renommage du fichier lot 2 en **108** après nettoyage du bookkeeping.
- **Mécanisme confirmé** : `server/src/index.js:103` (`db.migrate.latest()` au boot) + `nodemon`
  sans config (`nodemonConfig` absent de `package.json`) qui watch tout `server/` par défaut →
  toute écriture de fichier dans `server/` (y compris un script de test !) déclenche un restart
  qui auto-applique les migrations en attente. Incident mineur : un restart déclenché entre le
  renommage du fichier et la correction du bookkeeping a causé un crash serveur temporaire
  (duplicate key, `process.exit(1)`) — corrigé en réalignant `knex_migrations.name` sur le nom de
  fichier réel, puis `touch` sur `index.js` pour redéclencher un restart propre.
- **Leçon retenue pour la suite** : tous les scripts de vérification/test ont été exécutés en
  `node -e` inline (jamais de fichier écrit dans `server/`) pour éviter de redéclencher nodemon
  pendant les tests.

### Migration 108 + 109 — Lot 2 (5 carrières) + illustrations
- `108_seed_ref_careers_lot2.js` : cultivateur_eleveur, diplomate, erudit_archeologue, espion,
  hybride_trident + toutes tables enfants (titres, education, point_categories, equipment,
  random_benefits). Bug trouvé et corrigé : `required_genotype: 'geno_hybride'` (inexistant) →
  `'GEN_HYB'` (vérifié contre `ref_genotypes` + LdB `REGLE_PROFESSION.md` L.24).
- `109_seed_ref_careers_illustration_lot2.js` : 5 illustrations, mapping vérifié contre MinIO réel.
- **Décision Saar** : peupler `ref_career_equipment`/`ref_career_random_benefits`/
  `ref_career_point_categories` malgré leur non-consommation actuelle par le code (voir audit
  ci-dessous) — les données LdB sont prêtes, éviter de les retraiter plus tard.

### Découverte majeure — `skill_group` texte libre, jamais un FK
- En creusant une incohérence de libellé (`Communication/Relations sociales` vs
  `Communications/Relations sociales` — 16 vs 11 lignes en base), découverte que
  `ref_career_skills.skill_group` n'est qu'un texte libre retapé à la main à chaque migration de
  seed, sans aucun lien avec `ref_skills.family` (la vraie catégorie canonique, utilisée par
  `SkillsPanel.jsx`). Les deux vocabulaires n'ont jamais été alignés (espaces autour du `/`
  différents, casse différente).
- **Correction architecturale demandée explicitement par Saar** (pas un contournement) :
  migration **111** — `ALTER TABLE ref_career_skills ADD FOREIGN KEY (skill_id) REFERENCES
  ref_skills(id) ON DELETE RESTRICT` (0 orphelin vérifié sur 208 lignes avant ajout) + `DROP
  COLUMN skill_group`. Backend `creationService.js:133` : JOIN `ref_skills` pour `family`.
  Frontend `CareersAllocator.jsx:44-46` : regroupement par `sk.family`. Détail complet :
  `docs/Old/PLAN_CAREER_SKILLS_FK.md`.
- Effet : fusion `Communication/Relations sociales` (27 lignes, avant fragmenté 16+11), plus
  aucune faute de frappe possible sur `skill_id` (rejet DB immédiat).
- **Dette identique non traitée** : `ref_background_skills.skill_id` a le même défaut (pas de FK)
  — table différente, hors scope de cette session (`98_ref_backgrounds.js:49`).

### Audit consommation réelle des tables enfants (déclenché par Saar)
- `ref_career_skills`, `ref_career_titles` : affichés dans `CareersAllocator.jsx` ✅
- `ref_career_education` : vérifiée dans `creationService.js:107` (`validateCareerEducation`) ✅
- `ref_career_point_categories` : fetchée par le backend mais **jamais affichée côté frontend**
- `ref_career_equipment`, `ref_career_random_benefits` : **jamais lues nulle part** (backend ni
  frontend) — données peuplées mais inertes depuis le lot 2
- Décision Saar : continuer à tout peupler quand même pour les lots 3-6 (branchement UI = chantier
  séparé, non planifié ici).

### Migrations 112-116 — Lots 3 à 6 (27 carrières)
- Vérification complète (skill_id contre `ref_skills` + fichiers illustration contre MinIO réel)
  pour les 5 lots avant tout code, à la demande explicite de Saar (vision globale). Détail :
  `docs/Old/PLAN_LOTS_3_6_CAREERS.md`.
- `112_seed_ref_careers_lot3.js` : marchand, marchand_itinerant, medecin_chirurgien, mercenaire, mineur.
- `113_seed_ref_careers_lot4a.js` : officier_naval_civil, officier_naval_militaire,
  officier_militaire_souterrain, officier_militaire_surface, ouvrier_docker.
- `114_seed_ref_careers_lot4b.js` : pilote_chasse_sous_marin, pilote_chasse_atmospherique, pirate.
- `115_seed_ref_careers_lot5.js` : policier_enqueteur, pretre_trident, prostitue,
  scientifique_ingenieur, soldat_milicien.
- `116_seed_ref_careers_lot6.js` : soldat_elite_commando_marin/souterrain/surface,
  soldat_elite_forces_speciales, sous_marinier, technicien_mecanicien, techno_hybride, veilleur,
  voleur_criminel. Bug trouvé et corrigé : `required_genotype: 'techno_hybride'` (inexistant) →
  `'TEC_HYB'` (même pattern que hybride_trident).
- Toutes les 5 migrations incluent l'illustration directement dans l'INSERT `ref_careers` (pas de
  migration séparée, contrairement au lot 1/2) — évite de reproduire le trou du lot 1.
- `skill_group` non repris dans aucune des 5 migrations (colonne supprimée par la migration 111).

### Incident mineur additionnel (lots 3-6)
- Chaque écriture de fichier de migration (112 à 116) a déclenché un restart nodemon +
  auto-application immédiate, avant le test round-trip contrôlé. Procédure systématique appliquée
  à chaque migration : `mig.down()` + suppression de la ligne `knex_migrations` orpheline, test
  `up`/`down`/`up` complet via `node -e` (jamais de fichier écrit dans `server/`), puis
  réinsertion propre de la ligne de bookkeeping avec le bon numéro de batch.

### Testé ✅
- 37/37 carrières en base (5 lot1 + 5 lot2 + 5 lot3 + 5 lot4a + 3 lot4b + 5 lot5 + 9 lot6).
- 0 orphelin FK sur l'ensemble de `ref_career_skills` (vérifié après ajout de la contrainte 111
  et après les 5 lots suivants).
- 0 carrière sans illustration (37/37).
- Round-trip `up`/`down`/`up` pour chacune des 8 migrations de cette session (108, 109, 111, 112,
  113, 114, 115, 116) — comptages identiques à chaque fois.
- FK active : tentative d'insert avec `skill_id` invalide rejetée (code Postgres `23503`).
- Fonctionnel navigateur confirmé par Saar : wizard Step4 affiche les 37 carrières, illustrations
  visibles, regroupement de compétences par famille correct, filtre génotype fonctionnel
  (hybride_trident + techno_hybride).

### Non testé
- Branchement UI de `ref_career_point_categories`/`ref_career_equipment`/`ref_career_random_benefits`
  (chantier séparé, non planifié).
- Prérequis carrières (`ref_career_prerequisites`) — non insérés, migration dédiée à venir.
- Mécanisme "au choix" (`conditional:true`) — CAR1, toujours ouvert.

### Dettes ouvertes (mises à jour)
- **CAR1** — mécanisme "au choix" toujours non implémenté (inchangé).
- **CAR2** (nouvelle) — `ref_background_skills.skill_id` sans FK, même défaut que `ref_career_skills`
  avant la migration 111 — préventif, aucun bug connu à ce jour.
- **CAR3** (nouvelle) — prérequis carrières non insérés dans `ref_career_prerequisites` — migration
  dédiée à planifier.
- Branchement UI equipment/random_benefits/point_categories — chantier séparé futur.

---
## Session 135 — 2026-07-05 — Bug encodage `ref_mutations` (migration 108) + PLAN_MUTATION stacking (migration 109) ✅

> Démarré sur [[docs/PLAN_MUTATION|PLAN_MUTATION]] (dépendance bloquante de PLAN_STEP4, jamais démarré).
> Run à vide sur le plan a révélé un bug d'encodage réel et non lié, traité séparément (règle "un
> seul bug à la fois") avant de revenir à PLAN_MUTATION. Plan archivé dans `docs/Old/PLAN_MUTATION.md`
> une fois implémenté — contenu absorbé ici.

### Bug découvert — corruption d'encodage `ref_mutations`/`ref_mutation_subtypes`/`ref_mutation_skills`
- `95_seed_ref_mutations.js` insère des chaînes déjà corrompues au niveau des octets du fichier
  source (vérifié : Node lisant le fichier en UTF-8 produit directement le texte mojibake, ex.
  `"RÃ©sistance naturelle"`) — octets UTF-8 valides mal réinterprétés en Windows-1252 puis
  ré-encodés en UTF-8. Différent du pattern `??` de la migration 44 (`char_fix_encoding`).
- Périmètre vérifié en base réelle : 44/45 lignes `ref_mutations` (`name`/`description`/
  `special_effect`/`stack_effect`), 4/4 `ref_mutation_subtypes`, 4 lignes `ref_mutation_skills`
  (`skill_name`) — toutes indépendamment cross-vérifiées contre `docs/Character/Creation/
  REGLE_MUTATION.md` (texte LdB correctement encodé, jamais touché par le bug).

### `server/src/db/migrations/108_fix_ref_mutations_encoding.js` **NOUVEAU**
- Transformation déterministe et réversible (table CP1252 0x80-0x9F, seule plage où Windows-1252
  diverge d'ISO-8859-1) : `decodeMojibake()`/`encodeMojibake()`, testées avant écriture (0/201
  colonnes en échec sur un round-trip decode→encode complet des 3 tables).
- `up()` corrige les 3 tables ; `down()` restaure le texte corrompu d'origine à l'identique.

### Incident et remédiation (à conserver — piège pour les sessions futures, voir P53 dans `CLAUDE.md`)
- Écrire le fichier de migration a déclenché un restart `nodemon` → `db.migrate.latest()` au boot a
  **auto-appliqué la migration correctement**, avant même mon premier test manuel (mécanisme déjà
  connu depuis la session 134 suite, mais pas assez internalisé ici).
- Un rappel manuel redondant de `mig.up(knex)` (test de round-trip, sans savoir que la migration
  était déjà appliquée) a fait tourner `decodeMojibake()` une **deuxième fois** sur du texte déjà
  correct : les caractères déjà propres (code point ≤ 0xFF, ex. `é`) sont repoussés comme octet
  UTF-8 isolé, produisant une séquence invalide que Node remplace silencieusement par `�` (aucune
  erreur levée) — 6 lignes endommagées (mutation_id 1,2,4,5,6,7) avant qu'un caractère non
  mappable (`→`, jamais un octet CP1252) ne fasse enfin planter la boucle et révèle le problème.
- Tentative de réparation par extraction regex (`src.slice(idx-200, end)`) sur le fichier source :
  fenêtre de 200 caractères trop courte, débordait sur le bloc `ins({...})` **précédent** → la
  `description` de 5 lignes (id 2,4,5,6,7) a reçu celle de la ligne précédente au lieu de la
  sienne. Détecté avant application par relecture manuelle du résultat affiché (jamais écrit).
- Réparation finale : les 5 valeurs correctes écrites en dur (texte relu ligne par ligne depuis le
  fichier source déjà chargé en contexte, zéro extraction dynamique), cross-vérifiées contre
  `REGLE_MUTATION.md`, appliquées avec vérification avant/après par ligne.
- **Leçon retenue** : pour toute réparation de données textuelles, afficher le résultat calculé et
  le comparer à une attente connue **avant** d'écrire — jamais uniquement vérifier l'absence
  d'erreur/de caractère de remplacement (condition nécessaire mais pas suffisante).

### `server/src/db/migrations/109_mutation_stacking.js` **NOUVEAU**
- Colonne `ref_mutations.stack_deltas` (JSONB, nullable) — peuplée sur les 9 lignes à incrément
  non-linéaire (Peau renforcée, Purulence, Squelette renforcé, Résistance naturelle ×6), matchées
  par `name`/`subtype` (sûr désormais que l'encodage est corrigé — plus besoin de contourner via
  colonnes structurelles comme envisagé avant la découverte du bug ci-dessus).
- `char_mutation_effects_view` réécrite (`CREATE OR REPLACE`, mêmes colonnes/types en sortie) :
  `SUM(base + (count-1) × COALESCE(stack_deltas->>col, base))` — linéaire par défaut pour les 42
  mutations sans `stack_deltas`.
- Round-trip `down()`/`up()` testé (un seul cycle, jamais deux `up()` consécutifs — leçon de
  l'incident ci-dessus).

### `server/src/services/creationService.js:245-269` (`finalizeCreation` STEP 3)
- Mutations sans sous-type : `INSERT ... ON CONFLICT (char_sheet_id, mutation_id) WHERE
  subtype_id IS NULL DO UPDATE SET count = count + 1` — cible explicitement l'index partiel
  `uq_char_mut_no_sub` (Postgres l'exige pour un index avec `WHERE`).
- Mutations à sous-type (CGA) : `insert` simple inchangé, aucun empilement possible (`is_unique`).

### Piège découvert — collision de numérotation de migration (P53, voir `CLAUDE.md`)
- `EN_COURS.md` indiquait "migration 108 disponible" au début de cette session ; en réalité, un
  travail parallèle sur les carrières (documenté juste au-dessus, "Session 134 suite") avait déjà
  consommé 108 et 109 **avant** cette conversation, sans que la doc partagée soit resynchronisée à
  temps. Résultat : deux fichiers `108_*` et deux fichiers `109_*` coexistent sur disque
  (`108_fix_ref_mutations_encoding.js`/`108_seed_ref_careers_lot2.js`, `109_mutation_stacking.js`/
  `109_seed_ref_careers_illustration_lot2.js`). Aucune collision réelle (tables disjointes, chaque
  fichier a un nom complet distinct, knex trace par nom complet) mais numérotation trompeuse.
- Prochain numéro de migration réellement disponible : **117** (vérifié par `ls` direct du dossier,
  pas par lecture d'`EN_COURS.md`).

### Testé ✅
- Formule de stacking : 3 scénarios (Peau renforcée ×2 → armure 5, Résistance naturelle feu ×3 →
  résistance 5, Difformité légère ×2 → PRE -2 linéaire) via transaction Postgres annulée.
- Upsert `finalizeCreation` : mutation stackable choisie 2× dans le même lot → 1 ligne `count=2`
  (pas de violation de contrainte) ; CGA à sous-type → insert simple inchangé. Transaction annulée.
- Migration 108 : 45/45 + 4/4 + 10/10 lignes décodées, 0 anomalie résiduelle, relecture visuelle
  complète des 45 `name`/`description` cohérente.
- Migration 109 : round-trip `down`/`up`, 9/9 `stack_deltas` corrects après ré-application.

### Non testé
- Parcours réel dans le wizard (Step3Mutations.jsx utilise encore le mock — confirmé par Saar,
  attendu tant que PLAN_STEP4 n'est pas implémenté). Scénarios de test du navigateur (PLAN_MUTATION
  §"Scénario de test") reportés à après PLAN_STEP4.

### Dettes ouvertes
- Aucune nouvelle — PLAN_STEP4 reste la prochaine étape planifiée (mutations réelles dans le
  wizard), désormais débloqué.

---
## Session 136 — 2026-07-05 — PLAN_STEP4 : mutations réelles dans le Wizard Step3 ✅

> Implémentation de [[docs/PLAN_STEP4|PLAN_STEP4]] (plan validé Session 134, débloqué Session 135
> après la résolution de sa dépendance stacking). Avant codage, vérification directe en base réelle
> (`node -e` + dotenv pointé sur `../.env`, racine monorepo) des 45 lignes `ref_mutations`, des 4
> `ref_mutation_subtypes` (CGA) et des 10 `ref_mutation_skills` — aucune donnée supposée.

### `server/src/db/migrations/117_ref_mutation_subtypes_description.js` **NOUVEAU**
- Ajoute `ref_mutation_subtypes.description TEXT` (nullable) + backfill des 4 lignes CGA (félin,
  canin, reptilien, simiesque) avec le texte déjà rédigé dans `creation.json`
  (`step3.mutations.20.subtypes.*.desc`) — texte déplacé, aucune nouvelle rédaction.
- Numéro confirmé libre par `ls` direct du dossier (102-116 tous occupés, cf. P53).

### Bloc serveur
- `creationService.js` : nouvelle fonction `getStep3RefData()` — `ref_mutations` + imbrication
  `ref_mutation_subtypes` (clé `subtable`, renommée pour éviter la collision avec la colonne
  `subtype`) + `ref_mutation_skills` (clé `skills`), pattern `Map` identique à `getStep4RefData`.
- `startCreation()` : ajout de `randomMutationsEnabled: settings.random_mutations` au retour (même
  emplacement que `ambiance`).
- `routes/creation.js` : nouvelle route `GET /:sheetId/step3/ref`.

### Bloc client
- `Step3Mutations.jsx` — réécriture complète (mêmes boutons/handlers, source de données changée) :
  suppression des mocks (`MOCK_MUTATION_IDS`/`MOCK_SUBTYPES`/`MUTATION_META`), fetch réel au montage,
  variantes (Difformités, Organe sensoriel manquant/suppl., Résistance naturelle) affichées comme
  cartes distinctes avec libellé de variante (13 codes DB → `step3.subtype_labels`), tirage aléatoire
  réécrit sur un vrai D100 (filtre par plage `d100_range_start/end`, tirage uniforme si plusieurs
  lignes partagent la plage — 3 familles concernées), relance du D100 si le résultat est `is_unique`
  et déjà obtenu dans le lot en cours de constitution (décision maison actée Session 134, garde-fou
  anti-boucle 500 tentatives). Tag "Cumulable" affiche désormais `stack_effect` (texte DB réel) au
  lieu du template `{{limit}}` (`ref_mutations.stack_limit` toujours `NULL` en base — confirmé par
  requête directe avant d'écrire le code).
- `mutationsMeta` (`mutation_id`, `name`, `subtype_name`, `cost_pc`) construit à la soumission de
  chaque méthode (achat/aléatoire/aucune) et envoyé dans le payload `onNext` — `WizardReview.jsx` le
  lit directement, sans plus aucun accès aux clés i18n par mutation ni à la base.
- `creationStore.js` + `WizardCreation.jsx` : propagation de `sheetId` et `randomMutationsEnabled`
  vers `Step3Mutations` (manquants jusqu'ici) ; carte "Tirage aléatoire" masquée si l'option de
  campagne `random_mutations` est désactivée.
- `creation.json` : suppression du bloc `step3.mutations.*` (45 mutations + 4 sous-types, obsolète —
  vérifié par grep qu'aucun autre composant ne l'utilisait), ajout `step3.loading` et
  `step3.subtype_labels.*`.

### Libellés de variantes — vérifiés contre la rulebook, pas devinés
- Avant d'écrire les 13 libellés `step3.subtype_labels`, lecture de
  `docs/Character/Creation/REGLE_MUTATION.md` (Difformités, L.88-94) et `REGLE_AVANTAGES.md`
  (Sens développé/diminué, L.95-96/203-204) : confirmé **"Difformité légère"/"Difformité
  importante"** (pas "mineure/majeure", hypothèse initiale erronée corrigée avant codage) et
  **vue/toucher/goût/odorat/ouïe** pour les 5 sens (Organe sensoriel manquant/supplémentaire).

### Correctif UX post-fonctionnel — halo de confirmation au clic
- Après confirmation SR/fonctionnel par Saar, demande d'un retour visible manquant au clic sur une
  carte de mutation (liste "équipées" hors champ visuel en bas de la longue grille). Choix retenu
  (préférence explicite de Saar, arbitrage UI/UX) : halo temporaire (0.6s, cyan `#2FD7FF`) sur la
  carte cliquée, plutôt qu'un déplacement de la liste de sélection.
- `index.css` : nouvelle classe `.wiz3-card-flash` + `@keyframes wizCardFlash` (voisine de
  `wizHudOk` déjà existant, même palette wizard). Animation CSS plutôt que `style={}` inline —
  seule option pour une `@keyframes`, cohérent avec la convention CSS du projet malgré l'usage
  d'objets `style` inline préexistant dans tout ce fichier (dette non traitée, hors scope).
  Les animations CSS priment sur `style={}` inline pour les propriétés animées (`border-color`,
  `box-shadow`), donc aucun conflit avec le style existant de la carte.
- `Step3Mutations.jsx` : état `flashId` + helper `flashCard(mutationId)` (timeout 600ms),
  déclenché uniquement sur ajout réussi (`handleAdd` direct + `handleSelectSubtype` après choix CGA
  dans la modal) — jamais sur un clic bloqué (mutation unique déjà possédée, PC insuffisants).

### Testé ✅
- `node --check` sur les 3 fichiers serveur + la migration, `JSON.parse` sur `creation.json`,
  ESLint sur les 3 fichiers client réécrits/modifiés (0 erreur introduite — 1 erreur préexistante
  et hors diff sur `WizardCreation.jsx:22`, `characterId` inutilisé, vérifiée via `git diff`).
- Confirmé SR + fonctionnel par Saar (parcours Step3 réel).
- Halo de confirmation confirmé fonctionnel par Saar après implémentation.

### Non testé
- Round-trip `up`/`down` de la migration 117 (à faire via appel direct des fonctions du module,
  jamais la CLI knex — P52/P54).
- Achat d'une mutation stackable 2× dans le même lot (empilement `count`) en conditions réelles
  navigateur (formule déjà validée en base Session 135 via transactions annulées).
- Tirage aléatoire D20/D100 en conditions réelles, dont le cas de relance `is_unique`.
- Toggle `random_mutations` dans les options de campagne (masquage de la carte "Tirage aléatoire").

### Dettes ouvertes
- Aucune nouvelle.

---
## Session 137 — 2026-07-06 — Option de campagne `feminin_bonus` + Sexe/Fécondité (Step1/3/5) ✅

> Item "41." de `docs/EN_COURS.md` (options de campagne câblées une par une). Analyse initiale
> trop étroite ("juste débrancher le sélecteur Sexe") — élargie après remarque de Saar : le Sexe
> est choisi en Step1 mais peut être altéré par une mutation en Step3 (Asexué/Androgyne/
> Autofécondation), ce qui touche aussi la Fécondité (désavantage `adv_076`, Step5). Plan complet
> rédigé et validé avant codage : [[docs/PLAN_SEXE|PLAN_SEXE]].

### Découverte clé (avant codage)
- Le schéma DB existait déjà en totalité mais n'était câblé nulle part : `char_archetype.sex`/
  `is_fertile` (migration 36, éditables seulement à la main sur la fiche perso), `ref_mutations.
  mod_sex`/`mod_fertility` (migration 95, agrégés dans `char_mutation_effects_view` — vue jamais
  lue par aucun code serveur), `ref_advantages.adv_076` "Fécondité" (migration 92, jamais relié à
  `is_fertile`). **Aucune nouvelle migration nécessaire.**
- Règle LdB (`REGLE_CREATION.txt:292-296` et `:1312-1316`) : le bonus féminin (FOR base 5, +2
  COO/PRE) est une règle optionnelle distincte du choix de Sexe lui-même. Décision de portée :
  `feminin_bonus` gate uniquement l'effet mécanique — le sélecteur Sexe reste toujours visible.

### Bloc serveur
- `creationService.js` : `startCreation()` renvoie `femininBonusEnabled: settings.feminin_bonus`
  (même pattern que `ambiance`/`randomMutationsEnabled`). STEP1 : `validateStep1` reçoit
  `(isFeminin1 ?? false) && settings.feminin_bonus` au lieu du booléen brut (évite une désynchro
  client/serveur quand l'option est désactivée) ; écrit désormais `char_archetype.sex` (`'homme'`/
  `'femme'`). STEP3 : la boucle d'insertion des mutations accumule `mod_sex`/`mod_fertility` du
  `ref_mutations` de chaque mutation choisie, et met à jour `char_archetype` en conséquence après
  la boucle (dernière mutation avec override gagne).
- `advantageService.js` : `addAdvantage()` détecte une mutation active `mod_fertility = 'sterile'`
  (jointure `char_mutations`/`ref_mutations`) et la transmet à `validateAdvantage` ; pose
  `is_fertile = true` sur `char_archetype` si `adv_076` est acheté. `removeAdvantage()` repasse
  `is_fertile = false` symétriquement (nouveau `advantage_id` ajouté au `.select()`).
- `advantageConstraints.js` : nouvelle contrainte `not_if_sterile` (bloque l'achat de `adv_076` si
  le personnage a déjà une mutation stérilisante) ; `validateAdvantage()` accepte un 5ᵉ paramètre
  `isSterile`. Contrainte valable à la fois pour le Wizard (Step5) et l'achat post-création
  (`char-sheet.js` → même fonction `addAdvantage`), un seul point de vérité.

### Bloc client
- `creationStore.js` : nouvel état `femininBonusEnabled` (même circuit que `randomMutationsEnabled`
  — récupéré dans `startCreation()`, remis à `null` dans `resetCreation()`).
- `WizardCreation.jsx` : suppression du mock `mockIsFeminin = false` (mort depuis toujours — la
  prop `isFeminin` reçue par `Step1Attributes` était explicitement ignorée, `_deprecated`) ;
  transmission de `femininBonusEnabled` réel à `Step1Attributes`.
- `Step1Attributes.jsx` : tout le calcul mécanique (base FOR, `calcTotalCost`, cap G4) gate
  désormais sur `isFeminin && femininBonusEnabled` au lieu de `isFeminin` seul (4 points d'appel :
  `baseAttrs`, `handleSetFeminin`, `calcTotalCost` initial, `handleModPC`). Le `<select>` Sexe et
  le payload `onNext` ne changent pas — le choix reste toujours visible et toujours transmis.
  Tooltip de la ligne "Niveau de base" rendu conditionnel (mention de l'exception féminine
  seulement si l'option est active).
- Ajout demandé par Saar après implémentation : ligne d'explication dans l'accordéon "Règles de
  répartition" (`step1.ruleFemininBonus`, nouvelle clé `creation.json`), affichée uniquement si
  `femininBonusEnabled` est actif — décrit la mécanique (FOR 5, +2 COO/PRE cumulables, plafond 20)
  pour que l'option ne soit pas invisible côté joueur.

### Testé ✅ (confirmé par Saar)
- `node --check` sur les 3 fichiers serveur modifiés, `JSON.parse` sur `creation.json`, ESLint sur
  les 3 fichiers client modifiés (0 erreur introduite — 2 erreurs préexistantes hors diff :
  `poolBase` inutilisé `Step1Attributes.jsx`, `characterId` inutilisé `WizardCreation.jsx`,
  vérifiées via `git diff --stat`).
- Parcours Wizard confirmé fonctionnel par Saar (« all ok, testé et fonctionnel »).

### Non testé explicitement (détail des scénarios non confirmés un par un)
- Les 8 scénarios détaillés dans `docs/PLAN_SEXE.md` (option ON/OFF, override Sexe/Fécondité par
  mutation Step3, achat/retrait `adv_076`, blocage si mutation stérilisante, édition manuelle
  post-création) n'ont pas été vérifiés un par un individuellement — validation Saar donnée sur le
  parcours global, pas listée point par point.

### Dettes ouvertes
- `WizardReview.jsx` (écran récap Step6) n'affiche pas le Sexe/la Fécondité choisis — signalé comme
  hors scope dans `PLAN_SEXE.md`, amélioration possible à la demande.
- Cumul Androgyne + Asexué (deux mutations `mod_sex` sur le même personnage) non empêché — dernière
  mutation de la boucle gagne silencieusement, pas de contrainte d'exclusion mutuelle ajoutée.
- `char_mutation_effects_view` (migration 109) reste non lue par aucun code — dette préexistante,
  non traitée par ce plan (celui-ci écrit directement `char_archetype`, pattern différent).

Plan archivé : `docs/Old/PLAN_STEP4.md`.

---
## Session 138 — 2026-07-06 — Fix `cost_pc` « Organe sensoriel manquant » (migration 118) + présentation cartes Step3

> Signalement Saar : capture d'écran de la "TABLE DES MUTATIONS" (rulebook) montrant un gain de PC
> incorrect pour "Organe sensoriel manquant" dans le Wizard Step3. Avant tout plan, vérification
> exhaustive des 45 lignes `ref_mutations` contre `docs/Character/Creation/REGLE_CREATION.txt:812-898`
> (source de vérité) — demandée explicitement par Saar après un premier plan trop étroit (une seule
> mutation vérifiée au lieu de la table complète).

### Diagnostic
- `REGLE_CREATION.txt:834-850` vs `ref_mutations` en base : sous-types `smell`/`touch` à `cost_pc=0`
  (devrait être `1`), `hearing` à `1` (devrait être `2`), `sight` à `2` (devrait être `3`) — `taste`
  correct (`0`). Cause : décalage d'indexation dans le seed d'origine `95_seed_ref_mutations.js:130-143`.
- Vérification exhaustive des 45 lignes (01-06 à 96-00) : **44/45 correctes**, y compris la table
  sœur "Organe sensoriel supplémentaire ou amélioré" (0,1,1,2,2 — exacte).
- Incohérence distincte repérée en passant (non corrigée cette session, voir dette [MUT1]) :
  `Purulence` (`mutation_id` 30) stockée avec `cost_pc = -2` (`95_seed_ref_mutations.js:176`,
  intentionnel au seed d'origine), alors que `Difformités légères/importantes` — même colonne
  "Désavantage" de la rulebook — sont stockées en positif. `Step3Mutations.jsx:254` filtre
  `m.cost_pc >= 0`, ce qui pourrait exclure Purulence de la liste achetable en méthode libre.

### Bloc serveur
- `118_fix_ref_mutations_organe_sensoriel_manquant.js` **NOUVEAU** : `UPDATE` ciblé sur les 4 lignes
  concernées (`WHERE name='Organe sensoriel manquant' AND subtype=...`), `down()` symétrique restaure
  les valeurs bugguées d'origine (round-trip testable). Auto-appliquée par nodemon dès l'écriture du
  fichier (P53) ; vérifiée en base sans rappel manuel de `up()` (P54). Round-trip `down`/`up` testé
  via appel direct des fonctions du module — byte-identique aux deux états attendus.

### Bloc client
- `Step3Mutations.jsx` (méthode "achat", grille de cartes) : le titre était forcé sur une seule ligne
  avec troncature (`st.cardName` — `overflow:hidden`/`textOverflow:ellipsis`/`whiteSpace:nowrap`),
  illisible pour les noms longs (ex. "Organe sensoriel supplémentaire ou amélioré (Odorat)" → "...
  supplémentair..."). Le libellé de variante est sorti de la concaténation du titre vers une ligne
  dédiée sous l'en-tête (nouveau style `st.cardVariant`, même apparence que `st.rollSubtype` déjà
  utilisé côté tirage aléatoire — pattern réutilisé, pas inventé) ; troncature retirée de `st.cardName`
  (le nom peut désormais passer à la ligne). `st.cardHeader` : `alignItems` `center` → `flex-start`
  (alignement propre avec un titre sur 2 lignes). Effet de bord positif : la vue "tirage aléatoire"
  réutilise `st.cardName` et profite donc aussi de la fin de la troncature, sans modification
  supplémentaire de ce côté.

### Testé ✅
- Valeurs `cost_pc` en base conformes à `REGLE_CREATION.txt:834-850` après migration 118.
- Round-trip `down`/`up` migration 118 (appel direct des fonctions du module), byte-identique.
- ESLint sur `Step3Mutations.jsx` — 0 erreur.
- Confirmation fonctionnelle Saar (capture d'écran) : Odorat/Toucher −1 PC, Ouïe −2 PC, Vue −3 PC,
  Goût Gratuit ; titres non tronqués, variante affichée sur sa propre ligne.

### Non testé
- Achat effectif d'une des 4 mutations corrigées en conditions réelles (dépense PC, upsert
  `finalizeCreation`) — seul l'affichage (carte + coût) a été vérifié.

### Dette ajoutée
- **[MUT1]** `Purulence` (`mutation_id` 30) — `cost_pc = -2` en base, incohérent avec la convention
  positive utilisée par `Difformités légères/importantes` pour la même colonne "Désavantage" de la
  rulebook ; `Step3Mutations.jsx:254` (`m.cost_pc >= 0`) pourrait exclure Purulence de la liste
  achetable en méthode libre. Non diagnostiqué en profondeur (un seul bug à la fois) — à traiter dans
  un plan dédié.

---
## Session 139 — 2026-07-07 — Fiche personnage consultable en permanence pendant le Wizard ✅

> Plan complet rédigé en amont dans une conversation précédente : `docs/STE6_FINAL.md` (v3, révisé
> après 2 relectures critiques + 1 run à vide + 1 passe de recherche pro). Reprise en nouvelle
> session — protocole complet appliqué : tous les fichiers cités par le plan relus dans cette
> session avant tout codage (le plan lui-même l'exige explicitement, du code ayant pu bouger depuis
> son écriture — migration 118 notamment, vue non committée au moment de la rédaction du plan).

### Vérification de fraîcheur du plan (avant codage)
- Migration 118 confirmée dernière en date (`ls server/src/db/migrations/`) — **119** toujours
  disponible, hypothèse du plan tenue.
- `creationService.js`, `routes/creation.js`, `routes/characters.js`, `WizardCreation.jsx`,
  `WizardHeader.jsx`, migration `36_char_sheet.js` : relus intégralement, aucune dérive vs le plan.
- `CharacterWindow.jsx` : les lignes citées par le plan (§9) pour PARAMÈTRE étaient décalées de
  quelques lignes (écrites avant un déplacement mineur du code) — dropdown réassignation
  propriétaire en fait une ternaire `isGm ? <select> : <span>` (pas un simple `isGm &&`). Contenu et
  règle à appliquer identiques, seul le repérage ligne à ligne corrigé en codant.
- Le point "AdvantagesPanel — onglet FICHE" du plan (§9) ne correspond à aucune ligne de
  `CharacterWindow.jsx` : ce composant est monté dans `CharacterSheet.jsx:826`, qui reçoit déjà
  `canEdit` calculé depuis `isGm`/`isOwner` reçus en cascade — aucune ligne supplémentaire à toucher
  pour ce point, confirmé en lisant `CharacterSheet.jsx`.
- Vigilance §12 du plan (`SkillsPanel`/`AdvantagesPanel` respectent-ils `canEdit` ?) vérifiée :
  `AdvantagesPanel.jsx` gate bien ses boutons avec `canEdit &&` (L229/L243). `SkillsPanel.jsx` reçoit
  `canEdit` mais ne l'utilise jamais directement (maîtrise gatée par `isGm` seul, achat Mode
  Progression gaté par `progressionMode`/`xpAvailable` seuls) — sans risque : le bouton qui active
  `progressionMode` dans `CharacterSheet.jsx:510` est lui-même `disabled={!canEdit}`, donc
  `progressionMode` ne peut jamais passer à `true` tant que `canEdit` est `false` (état local, reset
  à chaque montage). Aucun changement nécessaire dans `SkillsPanel.jsx`.
- **Déviation trouvée en codant (plan corrigé)** : le plan §10 demandait
  `useCharacterStore.setCharacters([character])` pour peupler la fenêtre. En lisant
  `CharacterWindow.jsx`, ce composant ne lit **jamais** `characters` depuis ce store (seulement
  `members`, utilisé uniquement dans le dropdown GM — jamais affiché en `forceReadOnly` puisque
  `effectiveIsGm` est toujours `false`). Appeler `setCharacters` aurait été sans effet utile ET
  risqué : store **partagé** avec la session de jeu réelle (`SessionPage`) — aurait écrasé la vraie
  liste de personnages si l'onglet avait déjà une session chargée. Omis — `character` passé
  directement en prop suffit.

### Bloc serveur
- Migration `119_char_sheet_wizard_lock.js` **NOUVEAU** : `char_sheet.wizard_locked_at TIMESTAMPTZ`
  nullable. Sépare propriété "assistant" (rejouable) de propriété "runtime" (fiche éditable
  librement post-verrouillage).
- `creationService.js` : `finalizeCreation` → `reconcileCreation` (pattern reconciliation
  Kubernetes/Terraform — chaque bloc STEP1-5 conditionné à sa présence dans le payload, garde sur
  `wizard_locked_at` au lieu de `creation_state === 'complete'`). Reset avant réapplication :
  `is_fertile=false` (STEP3, avant del `char_mutations`), `char_skills`+`char_careers` (STEP4, avant
  résolution backgrounds/boucle carrières), `char_advantages`+ledger `pc_spent_step5`/
  `pc_gained_desavantages` (STEP5, avant boucle `addAdvantage`). Effets d'âge : `.increment` →
  `.update` absolu (`ageEffects[attr] ?? 0`) — rejouer avec un âge final différent recalcule au lieu
  de cumuler. `isComplete` calculé (`step1 && ... && step5`) → pose `visible=true`/
  `creation_state='complete'` seulement si vrai. +`lockWizard(sheetId)` (pose `wizard_locked_at`,
  exige `creation_state='complete'`). +`getCharacterPreview(characterId, isGm)` (mêmes colonnes que
  `characters.js` liste, sans `worst_wound_severity` — duplication assumée, cf. plan §8.3).
- `routes/creation.js` : `POST /:sheetId/finalize` (garde stricte 5 champs) → `POST
  /:sheetId/reconcile` (payload partiel autorisé) ; +`GET /:sheetId/preview` ; +`POST
  /:sheetId/lock`.
- `routes/characters.js` (liste `GET /`) : filtre brouillons → `whereNotExists` gate sur
  `char_sheet.wizard_locked_at IS NULL` (au lieu de `creation_state != 'complete'`). Invariant
  documenté en commentaire à cet endroit (voir plan §8.1) : `reconcileCreation` pose
  `visible=true` dès `isComplete`, indépendamment du verrou — ça ne fuit nulle part uniquement parce
  que ce filtre gate sur `wizard_locked_at`, pas sur `visible`/`creation_state`.

### Bloc client
- `CharacterWindow.jsx` : nouvelle prop `forceReadOnly` (défaut `false`). `effectiveIsOwner`/
  `effectiveIsGm` (`isOwner/isGm && !forceReadOnly`) remplacent `isOwner`/`isGm` dans tous les
  calculs de permission (nom, portrait, toggle visibilité, `CharacterSheet`/`ArmorWoundPanel`/
  `WeaponPanel`/`InventoryPanel`, dropdown propriétaire, upload GLB, suppression). Correctif trouvé
  en relisant le fichier en entier avant livraison (hors énumération du plan, mais même principe de
  lecture seule) : textarea "Notes MJ" n'avait aucun `readOnly` — ajouté `readOnly={!canEditDescription}`
  (label reste visible au vrai GM, seule l'édition est bloquée pendant le peek).
- `WizardCreation.jsx` : import `useAuthStore` (absent jusqu'ici, confirmé à la lecture) ; états
  `peekOpen`/`peekCharacter`/`peekIsGm`/`peekLoading` ; `openPeek()` (reconcile partiel → preview →
  ouverture, guard anti-double-clic `if (peekLoading) return`) ; `handleTerminate` remplace
  `handleFinalize` (reconcile complet + lock) ; rendu `<CharacterWindow forceReadOnly>` monté hors du
  switch d'étapes (persiste à travers la navigation) ; `canFinalize` supprimé (mort par construction
  — l'étape 6 n'est atteignable qu'après validation complète des 5 étapes).
- `WizardHeader.jsx` : +props `hasCharacter`/`onOpenPeek`/`peekLoading` — bouton "Voir ma fiche"
  visible en permanence dès l'étape 1, grisé tant que `step1Data` est `null`.
- `creation.json` : +clé `wizard.open_sheet`.
- Nettoyage en passant : `characterId` déstructuré sans usage dans `WizardCreation.jsx` (préexistant
  avant cette session, déjà signalé Session 137 — supprimé puisque le fichier était déjà réécrit ici).

### Testé ✅
- `node --check` sur les 4 fichiers serveur touchés (3 modifiés + migration 119 nouvelle).
- ESLint sur les 3 fichiers client touchés — 0 erreur (après nettoyage `characterId`).
- `JSON.parse` sur `creation.json`.
- Round-trip migration 119 (`down`/`up` via appel direct des fonctions du module, jamais la CLI —
  P52) : colonne supprimée puis recréée (`timestamptz` nullable), byte-identique à l'état
  auto-appliqué par nodemon (P53, vérifié dans `knex_migrations` avant le test — P54). 0 personnage
  `creation_state='complete'` en base au moment du test — aucun risque de régression sur le nouveau
  filtre `characters.js` (les personnages déjà complets, s'il y en avait eu, auraient eu
  `wizard_locked_at` NULL faute de backfill — vérifié non applicable ici, à surveiller si des
  personnages complets existent lors d'un futur déploiement).
- SR + parcours fonctionnel confirmé par Saar.

### Non testé explicitement
- Les 8 scénarios détaillés un par un dans `docs/STE6_FINAL.md` §15 (retour arrière avec
  réouvertures régulières, tentative d'édition bloquée constatée champ par champ, GM consultant la
  liste pendant qu'un joueur est dans le Wizard, etc.) — validation Saar donnée sur "SR et
  fonctionnel" globalement, pas listée point par point.

### Dette à surveiller (pas une dette active — condition non rencontrée cette session)
- Si un déploiement futur applique la migration 119 sur une base contenant déjà des personnages
  `creation_state='complete'` (aucun cas ici, vérifié), ils auraient `wizard_locked_at` NULL faute de
  backfill dans la migration — le nouveau filtre `characters.js` les masquerait de la liste jusqu'à
  un premier appel manuel à `lockWizard` (aucun point d'entrée actuel ne le fait pour un personnage
  déjà complet hors Wizard). Non traité car non applicable en l'état ; à surveiller si des données de
  ce type apparaissent.

---

## Session 139 (suite) — Redesign Step 4 Profession : cadrage rework + Lot 0

Conversation longue de **cadrage** (aucun code UI). Livrable durable : `docs/PLAN_REWORKFINAL.md`
(plan maître 8 lots, auto-suffisant). Source design : `docs/ClaudeDesign/project/Professions.dc.html`
(bundle Claude Design importé localement, le MCP DesignSync étant inaccessible en session
`CLAUDE_CODE_OAUTH_TOKEN` sans scopes design).

### Méthode retenue (validée Saar, après remise en cause)
« Architecture (contrats partagés) verrouillée globalement → implémentation incrémentale testée. »
Contrats figés dans `PLAN_REWORKFINAL §1bis` : (A) modèle de données de bout en bout — **une seule
migration sur tout le rework = `char_relations` (Lot 7)**, tout le reste réutilise l'existant ;
(B) payload `reconcile({step4})` cible, rempli par tranches (bascule skills per-career → **global** au
Lot 2). Décisions + modèle compétences + faits vérifiés : `§1ter`.

### Découvertes clés (code lu)
- `calcSkillCost` + `getMaxMasteryByYears` (`shared/polarisUtils.js`) = **code mort** — jamais
  consommés en prod. Lot 1 = 1er consommateur (courbe LdB déjà implémentée, à réutiliser, pas recréer).
- Modèle compétences = LdB `REGLE_CREATION.txt:1103-1128,1250-1263` : une compétence = un niveau
  (pas de doublon) ; coût courbe ×2 hors-profession ; plafond par années **cumulées** entre métiers ;
  pool skills GLOBAL = Σ(10×années) ; avantages pro 5×années PAR MÉTIER.
- `getStep4RefData` ne renvoie ni `refSkills` (dispo via route existante `/api/char-ref/skills`) ni
  `ref_career_education` (à ajouter Lot 1).
- Fiche perso `CharacterSheet` = SkillsPanel + AdvantagesPanel seulement → panneau carrières/relations
  à créer (Lot 7).

### Lot 0 — Fondation éligibilité ✅ CLOS
- `shared/careerEligibility.js` (NOUVEAU) : `evaluateCareerEligibility(career, context)` pur, renvoie
  des **raisons structurées** (codes+params, pas de texte FR) — prérequis/génotype/attributs/études.
- `creationService.js` : 4 fonctions `validateCareer*` + 4 appels → **1** `checkCareerEligibility`
  (fetch DB + noms prérésolus → évaluateur → `formatEligibilityReason(reasons[0])`). **Parité stricte**
  (ordre [prereq, genotype, attributes, education], early-return préservé, dettes AND/OR conservées).
- **Testé** : parité 12/12 en `node -e` inline (P53 respecté), `node --check`, SR + fonctionnel
  confirmé Saar (« métiers non proposés si prérequis manquants »). **Non testé** : —
- Bénéfice visible reporté au Lot 2 (filtre « Accessibles » réel côté client via le même évaluateur).

### Lot 1 — Fondation moteur de coût (invisible) ✅ CLOS
- `shared/careerSkills.js` (NOUVEAU) : `computeSkillAllocation(skillAllocations, ctx)` pur, réutilise
  `calcSkillCost`/`getMaxMasteryByYears` (`polarisUtils.js`, code mort jusqu'ici — 1er consommateur).
- **Correction de modèle trouvée en lisant la source avant de coder** (`REGLE_CREATION.txt:1103-1128,
  1250-1263`, demandée explicitement par Saar — « code seulement si sûr à 100% ») : le plafond
  `getMaxMasteryByYears(années cumulées, +2 études)` du §4/§1ter ne s'applique qu'aux compétences
  **professionnelles** (listées par ≥1 carrière retenue, ou par les études supérieures qui comptent
  pour +2 ans comme une profession). Une compétence d'**origine** (géo/social/formation) qui n'est PAS
  professionnelle a un plafond **fixe +5** (ligne 1122-1128), pas `getMaxMasteryByYears(0)=3` comme
  écrit initialement dans le plan. Coût ×2 « hors profession » : basé strictement sur l'appartenance à
  une carrière retenue — les études supérieures ne comptent que pour le plafond, jamais pour le coût.
- `creationService.js` — `getStep4RefData` (lignes 128-165 seulement) : ajout de `ref_career_education`
  au `Promise.all` + attaché par carrière (`career.education[]`), pattern identique aux autres
  collections imbriquées (`skills`/`titles`/`prerequisites`/`pointCategories`).
- **Ce qui n'a pas changé** : `reconcileCreation` (validation du budget skills = Q2, reportée au Lot 2
  avec l'UI qui la consomme), payload, schéma DB, UI. Zéro régression possible sur l'assistant actuel.
- **Testé** : `node --check` 0 erreur (shared/server hors périmètre ESLint) ; `calcSkillCost`/
  `getMaxMasteryByYears` vérifiés en isolation (pro vs hors-pro ×2, palier +5→+6, `(X)`, `PN`, bornes
  1/2/3-5/6-10/11-20/21+ — 2 hypothèses de test initiales erronées, corrigées, code existant confirmé
  correct et non modifié) ; `computeSkillAllocation` : cas nominal, cumul années sur compétence
  partagée (cap cumulé=7), `over_cap`, `over_budget`, plafond fixe +5 (compétence d'origine non-pro),
  plafond via études seules (+2 ans) — tout via `node -e` inline (P53, aucun fichier dans `server/`) ;
  `getStep4RefData` interrogé en base réelle (12/12 lignes `ref_career_education` correctement
  attachées par carrière) ; SR + « Test OK » confirmé Saar.
- **Non testé** : intégration UI (hors scope, prévue Lot 2).

### Lot 2 — UI : réécriture CareersAllocator + board global ✅ CLOS
- Re-détaillage au lancement : lecture du design source `Professions.dc.html` (logique complète, pas
  que le visuel) a tranché la contradiction signalée au plan — board **GLOBAL** confirmé (un seul
  compteur de points restants, pas « par métier »), avantages pro restant PAR MÉTIER (Lot 4).
- `CareersAllocator.jsx` réécrit entièrement : rail (filtre Accessibles via `evaluateCareerEligibility`
  Lot 0) + barre d'âge + détail (onglet Métier réel, Carrière/Avantages en coquilles) + **board global**
  de compétences (coût/plafond via `computeSkillAllocation` Lot 1) + pied de page. `useReducer`
  (`careersReducer`), zéro `style={}` visuel, classes `.wiz4-*` (`index.css` Section 12, après l.2058).
- **Contrat payload restructuré (§1bis Contract B)** : `skillAllocations` passe de per-career à
  **top-level global** dans le payload `step4` — `career_name`/`titles` restent en state client
  (affichage `Step4Summary`/`WizardReview` inchangé) mais sortent du payload réseau (le serveur relit
  `ref_careers`). `onAdd` simplifié à 4 args (retire `skillAllocations`).
- `creationService.js` — `reconcileCreation` STEP4 : la boucle par carrière n'upsert plus `char_skills`
  directement ; après la boucle, validation globale `computeSkillAllocation` (Q2, `ctx` construit
  depuis `ref_career_skills`/`ref_background_skills`/`ref_skills` lus en base) puis upsert absolu sur
  le payload global. Rejet `AppError(400)` si budget ou plafond dépassé.
- **2 bugs trouvés et corrigés en test navigateur (même mécanisme, 2 manifestations)**, aucun des deux
  couvert par les tests unitaires du Lot 1 (fixtures synthétiques sans compétence `(X)` réelle) :
  1. **`-Infinity` (1er signalement)** : `ref_background_skills` contient de vraies compétences `(X)`
     avec un bonus d'origine positif (45 lignes vérifiées en base, ex. `ELECTRONIQUE`,
     `LANGUE_ETRANGERE_NEO_AZURAN`). `calcSkillCost` bloque (`Infinity`) toute compétence `(X)` si
     `!isLearned && target>0`, or `isLearned` ne dépendait que d'`openedSkills` (Lot 5, jamais câblé).
     Cause secondaire : `CareersAllocator.jsx` passait **toutes** les compétences du board (touchées ou
     non) à `computeSkillAllocation` au lieu des seules compétences cliquées par le joueur (conception
     Lot 1 d'origine). Fix : (a) `isLearned` inclut `(baseMastery[skillId] ?? 0) > 0` ; (b) le board
     n'envoie plus que `state.skillAllocations` (compétences réellement touchées) ; le plafond par
     ligne (touchée ou non) vient d'un nouvel export `getSkillCap(skillId, ctx)` (factorisé, DRY).
  2. **`-Infinity` (2e signalement, cause incomplète après le 1er fix)** : compétence `(X)`
     professionnelle (listée par une carrière retenue) mais **sans** bonus d'origine (Origine=0) —
     toujours bloquée par le 1er fix. Lecture complémentaire de `REGLE_CREATION.txt:1129-1132`
     (« Note sur les Compétences spéciales ») : une compétence spéciale/réservée est accessible **dès
     qu'elle est indiquée dans la description d'une des Professions du personnage** — pas besoin d'un
     bonus d'origine. Fix : `isLearned = isPro || openedSkills.includes(...) || (baseMastery>0)`. Le
     malus « base -3 » du premier point investi (ligne 1115) reste appliqué normalement (règle de coût,
     pas un blocage) : premier achat d'une `(X)` professionnelle sans origine = 1pt (ouverture -3) +
     N pts (climb -3→cible), jamais 0 ni Infinity.
- **Réponse à une question rulebook posée par Saar en cours de route** : le bonus « Études supérieures »
  +2 ans (cap uniquement) ne s'applique jamais universellement, seulement aux compétences listées par
  le cursus É.Sup. — confirmé conforme à l'implémentation existante, aucun changement nécessaire.
- **Testé** : ESLint client 0 erreur (`CareersAllocator.jsx`), `node --check` (`creationService.js`,
  `careerSkills.js`), JSON valide (`creation.json`), `getStep4RefData`/`ref_career_education` déjà
  vérifiés en base (Lot 1). Reproduction exacte des 2 bugs en `node -e` inline avant/après fix
  (`-Infinity` → coût fini correct dans les deux cas), régression complète des 9 scénarios Lot 1 (aucun
  cassé par les 2 fixes). SR + parcours fonctionnel confirmé Saar (filtre par défaut à corriger en
  Accessibles — voir dette [CAR-DEF] ; sélection/ajout carrières ; board avec compétence `(X)`
  professionnelle et non-professionnelle, plafonds 5/10/13 conformes à la table par années).
- **Non testé** : retrait d'une carrière (recalcul budget/purge allocations orphelines), parcours
  complet jusqu'à finalisation + vérification `char_skills.mastery` en base, onglets Carrière/Avantages
  (coquilles, Lot 3/4).
- `Step4Experience.jsx` — hors du bug : nouveau state `skillAllocations` (remonté via callback
  stabilisé `useCallback`), fetch `/char-ref/skills`, props `baseAge`/`attributes`/`genotypeId`/
  `higherEd`/`refSkills`/`initialSkillAllocations`/`onSkillAllocationsChange` vers `CareersAllocator`.
- **Dette préexistante repérée, non corrigée (hors scope)** : `Step4Experience.jsx:82` `remainingPC`
  déclarée mais jamais utilisée (ESLint) — confirmé via `git show HEAD` antérieur à ce lot, ligne jamais
  touchée par mes modifications.

### Lot 3 — Onglet « Carrière & économies » (lecture seule) ✅ CLOS

**Objectif** : table de progression (années/titre/salaire) + encadré économies cumulées pour le métier
consulté, plus la tuile « Économies de départ » de la barre d'âge (placeholder `—` depuis le Lot 2).
Aucune migration, aucun changement serveur — `getStep4RefData` fournissait déjà `career.titles[]`
(`min_years`/`max_years`/`title`/`salary_per_year`/`salary_formula`).

**Point de conception clé** : le serveur (`creationService.js` `reconcileCreation` STEP4, l.365-374)
calcule déjà les économies persistées ainsi : `salaire(titre courant pour `years`) × years` — pas une
accumulation par palier traversé. Le Lot 3 **reproduit exactement cette formule côté client**, en
lecture seule, sans jamais appeler `Math.random()` (aucun tirage hors DicePanel/Lot 6). Pour les
titres à `salary_formula` (ex. `1D6*100`), ajout de `estimateSalaryFormula()` (moyenne déterministe,
`shared/polarisUtils.js`, regex `SALARY_FORMULA_RE` extraite et partagée avec `evaluateSalaryFormula`
sans changer son comportement aléatoire existant) — marqué `*` avec une note explicite, le montant réel
restant déterminé par le serveur à la validation (comportement déjà existant, inchangé).

**Fichiers touchés** :
- `shared/polarisUtils.js` : `estimateSalaryFormula(formula)` (nouveau, pur, déterministe).
- `client/src/components/creation/CareersAllocator.jsx` : helper `salaryPerYear(title)` (fixe vs
  estimé) ; `useMemo` `savingsInfo` (Σ sur les métiers retenus, `salaire × années` par métier, comme le
  serveur) → tuile agebar « Économies de départ ». Onglet « Carrière & économies » (placeholder « à
  venir » depuis Lot 2) remplacé par la table `.wiz4-prog` (titres triés par `min_years`, ligne
  courante `.cur` selon `displayYears`, déjà calculé Lot 2) + encadré `.wiz4-ecobox` (économies pour
  la durée engagée du métier consulté, note fixe/aléatoire).
- `client/src/index.css` : blocs `.wiz4-prog` / `.wiz4-ecobox` (Section 12, même famille visuelle que
  `.wiz4-skill.hl` / `.wiz4-geo`).
- `client/src/locales/creation.json` : `career_prog_years/title/savings`, `career_eco_cumul`,
  `career_eco_note_random/fixed`.

**Vérification en base (demande Saar, avant validation)** : test réel avec 3 ans Chasseur de primes +
2 ans Cultivateur/Éleveur → 3500 sols affichés. Vérifié en base (`ref_career_titles`) : `chasseur_primes`
palier 1-6 ans = 500¤/an, `cultivateur_eleveur` palier 2-9 ans = 1000¤/an → 3×500 + 2×1000 = 3500,
conforme. Le « 100¤/an » mentionné par Saar dans son observation correspondait au **rail de gauche**
(aperçu carrière toujours calculé à 1 an, comportement Lot 2 préexistant — `cultivateur_eleveur` palier
1 an = 100¤/an), pas au taux réellement utilisé pour 2 années investies — aucun bug.

**Testé** : `node --check`, ESLint 0 erreur, `estimateSalaryFormula` testé en isolation (`1D6*100`→350,
`2D10*50`→550, entrées invalides→0), non-régression `evaluateSalaryFormula` (2000 tirages, bornes
100-600 intactes après extraction de la regex partagée), vérification base réelle du scénario Saar
(3500 sols conforme), SR + fonctionnel confirmé Saar.
**Non testé** : les 8 scénarios détaillés un par un (validation donnée globalement par Saar, « ook »).

### Bugfix — Filtre carrières par défaut « Tous » → « Accessibles » ✅ CLOS

Dette [CAR-DEF] repérée lors des tests Lot 2 (voir ci-dessus), signalée par Saar comme source
d'erreurs (un joueur peut sélectionner un métier non éligible par défaut). Fix d'une ligne :
`CareersAllocator.jsx` `initialReducerState` — `filter: 'all'` → `filter: 'eligible'`. Rien d'autre
changé (le segment « Tous » reste disponible au clic).
**Testé** : ESLint 0 erreur.
**Non testé** : confirmation visuelle navigateur (segment « Accessibles » actif à l'arrivée sur l'écran).

### Migration 120 — Fix `ref_career_point_categories` manquantes (4 carrières Lot 1) ✅ CLOS

Trouvé en préparant le Lot 4 (lecture obligatoire avant tout plan) : `artisan_artiste`, `assassin`,
`barman`, `contrebandier` (4 des 5 carrières du Lot 1, migration `100_seed_ref_careers.js`) ont **0
ligne** dans `ref_career_point_categories`, alors que `REGLE_PROFESSION.md` liste explicitement leurs
catégories d'avantages pro — même angle mort que la migration 106 (`ref_career_skills`), jamais corrigé
pour cette table-là. `chasseur_primes` (5ᵉ carrière du lot) a bien **0 ligne légitimement** : absent de
la LdB p.156 (confirmé par un commentaire explicite dans le fichier de référence pré-migration
`docs/Character/Creation/migrations/93_seed_ref_careers_lot1.cjs`, qui contenait déjà les inserts
corrects pour les 4 autres — jamais transcrits dans la vraie migration).

**Vérification exhaustive demandée par Saar** avant de coder : les 30 sections restantes de
`REGLE_PROFESSION.md` (32 lignes DB en comptant les carrières à variantes multiples — officier
naval/militaire, pilote de chasse, soldat d'élite) alignées précisément via les en-têtes `#---` de
chaque profession (pas par déduction de contenu) contre les données DB réelles. **30/30 conformes**,
deux normalisations cosmétiques sans impact (rulebook "Relation" singulier → DB "Relations" pluriel ;
parenthèses explicatives du rulebook non reprises dans le libellé de catégorie, ex. "Matériel (inclus
du matériel militaire)" → "Matériel"). Bug confirmé isolé aux 4 carrières identifiées.

`server/src/db/migrations/120_fix_ref_career_point_categories_lot1.js` (NOUVEAU) : insère les 26
lignes manquantes (5+7+5+9), valeurs croisées rulebook + fichier de référence. `down()` symétrique
(`DELETE ... WHERE career_id IN (...)`).

**Incident mineur (sans conséquence)** : nodemon a auto-appliqué la migration (P53) entre l'écriture
du fichier et le test manuel prévu — le premier appel direct à `up()` a levé une violation de
contrainte unique (données déjà insérées par le vrai runner, bookkeeping `knex_migrations` correcte,
batch 86). Contrairement au piège P54 (mojibake Session 135), ici la contrainte unique a **empêché**
toute corruption — juste un échec propre, aucune donnée touchée. Round-trip `down`/`up` refait ensuite
en toute sécurité (bookkeeping déjà correcte, pas de second `up()` sur données saines).

**Testé** : `node --check` 0 erreur, application réelle confirmée (151 lignes totales, bookkeeping
`knex_migrations` batch 86), round-trip `down`/`up` byte-identique (125 → 151 → 125 → 151, contenu
vérifié pour les 4 carrières), `getStep4RefData` vérifié en base réelle (26 lignes remontées côté
`artisan_artiste`).
**Non testé** : aucun consommateur UI à ce stade (c'est l'objet du Lot 4, ci-dessous).

### Lot 4 — Avantages pro (5 pts/an par métier) ✅ CLOS

**Modèle (`REGLE_CREATION.txt:1151-1159`, jamais lu avant ce lot)** : 5 pts/an à répartir librement
dans les catégories du métier — confirme Q3 déjà verrouillé (`§1ter`), budget **par métier**
(≠ compétences qui sont globales). Pas de plafond par catégorie (contrairement aux compétences).
Deux mécaniques annexes explicitement **hors scope** (déjà cadrées ailleurs ou non câblées) : tirage
aléatoire optionnel remplaçant les 5 pts classiques (Lot 6, `random_picks`) ; table des Revers p.185
(+5 pts, aucune table/colonne dédiée trouvée — dette notée, non bloquante).

**Fichiers touchés** :
- `shared/careerAdvantages.js` (NOUVEAU) : `computeProAdvantageAllocation(allocations, ctx)`, pattern
  identique à `careerSkills.js` (fonction pure, réutilisée client+serveur). **Cas limite trouvé en
  relecture avant livraison** (règle 5) : un métier à 0 catégorie (`chasseur_primes`) calculait quand
  même un budget `5×années` invendable — bloquait "Suivant" indéfiniment pour ce métier. Fix dans le
  helper : `budget = categories.length === 0 ? 0 : 5×years`.
- `server/src/services/creationService.js` : `reconcileCreation` STEP4, dans la boucle carrières
  (avant l'insert `char_careers`) — fetch `ref_career_point_categories` + validation par métier (Q3),
  `AppError` si `over_budget`/`invalid_category`/`invalid_points`.
- `client/src/components/creation/CareersAllocator.jsx` : reducer étendu (`proAdvAllocations`,
  actions `SET_ADV_POINTS`/`PRUNE_ADV`), onglet "Avantages pro" (placeholder "à venir" du Lot 2)
  remplacé — verrouillé si métier non retenu, "aucun avantage" si 0 catégorie, sinon steppers +
  compteur restant. **Zéro nouvelle classe CSS** (réutilise `.wiz4-skill`/`.wiz4-ctl`/`.wiz4-sbtn`/
  `.wiz4-boardhead`/`.wiz4-poolrem` du board compétences). Gating "Suivant" étendu : tous les métiers
  retenus doivent avoir leur pool d'avantages entièrement réparti.
- `client/src/components/creation/Step4Experience.jsx` : state `proAdvantages` (map career_id→
  {catégorie:pts}), remonté depuis `CareersAllocator`, injecté dans `careerEntries[i].proAdvantages`
  du payload (Contract B `§1bis`, déjà prévu). Purge automatique au retrait de carrière (effect
  `PRUNE_ADV` côté `CareersAllocator`, aucune logique supplémentaire nécessaire côté parent).
- `client/src/locales/creation.json` : `career_adv_title/locked/none`, `career_status_adv_left`.

**Testé** : `node --check`/ESLint 0 erreur (1 erreur ESLint pré-existante non liée sur
`Step4Experience.jsx:84` `remainingPC`, confirmée via `git diff --stat` = 5 insertions seulement),
6 scénarios unitaires isolés sur `computeProAdvantageAllocation` (nominal vide/rempli, `over_budget`,
`invalid_category`, `invalid_points`, cas 0-catégorie), `getStep4RefData` vérifié en base réelle avec
un vrai `sheetId`, simulation de la validation serveur Q3 (rejet correct sur les 2 cas), JSON valide,
SR + fonctionnel confirmé Saar.
**Non testé** : persistance `char_careers.pro_advantages` vérifiée en base après un `reconcileCreation`
réel complet (le scénario navigateur a validé le flux UI + gating, pas une lecture SQL post-finalize).

### Lot 5 — Compétences « au choix » (`conditional`, migration 121) ✅ CLOS

Audit exhaustif fait en amont (`PLAN_REWORKFINAL §7`, 44 lignes `conditional=true` croisées ligne à
ligne avec `REGLE_PROFESSION.md`, 6 phénomènes distincts identifiés sous le flag booléen unique).
**Avant tout codage (demande explicite Saar « code seulement si sûr à 100% »)** : re-vérification
complète de la source primaire (pas seulement du plan déjà écrit) — lecture directe de
`REGLE_PROFESSION.md` sur les cas les plus ambigus (marqueur « (au choix) » présent/absent : Officier
militaire "Techniques spéciales", Soldat/Milicien vs Soldat d'élite "Armes spéciales", Barman "ou"
sans marqueur, Diplomate/Espion doublons, familles Médecin/Scientifique/Érudit/Technicien) + requêtes
SQL read-only en base réelle (44 lignes, `ref_skills.parent`/`is_category`, absence de collision avec
des compétences déjà existantes). **Aucun écart trouvé** entre le plan verrouillé et la réalité
code+base — tous les cas cités (y compris l'anomalie Soldat d'élite, confirmée mot pour mot absente du
marqueur contrairement à Soldat/Milicien) confirmés avant d'écrire une ligne de code.

**Fichiers touchés** :
- `server/src/db/migrations/121_ref_career_skills_choice_groups.js` (NOUVEAU) : colonne
  `ref_career_skills.choice_group` + 24 lignes T3 (catégorie/enfant-proxy) réécrites en vrais enfants
  `ref_skills.parent` avec `choice_group` partagé (scopé par `career_id`, aucune collision malgré des
  noms de groupe réutilisés entre métiers) + 4 doublons inertes supprimés (Diplomate ×3, Espion ×1) +
  4 lignes Soldat d'élite repassées `conditional=false` (flag erroné, texte source sans marqueur).
  `down()` symétrique. **Round-trip `down`/`up` testé en base réelle** (nodemon avait déjà
  auto-appliqué `up()` avant le test manuel, P53) : `down()` → 44/44 lignes restaurées à l'identique
  (vérifié Diplomate 4 lignes, Chasseur de primes 1 ligne) → `up()` ré-appliqué → état final
  re-vérifié (Diplomate 1 ligne `conditional=false`, Soldat d'élite ×4 `conditional=false`, Chasseur
  de primes 3 lignes `arts_martiaux_choice`, Technicien fusion 3 lignes `sciences_choice`).
- `shared/careerSkills.js` : nouvelle fonction pure `validateChoiceGroups(openedSkillIds,
  careerSkillRows)` — exclusivité par `choice_group` (ignore les lignes T1 sans groupe). Testée en
  isolation (`node -e`) : conflit détecté, solo indépendant, un choix par groupe OK, entrées
  vides/undefined. Non-régression `computeSkillAllocation` reconfirmée.
- `server/src/services/creationService.js` : `reconcileCreation` STEP4 — `validateChoiceGroups` appelé
  par métier avant construction du contexte de coût ; les compétences `conditional=true` dont le
  `skill_id` est dans `step4.openedSkills` rejoignent désormais `careersCtx[].skills` (déjà
  utilisé par `computeSkillAllocation` pour `isPro`/plafond). Le champ payload `openedSkills` existait
  déjà côté serveur/moteur de coût depuis le Lot 2 (jamais envoyé par le client avant ce lot — trou
  comblé, pas un nouveau champ inventé, cf. `PLAN_REWORKFINAL §7.3`).
- `client/src/components/creation/Step4Experience.jsx` : state `openedSkills` + `buildPayload()` +
  props `initialOpenedSkills`/`onOpenedSkillsChange` vers `CareersAllocator`.
- `client/src/components/creation/CareersAllocator.jsx` : reducer étendu (`state.openedSkills`,
  actions `TOGGLE_OPENED_SKILL` solo / `SELECT_CHOICE_GROUP_SKILL` radio exclusif, purge
  `PRUNE_OPENED_SKILLS` au retrait de carrière) ; `boardSkillIds`/`skillAllocationCtx` incluent les
  compétences conditionnelles ouvertes. **Trouvé et corrigé en relecture avant livraison (règle 5)** :
  `provenanceFor` (tag coloré de la carrière d'origine sur le board) ne couvrait que les compétences
  non-conditionnelles — une compétence "au choix" fraîchement ouverte apparaissait sur le board sans
  aucun tag de provenance. Corrigé en même temps que le fix. Nouveau bloc UI "Compétences au choix"
  dans l'onglet Métier (checkbox indépendante pour les 10 lignes T1, radio exclusif par `choice_group`
  pour les 24 lignes T3), verrouillé tant que le métier consulté n'est pas retenu (même UX que
  l'onglet Avantages pro).
- `client/src/index.css` : classes `.wiz4-choice`/`.wiz4-choicegrp`/`.wiz4-choicelbl`/`.wiz4-choiceopt`.
- `client/src/locales/creation.json` : `career_choice_title/locked/solo_label/group_label` ; suppression
  de `career_conditional` (devenue morte, l'ancien suffixe texte "(au choix)" est remplacé par les
  contrôles interactifs).

**Testé** : migration round-trip `down`/`up` en base réelle (byte-identique), `validateChoiceGroups`
(6 scénarios isolés `node -e`), non-régression `computeSkillAllocation`, `node --check`/ESLint 0 erreur
introduite (1 erreur pré-existante non liée sur `Step4Experience.jsx` confirmée via `git stash`), SR
(`/api/health` 200), parcours navigateur confirmé fonctionnel par Saar ("All ok").
**Non testé** : vérification directe `char_skills.is_learned` en base après un `reconcileCreation` réel
avec un choix "au choix" sélectionné (le scénario navigateur a validé le flux UI, pas une lecture SQL
post-finalize).

### Nettoyage UI — icône hexagonale du rail carrières retirée

Demande Saar post-Lot 5 : les hexagones d'initiale devant chaque ligne de la liste de métiers (rail de
gauche) alourdissaient l'affichage sans apporter d'information (juste la 1ʳᵉ lettre du nom, déjà lisible
juste à côté). `<span className="wiz4-hex">` retiré de `CareersAllocator.jsx` (avec le style inline
`--hex` associé, devenu inutile), règle CSS `.wiz4-hex` supprimée (morte). `careerHexColor()` conservé
(toujours utilisé par les tags de provenance colorés du board). `.wiz4-cols` : colonne de rail réduite
de `296px` à `246px` (largeur libérée par l'icône : 40px + 10px de gap).
**Testé** : ESLint 0 erreur.
**Non testé** : confirmation visuelle navigateur.

### Prochain — Lot 6 (Tirage 1D10 via DicePanel)
Voir `PLAN_REWORKFINAL §8`.

---
## Session 139 (suite 5) — 2026-07-08 — Wizard Step1 : Description physique + Main directrice (2D10) ✅ CLOS

Hors chantier Redesign Step4 (item séparé, comme la fenêtre "peek" de Session 139). Demande Saar :
ajouter à l'Étape 1 du Wizard les champs de la "première section" de la fiche personnage (taille,
poids, peau, etc.), en référence au Bloc 2 "Description" de `CharacterSheet.jsx`.

**Lecture confirmée avant plan** : le schéma DB (`char_identity`, migration 36) possédait déjà toutes
les colonnes nécessaires (`height`/`weight`/`skin`/`eyes`/`hair`/`build`/`distinctive_signs`/
`hand_pref`) — **aucune migration requise**. `reconcileCreation` STEP1 (`creationService.js`)
n'écrivait jusqu'ici que `char_name`/`player_name` dans `char_identity` ; les 8 champs physiques
n'avaient jamais été câblés côté Wizard.

**Main directrice** : Saar a proposé un bouton "Définir" tirant 2D10 sur le champ (règle LdB
`REGLE_CREATION.txt:1301-1311` : 2-15 Droitier, 16-19 Gaucher, 20 Ambidextre), en demandant
explicitement si l'idée relevait du bricolage architectural. Vérifié : le pattern de tirage aléatoire
100% client (`Math.random`, aucun aller-retour serveur) existe déjà dans `Step3Mutations.jsx`
(`handleRoll`, D20/D100) — même architecture reprise à l'identique, ce n'est pas un contournement.

**Vérification supplémentaire avant codage** (demande Saar "sûr à 100%") : `REGLE_CREATION.txt:
1317-1324` confirme que la section "Description physique" (taille/poids/peau/etc.) est purement
narrative, sans contrainte mécanique ("Servez-vous des Attributs pour avoir une idée du physique...").
Champs conçus **optionnels et non bloquants** pour "Suivant" — seule la Main directrice a une vraie
mécanique de dé.

**Fichiers touchés** :
- `client/src/components/creation/Step1Attributes.jsx` : nouveau bloc "Description physique" (taille,
  poids, peau, corpulence, yeux, cheveux, signes particuliers, main directrice) entre le tableau
  Attributs et le bloc PC. `handleRollHandPref` (2D10 client, mapping table LdB). Payload `onNext`
  étendu avec les 8 nouveaux champs.
- `server/src/services/creationService.js` : `reconcileCreation` STEP1 — destructure les 8 nouveaux
  champs, garde serveur `hand_pref ∈ {R,L,A}` si fourni, étend l'insert/merge `char_identity`
  (pattern idempotent inchangé, déjà utilisé pour `char_name`/`player_name`).
- `client/src/locales/creation.json` : 15 nouvelles clés sous `step1` (titre section + 8 libellés +
  4 options main directrice + placeholder + bouton "Définir").
- `client/src/index.css` : 6 nouvelles classes `.wiz1-desc-*` (grille 6 colonnes + input transparent),
  calquées sur `.wiz1-name-input`/`.wiz1-pc-btn` existants — aucun nouveau pattern visuel inventé.

**Bug préexistant découvert en vérifiant la consommation de `hand_pref` côté combat** (non corrigé,
hors scope de cette tâche — voir dette **HP1**) : `socketCombatHelpers.js:550` (priorité slot arme en
défense CaC) et `char-sheet.js:810` (route inventaire) lisent tous les deux `sheetCible.hand_pref` /
`sheet.hand_pref` sur des lignes issues de la table `char_sheet` — qui n'a **jamais eu** de colonne
`hand_pref` (seule `char_identity.hand_pref` existe, migration 36). `(undefined ?? 'R')` retombe
donc toujours sur `'R'` : la mécanique Main directrice n'a probablement jamais été réellement
appliquée en combat, quel que soit le choix du joueur. Trouvé par lecture directe du code (les deux
call sites + la définition de table), **non instrumenté/observé en exécution** — reste `[HYPOTHÈSE]`
au sens strict du protocole, mais la colonne est absente sans ambiguïté possible.

**Testé** : `JSON.parse` OK (`creation.json`), `node --check` OK (`creationService.js`), ESLint 0
erreur introduite (1 erreur pré-existante `poolBase` non liée, confirmée via `git diff --stat` — 0
ligne touchée), SR + parcours fonctionnel confirmé par Saar.
**Non testé** : les 8 scénarios détaillés un par un (validation donnée globalement "SR et
fonctionnel"), vérification directe des colonnes `char_identity` en base après un `reconcileCreation`
réel, distribution statistique du tirage 2D10 sur un grand nombre d'essais, et bien sûr la dette HP1
ci-dessus (nécessiterait son propre bug fix + scénario de test, hors scope ici).

## Session 140 — 2026-07-08 — Lot 6 (Tirage 1D10) + fix dieType DICE_RESULT + D20 réel Step3 ✅ CLOS

**Redesign Step 4 Profession — Lot 6 (dernier lot du chantier `PLAN_REWORKFINAL.md`) : Tirage 1D10
via le vrai système de dés (jamais `Math.random`).**

**Reprise en nouvelle session** : protocole complet appliqué — tous les fichiers cités par le plan
§8 (déjà rédigé lors d'une session antérieure) relus dans cette session avant tout code :
`DiceRoller.jsx`, `DiceMesh.jsx`, `diceMath.js`, `SocketContext.jsx`, `socket/index.js`,
`socketDice.js`, `Canvas3D.jsx`, `CareersAllocator.jsx`, `Step4Experience.jsx`,
`WizardCreation.jsx`, `creationService.js`, `careerAdvantages.js`, `REGLE_PROFESSION.md`,
`shared/events.js` + requêtes réelles (`ref_career_random_benefits`, `knex_migrations`). Le plan
s'est révélé exact sur l'architecture, avec 2 écarts mineurs (référence de fichier `SessionPage.jsx`
→ en réalité `Canvas3D.jsx` ; comptage "22/22" lignes `roll=10` → en réalité 32/32, encore plus
solidement vérifié).

**Enquête approfondie sur Chasseur de primes (demandée explicitement par Saar, pas de questionnaire
simpliste)** : le plan initial prévoyait de masquer le bloc 1D10 pour tout métier sans
`ref_career_point_categories`. Saar a fourni un extrait qu'il pensait être la page Chasseur de primes
du Livre de Base, contenant une ligne "Avantages professionnels (5 points/an) : Célébrité, Relations,
Matériel" absente de notre base. Vérification croisée : ce texte s'est avéré être **mot pour mot
identique** à la carrière Mercenaire déjà seedée (`REGLE_PROFESSION.md:1015-1026`) — confirmé par
Saar comme un artefact de mise en page du livre source (bavure entre deux pages/colonnes lors d'une
lecture/copie), pas une donnée réelle de Chasseur de primes. Conclusion : le constat initial (0
catégorie légitime pour ce métier, migration 120) reste valide, aucune correction BDD nécessaire —
mais le design du Lot 6 a été affiné pour dissocier "jet 1D10 disponible" (toujours vrai si
`randomBenefits` existe) de "bascule convertir en points" (vrai seulement si `pointCategories.length
> 0`), pour respecter le cas Chasseur de primes qui a bien sa table de tirage imprimée dans la LdB
malgré l'absence de budget automatique.

**Fichiers touchés (Lot 6)** :
- `server/src/db/migrations/122_ref_career_random_benefits_lot1_and_points_alt.js` (NOUVEAU) :
  colonne `points_alt` + backfill des 37 lignes `roll=10` déjà seedées (`points_alt=7`, texte
  identique vérifié 37/37) + insert des 50 lignes manquantes (5 carrières du Lot 1 × 10, texte repris
  de `docs/Character/Creation/migrations/93_seed_ref_careers_lot1.cjs`, cross-vérifié mot pour mot
  contre `REGLE_PROFESSION.md`). Round-trip `down`/`up` testé en base réelle, byte-identique
  (320↔370 lignes). 122 migrations stables.
- `shared/careerAdvantages.js` : `computeRandomBudgetDelta(picks, benefitRows)` (nouveau, fonction
  pure) + `computeProAdvantageAllocation` gagne `ctx.randomBudgetDelta` (défaut 0, rétro-compatible) —
  `budget = categories.length===0 ? 0 : 5×years + randomBudgetDelta` : le delta est naturellement
  neutralisé pour Chasseur de primes sans code spécifique supplémentaire.
- `server/src/services/creationService.js` : `getStep4RefData` fetch `randomBenefits` par carrière
  (pattern `pointCategories`) ; `reconcileCreation` STEP4 valide `career.randomPicks` (bornes
  `blockIndex`, pas de doublon, `roll` existant pour la carrière, `useAsPoints` seulement si
  `points_alt` non nul) puis injecte le delta dans Q3 avant validation du budget.
- `client/src/components/creation/WizardCreation.jsx` : `wiz-shell` enveloppé dans
  `<SocketProvider campaignId={campaignId}>` — le Wizard n'avait jusqu'ici aucune connexion socket.
- `client/src/components/creation/CareersAllocator.jsx` : reducer étendu (`randomPicks`,
  `awaitingRandomRoll` + 5 actions), nouveau bloc UI dans l'onglet Avantages pro — affiché dès
  `isAdded && randomBenefits.length>0` (indépendamment de `pointCategories`), bascule "convertir en
  points" gatée séparément. Overlay `<Canvas><DiceLights/><DiceRoller/></Canvas>` piloté par
  `socket.emit(WS.DICE_ROLL,{formula:'1d10'})` / écoute `DICE_RESULT` filtrée `userId`. Garde
  anti-course (`awaitingRandomRoll`, un seul jet en vol, careerId/blockIndex capturés au clic).
- `client/src/index.css` : 7 nouvelles classes `.wiz4-random*`/`.wiz4-diceoverlay`.
- `client/src/locales/creation.json` : 7 nouvelles clés `step4.career_random_*`.

**Bug trouvé et corrigé après premier test navigateur — "Lancer 1D10" affichait un D6"** : Saar a
soupçonné à raison que je n'avais pas correctement réutilisé le système de dés existant. Cause
tracée jusqu'au bout du pipeline : `server/src/socket/socketDice.js:20-55` calcule `dieType` via
`parseDice()` mais **ne l'a jamais inclus dans le payload `DICE_RESULT` émis au client** (utilisé
uniquement en interne pour le lookup `dice_config`). Le système existant fonctionne dans
`SessionPage` uniquement parce que `client/src/lib/useSessionSocket.js:62` **reconstruit `dieType`
côté client depuis le texte de la formule** avant de le passer à `DiceRoller` — étape que je n'avais
pas identifiée en lisant seulement le commentaire (trompeur) de `DiceRoller.jsx` ("payload: {rolls,
dieType, seed, timestamp} depuis DICE_RESULT"). Résultat : `dieType=undefined` →
`GLB_PATHS[undefined]` non trouvé → `DiceMeshProcedural` retombe sur `DIE_GEOMETRY['d6']`
(fallback explicite `diceMath.js:27`) → un D6 s'affichait quel que soit le dé réellement lancé.
**Fix** : `dieType` forcé en dur (`'d10'` dans `CareersAllocator.jsx`, `'d20'` dans
`Step3Mutations.jsx` ci-dessous) au moment de la réception du payload — ces points d'appel ne
lancent jamais qu'une seule formule fixe, ce n'est pas une supposition. **Voir P56.**

**Bonus demandé par Saar dans la foulée — Step3Mutations.jsx, tirage D20 réel** : le bouton "Lancer
1D20" (méthode Tirage aléatoire) utilisait `Math.random()` (accepté Session 136, explicitement écarté
du Lot 6 initialement). Même mécanique que ci-dessus appliquée : `handleRoll` scindé en
`finalizeRoll(d20)` (logique count/D100 inchangée) + `handleStartRoll`/`handleDiceOverlayDone`
pilotés par socket réel. Les tirages D100 par mutation (`rollOneMutation`) restent en `Math.random()`
(hors demande). `client/src/components/DiceLights.jsx` (NOUVEAU) : rig lumière extrait en composant
partagé (2 consommateurs réels désormais — `CareersAllocator.jsx` + `Step3Mutations.jsx` — plus de
raison de dupliquer une 3ᵉ fois ; `Canvas3D.jsx` toujours à zéro modification). Nouvelle clé i18n
`step3.roll_d20_rolling`.

**Testé** : migration 122 round-trip byte-identique, `computeRandomBudgetDelta`/
`computeProAdvantageAllocation` (8 scénarios `node -e` isolés, y compris le cas Chasseur de primes),
`getStep4RefData` vérifié en base réelle (37/37 carrières), ESLint 0 erreur introduite sur tous les
fichiers touchés (`git stash` pour confirmer l'erreur `remainingPC` pré-existante), SR répété après
chaque étape, **SR + fonctionnel confirmé Saar** (Lot 6 après fix dieType, puis D20 Step3).
**Non testé** : les 4 rejets serveur du Tirage 1D10 (bornes/doublon/roll inconnu/`useAsPoints`
invalide) en conditions réelles plutôt que par lecture de code ; vérification directe
`char_careers.random_picks` en base après un `reconcileCreation` réel ; retrait de carrière avec
tirage en cours (purge) en conditions navigateur.

**Chantier Redesign Step 4 Profession terminé (8/8 lots).** Plan archivé : `docs/Old/PLAN_REWORKFINAL.md`.

---
## Session 141 — 2026-07-08 — Options de campagne : `random_pro_advantages` (OPT-05) câblée ✅

Reprise en nouvelle session (protocole complet appliqué). Sujet : suite du chantier "Options de
campagne — effets mécaniques" (item 41 EN_COURS, un par un), option choisie par Saar : OPT-05
(Avantages pro aléatoires), la plus proche à câbler puisque son mécanisme (tirage 1D10, Lot 6) vient
d'être codé Session 140 mais n'était gaté par aucun toggle.

**Vérifications faites avant tout code (demande explicite Saar "être sûr à 100%")** :
- Grep exhaustif `handleStartRoll`/`handleToggleRandomPoints`/`randomBenefits` dans
  `CareersAllocator.jsx` : un seul point d'entrée chacun, tous deux imbriqués dans le bloc "Lot 6 —
  Tirage 1D10" (`CareersAllocator.jsx:815-857`) — gater ce seul `if` suffit, pas de chemin alternatif.
- `computeRandomBudgetDelta` (`shared/careerAdvantages.js`) retourne `0` si `picks` est vide — si le
  bouton n'apparaît jamais, aucune donnée de jet ne peut exister, le budget retombe naturellement sur
  `5 × années` pur (comportement "option OFF" correct par construction, pas juste cosmétique).
- Lecture de `reconcileCreation` STEP4 (`creationService.js:392-425`) : confirmé qu'aucune revalidation
  serveur n'est liée à `settings.random_pro_advantages` (même limite déjà acceptée pour
  `random_mutations`/`feminin_bonus` — gating client-only assumé, pas une régression introduite ici).
- `Step4Experience.jsx` lit déjà `useCreationStore()` directement (`sheetId, step1Data, step2Data`) —
  plan initial (prop-drilling via `WizardCreation.jsx`) simplifié à 4 fichiers au lieu de 5, découvert
  en lisant le fichier avant modification (règle 1).

**Code (pattern identique à `randomMutationsEnabled`/`femininBonusEnabled`)** :
- `server/src/services/creationService.js` : `startCreation` retourne `randomProAdvantagesEnabled:
  settings.random_pro_advantages`.
- `client/src/stores/creationStore.js` : état `randomProAdvantagesEnabled` (init/set/reset).
- `client/src/components/creation/Step4Experience.jsx` : lu depuis le store, transmis à
  `<CareersAllocator>`.
- `client/src/components/creation/CareersAllocator.jsx` : prop reçue, condition du bloc Lot 6 étendue
  `randomProAdvantagesEnabled !== false && ...` (fallback fail-open, cohérent avec `default: true` du
  schema et le pattern `Step3Mutations.jsx:262`).

**Testé :** `node --check` (fichiers serveur), ESLint sur les 3 fichiers client touchés (0 nouvelle
erreur — 1 erreur pré-existante `remainingPC` dans `Step4Experience.jsx` confirmée identique
avant/après via `git stash`), SR (`/api/health` 200 après rechargement nodemon), **SR + fonctionnel
confirmé Saar** (option OFF → bloc "Tirage 1D10" absent, budget avantages pro repasse en répartition
manuelle pure ; option ON → comportement Session 140 inchangé).
**Non testé :** bascule ON→OFF→ON en cours de wizard sur un personnage ayant déjà des `randomPicks`
existants (cas non prévu par le design — les campagnes changent leurs options avant la création des
personnages, pas en cours de wizard).

Options de campagne restantes (7/11) : `polaris_latent`, `revers`, `skill_prerequisites`,
`skill_max_level`, `skill_natural_prog`, `young_penalty`, `celebrity`.

---
## Session 141 (suite) — 2026-07-08 — Options de campagne : `skill_prerequisites` (OPT-07) câblée ✅

**Conflit de source trouvé avant tout code** : `docs/OPTIONS_CAMPAGNE.md` décrit `SKILL_MIN` comme une
option de campagne (défaut OFF), mais `docs/Character/CHARACTER.md` (spec de référence de
`SkillsPanel.jsx`, 6 pièges dédiés PC9-PC19) la décrit comme une règle **inconditionnelle**. Signalé à
Saar avant de planifier — confirmation : c'est bien une vraie option, à câbler proprement.

**Différence structurelle avec les options précédentes (demande explicite Saar "bien ET propre")** :
contrairement à `random_mutations`/`feminin_bonus`/`random_pro_advantages` (gating Wizard, client-only,
un seul flux), `SKILL_MIN` s'applique sur la **fiche personnage en jeu** (post-création), via
`SkillsPanel.jsx` (affichage) ET `POST /skills/buy` (achat XP réel) — deux points d'application, pas un
seul. Découverte clé en lisant avant de coder : `server/src/lib/charStats.js` expose déjà
`calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow)` (utilisée en combat, `weapon-skill` route)
— réutilisable telle quelle côté serveur pour revalider un prérequis, sans écrire de nouveau calcul.

**Code :**
- `server/src/routes/character/char-sheet.js` : `GET /:characterId` renvoie désormais `settings`
  (mergé defaults via `getCampaignSettings(db, req.character.campaign_id)`) — canal générique,
  réutilisable par les 6 options restantes du même chantier (Wizard/SkillsPanel/CharSheet), pas
  seulement `skill_prerequisites`. `POST /skills/buy` : revalidation serveur indépendante (jamais
  confiance en un état client) — si `settings.skill_prerequisites`, charge les `ref_skill_requirements`
  `SKILL_MIN` du skill acheté, calcule le Total de chaque prérequis via `calcSkillTotal` (attrs/
  archetype/genotype chargés une seule fois hors boucle, pas par prérequis), rejette (400) si non
  satisfait.
- `client/src/character/CharacterSheet.jsx` : état `campaignSettings`, transmis à `SkillsPanel`.
- `client/src/character/SkillsPanel.jsx` : prop `skillPrerequisitesEnabled` — gate le bloc `SKILL_MIN`
  dans `isVisible` (fermé par défaut, `=== true` requis — inverse de `random_pro_advantages` dont le
  schema par défaut est `true`). `MUTATION`/`GENOTYPE` restent toujours actifs (restrictions
  biologiques, hors périmètre OPT-07). Le marqueur `†` (groupe `PREREQ`) reste statique, non lié à
  l'application réelle.
- `docs/Character/CHARACTER.md` : 2 sections corrigées (table markers l.133, algorithme de visibilité
  l.550-557 + nouveau paragraphe OPT-07) — le PC10 existant reste vrai tel quel, non touché.

**Faux bug trouvé pendant le test navigateur (Saar, MJ, PNJ, mode Progression)** : Ctrl+F ne trouvait
ni Médecine/Chirurgie ni Électronique/Informatique. Chaîne réelle en base (vérifiée par requête directe,
pas supposée) : Médecine `(X)` exige Biologie/Physiologie ≥7 **ET** Culture générale ≥10 ; Chirurgie
`(X)` exige Médecine ≥10 ; Électronique `(X)` et Informatique `(-3)` exigent chacun Culture générale
≥10 (en parallèle, pas en chaîne via Électronique comme Saar le supposait initialement). Après avoir
remonté Culture générale, Électronique/Informatique restaient introuvables — cause réelle : Saar avait
réglé la **Maîtrise** à 10, mais le **Total** (`Base(attributs) + Maîtrise`) valait 9 (Base attribut
INT = -1 pour ce PNJ) — prérequis `≥10` non atteint à un point près. Comportement correct, pas un bug :
`Total` (pas `Maîtrise` seule) est bien la valeur comparée au seuil, cohérent avec `calcTotal`/
`calcSkillTotal` des deux côtés (client et serveur, même formule).

**Testé :** `node --check` (serveur), ESLint sur les fichiers client touchés (0 nouvelle erreur,
pré-existantes confirmées via `git stash`), `calcSkillTotal` vérifiée en isolation (`node -e` : total
sans mastery = Base seule, avec mastery = Base+mastery), requêtes réelles en base (chaîne de
prérequis des 5 compétences confirmée), SR (`/api/health` 200), **parcours navigateur réel confirmé
Saar** — option ON, MJ, PNJ, mode Progression : cascade de prérequis correcte sur plusieurs
compétences (dont certaines apparues correctement une fois leur propre prérequis satisfait), confusion
Maîtrise/Total résolue en cours de test. **"All tests OK" (Saar).**
**Non testé :** option repassée à OFF après validation ON (comportement attendu par construction —
c'est l'état par défaut du schema, jamais modifié pendant ce test) ; rejet serveur `POST /skills/buy`
en conditions réelles plutôt que par lecture de code (la visibilité masque déjà le bouton d'achat côté
UI, donc pas testable sans appel API direct).

Options de campagne restantes (6/11) : `polaris_latent`, `revers`, `skill_max_level`,
`skill_natural_prog`, `young_penalty`, `celebrity`.

---
## Session 141 (suite 2) — 2026-07-08 — Options de campagne : `skill_max_level` (OPT-08) câblée ✅

**Conflit de source trouvé avant tout code (même schéma que OPT-07)** : `REGLE_CREATION.txt:1250-1263`
titre explicitement la règle **« NIVEAU MAXIMUM DES COMPÉTENCES (OPTIONNEL) »** — le plafond de maîtrise
par années d'expérience dans la Profession ne s'applique QUE si l'option est activée. Or `getSkillCap()`
(`shared/careerSkills.js`, rework Step4 Lot 1, Session 139) l'applique **inconditionnellement** depuis
sa création — client (`CareersAllocator.jsx`) et serveur (`creationService.js` STEP4 via
`computeSkillAllocation`) plafonnaient déjà toutes les compétences professionnelles par années, sans
jamais lire `settings.skill_max_level` (défaut OFF documenté dans `OPTIONS_CAMPAGNE.md`). Signalé à
Saar avant de planifier — confirmation explicite : **option désactivée → aucun plafond de compétence**
(seul le budget global Q2 limite).

**Point distinct vérifié, resté inchangé** : le plafond fixe **+5** pour les compétences d'origine
non-professionnelles (`ORIGIN_SKILL_CAP`) est une règle de base non marquée « optionnelle » dans le LdB
(`REGLE_CREATION.txt:1122-1128`) — reste appliqué dans les deux états du toggle.

**Scope vérifié avant code** : la règle est explicitement *« Lors de la création »* — vérification de
`POST /skills/buy` (`char-sheet.js`, mode Progression) : cette route n'applique déjà **aucun** plafond,
ni celui-ci ni même le +5 origine. `skill_max_level` ne touche donc que le Wizard Step4, jamais la
Progression — scope cohérent avec le texte source, aucune extension de périmètre.

**Analyse à charge demandée par Saar avant codage** — 3 risques identifiés et adressés :
1. Régression comportementale invisible : toute campagne n'activant pas l'option perd un plafond
   jusqu'ici toujours actif (et déjà validé par Saar en Session 139) — confirmé voulu par Saar.
2. Risque d'échec silencieux (pattern déjà vécu P54/P56) : si le câblage est incomplet quelque part,
   `ctx.skillMaxLevelEnabled` est `undefined` → `Infinity` → plafond désactivé sans la moindre erreur.
   Testé explicitement le cas décisif (état ON, pas seulement OFF) pour écarter ce risque.
3. Tests unitaires du Lot 1 (Session 139) rendus obsolètes en silence si rejoués tels quels (jamais
   passé `skillMaxLevelEnabled`) — nouveaux scénarios écrits couvrant les deux états.

**Code :**
- `shared/careerSkills.js` (`getSkillCap`) : `if (!ctx.skillMaxLevelEnabled) return Infinity` inséré
  entre le plafond origine (inchangé) et le calcul par années — commentaire d'en-tête du fichier mis à
  jour pour ne plus décrire le plafond par années comme inconditionnel.
- `server/src/services/creationService.js` : `startCreation` +`skillMaxLevelEnabled` (settings.
  skill_max_level, même pattern que les 3 flags précédents) ; bloc STEP4 récupère désormais
  `campaignId`/`settings` (pattern identique STEP1) et transmet `skillMaxLevelEnabled` au ctx de
  `computeSkillAllocation`.
- `client/src/stores/creationStore.js`, `Step4Experience.jsx`, `CareersAllocator.jsx` : propagation du
  flag jusqu'à `skillAllocationCtx` (même chaîne que `randomProAdvantagesEnabled`).
- Sélecteur GM déjà existant (`SectionCharacterSheet.jsx`, Session 130) — aucun changement UI de config.

**Testé :** `node --check` (shared/serveur) 0 erreur, ESLint client 0 erreur introduite (1 erreur
pré-existante `remainingPC` confirmée via `git stash`). Scénarios isolés `node -e` — le point décisif
de l'analyse à charge : OFF (et champ omis) → `cap = Infinity` ; ON avec 1 an de carrière → `cap = 3`
conforme à la table RAW ; `computeSkillAllocation` confirme `over_cap` absent en OFF et présent en ON
pour la même cible ; plafond origine +5 inchangé dans les deux états. SR (`/api/health` 200).
**Parcours navigateur confirmé fonctionnel par Saar.**
**Non testé :** les 4 étapes du scénario détaillées une par une (validation donnée globalement
"Fonctionnel") ; rejet serveur `over_cap` en conditions réelles avec option ON plutôt que via `node -e`.

Options de campagne restantes (5/11) : `polaris_latent`, `revers`, `skill_natural_prog`,
`young_penalty`, `celebrity`.

---
## Session 141 (suite 3) — 2026-07-08 — Wizard Step 4 : Formation "Autodidacte" (7 points libres) ✅

**Hors chantier "Options de campagne" (item 41)** — signalement Saar : la formation "Autodidacte"
(sous-étape Formation, Step 4 Expérience) affiche depuis toujours le texte *"7 points libres à
répartir (+2 max par compétence). Les compétences réservées doivent être validées par le MJ."* sans
la moindre UI de répartition, ni application de bonus. Confirmé par lecture avant tout plan :
`BackgroundSelector.jsx:158-162` n'était qu'un `<p>` statique (flag `isAutodidacte`,
`backgroundMeta.js`) ; côté serveur, `ref_background_skills` ne contient aucune ligne pour ce
background — le commentaire de `98_ref_backgrounds.js:258` l'annonçait déjà à l'époque : *"Autodidacte
— pas de skills fixes, 7 points libres gérés côté UI"* — jamais fait.

**Réflexion demandée par Saar avant tout code ("on y réfléchit sans coder")** — plusieurs tours de
clarification :
- Budget ≤7 points, +2 max/compétence, sous-consommation autorisée (confirmé Saar Q1).
- Compétences éligibles : **hors `(X)` réservées ET hors compétences à prérequis `SKILL_MIN`** (le
  "†" du LdB, légende `docs/REGLES/REGLECOMPETENCE.md:127-128` *"COMPÉTENCE PRÉ-REQUISE NÉCESSAIRE"*,
  concept distinct du `marker` DB — confirmé par recoupement avec `docs/Old/MIGRATION_37BIS.md:544`).
  Exclusion **plus stricte** que la lettre de la règle (`REGLE_CREATION.txt:1026-1033`, qui autorise
  les `(X)` "sous validation MJ") — choix explicite de Saar, confirmé deux fois sans ambiguïté
  possible : "Toute compétence HORS (X) et †". La validation MJ des `(X)` n'a donc plus d'objet
  puisqu'aucune compétence éligible n'est concernée.
- Vérifié en base avant de concevoir l'UI (pas supposé) : 29 compétences éligibles sur 232 leaf
  skills, réparties sur 10 familles (la famille "Langues/langages" n'en a aucune — toutes `(X)` ou
  `†`). Ce chiffre a fait revenir sur le choix initial d'UI (accordéon envisagé par Saar vu le volume
  attendu "conséquent") vers une liste plate groupée par famille, sans repli/dépli — 29 lignes
  tiennent sans qu'un accordéon se justifie.

**Analyse à charge demandée par Saar sur le plan lui-même avant codage** — 1 vrai bug trouvé, 2
correctifs mineurs, 2 points vérifiés (pas de simple affirmation) :
- **Bug réel (fix A)** : `handleSelectGeoOrigin`/`handleSelectSocialOrigin`/`handleSelectTraining`
  (`Step4Experience.jsx`) réinitialisent l'état en cascade sur **tout** clic de carte via
  `onSelect(item.code)` (`BackgroundSelector.jsx:48`), y compris un re-clic sur la carte déjà
  sélectionnée. Un joueur ayant réparti ses 7 points sur Autodidacte et re-cliquant par erreur sa
  propre carte perdait silencieusement toute sa répartition. Défaut préexistant sur `higherEd`/
  `conditionalChoices` (bénin, un choix à refaire coûte un clic) mais bien plus coûteux sur 7 points
  pesés — corrigé par une garde `if (code === valeur actuelle) return` en tête des 3 handlers
  (corrige au passage, en effet de bord positif, le défaut préexistant).
- **Incohérence de cascade (fix B)** : `handleSelectGeoOrigin`/`handleSelectSocialOrigin`
  réinitialisaient déjà `training`/`higherEd`/`conditionalChoices` mais pas `autodidacteAllocations`
  — ajouté aux deux handlers pour une cascade complète.
- **Robustesse serveur (fix C)** : `validateAutodidacteAllocations` ignore désormais les entrées à 0
  point (artefact bénin, jamais produit par l'UI normale) au lieu de rejeter toute la réconciliation
  Step4 pour un cas inoffensif.
- **Garde de chargement (fix D)** : `AutodidacteAllocator` affiche un message si `refSkills` n'est
  pas encore résolu (cas atteignable en navigant directement vers la sous-étape Formation après
  reprise d'un Step4 déjà rempli, avant la fin du fetch `/char-ref/skills`).
- **Vérifié plutôt qu'affirmé** : réutilisation CSS `.wiz4-*` (variables déclarées `:root`,
  `index.css:31` — cascadent bien dans le conteneur `style={}` de `BackgroundSelector`, contrairement
  à une simple supposition initiale) ; interaction avec le plafond d'origine fixe +5
  (`ORIGIN_SKILL_CAP`, `careerSkills.js`) — non affectée, `computeSkillAllocation` n'évalue que les
  compétences réellement touchées par le joueur (P55), une compétence jamais touchée n'est jamais
  soumise au plafond même si son `baseMastery` cumulé (géo+social+Autodidacte) le dépasse.

**Code :**
- `shared/autodidacte.js` (NOUVEAU) : `AUTODIDACTE_TOTAL_POINTS`/`AUTODIDACTE_MAX_PER_SKILL`,
  `isAutodidacteEligible`, `getAutodidacteEligibleIds`, `validateAutodidacteAllocations` — fonctions
  pures, importées à l'identique côté client et serveur (zéro duplication de la règle d'éligibilité,
  seulement un petit adaptateur de forme côté serveur pour reconstruire `requirements`).
- `client/src/components/creation/AutodidacteAllocator.jsx` (NOUVEAU) : widget de répartition
  (liste plate groupée par famille, stepper 0/1/2, compteur "X restants"), monté dans
  `BackgroundSelector` à la place de l'ancien `<p>` statique. **Zéro nouvelle classe CSS** — réutilise
  `.wiz4-block`/`.wiz4-boardhead`/`.wiz4-h`/`.wiz4-poolrem`/`.wiz4-note`/`.wiz4-grplbl`/`.wiz4-skill`/
  `.wiz4-skmain`/`.wiz4-sklabel`/`.wiz4-ctl`/`.wiz4-sbtn`/`.wiz4-val` (pattern Lot 4, board Avantages
  pro).
- `client/src/components/creation/BackgroundSelector.jsx` : 3 nouvelles props
  (`refSkills`/`autodidacteAllocations`/`onAutodidacteAllocationsChange`), remplacement du `<p>`
  statique, suppression du style `autodidacteInfo` devenu mort.
- `client/src/components/creation/Step4Experience.jsx` : state `autodidacteAllocations`, fixes A/B
  dans les 3 handlers de sélection background, ajout au payload `buildPayload`, props transmises au
  `<BackgroundSelector>` de la sous-étape Formation.
- `server/src/services/creationService.js` : `resolveAutodidacteSkills` (nouvelle fonction,
  requêtes `ref_skills`/`ref_skill_requirements` + validation) injectée dans `bgSkillsToApply` juste
  après `getBackgroundSkillsToApply` — la boucle `upsertSkillBonus` et l'agrégation `baseMastery`
  existantes héritent automatiquement, **aucune autre ligne du bloc STEP4 modifiée**.
- `client/src/locales/creation.json` : 4 clés (`autodidacte_title`/`autodidacte_points_remaining`/
  `autodidacte_rule`/`autodidacte_loading`).
- Aucune migration DB (schéma `char_skills` déjà suffisant).

**Testé :** `node --check` (`shared/autodidacte.js`, `creationService.js`) 0 erreur, `JSON.parse`
(`creation.json`) 0 erreur, ESLint 0 erreur introduite sur `AutodidacteAllocator.jsx`/
`BackgroundSelector.jsx` (0 erreur) et `Step4Experience.jsx` (1 erreur préexistante `remainingPC`
ligne 89, confirmée via `git stash` avant/après mes modifications), relecture complète de chaque
fichier produit avant livraison, SR + **parcours navigateur confirmé fonctionnel par Saar ("Test
OK")**.

**Non testé :** les 6 scénarios détaillés proposés un par un (validation donnée globalement, pas
listée point par point) ; re-clic accidentel sur la carte Autodidacte déjà sélectionnée (fix A) en
conditions réelles navigateur plutôt que par lecture de code ; vérification directe
`char_skills.mastery` en base après un `reconcileCreation` réel avec des points Autodidacte
effectivement répartis ; rendu visuel exact des 29 lignes dans le conteneur `max-width:500px` de
`BackgroundSelector` (confirmé fonctionnel globalement par Saar, pas détaillé ligne par ligne).

---
## Session 141 (suite 4) — 2026-07-08 — Options de campagne : `young_penalty` (OPT-10) câblée ✅

**Lecture avant plan** : `REGLE_CREATION.txt` (« PERSONNAGES TRÈS JEUNES (OPTIONNEL) »),
`shared/polarisUtils.js` (`getAgeEffects`, ne couvrait jusqu'ici que le malus de vieillesse 30+ — code
mort pour 16-19 ans, confirmé par `PLAN_OPTCAMP.md`), `creationService.js` (bloc STEP4, calcul
`finalAge`), `AgeSelector.jsx` (**2ᵉ point d'appel de `getAgeEffects` non repéré au premier abord** —
aperçu client pendant la sélection de l'âge de base), `campaignSettingsService.js` (schéma),
`SectionCharacterSheet.jsx` (toggle GM déjà existant depuis Session 130), `char-sheet.js` (route
`PUT /archetype` — confirmé qu'aucun mécanisme de vieillissement en cours de partie n'existe nulle
part dans le code, donc l'aspect RAW « temporaire, disparaît avec le temps » reste hors-scope, comme
pour le malus de vieillesse existant).

**Règle exacte** : 16-17 ans → FOR -3, PRE -2 ; 18 ans → FOR -2, PRE -1 ; 19 ans → FOR -1. Non
applicable **par attribut** si sa valeur de base est déjà ≤7 (vérifié indépendamment pour FOR et PRE).

**Analyse à charge demandée par Saar avant codage — 3 points vérifiés, aucun n'a nécessité de
changement de plan :**
1. Aperçu `AgeSelector.jsx` structurellement désynchronisé du calcul réel (utilise `baseAge`, avant
   ajout des années de carrière, alors que le calcul serveur utilise `finalAge`) — plus visible pour
   cette option que pour le malus 30+ (16-19 ans est la valeur naturelle qu'un joueur choisira
   précisément pour un personnage jeune). Décision Saar : laisser tel quel (cohérent avec l'existant,
   le Récap final donne toujours le vrai résultat), pas de correctif supplémentaire.
2. Risque de péremption de `char_attributes.base_level` lu côté serveur : vérifié que les 2 seuls
   points d'appel de `/reconcile` (`openPeek`, `handleTerminate`, `WizardCreation.jsx`) envoient
   toujours le payload accumulé complet (`step1`→`step5`) — le bloc STEP1 s'exécute donc avant STEP4
   dans la même transaction, `char_attributes.base_level` est toujours frais au moment de la lecture.
3. Génotype modifiant FOR/PRE directement : vérifié que STEP2 (`creationService.js`) ne touche que
   `char_archetype.genotype_id`, jamais `char_attributes` — `base_level` est bien la seule source
   pertinente pour le seuil ≤7, pas de modificateur caché à sommer.

**Code :**
- `shared/polarisUtils.js` (`getAgeEffects`) : signature `getAgeEffects(age, ctx = {})` — nouvelle
  branche 16-19 ans gatée par `ctx.youngPenaltyEnabled`, malus par attribut seulement si
  `ctx.attributes.FOR`/`.PRE` > 7. Malus de vieillesse (30+) inchangé et toujours prioritaire.
- `server/src/services/creationService.js` : bloc STEP4 — requête `char_attributes` (FOR/PRE
  `base_level`) juste avant l'appel à `getAgeEffects(finalAge, { attributes, youngPenaltyEnabled:
  settings.young_penalty })` (réutilise le `settings` déjà chargé pour `skill_max_level`, aucune
  requête settings supplémentaire) ; `startCreation` +`youngPenaltyEnabled`.
- `client/src/stores/creationStore.js`, `Step4Experience.jsx`, `AgeSelector.jsx` : propagation du
  flag + des attributs Step1 jusqu'à l'aperçu (même chaîne que les options précédentes).
- `client/src/locales/creation.json` : `age_effects_none` — *"Aucun effet (moins de 30 ans)"* devenait
  faux dès que l'option est active → simplifié en *"Aucun effet"*.
- Sélecteur GM déjà existant (`SectionCharacterSheet.jsx`, Session 130) — aucun changement UI de config.

**Testé :** `node --check` (shared/serveur) 0 erreur, JSON valide, ESLint client 0 erreur introduite
(1 erreur préexistante `remainingPC` — `Step4Experience.jsx`, ligne décalée par le travail Autodidacte
entre-temps mais confirmée identique). Scénarios `node -e` : OFF → `{}` ; ON 16/17 ans (FOR-3/PRE-2),
18 ans (FOR-2/PRE-1), 19 ans (FOR-1), 20 ans → `{}` (hors plage) ; attributs ≤7 → non appliqué ; `ctx`
omis → `{}` (fail-open documenté) ; malus de vieillesse (30, 41 ans) inchangé et prioritaire même
option jeunesse active. SR (`/api/health` 200). **Parcours navigateur confirmé fonctionnel par Saar.**
**Non testé :** les 4 étapes du scénario détaillées une par une (validation donnée globalement
"Fonctionnel") ; confirmation visuelle du texte "Aucun effet" simplifié en navigateur.

Options de campagne restantes (4/11) : `polaris_latent`, `revers`, `skill_natural_prog`, `celebrity`.

---

## Session 141 (suite 5) — 2026-07-08 — PLAN_DICEREWORK3 : recalibration D10/D100 ✅

Signalement Saar : l'animation 3D du D100 n'a jamais été correcte — faces non alignées, résultat
serveur ≠ résultat affiché (exemple vécu : serveur roll=1 → affiché "30+7"), dé des unités décrit
comme visuellement cassé. Hors chantier "Options de campagne".

**Diagnostic [VÉRIFIÉ] avant tout code** — exécution réelle de `tools/inspect-glb.js` sur les
fichiers `.glb` commités (calcul des normales géométriques réelles par triangle + extraction de la
texture atlas), comparé aux tables `FACE_NORMALS` de `client/src/lib/diceMath.js` : D4/D6/D8
matchent exactement le fichier réel ; `D10_FACE_GLB`/`D10U_FACE_GLB`/`D10T_FACE_GLB` ne
correspondaient à **aucune** face réelle de `D10.glb`/`D100.glb`, jamais recalculées correctement
depuis leur introduction Session 65 (même commit que l'ajout des `.glb`). D12/D20 confirmés hors
scope (D12 fonctionnel en usage réel selon Saar malgré un écart offline non fiable ; D20 déjà
calibré manuellement Session 65, non retouché).

**Recherche pro demandée par Saar avant de coder** (`docs/PLAN_DICEREWORK3.md`, section dédiée) :
code source de `byWulf/threejs-dice` et `Dice So Nice!` (Foundry VTT) lus — confirment que notre
pipeline de rendu (normale de face → orientation caméra via `setFromUnitVectors`) suit déjà le
pattern standard de l'industrie, le bug étant uniquement une donnée de calibration. Piste écartée
explicitement par Saar : réactiver le code procédural D10 (`createD10Geometry`/`D10_KITE_VALUES`,
pattern légitime chez Dice So Nice) — rejetée car les dés procéduraux sont visuellement médiocres et
le D20 procédural s'était avéré impossible à texturer proprement (contrainte UV), raison très
probable du passage historique aux `.glb` (Session 65) — **décision définitive : on reste sur
`.glb`**, le code procédural D10 est du code mort à supprimer, pas à réactiver.

**Architecture (Lot 1)** : `D10_FACE_GLB`/`D10U_FACE_GLB` (deux tables dupliquées à la main pour le
même fichier `D10.glb` — relevé par Saar) fusionnées en une seule table canonique
`D10_GLB_NORMALS` (clés 1-10) ; `d10_units` dérive désormais de celle-ci via une table calculée une
fois au chargement du module (relabeling `10→0`), plus de duplication manuelle. `D10T_FACE_GLB`
(D100.glb, fichier distinct) reste une table indépendante — confirmé nécessaire (sérigraphie
différente malgré la géométrie identique).

**Calibration réelle (Lot 2/3)** : harnais temporaire `/dev/dice-calibration` (`DiceCalibrationPage`/
`DiceCalibrationProbe`, route protégée) — composant autonome ne dépendant ni de `DiceMesh` ni de
`getFaceNormal` (justement la donnée à calibrer), pose statique immédiate sur les 10 normales réelles
verrouillées (calculées via `inspect-glb.js`), caméra/lumières identiques à `Canvas3D.jsx`. Bonus
ajoutés sur demande Saar : échelle ×5, rotation additionnelle autour de l'axe de visée (même face,
orientation du chiffre variable) pour vérifier la lisibilité sous tous les angles. Saar a lu les 20
valeurs réelles (10 D10.glb + 10 D100.glb, bijection 0-9 vérifiée des deux côtés) — tables réécrites.

**Nettoyage (Lot 1bis/4)**, fait après confirmation fonctionnelle : suppression harnais + route
temporaire, suppression code mort D10 procédural (`D10_KITE_NORMALS`/`D10_KITE_VALUES`/
`D10_FACE_VALUES`/`D10_UNITS_FACE_VALUES`/`D10_TENS_FACE_VALUES`, `createD10Geometry()`, branche de
rotation D10 et cas géométrie/matériau `pentagonal_bipyramid` dans `DiceMeshProcedural` — chemin déjà
inatteignable, `GLB_PATHS` couvrant tous les dieType). `docs/ASBUILT.md` (tableau "Dice Rework",
obsolète depuis la bascule `.glb` Session 65) et `.claude/rules/dice.md` (PE32/PE33) mis à jour en
conséquence.

**Incident de process en cours de session** : Saar a signalé à raison une dérive — redemander la
permission de continuer ("je continue sur le Lot 2 ?") après un plan déjà validé ("Ok go") revient à
improviser malgré le plan. Correction : exécution directe des lots suivants sans redemander, plan
déjà complet faisant foi.

**Testé :** dérivation `d10_units`/`d10` (référence stricte `getFaceNormal`), bijection 0-9 des deux
tables calibrées, ESLint 0 erreur introduite sur tous les fichiers touchés (2 warnings préexistants
confirmés via `git stash` avant/après), aucune référence résiduelle aux identifiants supprimés,
**SR + jet D100 réel en session confirmé fonctionnel par Saar** ("SR et fonctionnel").
**Non testé :** scénarios limites détaillés un par un (00/100, doublons `is_unique` non applicable
ici), retrait de dé en cours d'animation, D12/D20 (hors scope, non retouchés).
Détail complet : `docs/PLAN_DICEREWORK3.md`.
