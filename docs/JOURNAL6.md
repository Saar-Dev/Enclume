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

**Extension demandée par Saar une fois le bug corrigé** : l'outil de calibration (Lot 2) a été
**généralisé aux 7 dieType** (`d4`/`d6`/`d8`/`d10`/`d100`/`d12`/`d20`) au lieu d'être retiré (Lot 4
révisé — le tool devient permanent, `/dev/dice-calibration` reste dans `App.jsx`). Changement
d'implémentation par rapport au Lot 2 initial : plus aucun vecteur transcrit à la main — nouveau
`client/src/lib/devFaceClusters.js` (port navigateur du k-means de `tools/inspect-glb.js`, calcule
les clusters de normales à la volée depuis la géométrie réellement chargée, pour n'importe quel dé).
Ajout `getClosestFaceValue(dieType, normal)` (`diceMath.js`, lookup inverse pur) — l'outil affiche
désormais "le code actuel prévoit : X" à côté de chaque face, évite la retranscription manuelle de
séquences.

**Investigation "cassé" D8/D20 dans l'outil (pas dans le jeu)** : Saar a signalé des faces
apparaissant en arête/pointe sur D8 (3/8) et D20 (6/20) **dans l'outil de calibration uniquement**.
Confirmé par Saar : aucun problème en jeu réel sur ces dés — donc pas le même bug que D10/D100.
Vérifications poussées avant d'abandonner la piste (aucune supposition non testée) :
clustering rejoué en Node avec le **vrai `GLTFLoader`** (celui que `useGLTF` utilise réellement,
pas une simple lecture manuelle du fichier) → résultat identique et parfaitement propre (8/8
clusters D8 distincts, 37 triangles chacun) ; testé aussi avec l'ordre des triangles mélangé exprès
→ toujours propre ; maths d'orientation (`setFromUnitVectors`) déjà vérifiées exactes précédemment
(cas 176,6° inclus). Données et calculs provablement corrects jusqu'au bout de la chaîne testable
sans navigateur. Hypothèse résiduelle **non vérifiée** [HYPOTHÈSE] : artefact visuel (normal map +
éclairage fixe de l'outil) ou timing d'effet React propre à l'outil — **decision Saar : ne pas
creuser plus loin**, le bug réel (D10/D100 en jeu) est clos, cet artefact reste un défaut cosmétique
connu de l'outil de debug uniquement.

---

## Session 141 (suite 6) — 2026-07-08 — AdvantagesPanel Lot A : Force Polaris (OPT-04) câblée ✅ CLOS

Reprise en session neuve depuis `docs/PLAN_ADVANTAGESPANEL.md` (rédigé lors d'une session
précédente, Lot A détaillé ligne-à-ligne, pas encore codé). Protocole complet appliqué : les 7
fichiers cités par le plan + les 3 références (`docs/OPTIONS_CAMPAGNE.md` OPT-04,
`REGLE_CREATION.txt` section Polaris latent, migration `92_ref_advantages.js`) relus dans cette
session avant tout code.

**Root cause confirmée par le plan** : `AdvantagesPanel.jsx` n'a jamais été mis à jour après la
migration `99_char_advantages_v2.js` — gate "Force Polaris" (`hasMuta029`) toujours faux en
pratique (aucune ligne `char_advantages` n'a jamais eu `type==='MUTATION'`/`muta_numero` en V2).

**Écart trouvé avant codage (tranché avec Saar)** : `docs/OPTIONS_CAMPAGNE.md` (OPT-04) mentionne
une limite "1 seul Polaris latent/non maîtrisé **par groupe**" (campagne, tous personnages
confondus) que le plan Lot A n'implémentait pas (seulement `family_limit:1`, exclusion **par
personnage**). Décision Saar : hors scope, géré manuellement par le MJ — pas de code pour ça.

**Codé (7 fichiers, exactement le périmètre du plan)** :
- **NOUVEAU** `server/src/db/migrations/123_ref_advantages_polaris.js` — 3 lignes `ref_advantages`
  (`adv_077` "Polaris latent" 3 PC, `adv_078` "Polaris non maîtrisé" 3 PC, `adv_079` "Force Polaris"
  5 PC), `family:'Polaris'`/`family_limit:1` identique sur les 3, tous `mod_*` à `null` (narratif/MJ,
  comme `adv_050`). House-rule assumé par Saar, pas retrouvé tel quel dans la RAW.
- `creationService.js` : `getStep5RefData()` → `getStep5RefData(campaignId)`, filtre `adv_077`/
  `adv_078` si `settings.polaris_latent` est OFF (`adv_079` toujours visible). Seul appelant :
  `routes/creation.js` (vérifié avant modification).
- `routes/creation.js` : `getStep5RefData(req.character.campaign_id)`.
- `advantageConstraints.js` : nouvelle contrainte `polaris_option_enabled` (ciblée par ID explicite
  `adv_077`/`adv_078`, jamais par `family` — `adv_079` doit rester achetable option OFF).
  `validateAdvantage(...)` gagne un 6ᵉ paramètre `polarisLatentEnabled = false` (défaut `false`
  volontaire — gate un achat, pas une restriction, fail-closed si oublié). Seul appelant :
  `advantageService.js` (vérifié avant modification).
- `advantageService.js` : `addAdvantage()` résout désormais `campaignId` par jointure
  `char_sheet → characters` (aucune fonction existante ne le faisait avec seulement `sheetId`), lit
  `settings.polaris_latent` via `getCampaignSettings` (import ajouté), le passe à `validateAdvantage`.
- `AdvantagesPanel.jsx` : `MUTA_POLARIS`/`hasMuta029` supprimés, remplacés par `hasForcePolaris`
  (`charAdvantages.some(a => a.advantage_id === 'adv_079')`) sur les 3 usages (disabled/onClick/
  title/texte).
- `fr.json` : `polarisRequired`/`typePolarisDisabled` reformulés sans référence à `muta_029`.

**Testé** : `node --check` (5 fichiers serveur) 0 erreur ; ESLint client (`AdvantagesPanel.jsx`)
0 erreur ; `fr.json` JSON valide ; migration 123 auto-appliquée par nodemon (P53), vérifiée dans
`knex_migrations` avant tout appel manuel (P54) — 3 lignes confirmées en base réelle ;
`getStep5RefData` vérifié contre une campagne réelle (filtre correct selon `polaris_latent`) ;
5 scénarios `node -e` sur `validateAdvantage` (`adv_077` option OFF→rejeté, option ON→accepté,
`adv_079` option OFF→toujours accepté, exclusion `family_limit` `adv_077`/`adv_078` toujours active,
paramètre omis→fail-closed) ; SR + **parcours navigateur confirmé fonctionnel par Saar**.

**Non testé** : achat effectif de `adv_079` en conditions réelles suivi du déblocage visuel du
bouton "Force Polaris" dans la modale (validation donnée globalement "SR et fonctionnel", pas
détaillée scénario par scénario) ; la dépendance PC 077/078→079 documentée comme non résolue dans
le plan (`char_pc_ledger.pc_postcreation` jamais crédité nulle part) reste non résolue, hors scope
de ce lot.

**Prochaine étape** : Lot B (affichage de la liste `AdvantagesPanel.jsx` — `adv.label`→`adv.name`,
badge `MUT`/`ATR` à redéfinir, `adv.level` à retirer) — tâche séparée, à planifier en détail avec
Saar avant de coder (règle "un seul bug à la fois"). Lots C/D non cadrés, Lot E toujours backlog.
Prochaine migration disponible : **124** (123 consommée cette session).

---

## Session 141 (suite 7) — 2026-07-08 — AdvantagesPanel Lot B : affichage de la liste ✅ CLOS

Tâche séparée du Lot A (règle "un seul bug à la fois"), planifiée en détail avant code — le plan
`docs/PLAN_ADVANTAGESPANEL.md` ne décrivait Lot B qu'à gros grain (3 puces), un plan ligne-à-ligne a
été construit en relisant `AdvantagesPanel.jsx` (lignes 195-244, bloc liste) et `fr.json`.

**Confirmé avant code** : `adv.label`/`adv.mutation_nom`/`adv.muta_numero`/`adv.level` ne sont
jamais définis en V2 (seuls `adv.name`/`adv.type` ∈ {`'advantage'`,`'disadvantage'`} existent
réellement, cf. `getAdvantages()`) — vérifié une seconde fois contre une fiche réelle
(`adv_002` "Ambidextre") : l'ancien code affichait un badge "ATR" et un **nom vide** (`adv.label`
toujours `undefined`), confirmant le bug avant et après fix.

**Codé (1 fichier client + 1 fichier i18n)** :
- `AdvantagesPanel.jsx` (bloc liste, lignes 207-224) : `adv.type === 'MUTATION'` → `adv.type ===
  'advantage'` (vs `'disadvantage'`, les 2 seules valeurs réelles) ; `adv.mutation_nom ||
  adv.muta_numero` / `adv.label` → `adv.name` (seul champ réel) ; suppression complète du bloc
  `level` (`adv.level` inexistant en V2, mort depuis la migration 99).
- Styles renommés pour refléter la vraie sémantique : `s.badgeMut`→`s.badgeAdvantage`,
  `s.badgeAtr`→`s.badgeDisadvantage` (même rendu visuel) ; `s.level` supprimé (plus aucun usage).
- `fr.json` : `advantages.badgeMut`("MUT")/`badgeAttr`("ATR") → `badgeAdvantage`("AVA")/
  `badgeDisadvantage`("DÉS").
- `en.json` non touché — déjà invalide/hors service (dette `[JSON1]` pré-existante), cohérent avec
  le choix du Lot A.

**Testé** : ESLint client 0 erreur, `fr.json` JSON valide, grep de contrôle confirmant zéro trace
résiduelle des anciennes clés/styles (`badgeMut`/`badgeAtr`/`level`), sortie réelle de
`getAdvantages()` revérifiée contre une fiche existante (`adv_002` "Ambidextre" — badge "AVA" +
nom affiché correctement, contre badge "ATR" + nom vide avant fix), SR + **parcours navigateur
confirmé fonctionnel par Saar**.

**Non testé** : affichage d'un désavantage réel en base (aucune ligne `type:'disadvantage'` active
trouvée lors de la vérification — badge "DÉS" non observé en conditions réelles, seulement par
lecture du code).

**État du plan `PLAN_ADVANTAGESPANEL.md`** : Lots A et B clos. **Pas fini** — Lot C ("Autres" texte
libre, conception à trancher avec Saar : colonne `custom_label` ? catalogue générique ?) et Lot D
("Mutations" ajoutées en jeu, aucune route n'existe pour un personnage déjà verrouillé — le plus
gros chantier restant) ne sont pas cadrés en détail. Lot E (`SkillsPanel.jsx activeMutations`,
dette `[CS7]`) reste backlog, non prioritaire. Chacun nécessite sa propre session de conception
avant tout code (règle "un seul bug à la fois").

---

## Session 141 (suite 8) — 2026-07-08 — Bug réel D4 face "4" + roulis aléatoire des dés ✅ CLOS

Suite directe de l'item 47/PLAN_DICEREWORK3 (interruption ponctuelle hors chantier
`AdvantagesPanel.jsx`, repris ensuite). Point de départ : Saar a demandé d'étendre l'outil de
calibration (`/dev/dice-calibration`) à tous les dés pour "être exigeant" maintenant qu'un outil
de vérification précis existe (auparavant contentement d'un "à peu près correct").

**Bug outil #1 — ordre N1-Nk instable pour les dés symétriques.** Les relevés D4 de Saar entre deux
rechargements de page ne concordaient pas (même chiffre, index N différent). Cause : tous les
clusters d'un dé symétrique (D4/D6/D8/D20) ont le même nombre de triangles — le tri
`sort((a,b) => b.triCount - a.triCount)` n'a alors aucun critère pour départager, et l'ordre dépend
de quelle graine k-means (parmi les 12 essais) a gagné, non reproductible. Fix : tri secondaire
déterministe sur la normale arrondie (`devFaceClusters.js`). Testé : rejoué le calcul avec l'ordre
d'entrée original + 2 ordres mélangés différemment → résultat rigoureusement identique aux 3 essais.

**Investigation "cassé" D8/D20 dans l'outil (arête/pointe au lieu d'une face).** Saar a confirmé
l'absence de ce problème en jeu réel sur ces dés — donc pas le même type de bug que D10/D100.
Vérifications poussées avant d'abandonner la piste : clustering rejoué en Node avec le **vrai
`GLTFLoader`** (celui que `useGLTF` utilise réellement — reconstruction d'un `.glb` sans textures
pour éviter les polyfills navigateur, cf. script temporaire) → résultat identique et parfaitement
propre. Maths d'orientation (`setFromUnitVectors`) déjà revérifiées précédemment, y compris le cas
176,6° (quasi-opposé). Hypothèse résiduelle non vérifiée (artefact éclairage/normal map ou timing
d'effet React) — décision Saar de ne pas creuser plus loin, hors scope.

**Nouveau contrôle "Inclinaison axe X"** ajouté à l'outil sur demande Saar : un vrai axe
supplémentaire (rotation autour de l'axe X écran, perpendiculaire à la vue), distinct de la
rotation "même face" existante (qui tourne autour de l'axe de visée et ne change jamais quelle face
est montrée) — celui-ci **dévie volontairement** la face de l'alignement exact face→caméra, pour
amener un sommet du D4 vers le haut de l'écran (convention de lecture réelle d'un vrai D4 : chaque
face porte les 3 AUTRES chiffres, jamais le sien). `DEFAULT_ADJUSTMENTS` (D4CalibrationPage.jsx) :
préréglages automatiques par face trouvés par Saar (index désormais stable grâce au fix ci-dessus).

**Vrai bug de production trouvé** (pas seulement l'outil) : Saar a fourni une capture d'écran de la
face "4" du D4 **en vraie session** montrant "1,2,3" visibles, aucun "4" lisible — confirmation
qu'il ne s'agissait pas juste d'un confort de lecture pour l'outil. Cause : `DiceMeshGlb`
(`DiceMesh.jsx`, code de production) fait `setFromUnitVectors(fn, camDir.negate())` **sans aucune
correction de roulis** — exactement la même limitation que l'outil avant l'ajout de ses contrôles
manuels. Fix : `getFaceRollCorrection(dieType, faceValue)` (`diceMath.js`, NOUVEAU) — table de
corrections ponctuelles, appliquée dans `DiceMeshGlb` (inclinaison `-240°` axe X écran pour D4 face
"4", réutilisant exactement les maths validées dans l'outil). Scope volontairement limité à cette
seule face (seule signalée cassée par Saar — "un seul bug à la fois").

**Demande Saar dans la foulée — roulis aléatoire des dés** : les dés semblaient toujours s'afficher
avec la même orientation ("horloge") pour un même résultat, donnant une impression de dé figé.
`getRandomClockDeg(seed)` (`diceMath.js`, NOUVEAU, PRNG seedé — jamais `Math.random()`, principe
backtracking respecté) appliqué dans `DiceMeshGlb` sur toutes les faces **sauf** celles ayant une
correction manuelle (D4 "4" — un roulis aléatoire en plus aurait décalé la lecture qui vient d'être
corrigée, les deux rotations ne commutent pas).

**Bug trouvé en testant ("aucun effet" signalé par Saar, sur le vrai playground)** : pour un jet à
un seul dé, `seed` (`server/src/lib/diceParser.js:65`, XOR d'un seul élément) **= la valeur du
résultat elle-même** — deux jets tombant sur le même chiffre avaient donc *toujours* le même
roulis, aucune variation visible en relançant simplement le dé. Fix : `timestamp` du jet (jusqu'ici
jamais transmis en tant que donnée, seulement utilisé pour la `key` React de démontage/remontage)
propagé `DiceRoller.jsx` → `DiceMesh.jsx` (spread `{...props}`, aucun changement nécessaire côté
routeur) → `DiceMeshGlb`, combiné à `seed` par XOR pour dériver l'angle. Voir **P57** ci-dessous.

**Testé :**
- Ordre N1-Nk stable : rejoué avec 3 ordres d'entrée différents → résultat identique.
- D8 "cassé" : clustering rejoué via le vrai `GLTFLoader` → identique à la lecture manuelle directe.
- Maths de correction D4 : rejouées numériquement avec le vrai `three.js` et la caméra par défaut
  de `Canvas3D.jsx` → s'exécutent sans erreur, orientation cohérente avec ce qui a été validé dans
  l'outil.
- Roulis aléatoire : vérifié déterministe (même seed+timestamp → même angle) et variable (seeds ou
  timestamps différents → angles différents) ; invariant "face toujours exactement vers la caméra
  après rotation" reconfirmé numériquement.
- ESLint 0 erreur introduite sur tous les fichiers touchés (`diceMath.js`, `DiceMesh.jsx`,
  `DiceRoller.jsx`, `devFaceClusters.js`, `DiceCalibrationPage.jsx`) — 1 warning préexistant
  confirmé sans lien (dep `dieType` inutilisée dans un `useMemo` de code mort, déjà signalé Lot 1bis).
- **SR + D4 fonctionnel en jeu confirmé par Saar. Roulis aléatoire fonctionnel en jeu confirmé par
  Saar** (après le fix `timestamp`).

**Non testé :** confirmation visuelle des 6 autres dés (D6/D8/D10/D100/D12/D20) avec le nouveau
roulis aléatoire ; comportement de la correction D4 "4" à un angle de caméra très différent du
défaut (limite assumée et documentée, pas un bug caché — aucune correction n'existait avant).

Détail complet du chantier initial : `docs/PLAN_DICEREWORK3.md` (addendum ajouté).

---

## Session 141 (suite 9) — 2026-07-09 — AdvantagesPanel Lot C : notes "Autres" ✅ CLOS + Bug MUT2 inscrit

**Lot C** — tâche séparée des Lots A/B, conception requise avant plan détaillé (signalé dans
`docs/PLAN_ADVANTAGESPANEL.md`). Discussion directe (pas de questionnaire structuré, rappel Saar) :
pourquoi une nouvelle table plutôt que réutiliser le pattern texte libre d'avant migration 99 ?
Réponse tranchée avec Saar : l'ancien schéma `char_advantages` (V1) était volontairement souple
(pas de FK catalogue, pas de contrainte unique) — la migration 99 a introduit un modèle strict
(FK obligatoire vers `ref_advantages`, `snapshot_data`, contrainte unique par `advantage_id`) conçu
pour de vrais avantages mécaniques. Réintroduire "Autre" via une ligne catalogue générique
(`adv_080` + `custom_label`) contournerait ces garde-fous un par un (exception à la contrainte
unique, `snapshot_data` incohérent avec le texte réel ailleurs). Précédent déjà dans le projet :
`char_mutations` est une table séparée de `char_advantages` pour la même raison structurelle.

**Analyse à charge demandée par Saar avant codage** — 3 points vérifiés avant de coder : (1)
`CharacterSheet` n'a pas de `key={characterId}` (`CharacterWindow.jsx:366`) → ne remonte jamais au
changement de personnage → `useEffect([characterId])` réellement nécessaire pour recharger les
notes, pas une précaution superflue. (2) `Step5Advantages.jsx` (Wizard) n'a aucune notion de texte
libre → confirme "Autre" comme 100% `CharacterSheet`/`AdvantagesPanel`, jamais le Wizard. (3) Les
routes `/advantages` existantes n'ont aucun contrôle de propriété au-delà de `requireAuth` — les
nouvelles routes reproduisent cette même absence pré-existante (pas une régression introduite, pas
corrigé ici, hors scope). Flicker UX mineur accepté (notes chargées séparément de `charAdvantages`,
pas de fusion des deux `useEffect`) et absence d'audit de suppression (pas d'enjeu PC à tracer)
validés explicitement par Saar.

**Codé** : migration `124_char_advantage_notes.js` (NOUVEAU — table dédiée, `id`/`char_sheet_id`
FK CASCADE/`label`/`created_at`, pas de soft-delete). `advantageService.js` : 3 fonctions
(`getAdvantageNotes`/`addAdvantageNote`/`removeAdvantageNote`, validation label non vide ≤255
caractères). `char-sheet.js` : 3 routes `GET/POST /:characterId/advantage-notes` +
`DELETE /:characterId/advantage-notes/:id`, même pattern exact que les routes `/advantages`
existantes. `AdvantagesPanel.jsx` : état local `advantageNotes` + fetch dédié, liste fusionnée
`combinedEntries` (`useMemo`, tri chronologique `acquired_at`/`created_at`) affichant avantages
catalogués (badge AVA/DÉS) et notes (nouveau badge AUT) dans un seul flux, `handleAddOther` réécrit
vers `/advantage-notes` (au lieu de l'ancien `POST /advantages {type:'OTHER'}` qui échouait
toujours), nouveau `handleRemoveNote`. En-tête JSDoc du fichier corrigé au passage (resté obsolète
depuis les Lots A/B — mentionnait encore `muta_029`/badges `MUT`/`ATR`).

**Testé** : `node --check` (3 fichiers serveur) 0 erreur, ESLint client 0 erreur, `fr.json` valide,
migration 124 vérifiée en base réelle (P53/P54 respectés), scénarios `node -e` (`addAdvantageNote`
label vide/>255 → rejeté en transaction annulée sans résidu ; cycle complet réel add→get→remove→404
sur double-suppression, base nettoyée après test), SR + **parcours navigateur confirmé fonctionnel
par Saar** ("Oui, lot C testé").

**Bug trouvé en testant, hors scope Lot C — MUT2 inscrit dans `docs/BUGIDENTIFIE.md`** : l'étape
"Mutations" de la même modale (jamais touchée par Lot C) plante en 500 — `GET /char-ref/mutations`
(`ref.js:73`) trie sur `muta_numero`, colonne inexistante (vraies colonnes `mutation_id`/`name`,
vérifié via `columnInfo()` en base réelle). Analyse plus poussée avant de choisir patch vs
inscription : même en corrigeant l'`orderBy`, `AdvantagesPanel.jsx` lit `mut.muta_numero`/`mut.nom`/
`linked_skill_id` (aucun de ces champs n'existe) et `handleAddMutation` poste toujours vers
`/advantages` avec `advantage_id` absent → 400 garanti. Un patch isolé de l'`orderBy` aurait juste
déplacé la casse (liste avec noms vides, échec à l'ajout) sans réparer la fonctionnalité — décision
(Saar a laissé le choix) : inscription dans `BUGIDENTIFIE.md` plutôt que correctif partiel, ce bug
étant la porte d'entrée du **Lot D** déjà identifié comme le plus gros chantier restant.

**Non testé** : affichage d'un désavantage réel (`type:'disadvantage'`) dans la liste fusionnée —
toujours aucune ligne active trouvée en base ; note texte libre >255 caractères via un appel API
direct (contournement du `maxLength` navigateur) — le rejet serveur existe mais n'a pas été
déclenché en conditions réelles navigateur.

**État du plan `PLAN_ADVANTAGESPANEL.md`** : Lots A/B/C clos. Lot D (le plus gros, englobe
désormais aussi MUT2) et Lot E (`[CS7]`, backlog) restent à planifier en détail avec Saar, chacun
sa session (règle "un seul bug à la fois").

---

### Suite (même session) — Lot D : mutations octroyées en jeu ✅ CLOS + `PLAN_MUTATION2.md` créé

**Conception avant plan** (discussion directe, pas de questionnaire — rappel explicite de Saar en
plein milieu de la conversation, appliqué pour la suite). Trois questions tranchées avec Saar avant
tout code :
1. Coût en PC ou octroi narratif pur ? → **Aucun coût.** Recherche RAW (`REGLE_MUTATION.md`) : pas
   de règle "achat de mutation en jeu" trouvée, seulement des mutations octroyées par le MJ
   (parasites, drogues Régé+). Le trou déjà noté au Lot A (`pc_postcreation` jamais crédité, aucune
   route) aurait bloqué toute mutation payante de toute façon.
2. Qui peut déclencher l'ajout ? → **MJ uniquement, lecture seule pour le joueur.**
3. Complexité Wizard à reprendre (sous-type, tirage D100, stacking) ? → **Non, le MJ gère** —
   version simplifiée : choisir une mutation, l'ajouter, terminé.

**Correction d'une erreur de ma propre analyse à charge du Lot C**, trouvée en recherchant pour le
Lot D : j'avais affirmé que les routes `/advantages` n'avaient aucun contrôle de propriété au-delà
de `requireAuth` — **faux**. `router.param('characterId', ...)` (`char-sheet.js:54-76`) s'exécute
automatiquement sur toutes les routes `:characterId` du fichier : vérifie l'appartenance à la
campagne, pose `req.character`/`req.isGm`, bloque si ni owner ni GM. Je l'avais raté en ne lisant
pas assez loin dans le fichier au moment du Lot C. Conséquence positive : le gate MJ du Lot D est
une ligne (`if (!req.isGm) throw new AppError(403, ...)`, pattern déjà utilisé 3 fois ailleurs dans
ce fichier), aucune nouvelle plomberie d'autorisation nécessaire.

**Question de scope résolue** : les mutations d'un personnage n'étaient affichées **nulle part**
dans `CharacterSheet.jsx` (vérifié — aucun bloc dédié, malgré le commentaire d'en-tête du module
qui annonçait "mutations, Force Polaris, texte libre" depuis le début). Confirmé avec Saar : Lot D
inclut donc aussi l'affichage en lecture seule dans la liste fusionnée (3ᵉ type, badge "MUT"), pas
seulement la route d'ajout.

**Codé** :
- **NOUVEAU** `server/src/db/migrations/125_char_mutations_source_campaign.js` — étend le CHECK
  `chk_char_mutations_source` avec `'campaign'` (en plus de `chosen`/`random` du Wizard), même
  logique que `char_advantages.acquired_during`.
- **NOUVEAU** `server/src/services/mutationService.js` — `getMutations`/`addMutation`/
  `removeMutation`. `addMutation` mirrors l'upsert stackable de STEP3 (`creationService.js`) à
  l'identique (raw SQL `ON CONFLICT ... WHERE ... DO UPDATE`, index partiel `uq_char_mut_no_sub`,
  `knex.onConflict()` standard ne gère pas les index partiels) + override `char_archetype.sex`/
  `is_fertile` si la mutation le prévoit (garantit la cohérence avec la contrainte `not_if_sterile`
  même pour une mutation octroyée post-création). `removeMutation` = soft-delete `status='removed'`
  (le CHECK constraint anticipait déjà ce statut, jamais exploité jusqu'ici).
- `char-sheet.js` : 3 routes `/:characterId/mutations` (GET public, POST/DELETE `req.isGm`).
- `ref.js` : **bug MUT2 corrigé** — `orderBy('muta_numero')` (colonne inexistante) →
  `orderBy('mutation_id')`.
- `AdvantagesPanel.jsx` : nouveau prop `isGm`, état `charMutations` (fetch `[characterId]`),
  `combinedEntries` gagne un 3ᵉ type `'mutation'` (badge "MUT", retrait réservé au MJ), bouton
  "Mutations" de l'étape 1 grisé si `!isGm`, Étape 2A réparée (`mut.name`/`mut.mutation_id` au lieu
  des champs V1 inexistants, `existing.count` au lieu d'`existing.level`), `handleAddMutation`
  réécrit vers `POST .../mutations`.
- `CharacterSheet.jsx` : `isGm` descendu vers `AdvantagesPanel` (1 ligne, déjà disponible en prop).

**Recherche/inspiration** (demande explicite Saar avant de coder) : pas de recherche externe —
réutilisation de 3 patterns déjà éprouvés dans ce même projet plutôt qu'un problème algorithmique
inédit (contrairement aux dés 3D qui avaient justifié `threejs-dice`) : l'upsert SQL brut de STEP3,
le gate `req.isGm` déjà utilisé 3 fois, le soft-delete par `status` déjà anticipé par le schéma.

**Testé** (avant de déclarer "100% sûr", conformément à la demande explicite de Saar) : `node
--check` (4 fichiers serveur) 0 erreur, ESLint client 0 erreur introduite (3 problèmes
pré-existants `CharacterSheet.jsx` confirmés via `git stash` — `calcAllureMoy`/`sheetId` non
utilisés, dep manquante), migration 125 vérifiée en base réelle (P53/P54 respectés), cycle complet
réel `addMutation`→`getMutations`→`removeMutation` (mutation simple, mutation avec override sexe/
fécondité — Asexué testé, `is_fertile` correctement resté `false`, mutation inconnue rejetée
proprement, soft-delete confirmé, base nettoyée après test), MUT2 revérifié corrigé (requête
`ref_mutations` réussit), SR + **parcours navigateur confirmé fonctionnel par Saar**.

**Limite trouvée par Saar en testant** : *"ajouter une mutation implique forcément d'appliquer les
EFFETS de la mutation (accès à une compétence, perte ou gain de statistiques, etc...). Est-ce qu'on
le gère dans le Wizard ça ?"* Réponse vérifiée par recherche exhaustive (`grep` server+client, pas
une supposition) : **non, le Wizard ne le gère pas non plus.**
- `char_mutation_effects_view` (migrations 96/109) agrège déjà les `mod_FOR..PRE`+résistances+
  armure de toutes les mutations actives — **jamais interrogée nulle part dans le code**, vue morte
  depuis sa création.
- Plus profond : `calcNA(base_level, pc_modifier, mod_genotype)` (`charStats.js:195`) n'a que 3
  paramètres — aucune place prévue pour un modificateur de mutation. Le calcul d'attribut n'a
  jamais été conçu pour ça, pour personne.
- Même diagnostic demandé et fait pour les Avantages : sur 76 lignes `ref_advantages`, seule
  `adv_076` (Fécondité) a un effet réellement appliqué, et encore, câblé en dur par ID
  (`if (advantageId === 'adv_076')`) plutôt que par lecture générique de `mod_identity` (qui
  contient pourtant `{is_fertile: true}`). Les 12 colonnes de modificateurs existent sur ~74
  avantages mais ne font jamais rien.

**Décisions de clôture (Saar)** :
- Gap **pas un blocage de clôture du Lot D** — pré-existant, aucune régression introduite, juste
  rendu visible plus tôt par les tests.
- **`docs/PLAN_MUTATION2.md` créé** (NOUVEAU) : diagnostic complet Mutations + Avantages, 3 pistes
  de résolution non tranchées (agrégation à la lecture / application à l'écriture / scope réduit
  priorisé), aucun code. Mis de côté pour une session dédiée que Saar lance juste après celle-ci.
- **Lot E (`[CS7]`) transféré intégralement** vers `docs/PLAN_MUTATION2.md` (même famille de
  problème — données de mutation jamais branchées jusqu'au bout) plutôt que de rester dans
  `PLAN_ADVANTAGESPANEL.md`.
- `docs/PLAN_ADVANTAGESPANEL.md` marqué **chantier clos** (Lots A/B/C/D faits, Lot E transféré).

**Non testé** : mutation `is_stackable` ajoutée deux fois via `addMutation()` directement (testé
seulement en SQL brut plus tôt dans la session) ; parcours navigateur du grisage bouton "Mutations"
côté joueur vs MJ (confirmé fonctionnel globalement par Saar, pas détaillé scénario par scénario).

---

## Session 141 (suite 12) — 2026-07-09/10 — Options de campagne : `revers` (OPT-06) câblée ✅ CLOS + mode développeur écarté (UX à deux niveaux) + consolidation mini-stepper Avantages pro ✅ CLOS

Session longue, trois volets liés (Revers → friction de test → rework UI/UX Avantages pro), documentée en une fois faute de point de coupure naturel. Note de numérotation : "suite 10" et "suite 11" étaient déjà pris par deux autres sessions parallèles (`PLAN_MUTATION2.md`/`PLAN_MODING.md`, sujets sans rapport) au moment de documenter celle-ci — repéré avant de commettre la collision, cette session prend donc "suite 12" (vérifié libre). Migration **126** consommée ici, déjà réconciliée par la session "suite 11" (voir son entrée, "Dérive de numérotation de migration confirmée en conditions réelles").

### Volet 1 — Revers (OPT-06)

Chantier "Options de campagne" (item 41), reprise directe (discussion, pas de questionnaire structuré). **Conception requise avant plan** : la table des Revers (LdB p.185+) n'était transcrite nulle part dans les docs — seulement 5 lignes placeholder (`[DETTE-ETAPE4-5]`). Saar a fourni le texte complet via un nouveau fichier `docs/REGLES/REGLEREVERS.md` (27 catégories 1D100, 5 avec sous-table imbriquée). Transcrit intégralement dans `docs/JOURNALTEMP.md` pour relecture avant migration — un point resté ouvert (**"Narco-dommages"**, texte présent dans la source mais sans plage 1-100 associée) confirmé par Saar comme **erreur du livre de base** (vérifié sur l'exemplaire papier), exclu des 27 lignes.

**Décisions de conception, tranchées une par une avec Saar** :
- **Déclencheur = total d'années CUMULÉES toutes carrières confondues**, pas par métier (contrairement au Tirage 1D10 Lot 6) — confirmé par relecture de `REGLE_CREATION.txt:1190-1199`, qui ne mentionne jamais "dans une Profession" contrairement à OPT-05.
- **Obligatoire, sans refus** — contrairement au jet volontaire de base ("+5 pts via la table des Revers", `REGLE_CREATION.txt:1156-1159`, mécanique différente, **hors scope** cette session).
- **Portée narrative uniquement** — aucune automatisation mécanique des conséquences (attribut/PC/économies), même traitement que Force Polaris OPT-04. Sous-tables (Blessure/Mutilation/Complot/Contamination/Faute lourde) intégrées en texte dans la description, jamais rejouées par le système.
- **Fichier indépendant** (`shared/careerSetbacks.js`), jamais fusionné avec `careerAdvantages.js` malgré la ressemblance de surface (jet lié aux années) — analyse critique demandée par Saar : déclencheur global vs par-métier, table à plages vs valeur exacte, obligatoire vs optionnel, zéro effet mécanique vs budget d'avantages. Fusionner aurait recréé deux fonctions dans une seule avec des branches conditionnelles, et élargi le rayon d'impact du Lot 6 déjà en prod.
- **Sous-step dédiée du mini-stepper** (`SetbacksAllocator.jsx`, NOUVEAU), pas un bloc dans `CareersAllocator.jsx` — Saar a insisté pour qu'Avantages pro et Revers soient "traités en même temps" (visibles, pas perdus dans un onglet) sans pour autant être mélangés dans le même code.

**Implémentation** :
- Migration `126_ref_setbacks_revers_table.js` (NOUVEAU) : `ref_setbacks` restructurée (`roll` exact → `roll_min`/`roll_max`, `career_id`/`category` retirés — jamais corrects pour cette mécanique, table réellement partagée) + 27 lignes réelles (couverture 1-100 vérifiée **programmatiquement**, pas à la main) ; `char_archetype.setback_rolls` (JSONB, nouveau) — pas `char_careers.setbacks` (colonne existante mais fausse cible maintenant que le déclencheur est global, laissée en l'état/inutilisée).
- `shared/careerSetbacks.js` : `getSetbackBlockCount(totalYears)` (`floor((years-10)/3)`, testé aux bornes 9/10/12/13/15/16/18/19/21/22) + `resolveSetback(roll, rows)`.
- `creationService.js` : `getStep4RefData` expose `ref_setbacks` (top-level) ; `startCreation` renvoie `reversEnabled` ; `reconcileCreation` STEP4 valide les tranches (bornes/doublons/résultat table) et rejette si obligatoire non résolu — calculé en haut du bloc STEP4 (pas après la boucle carrières, `totalCareerYears` dispo immédiatement depuis le payload).
- `Step4Experience.jsx` : nouvelle sous-step `SETBACKS` entre `CAREERS` et `SUMMARY`, sautée si non applicable (même pattern que `HIGHER_ED`).

**Bug trouvé en run à vide (avant tout test navigateur)** : un joueur revenant sur Carrières et réduisant le total d'années pouvait laisser un jet Revers orphelin (`blockIndex` devenu hors bornes), rejeté par le serveur sur un écran déjà quitté. Corrigé par état **dérivé** (`validSetbackRolls` filtré à chaque rendu) plutôt qu'un `useEffect`+`setState` — a aussi évité une seconde fois la même erreur ESLint (`react-hooks/set-state-in-effect`) rencontrée et corrigée pendant l'implémentation.

**Testé** : couverture 1-100 vérifiée par script, `getSetbackBlockCount` testé aux bornes, `node --check`/ESLint 0 erreur introduite sur tous les fichiers touchés, **SR + parcours navigateur confirmé Saar** (mini-stepper se déclenche correctement, jet + résultat affiché).

### Volet 2 — Mode développeur demandé, puis écarté au profit d'une UX à deux niveaux

Saar a signalé la vraie friction de test : devoir tout redistribuer (Étape 1 attributs + Étape 4 compétences/avantages pro) à chaque personnage de test. Demande initiale : un "mode développeur" (flag séparé par campagne, **jamais** mélangé aux Options de campagne — analyse critique validée : ce n'est pas une règle Polaris, ça n'a rien à faire dans `SETTINGS_SCHEMA`).

**Avant tout code, analyse serveur** : `validateStep1` (Étape 1) bloque un budget non totalement dépensé **côté serveur** (G1, exact) ; `computeSkillAllocation`/`computeProAdvantageAllocation` (Étape 4) ne l'ont **jamais** bloqué côté serveur (seulement le dépassement) — incohérence trouvée en creusant, pas un choix voulu. Saar a demandé si c'était l'occasion d'uniformiser plutôt que de patcher un contournement par-dessus une base incohérente.

**Proposition finale de Saar (meilleure que le mode développeur)** : bouton "Suivant" **toujours opérationnel** ; un solde de points non dépensé (gâchis, pas une violation de règle) déclenche un **avertissement au premier clic**, un **second clic confirme et avance quand même**. Rend le mode développeur inutile — n'importe qui peut cliquer deux fois, pas besoin de flag de campagne, pas de migration.

**Implémentation** :
- `shared/polarisUtils.js` : `validateStep1` sépare G1 (`budgetIncomplete`, informatif) de G2/G3/G4 (`erreurs`/`valide`, vraies bornes) — testé (`node -e`, cas budget non dépensé → `valide:true`, cas hors bornes → `valide:false`).
- `Step1Attributes.jsx` / `CareersAllocator.jsx` : même pattern — état dérivé (`warnedAtValue`/`warnedAllocSignature`, comparé à la valeur courante, jamais un `useEffect`+`setState`) pour détecter un avertissement déjà affiché et l'invalider automatiquement si l'état sous-jacent change entretemps.

**Testé** : `node --check`/ESLint 0 erreur introduite, **double-clic avertissement confirmé fonctionnel par Saar en conditions réelles** (Étape 1).

### Volet 3 — Consolidation du Tirage 1D10 (Avantages pro aléatoires) dans le mini-stepper

Demande distincte de Saar en testant Revers : le Tirage 1D10 (Lot 6, déjà en prod depuis Session 140) est "complètement invisible si tu ne sais pas où chercher" — enterré dans l'onglet "Avantages pro" de `CareersAllocator.jsx`, jamais dans le mini-stepper malgré une demande antérieure jamais suivie d'effet.

**Design, "pas de maquette mais prendre le temps d'y réfléchir" (consigne Saar)** : contrairement à Revers (global, narratif pur), le Tirage 1D10 est **par métier** et son résultat (`useAsPoints`) **modifie rétroactivement le budget d'Avantages pro**. Le sortir vers un sous-step séparé APRÈS Carrières créait un risque réel : répartir manuellement tout le budget sur l'écran Carrières, puis convertir un jet en points sur un écran différent, laissant une répartition déjà quittée en dépassement. Saar a proposé la vraie solution : **fusionner répartition manuelle (Lot 4) et Tirage (Lot 6) dans la même nouvelle sous-step**, réglant le séquençage par construction plutôt que par un garde-fou.

**Recherche/inspiration évaluée avant codage (demande explicite Saar)** : machine à états (XState) écartée — aucune lib de state machine nulle part dans ce projet, en introduire une pour un seul composant aurait fragmenté l'architecture au lieu de la renforcer. Pattern "field array" (react-hook-form) retenu **dans le principe seulement** (décomposition en sous-composant par élément répété, `CareerAdvantageBlock`), sans la librairie — ce projet n'utilise aucune lib de formulaire.

**Implémentation** :
- `ProAdvantagesAllocator.jsx` (NOUVEAU) : sous-step consolidée, un bloc par métier retenu (répartition manuelle + Tirage 1D10, écouteur `DICE_RESULT`/overlay dé propres, même pattern socket que `SetbacksAllocator.jsx`).
- `CareersAllocator.jsx` : onglet "avant" retiré intégralement (JSX + 8 actions reducer + imports `DiceRoller`/`DiceLights`/`Canvas`/`useSocket`/`useAuthStore`/`computeProAdvantageAllocation`/`computeRandomBudgetDelta`) — relu intégralement avant modification pour un plan de suppression exact, `canNext`/statut simplifiés (ne portent plus que sur les compétences).
- `Step4Experience.jsx` : nouvelle sous-step `PRO_ADVANTAGES` entre `CAREERS` et `SETBACKS`, **toujours affichée** (pas de condition de saut — un métier retenu a toujours un budget, contrairement à Revers/Études). Logique de saut Carrières↔Revers corrigée pour tenir compte de l'étape intermédiaire (le saut se fait désormais depuis/vers `PRO_ADVANTAGES`, plus directement Carrières↔Récap).
- `creation.json` : clé `career_tab_avant` supprimée (orpheline après le retrait de l'onglet).

**Deux vrais bugs trouvés en run à vide, avant tout signalement Saar** :
1. Signature d'avertissement basée uniquement sur `proAdvAllocations`, pas `randomPicks` — un jet relancé (sans toucher la répartition manuelle) changeait pourtant le budget via `randomBudgetDelta`, laissant un avertissement obsolète passer inaperçu. Corrigé : signature couvrant les deux.
2. **Incohérence client/serveur sur le dépassement de budget** — `hasIncomplete` traitait sous-dépensé et sur-dépensé de façon identique (avertissement doux, contournable), alors que le serveur (`creationService.js`, `err.code==='over_budget'`) rejette **toujours** le dépassement (vraie violation de règle, pas un gâchis). Le scénario "conversion rétroactive après répartition complète" pouvait laisser un joueur "confirmer" un état que le serveur refuse de toute façon, avec un rejet générique tardif au moment de "Terminer". Corrigé : sur-dépensé (`remaining < 0`) est désormais un vrai blocage dur (cohérent avec le serveur), seul le sous-dépensé reste un avertissement.
3. Texte de statut ("...à répartir (onglet Avantages pro)") resté périmé après le retrait de l'onglet — corrigé, trouvé en relisant une capture d'écran fournie par Saar.

**Dette trouvée en testant les limites de navigation, ajoutée au backlog (`[WIZ-4]`)** : le mini-stepper ne revalide jamais les blocages durs de la sous-step quittée au clic direct (contourne par ex. "au moins une carrière requise" en retirant sa carrière puis en cliquant directement sur une sous-step déjà visitée). **Vérifié préexistant**, pas une régression de cette session — le filet de sécurité serveur empêche toute donnée invalide persistée, juste un rejet tardif au lieu d'un blocage immédiat. Non traité (élargirait le chantier à toute l'architecture de navigation).

**Roadmap ouverte, décision explicite Saar ("à faire impérativement, maintenant ou sur une roadmap")** : Célébrité/Allié/Contact/Ennemi/Opposant et les autres "avantages relationnels" (Revers + Tirage 1D10) ne sont trackés nulle part mécaniquement — bloque toute automatisation au-delà de la conversion en points, déjà faite. Confirmé avec un vrai exemple lu en base (Cultivateur/Éleveur, migration 108 : "Célébrité +2", "Parcelle/Ferme +2", "Revenus +10% à partir de cette année"). Ajouté au backlog `CLAUDE.md` (`[ADV1]` jauges non trackées, `[ADV2]` modificateurs de revenus cumulatifs, `[ADV3]` déblocage de compétence via tirage) — **chantier dédié à planifier après celui-ci**, décision de Saar de ne pas le traiter maintenant.

**Testé** : `node --check`/ESLint 0 erreur introduite sur l'ensemble des fichiers touchés (sweep final), couverture 1-100 vérifiée par script, tests unitaires `shared/careerSetbacks.js`, **SR + parcours navigateur confirmé Saar** (board Avantages pro + tirages affichés et fonctionnels par métier, mini-stepper Revers confirmé après un faux-positif de test de Saar lui-même).

**Non testé** : le scénario "conversion rétroactive" en conditions réelles navigateur (corrigé par construction — blocage dur — suite au bug trouvé en run à vide, pas re-testé manuellement après coup) ; finalisation complète ("Terminer") avec un mélange Revers + Avantages pro non confirmée scénario par scénario (Saar : "semble ok") ; persistance `char_archetype.setback_rolls`/`char_careers.pro_advantages`/`random_picks` non vérifiée directement en base après un `reconcileCreation` réel.

---

## Session 141 (suite 11) — 2026-07-09 — PLAN_MODING.md : analyse critique + correction ✅ CLOS, chantier mis en pause

Session **analytique/planification pure — aucun code écrit**. Reprise à froid de
`docs/PLAN_MODING.md` (rédigé Session 120, 2026-06-24, jamais commencé depuis).

**Vérification d'implémentation demandée par Saar** : 0% du plan existant en base/code — aucune
migration 86 (le numéro proposé est déjà pris par `86_trade_offers.js`), aucun `modingService.js`,
aucune route `/moding/*`, aucune trace de `char_inventory_mods`/`installed_mods`. Plan resté à l'état
papier depuis sa rédaction.

**Analyse critique du plan lui-même (demandée par Saar)** — corrections apportées avant tout code :
- Migration renumérotée (86 → 124 au moment de l'analyse, puis re-décalée en fin de session — voir
  plus bas).
- Routes déplacées dans `char-sheet.js` (réutilise le guard ownership `router.param('characterId', ...)`
  déjà existant) au lieu d'un router séparé qui l'aurait réimplémenté.
- `REGLEARMURE.md`, cité par le plan initial pour une éventuelle limite de slots, est **la mauvaise
  source** (mécas/exo-armures, pas armes portatives) — retiré. Aucune règle de quota trouvée dans les
  16 lignes réelles `ref_equipment` (family=Armes, category=Accessoires pour armes).
- Notification socket requalifiée obligatoire (pas "optionnelle" comme écrit initialement) — vérifié
  que toutes les routes touchant `char_inventory` dans `char-sheet.js` émettent déjà
  `WS.INVENTORY_*`.
- **Scope explicitement réduit à une Phase A** (rangement pur — installer/retirer un mod de
  l'inventaire, aucun effet de jeu) — la **Phase B** (effet mécanique sur le Test de tir) extraite en
  section dédiée, à planifier séparément (règle "un seul bug/sujet à la fois").

**Étape 0 ajoutée à la Phase A, à la demande de Saar** : `char-sheet.js` fait ~1900 lignes — extraction
d'un `inventoryService.js` dédié avant d'y ajouter le moding. Portée exacte vérifiée ligne par ligne
(6 routes + 4 helpers + constantes déplacés ; `weapon-skill`/`sols`/drone explicitement exclus ;
dette `tradeService.js` — duplique déjà `char_inventory` sans jamais émettre de socket — repérée mais
non traitée, feature déjà en prod).

**"On ne laisse rien au codage" (Saar)** — trois points encore flous fermés par lecture directe du
code, pas par supposition :
1. **Bug réel trouvé** dans ma propre proposition : la logique `install` faisait un `DELETE`
   inconditionnel sur la ligne `char_inventory` du mod — incorrect si le mod est en stack
   (`quantity > 1`, ex. 2 "Visée laser" achetées). Corrigé via `inventoryService.removeItem`
   (décrément d'1 unité, réutilise la sémantique déjà existante de la route DELETE) — nouveau piège
   **P7** dans le plan.
2. **Mécanisme d'ouverture `ModingWindow`** tranché en lisant `CharacterWindow.jsx`/
   `InventoryPanel.jsx` : fenêtre flottante (convention du projet — suffixe "Window" = flottant),
   état `modingOpen` dans `CharacterWindow.jsx`, bouton "Customisation" dans `InventoryPanel.jsx`
   (nouvelle prop `onOpenModing`).
3. **Rafraîchissement temps réel** tracé jusqu'au mécanisme exact : `client/src/lib/
   useCharacterSocket.js:36-44` (déjà existant pour `INVENTORY_*`) doit gagner un handler
   `onModInstalled` suivant le même pattern pour le nouvel event `WS.MOD_INSTALLED`.

**Découpage de la Phase B, avec recherche dans `REGLESYSCOMBAT.md` + le code combat existant** :
formule du Test de tir à distance déjà localisée (`socketCombatHelpers.js:1340`,
`chancesDeReussite = skillTotal + totalModComp + effectiveMalus - carenceArmure + coverageModifier`,
`totalModComp` = tableau de modificateurs déjà réutilisable). Mais la majorité des 16 accessoires
réels dépend de mécaniques absentes du code :
- **Lot B1** (seul lot sans dépendance manquante) : bonus statiques (Visée laser +2) + exclusivité de
  sous-famille "Système de tir assisté" (Cyclope PVI/Onarck P/Implant palmaire/Vanguard, 4 objets,
  on prend le max) — s'accroche directement à `totalModComp`.
- **Lot B2** (Lunette de visée) : dépend du **Tir visé**, dont **aucune trace n'existe dans
  `server/src/socket/*`** (grep exhaustif, 0 résultat) — **nouvelle dette, distincte** de `COM9`
  ("Localisation précise") et de "Changer le mode de tir" : trois mécaniques voisines dans
  `REGLESYSCOMBAT.md` mais différentes (vérifié par lecture directe, pas une supposition), aucune
  des trois implémentée.
- **Lot B3** (Analyseur tactique) : bonus escaladant round par round contre une cible verrouillée —
  état persistant par combat, pas un modificateur statique.
- **Lot B4** (Projecteur de mouvement) : réduit un "malus de cible en mouvement" qui n'existe pas non
  plus dans le calcul actuel (vérifié).
- **Lot B5** (Mémoire de cibles, Système réactif autonome) : verrouillage IFF / tir automatique sans
  joueur — mécaniques hors sujet moding.
- Silencieux/Trépied/Calculateur laser/Harnais mécanisé : aucun bonus de Test de tir — narratif,
  couvert par le rangement Phase A, rien à faire en Phase B.

**Décision de clôture (Saar)** : Tir visé est un chantier à part entière, **jugé prioritaire par
Saar** — à planifier et implémenter avant de reprendre le moding, même si Phase A et le Lot B1
restent techniquement indépendants. **Le chantier `PLAN_MODING.md` est mis en pause dans son
ensemble** (décision explicite de Saar, pas seulement les lots dépendants). Aucun plan écrit pour Tir
visé pour l'instant — seulement identifié comme prérequis réel, en plus d'être une dette déjà connue
(`COM9`, "Changer le mode de tir").

**Dérive de numérotation de migration confirmée en conditions réelles (P53)** : au moment de refermer
cette session, `124_char_advantage_notes.js`/`125_char_mutations_source_campaign.js`/
`126_ref_setbacks_revers_table.js` avaient déjà consommé les numéros proposés par le plan quelques
heures plus tôt dans la même journée (travail parallèle sur `PLAN_ADVANTAGESPANEL.md` Lots C/D et sur
l'option de campagne `revers`) — `docs/PLAN_MODING.md` mis à jour pour ne pas laisser un numéro de
migration obsolète, avec rappel explicite de revérifier `ls server/src/db/migrations/` avant tout
codage futur.

**Testé** : rien à tester — session 100% documentaire/planification, zéro fichier de code touché.

**Non testé** : sans objet.

Détail complet du plan corrigé : `docs/PLAN_MODING.md` (section "Historique des révisions").

---

## Session 141 (suite 13) — 2026-07-10 — PLAN_MUTATION2 Lot 1 : attributs primaires mutations ✅ CLOS

Suite directe de la session "suite 10" (diagnostic + architecture `docs/PLAN_MUTATION2.md`, aucun
code) — reprise en conversation continue, pas une nouvelle session résumée. Note de numérotation :
"suite 11"/"suite 12" déjà pris par deux sessions parallèles sans rapport (`PLAN_MODING.md`, Revers
OPT-06) au moment de refermer celle-ci — "suite 13" vérifié libre avant d'écrire.

**Décisions Saar avant codage** : (1) l'AN/NA reste calculé dynamiquement des deux côtés
(client+serveur), jamais stocké — confirmé préservé, recherche faite (pattern "derived data" de
Foundry VTT, monorepo `shared/` déjà établi sur ce projet) à la demande explicite de Saar avant de
coder quoi que ce soit. (2) Aucun bricolage toléré : le calcul dupliqué à 3 endroits (serveur +
2 client) et la convention PI4 (encombrement ignorant génotype/mutations) sont de vrais gaps à
corriger, pas des choix à présenter comme options équivalentes à une rustine — mémoire
`feedback_no_hacks.md` renforcée suite à un premier brouillon qui présentait par erreur un
"correctif rapide" comme une alternative valable.

**Codé (~20 fichiers, 240+ lignes)** :
- `shared/polarisUtils.js` : nouveau point de calcul unique — `calcNA`, `getGenotypeModForAttr`,
  `getMutationModForAttr`, `ATTR_TO_GENOTYPE_MOD`/`ATTR_TO_MUTATION_MOD`.
- `server/src/lib/charStats.js` : supprime ses 5 doublons (`AN_TABLE`, `calcAN`,
  `ATTR_TO_GENOTYPE_MOD`, `getGenotypeModForAttr`, `calcNA`), importe depuis `shared/`.
  `calcAttributeAN`/`calcAttributeNA`/`calcSkillTotal` gagnent un paramètre `mutationEffectsRow`.
  `calcEncumbrancePenalty` gagne un paramètre `multiplier`.
- `mutationService.js` : `getMutationEffects(sheetId)` (lit `char_mutation_effects_view`).
- `campaignSettingsService.js`/`routes/campaigns.js` : options `encumbrance_enabled`/
  `encumbrance_multiplier` (défauts `true`/`3` — comportement actuel préservé).
- **PI4 réellement corrigé** (pas documenté comme exclusion, décision explicite Saar) : 5 sites
  trouvés après analyse à charge (2 manqués au premier passage) — `char-sheet.js` (`GET
  /inventory`), `socketCombatHelpers.js` ×3 (attaquant/défenseur CaC, tireur), `socketEntity.js` —
  utilisent désormais `calcAttributeNA` (génotype + mutation inclus) au lieu du calcul brut.
- 15 sites de calcul d'attribut/compétence rebranchés (`char-sheet.js`, `socketEntity.js`,
  `socketCombatHelpers.js`, `socketCombatResolution.js`, `socketDice.js`) + `CharacterSheet.jsx`/
  `CombatActionWindow.jsx` (suppriment leurs réimplémentations locales de `calcNA`).
- `SectionGameRules.jsx`/`fr.json` : UI des 2 nouvelles options de campagne.

**4 bugs supplémentaires trouvés en testant avec Saar, tous corrigés dans le même chantier** (même
cause profonde : les mutations à sous-table n'avaient jamais été branchées de bout en bout) :

1. **Vue aveugle aux sous-types** — `char_mutation_effects_view` ne lisait que `ref_mutations`,
   jamais `ref_mutation_subtypes`. "Caractère génétique animal" (seule mutation `has_subtable` du
   catalogue) porte ses `mod_FOR..PRE` sur la table enfant, pas la ligne parente (0 par défaut) —
   la vue retournait donc toujours 0, quel que soit le sous-type choisi (félin/canin/reptilien/
   simiesque). Migration `127_char_mutation_effects_view_subtypes.js` (`LEFT JOIN
   ref_mutation_subtypes`).
2. **Sélecteur de sous-type manquant côté Lot D** — `AdvantagesPanel.jsx` n'avait jamais eu de
   sélecteur (`handleAddMutation` n'envoyait aucun `subtype_id`, gap pré-existant de la session
   "suite 9", pas introduit ici). Ajout d'une étape de drill-down (`step: 'mutation-subtype'`) +
   `mutationService.addMutation(sheetId, mutationId, subtypeId)` (upsert sur le bon index partiel
   selon présence du sous-type — deux arbiters distincts, Postgres l'exige, ne permet pas de cibler
   les deux dans une seule clause `ON CONFLICT`) + `ref.js`/`getMutations()` exposent `subtable`/
   `subtype_name`.
3. **État client jamais rafraîchi** — `AdvantagesPanel` notifiait `onSaved` (simple ✓ visuel dans
   `CharacterWindow.jsx`, confirmé par lecture de toute la chaîne d'appel — ne recharge rien) après
   un ajout/retrait de mutation. `CharacterSheet.jsx` ne redemandait jamais `mutationEffects`,
   figé jusqu'à démontage/remontage complet de la fenêtre. Nouvelle route légère `GET
   /char-sheet/:characterId/mutation-effects` + callback dédié `onMutationsChanged` (distinct
   d'`onSaved`) appelé après ajout/retrait.
4. **Bug le plus sérieux — `bigint` retourné comme `string` par `node-pg`** : `SUM()` sur une
   colonne `integer` produit un `bigint` en PostgreSQL, que le driver parse en **chaîne JS** par
   défaut (évite la perte de précision au-delà de 2^53) — latent dans la vue depuis sa création
   (jamais consommée avant ce lot). `calcNA` faisait `10 + 0 + 0 + '2'` → concaténation de chaîne
   (`'102'`) au lieu d'une addition (`12`) — cause exacte du "COO Niveau Actuel = 110" signalé par
   Saar (`IMPROVISATION NON TOLÉRÉE` — réaction justifiée). **Erreur de vérification de ma part** :
   j'avais vu `mod_COO: '2'` entre guillemets dans mes propres tests instrumentés plus tôt dans la
   session et je ne l'avais pas identifié comme un problème de type — je l'ai reconnu explicitement
   auprès de Saar plutôt que de minimiser. Migration `128_char_mutation_effects_view_int_cast.js`
   (cast `::integer` sur les 13 colonnes numériques). **Piège Postgres trouvé en corrigeant** :
   `CREATE OR REPLACE VIEW` refuse de changer le type d'une colonne existante (erreur `42P16`,
   `bigint`→`integer`) — `DROP VIEW` + `CREATE` obligatoire, contrairement aux migrations 109/127
   qui ne changeaient que la formule, jamais le type. Audit du reste du code pour le même risque :
   un seul autre endroit trouvé (`char-sheet.js`, potentiel drone), déjà protégé correctement
   (`Number(row.total)`) — pas d'autre cas caché.

**Méthode de vérification (demande explicite Saar "on n'est pas pressés, on veut être sûr")** :
recherche de bonnes pratiques avant architecture (pattern Foundry VTT/monorepo), analyse à charge
répétée à chaque étape (3 sites d'encombrement manqués retrouvés en revérifiant systématiquement),
et surtout **vérification instrumentée en base réelle** à chaque correctif — connexion effective à
la DB de développement (`.env` du dossier racine, pas `server/`), requêtes réelles en transactions
systématiquement annulées (`ROLLBACK`/`throw` dans le callback knex), jamais de donnée réelle
modifiée hors du flux normal de l'app. Chaque bug a été reproduit puis corrigé avec preuve
avant/après (valeur erronée → valeur correcte), pas seulement déduit par lecture de code.

**Testé** : `node --check` 0 erreur sur tous les fichiers serveur/partagés touchés, ESLint 0
nouvelle erreur sur tous les fichiers client touchés (confirmé `git stash` avant/après à plusieurs
reprises), `fr.json` valide, scénarios `node -e` (non-régression `calcAN` sur toute la plage,
`calcNA`/`calcAttributeAN`/`calcAttributeNA` avec/sans mutation, `calcEncumbrancePenalty` avec/sans
multiplicateur personnalisé), vérifications instrumentées en base réelle (transactions annulées)
pour chacun des 4 bugs. **SR + parcours navigateur confirmé fonctionnel par Saar** : ajout d'une
mutation à sous-type via le Lot D avec sélection félin/canin/reptilien/simiesque, effet COO+2
visible immédiatement sur la fiche sans fermeture/réouverture de la fenêtre.

**Non testé** : effet en résolution de combat réelle (jet de compétence reflétant le bonus de
mutation — vérifié par lecture/scénarios `node -e`, pas par un jet réel en session) ; bascule
`encumbrance_enabled`/`encumbrance_multiplier` en navigateur ; aperçu Wizard ("peek",
`WizardCreation.jsx openPeek`) après fermeture/réouverture explicite (hypothèse formulée : même
cause que le bug 3 ci-dessus, la fonction refait un `reconcile`+`preview` complet à chaque ouverture
— non confirmée par un test dédié de Saar) ; les 6 autres attributs primaires avec une mutation
autre que "Caractère félin" ; retrait d'une mutation stackée (`count` > 1) en conditions réelles.

Détail complet (plan, ligne-à-ligne, analyse à charge) : `docs/PLAN_MUTATION2.md` section Lot 1.

---

## Session 141 (suite 14) — 2026-07-11

### Contexte

Suite directe de "suite 13" dans la même conversation (pas une reprise de résumé). Point de départ :
Saar signale un bug qu'un utilisateur ne devrait jamais rencontrer — supprimer un character ne
supprime jamais ses tokens sur les battlemaps, ils restent visibles et participent au combat sans
fiche de statistiques liée. Quatre correctifs se sont enchaînés, chacun trouvé en testant le
précédent avec Saar — jamais planifiés à l'avance comme un seul chantier.

### (1) Cascade de suppression token — `server/src/lib/tokenLifecycle.js` (NOUVEAU)

Root cause vérifiée par lecture : `tokens.character_id` a une FK `ON DELETE SET NULL` (migration
`20260331_16_tokens_character_id.js`, commentaire d'origine "le token reste sur la carte" — choix
voulu à l'époque, faux pour le cas combat) et `DELETE /api/characters/:id` ne nettoyait jamais les
tokens du character supprimé.

Recherche demandée par Saar avant codage ("architecture sérieuse ou bricolage ?") : Foundry VTT ne
supprime pas non plus automatiquement les tokens liés en supprimant un Actor (limitation connue,
comblée par des modules communautaires) — pas un bon modèle à copier, Polaris a une contrainte plus
stricte (combat sans fiche = vrai problème mécanique). Principe retenu : encapsuler le mécanisme de
suppression en un seul endroit (Nystrom, Game Programming Patterns, déjà cité dans
`PLAN_TIRVISE.md`) plutôt que dupliquer le triplet Redis/DB/socket à chaque nouveau point de
suppression.

`removeTokens(io, tokens, campaignId)` (nettoyage Redis `collisionRemoveToken` + suppression DB en
lot + broadcast `TOKEN_DELETED` par token) — appelé par :
- `tokens.js DELETE /:id` — refactorée, comportement strictement inchangé.
- `characters.js DELETE /:id` — le bug signalé, corrigé.
- `battlemaps.js DELETE /:id` — 2e occurrence du même trou trouvée en vérifiant (comptait
  uniquement sur le `ON DELETE CASCADE` SQL, aucun nettoyage Redis/socket) — incluse dans le même
  chantier après validation explicite de Saar (question posée : bug séparé ou inclus maintenant).

Testé : `node --check`/ESLint 0 erreur introduite (`poolBase` pré-existant confirmé `git stash`),
`combat_roster`/`combat_actions` confirmés `ON DELETE CASCADE` via `information_schema` réel (pas
supposé), scénario complet en fixtures réelles (character + 2 tokens sur 2 battlemaps + entrée
`combat_roster`) via `removeTokens()` direct, puis 2 vraies requêtes HTTP contre le serveur réel
(JWT signé, cookie `token=`) sur `DELETE /characters/:id` et `DELETE /battlemaps/:id` — tokens
supprimés, Redis nettoyé, `combat_roster` cascadé, résidu vérifié à zéro après nettoyage.
Non testé : suppression via l'UI réelle en navigateur (HTTP direct uniquement).

### (2) Migration 132 — char_sheet.character_id dédoublonné + UNIQUE

En testant (1), Saar signale que Thug/Deep/Soleil/Mr Sourire ont des tokens visibles sur la carte
sans fiche dans la sidebar. Investigation (pas de suppression à l'aveugle) : ces personnages
existent toujours en base (visible=true pour 3/4), pas de vraie suppression — le vrai symptôme
était une absence de la liste sidebar, cause distincte.

Trouvé en creusant : `char_sheet` n'a jamais eu de contrainte UNIQUE sur `character_id` (migration
36, origine du projet). 9 personnages de "Camp LOCALE" ont chacun 2 lignes `char_sheet`, créées à
quelques millisecondes d'écart (double-soumission classique, code aujourd'hui disparu —
`startCreation` actuel est atomique, 1 transaction, character_id toujours neuf). Sur les persos
activement joués (Deep, BaBar, Mr sourire, Soleil), les données ont réellement divergé entre les
2 lignes (attributs custom vs défaut, compétences, sols — jusqu'à -49364 sur une ligne vs 50635 sur
l'autre pour Mr sourire) : le jeu écrivait au hasard sur l'une ou l'autre selon les sessions.

Saar, interrogé sur l'arbitrage ligne A/B via AskUserQuestion : refusé — "on est en phase de
développement, ces données sont peu importantes... ce qui est vital c'est de profiter de ce bug pour
corriger PROPREMENT l'architecture." Dédoublonnage réglé par une règle uniforme et déterministe
(score = compétences+carrières+mutations+avantages+blessures, tie-break updated_at puis created_at
puis id), pas un choix au cas par cas.

`132_char_sheet_dedupe_and_unique.js` : dédoublonne (13 tables filles confirmées ON DELETE CASCADE
via information_schema réel, pas la liste supposée de la doc de migration 36) puis
ADD CONSTRAINT uq_char_sheet_character_id UNIQUE (character_id).

Testé : dry-run complet en transaction annulée contre les 9 vrais personnages avant d'écrire la
migration (résultat vérifié ligne par ligne) ; migration exécutée réellement (auto-appliquée
nodemon) — 0 doublon restant, contrainte présente, les 4 personnages vérifiés individuellement (bon
survivant conservé, identique au dry-run).

### (3) Atomicité Wizard — reconcileCreation gagne finalize

En testant (2), Saar demande "architecture SÛRE, ROBUSTE et COMPLÈTE ou on repart en analyse" —
poussé à creuser la vraie cause de la disparition sidebar plutôt que de se contenter d'un backfill.
Trouvé : `routes/characters.js` (liste sidebar) exclut tout personnage dont un char_sheet a
wizard_locked_at IS NULL (migration 119, Session 139) — mais `handleTerminate`
(`WizardCreation.jsx`) faisait 2 appels réseau séparés (POST .../reconcile puis POST .../lock).
Toute coupure entre les deux (réseau, onglet fermé, redémarrage serveur) laisse la fiche
creation_state='complete' mais wizard_locked_at jamais posé — invisible pour toujours, sans retry
possible. "jeune" (créé 3 jours avant ce test) prouvait que ce n'était pas un incident historique
clos.

Fusion en un seul appel atomique, réutilise lockWizard(sheetId, trxOpt) — déjà construit pour
vaultService.cloneCharacterDeep (pattern trx-or-db), pas recodé de zéro. Dans reconcileCreation :
si finalize est demandé, rejet immédiat (AppError 400) si isComplete est faux, sinon appel de
lockWizard(sheetId, trx) dans la même transaction. `WizardCreation.jsx` : handleTerminate envoie
finalize: true dans son unique appel reconcile, supprime le second appel /lock. openPeek (seul
autre appelant de /reconcile, vérifié) ne passe jamais finalize, comportement inchangé.

`133_char_sheet_wizard_locked_backfill.js` : backfill wizard_locked_at pour les fiches historiques
concernées — critère dérivé du code (creation_state IS NULL = antérieur au système Wizard lui-même,
structurellement pas un brouillon en cours ; 'complete' = Wizard fini mais jamais verrouillé, bug
(3) ci-dessus) — jamais les vraies draft_step0 (58 lignes, vérifié intactes après coup). Exécutée
après (2), un seul character_id par ligne concernée.

Testé : lockWizard(sheetId, trx) vérifié dans une transaction manuelle sur "jeune" (vrai cas cassé),
rollback confirmé ; migrations 132/133 exécutées réellement — Deep/BaBar/Mr sourire/Soleil/Conan/
Civil/Bobar/Koko/Mr Sourire/jeune/Mr STEP6 Final réapparaissent tous dans la requête sidebar réelle ;
rejet + rollback complet de la transaction vérifié sur un vrai brouillon (step1 valide envoyé avec
finalize sur données incomplètes → aucune trace de char_identity créée malgré le step1 valide) via
appel direct du service ET vraie requête HTTP (400 avec le message attendu).
Dette [WIZLOCK1] ajoutée (CLAUDE.md) — cause probable de "Mr STEP6 Final"/"jeune" jamais verrouillés
identifiée (ce bug), pas re-vérifiée a posteriori sur ces 2 cas précis.
Non testé : parcours Wizard complet réel jusqu'au clic "Terminer" (le mécanisme d'atomicité est
vérifié en isolation — transaction + rollback — pas observé bout en bout en navigateur).

### (4) Bonus féminin Coordination/Présence — shared/polarisUtils.js

Test navigateur de Saar sur (3) interrompu : erreur "Étape 1 invalide : Bonus féminin dépassé : 5 > 2
(COO: +5, PRE: +0)" à l'étape 6 (Terminer), pour un problème d'étape 1 — signalé "incompréhensible
sans mon explication". Vérifié dans REGLE_CREATION.txt:293-296 : la règle est correcte
(bonusCOO+bonusPRE ≤ 2), mais surgit trop tard (aucune UI ne l'empêche avant la finalisation).

1er correctif (abandonné après relecture critique) : blocage live des spinners Mod.PC COO/PRE au
plafond, règle centralisée dans shared/polarisUtils.js (getFemininBonusTotal). Testé et fonctionnel
en isolation, mais casse un cas réel signalé par Saar juste après : "je ne peux mettre aucun point
en Présence" dès que Coordination avait déjà consommé le quota. Cause racine réexaminée :
REGLE_CREATION.txt dit "les valeurs DE BASE... modifiées" — un décalage de base (comme Force -2),
pas un plafond sur la valeur finale achetée en PC. Le code (Session 137, jamais revu jusqu'ici)
traitait COO-7 comme si c'était TOUT du bonus gratuit, bloquant aussi l'achat PC normal au-delà —
bug présent depuis l'origine de cette option, masqué jusqu'ici car jamais vérifié qu'à la toute fin
(step 6).

Saar propose une simplification ("comme Force, sans UI supplémentaire ?") plutôt que mon plan initial
(nouvel état de répartition + mini-stepper dédié, jugé trop complexe). Vérifié mathématiquement
(6 scénarios node -e, y compris le cas exact signalé) : une remise forfaitaire (coût des 2 premiers
points investis en COO+PRE combinés, peu importe la répartition) est algébriquement identique à un
décalage de base par attribut, car COST_LOOKUP[7]=0 rend l'algèbre équivalente pour tout split.
Résultat : zéro nouvel état, zéro nouvelle UI — le spinner Mod.PC existant suffit.

shared/polarisUtils.js : calcTotalCost applique la remise (getFemininBonusDiscount, nouveau,
remplace getFemininBonusTotal du 1er correctif abandonné) ; G4 (validateStep1) supprimée
entièrement — la remise s'auto-limite à 2 par construction, plus rien à rejeter. Step1Attributes.jsx
: les 3 éditions du 1er correctif (canIncrement/handleModPC/handleSetFeminin) intégralement
annulées, fichier revenu identique à sa version d'avant ce chantier. creation.json :
ruleFemininBonus réécrite pour expliquer la remise (demande initiale de Saar : rendre la règle
compréhensible dans l'accordéon).

Testé : node --check/ESLint 0 nouvelle erreur, creation.json validé, 7 scénarios node -e (cas Saar
original n'est plus rejeté, nouveau cas COO-a-tout-pris n'est plus bloqué, coût exact vérifié 1 PC
au lieu de 3, remise plafonnée à 2 même avec investissement massif, remise nulle si rien investi,
G2/G3 non régressées), SR + fonctionnel confirmé Saar en navigateur réel.

### Testé (ensemble de la session) / Non testé

Testé : voir chaque sous-section — combinaison d'instrumentation directe (transactions réelles,
appels de service directs, vraies requêtes HTTP avec JWT signé) et de tests unitaires purs sur les
fonctions partagées. Item (4) seul confirmé par un parcours navigateur réel de Saar.
Non testé : suppression de character/battlemap via l'UI réelle (items 1-2, HTTP direct uniquement) ;
parcours Wizard complet jusqu'à "Terminer" en conditions réelles navigateur (item 3, mécanisme
vérifié en isolation).

## Session 141 (suite 15) — Dual-wield armes identiques + emplacements armure pairés ✅ CLOS
> Note de numérotation : "suite 15" choisi comme prochain numéro apparemment libre — une session
> parallèle semble active sur un autre chantier (Vault/Tir visé, fichiers non journalisés vus dans
> `git status` : `docs/PLAN_TIRVISE.md`, `vaultService.js`, migrations 129-133) ; si collision,
> reconcilier à la prochaine relecture.

Signalement Saar : deux armes identiques (même `equipment_id`) ne pouvaient pas être équipées une
dans chaque main — deux armes différentes fonctionnaient. **3 bugs empilés, trouvés et corrigés
en testant chacun avant de passer au suivant (règle "un seul bug à la fois" respectée par
itération, pas par plan groupé).**

**(1) Cause racine — stacking d'items équipables.** `char_inventory` fusionnait deux armes
identiques en une seule ligne `quantity=2` (POST /inventory + achat marchand `tradeService.js`) —
un seul exemplaire physique ne peut pas être dans deux mains à la fois. Recherche externe (pattern
industrie jeu vidéo/inventaire : "les objets à identité unique ne doivent jamais stacker, à traiter
dans l'architecture, pas en rustine") + preuve interne (armes déjà stateful par exemplaire —
`current_ammo`/`ammo_remaining`) confirmant que l'ancienne approche (split réactif au moment
d'équiper, proposée puis rejetée) aurait été du bricolage. **Solution retenue : un item équipable
(`ref_equipment.location` hors `null`/`'D'`/`'Ce'`) n'a jamais `quantity>1`, invariant posé à
l'écriture.** `server/src/lib/inventoryRules.js` (NOUVEAU, `isEquippableLocation`) +
`char-sheet.js` (`POST /inventory` insère N lignes indépendantes si équipable+quantity>1, `PUT
/inventory/:itemId` rejette `quantity≠1` sur un item équipable) + `tradeService.js` (achat
marchand, même invariant). Migration `131_split_equippable_stacks.js` (NOUVEAU) : corrige 3 lignes
déjà corrompues trouvées en base réelle (dont un "Scorpion" `quantity=2 slot='MG'` — exactement le
bug signalé, personnage réel). Round-trip `down`/`up` vérifié (P52/P53/P54 respectés — migration
déjà auto-appliquée par nodemon avant test manuel, `knex_migrations` vérifiée avant tout appel).

**(2) `WeaponPanel.jsx` — liste "armes disponibles" n'excluait pas les armes déjà équipées.**
Une fois (1) corrigé, le menu déroulant "Équiper" de CHAQUE main piochait dans `availableWeapons`,
qui ne filtrait jamais `i.slot` — l'arme déjà en main gauche réapparaissait dans le menu de la main
droite (même nom, indiscernable). La sélectionner déplaçait la ligne au lieu d'en équiper une
seconde — symptôme exact rapporté par Saar après le fix (1) seul. Fix : `&& !i.slot` ajouté au
filtre (complète un prédicat qui portait déjà ce nom sans le respecter — même règle que
`equippedWeapons` juste au-dessus, qui l'avait déjà).

**(3) `LocationPanel.jsx` — même classe de bug pour l'armure, trouvé en vérifiant s'il existait un
cas jumeau (demande Saar "architecture robuste ?").** BG/BD et JG/JD partagent le même
`ref_location` générique ('B'/'J', `SLOT_TO_REF_LOCATION`) — un item déjà équipé à gauche
réapparaissait dans le menu de droite. Différent de (2) dans ses conséquences : `handleEquip`
additionne le nouveau code au `slot` existant plutôt que de le remplacer (mécanisme voulu pour une
armure intégrale couvrant plusieurs zones à la fois, ex. combinaison `T/C/B/J`) — sélectionner
l'item par erreur ne le déplaçait donc pas, mais lui faisait couvrir les deux bras/jambes à la fois
depuis un seul exemplaire, laissant le second exemplaire identique inutilisé. **Lecture de
`docs/REGLES/REGLEARMURE.md` avant tout code** (référence dans `.claude/rules/blessures.md`) :
mauvaise source confirmée (exo-armures/véhicules, pas protections corporelles — écart déjà noté
Session 141 suite 11 pour Moding, revérifié ici) ; doc technique pertinente
`docs/SYSTEME/BLESSURES.md` (PI6/PI7) documentait le mapping mais pas ce cas précis. Règle
retenue, dérivée de la structure des données elle-même (pas une supposition) : un item à
`ref_location` **simple** (ex. `'B'` seul) ne couvre qu'un seul côté ; un item à `ref_location`
**composée** (contient `/`) peut légitimement accumuler les deux côtés. `shared/armorConstants.js`
(`SYMMETRIC_SLOT_PAIRS`, NOUVEAU) + `char-sheet.js` (`PUT /inventory/:itemId`, branche armure,
rejette 409 l'extension d'un item simple vers le slot pairé — fait autorité, même principe que (1))
+ `LocationPanel.jsx` (`availableItems` exclut l'item du menu pairé si non composé). Aucune donnée
déjà corrompue trouvée en base pour ce cas précis (vérifié avant code) — pas de migration requise.

**Testé** : `node --check`/ESLint 0 erreur sur tous les fichiers touchés. **Scénarios réels via
l'API HTTP du serveur en marche** (3 fixtures jetables — user/campagne/personnage — créées puis
supprimées, aucune donnée de campagne réelle touchée) : (1) 2 Scorpions identiques → 2 lignes
indépendantes, équipées MG+MD simultanément, `ammo_remaining` indépendant (24/24 chacune) ;
tentative `quantity:2` sur arme équipée → rejetée 400. (2) confirmé via (1) — plus de
téléportation, dropdown correct (prédicat rejoué directement sur les données réelles retournées par
le serveur). (3) 5 scénarios : item simple posé à gauche → OK ; extension vers la droite → rejetée
409 ; second exemplaire posé à droite → OK indépendant ; item composé posé à gauche → OK ;
extension du même exemplaire composé vers la droite → OK (couverture double bras légitime).
Personnage réel `357d64d8…` (celui qui avait le bug en base avant fix) revérifié après migration
131 : "Scorpion" bien scindé en 2 lignes indépendantes. **SR + parcours navigateur confirmé
fonctionnel par Saar** (les 3 correctifs).

**Non testé** : achat marchand (`tradeService.js`) non rejoué en conditions réelles (nécessite un
marchand configuré) — logique identique au POST validé, revue de code uniquement. Les 6 autres
slots armure (Tête/Corps/Jambes) non re-testés individuellement au-delà du cas Bras utilisé pour la
vérification (même code partagé, pas de raison de diverger).

**Documentation** : `docs/EN_COURS.md`/`CLAUDE.md`/`client/public/CHANGELOG.md` non mis à jour
dans cette session — une session parallèle semble en cours d'écriture active sur ces mêmes
fichiers (Vault/Tir visé), édition concurrente risquée. À consolider par Saar ou en session dédiée.

Détail complet : ce document, section ci-dessus.

Détail complet : CLAUDE.md "Session 141 (suite 14)", docs/EN_COURS.md item 56.

---

## Session 141 (suite 15) — 2026-07-10/11 — Coffre (Vault) personnel ✅ TERMINÉ, Étapes 0-7

Conversation dédiée entière, hors les chantiers ci-dessus (session parallèle indépendante — voir
note de l'entrée précédente sur l'édition concurrente de ces mêmes fichiers). Demande initiale
Saar : permettre à un joueur de stocker ses personnages dans un espace personnel, indépendant de
toute campagne, pour les faire circuler entre parties sans les recréer.

**Méthode de travail, demandée explicitement par Saar plusieurs fois dans cette conversation** :
"analyse critique du plan", recherche de bonnes pratiques pro avant de coder, ne jamais coder de
zéro. Deux relectures critiques distinctes demandées avant tout code (une sur l'architecture
générale, une sur le détail de la migration Étape 1) — **chacune a trouvé un vrai trou**, pas
seulement des broutilles :
- 1ʳᵉ relecture : un précédent cité (`modingService.js`) n'existait pas ; surtout, aucune gestion de
  `wizard_locked_at` sur les clones — un import Vault→campagne serait resté invisible sans erreur
  (Piège **P6**).
- Audit Étape 0 (liste exhaustive des tables à cloner) : 5 tables absentes de l'esquisse initiale ;
  `characters.type` a 3 valeurs (`pj`/`pnj`/`drone`), pas 2 comme supposé — une confirmation
  précédente de ma part ("type fixé à 'pj' en dur") s'est révélée fausse, corrigée avant impact.

**Recherche pro faite à chaque étape, pas une fois pour la forme** :
- Architecture générale : Roll20 Character Vault + Foundry VTT Compendium Packs — confirme "copie,
  jamais déplacement" comme le standard de l'industrie pour ce problème exact.
- Invariant "un personnage a une campagne XOR un Coffre" : motif SQL reconnu ("exclusive arc"),
  validé par une source dédiée comme le bon choix quand l'ensemble des parents possibles est fini
  et stable (le cas ici — comparé explicitement à l'alternative polymorphe à la Rails, écartée car
  elle perd la contrainte FK réelle).
- Robustesse dans le temps (garde-fou anti-dérive) : comparé aux gemmes Rails `amoeba`/
  `deep_cloneable` (référence mature du même problème "cloner une fiche + toutes ses données
  liées") — confirme que la liste explicite de tables à copier est la bonne pratique, pas une copie
  générique par réflexion.

**Périmètre élargi en cours de route (décision Saar)** : pas seulement les PJ classiques — les
drones (déjà dans le jeu) et, à terme, les exo-armures/vaisseaux (aucun des deux n'existe encore).
Conséquence architecturale : `COMPANION_REGISTRY` dans `vaultService.js`, un registre par type de
personnage plutôt qu'un cas spécial "drone" codé en dur — ajouter un futur type de compagnon devient
une entrée de registre, jamais une réécriture du service de clonage.

**Étapes 0-2 (schéma)** : audit exhaustif (16 tables à cloner, 3 à exclure, croisé avec une requête
`information_schema` réelle) ; migrations `129_vaults.js` (table `vaults` + `characters.vault_id` +
`campaign_id` rendu nullable via SQL brut — jamais le générateur knex sur une colonne avec FK,
2 précédents réels du projet suivis) + `130_vault_transfer_requests.js` (+ `CHECK` de statut +
index unique partiel anti-doublon, ajout non prévu dans l'esquisse initiale).

**Étape 3 (`vaultService.js`, cœur du mécanisme)** : `cloneCharacterDeep` générique (helper
`cloneRows` : omet toujours une éventuelle colonne `id` pour laisser la base en régénérer une, sans
effet sur les tables sans `id` séparé) + garde-fou anti-dérive (`information_schema` interrogée à
chaque clonage, comparée à l'union du registre + une liste d'exclusion explicite — **corrigé en run
à vide** : la 1ʳᵉ version cherchait des colonnes nommées `character_id`, aurait raté
`vault_transfer_requests.vault_character_id`, une vraie FK nommée différemment). Modification
ciblée de `creationService.lockWizard` (paramètre `trxOpt` ajouté, pattern trx-or-db déjà établi par
`advantageService.addAdvantage`, rétrocompatible) — sans ça, l'appeler depuis la transaction de
clonage aurait tenté de lire une ligne fraîchement insérée via une connexion différente, invisible
avant commit.

**Étapes 4-6 (routes)** : `POST /char-sheet/:characterId/clone-to-vault` (réutilise le
`router.param` existant de `char-sheet.js`, mais `cloneToVault` applique sa propre règle plus
stricte — propriétaire uniquement, un MJ qui peut consulter la fiche d'un joueur ne doit pas
pouvoir la faire atterrir dans son propre Coffre) + `vault.js` (nouveau router, ownership seule,
pas de notion de `campaign_members`).

**Étape 7 (UI, 4 lots, conception confiée à une réflexion UI/UX dédiée avant codage)** :
- Lot 1 : carte "Coffre" en première position de la grille Dashboard (`.campaign-grid` déjà
  existante — proposition de Saar, meilleure que ma 1ʳᵉ idée de bouton séparé dans l'en-tête),
  illustration fixe non modifiable, nom tranché avec Saar ("Coffre" plutôt que "Vault" ou "Sas" —
  plus thématique mais jugé trop ambigu pour un premier contact). Page dédiée `VaultPage.jsx`
  (liste/renommage/suppression).
- Lot 2 : bouton "Envoyer vers le Coffre" dans `CharacterWindow.jsx`/`DroneWindow.jsx` (onglet
  Paramètres) — écart trouvé en lisant le code : le plan disait "à côté du bouton Supprimer" en
  supposant la même règle de visibilité, or Supprimer est réservé au MJ tandis que ce bouton est
  réservé au propriétaire — deux règles différentes, pas superposables. Confirmation pédagogique
  ("copie, pas déplacement") plutôt qu'un simple oui/non.
- Lot 3 : sélecteur de campagne + badge "En attente" dans `VaultPage.jsx`. `listVaultCharacters`
  étendue côté service pour indiquer si une demande est déjà en cours.
- Lot 4 : onglet "Joueurs" de `CampaignSettingsPage.jsx` enfin rempli — désactivé depuis sa création
  Session 131 (texte placeholder générique "Phase 3", jamais un vrai projet documenté ailleurs —
  vérifié par historique Git avant de le réutiliser, questionné par Saar qui ne le reconnaissait
  plus). Nouvelle route `GET /vault/campaigns/:campaignId/transfer-requests` (réservée au MJ).

**Testé à chaque étape, jamais seulement par lecture de code** :
- Étapes 0-3 : scénarios en transactions Postgres réelles systématiquement annulées (jamais
  commitées) — clone complet d'un vrai personnage (14 tables comparées une à une, row count
  identique), clone vers un Coffre temporaire, rejet d'un personnage non finalisé, remise à neuf
  d'un drone endommagé.
- Étapes 4-6 : vraies requêtes HTTP contre le serveur en marche (JWT signé localement avec le même
  secret que l'application, cookie réel) — parcours complet clone→liste→renommage→suppression→
  demande→approbation/refus, tous les refus attendus vérifiés (mauvais propriétaire, non-membre,
  non-MJ, doublon, déjà traité), **défense en profondeur confirmée en conditions réelles** (un MJ
  authentifié ne peut pas vaulter le personnage d'un joueur).
- Étape 7 : **vrai navigateur piloté** (Playwright, `channel: 'chrome'` sur le Chrome déjà installé
  — pas de téléchargement de binaire —, cookie JWT injecté directement dans le contexte du
  navigateur), captures d'écran prises et regardées à chaque étape clé, pas seulement "ça n'a pas
  planté". Incident de test isolé sans rapport avec le code livré (jeton JWT corrompu par une sortie
  stdout de `dotenv` dans un script bash, corrigé côté outillage uniquement).
- Nettoyage systématique vérifié après chaque test (comptage de personnages/Coffres/demandes avant/
  après). Activité concurrente réelle détectée en fin de session (personnages "Brouillon" créés en
  temps réel, artefacts d'une autre session utilisant le même personnage de test "COO" — voir entrée
  précédente de ce journal, migration `131_split_equippable_stacks.js`) — non touchée, seuls les
  artefacts identifiés avec certitude comme les miens ont été supprimés.

**Bug préexistant trouvé en testant, sans rapport avec le Coffre, non corrigé** : avertissement React
("mixing shorthand and non-shorthand background properties") en changeant d'onglet dans les
Réglages de campagne — root cause identifiée avec certitude par lecture du diff (`s.navItem`
utilise `background`, `s.navItemActive` utilise `backgroundColor`, fusionnés dans le même objet
style) — présent sur les 4 onglets déjà actifs avant ce chantier, jamais remarqué car "Joueurs"
était le seul désactivé. Cosmétique, dette `[CSPLAYERSTAB]` ajoutée.

**Non testé** : bouton "Refuser" pas recliqué séparément dans le navigateur (chemin de code
strictement symétrique à "Approuver", déjà testé côté service) ; parcours équivalent sur
`DroneWindow.jsx` (code identique à `CharacterWindow.jsx`, vérifié par lecture + lint, pas par un
clic réel, faute de temps) ; contenu non-personnage du Coffre (hors scope explicite depuis le
début, extension future prévue).

Détail complet, étape par étape avec tous les tests : `docs/PLAN_VAULT.md`.

## Session 141 (suite 16) — 2026-07-11 — Audit combat (rapports d'agents externes) + `ref_equipment_skill_assoc` reconstruite (migration 135) ✅ CLOS

- Point de départ : deux lots de rapports d'agents externes signalant 4 problèmes potentiels côté
  combat/résistances ("on a tout pété" — Saar). Chaque affirmation vérifiée indépendamment (requêtes
  DB réelles + lecture de code + historique Git), aucune prise pour argent comptant.
- **1 bug majeur réel, confirmé et élargi** : `ref_equipment_skill_assoc` (table "compétence
  d'utilisation", distincte de `ref_equipment_skills` "compétences boostées/requises" — même schéma,
  jamais fusionnées) n'a **jamais été peuplée par aucun seed/migration** depuis sa création
  (migration 48, Session 47). Recherche Git exhaustive (`git log -S`) : aucun commit n'a jamais
  inséré de données dedans. Les 25 lignes trouvées en base provenaient de tests manuels ponctuels via
  l'API admin (`routes/equipment.js`, jamais reliée à aucune UI client — aucun composant
  `client/src` ne l'appelle). Trou confirmé bien plus large que rapporté : pas seulement "Armes de
  poing" (1/20), mais la quasi-totalité des catégories d'armes (Arme de contact 2/39, Arme d'épaule
  6/20, Lanceur 1/6, Armes étourdissantes 1/11 — seule "Arme à énergie" 13/13 complète, et de façon
  non uniforme : 6 compétences différentes dans cette seule catégorie, jugement arme par arme, pas
  une règle catégorie→compétence).
- **2 fausses pistes écartées après vérification** : `calcCarenceArmure` non gaté par
  `encumbrance_enabled` — infirmé, ce sont deux mécaniques distinctes (carence = règle de base LdB
  Session 56, encombrement = règle maison explicitement étiquetée comme telle) jamais liées dans
  aucune source du projet. "Résistances naturelles"/Choc — constats exacts mais **déjà documentés**
  dans `docs/PLAN_MUTATION2.md` Lot 3 (ouvert le même jour), bloqués sur un `[INCONNU]`
  documentaire réel, chantier séparé non touché ici.
- **Correction** : Saar a fourni `docs/ExtractCOMP.md` (extraction de la vraie colonne "Compétence
  associée" du Google Sheet source, 139 armes — distincte de la colonne "Compétences / Attributs"
  qui alimente déjà `ref_equipment_skills`, confusion initiale entre les deux colonnes clarifiée en
  cours de route). Migration `135_ref_equipment_skill_assoc_weapons.js` (NOUVEAU) : 130 nouvelles
  paires (item, compétence) + 3 corrections confirmées par Saar sur des items hors périmètre du
  fichier (TMP II : Fusil/Armes d'épaules erroné → Armes lourdes + Tir automatique ; Canon à
  infrasons : Arme spéciale distance générique → Armes lourdes ; **Lance-flammes** : Arme spéciale de
  CONTACT FOR/COO → Arme spéciale de DISTANCE COO/PER — erreur trouvée par Saar lui-même en
  proposant "contact" de mémoire puis corrigée après vérification croisée avec
  `REGLECOMPETENCE.md` p.191, qui cite littéralement le lance-flamme comme exemple de la compétence
  distance, jamais contact — confirmé aussi par le texte même de
  `ref_skills.description` pour `ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION`).
- **Rigueur de vérification demandée explicitement par Saar** ("la faiblesse d'un LLM c'est sa
  mémoire... vérification exigée x3, ligne à ligne") : aucune donnée retapée à la main — un premier
  script générateur en `node -e` inline a produit une **vraie erreur de citation shell** (message
  d'erreur tronqué dans le fichier généré, backtick interprété par bash avant JS), détectée et
  écartée avant écriture, régénérée proprement via un script fichier (hors `server/`, zéro risque
  d'échappement). Migration écrite = extraite mécaniquement d'`ExtractCOMP.md`, jamais transcrite.
  Cas "Dague neurale Brain" absent de la liste vérifié explicitement (déjà correct en base
  auparavant, pas un oubli). nodemon a auto-appliqué la migration dès l'écriture du fichier (P53
  documenté, confirmé en action) — un premier diff post-écriture comparait un état déjà post-migration
  contre lui-même (faux négatif de ma part, corrigé). **État final vérifié : 154/154 paires
  attendues, 0 écart.** Round-trip réel `down()`→25 (état pré-migration exact, items corrigés
  restaurés à leur ancienne valeur)→`up()`→154, par appel direct des fonctions du module (P52).
- **Dette notée** (question de Saar sur le doublon apparent des deux tables) : `ref_equipment_skills`
  (8 items, 33 lignes) n'est consommée **nulle part** en logique de jeu — seulement écrite/relue par
  l'API admin (`routes/equipment.js`). Donnée morte, jamais appliquée à un calcul. 1 seul item
  présent dans les deux tables (TMP II), dont l'entrée `ref_equipment_skills` (`ANALYSE_EMPATHIQUE`
  sur une arme) est visiblement une erreur de saisie ancienne sans rapport. Fusion possible mais non
  prioritaire (toucherait le moteur combat pour un gain cosmétique) — voir dette `[EQSKILLS1]`
  `CLAUDE.md`.
- **Testé** : triple recoupement automatisé (nom↔base 139/139, libellé↔`ref_skills.id` 11/11,
  proposé↔existant), état final vs attendu 154/154 (0 écart), round-trip `down`/`up` réel.
- **Non testé** : parcours combat réel en navigateur (assaut à l'arme de poing/CaC avec un
  personnage réel) — la correction porte sur la donnée consommée par
  `resolveAssaultAction`/`resolveMeleeAction`, déjà vérifiées correctes par ailleurs (piège `BUG C`
  `.claude/rules/combat.md`), mais le calcul de bout en bout n'a pas été rejoué en session live.
- Détail complet de l'investigation (recherche Git, admin API, outil `EditeurEQ.html`, distinction
  des deux tables) : cette conversation, `server/src/db/migrations/135_ref_equipment_skill_assoc_weapons.js`.

## Session 141 (suite 17) — 2026-07-10/11 — Tir visé (LdB p.227-228) + framework Actions Exclusives ✅ CLOS

- Point de départ : Saar a demandé la planification d'une mécanique "qui semble manquer" — Tir visé
  était confirmé absent (`docs/REGLES/REGLESYSCOMBAT.md` transcrit mais jamais câblé, aucune trace
  dans `MANUELSYSCOMBAT.md` §6.4 au-delà d'une ligne "à implémenter"). Session longue, en plusieurs
  passes : recherche externe → plan → 2 analyses critiques successives → codage backend → codage
  client, chaque étape validée par Saar avant la suivante (règle "un sujet à la fois" respectée sur
  toute la session malgré son ampleur).
- **Recherche externe demandée explicitement par Saar** avant de figer l'architecture (*"trouver des
  dépôts GitHub inspirants... s'assurer que l'architecture est robuste et dynamique"*) :
  [*A Turn-Based Game Loop*](https://journal.stuffwithstuff.com/2014/07/15/a-turn-based-game-loop/)
  (Bob Nystrom) — la légalité d'une action doit être encapsulée dans sa propre définition, pas
  dispersée ; trait **"Flourish"** de Pathfinder 2e (Foundry VTT) — même mécanique ("une seule action
  à trait Flourish par tour") confirmant qu'un registre léger est la solution standard, **pas** un
  moteur de règles généraliste type "Rule Elements" (PF2e en a un, mais spécifiquement parce qu'il
  doit supporter du contenu communautaire non-développeur — pas notre cas, ensemble d'actions
  exclusives fixe et développeur-authored).
- **Architecture retenue** : `shared/combatExclusiveActions.js` (NOUVEAU) — évaluateur pur, pattern
  déjà éprouvé `shared/careerEligibility.js` (une seule source de vérité, importée identique client +
  serveur). `getAimIneligibilityReasons({mapActions, state, quick, entry, isDualWield, bulletCount})`
  = implémentation réelle (liste de raisons d'échec, pour le tooltip UI) ; `isAimEligible` en dérive
  (`reasons.length === 0`) — jamais dupliqué entre un booléen serveur et une liste de raisons client.
  `isExclusiveDeclaration` = registre générique séparé, peuplé pour Tir visé seul (décision Saar :
  construire le framework maintenant car Charge/Rafale longue en auront besoin — leurs bonus
  mécaniques existent déjà, seule l'exclusivité manque — mais ne pas coder leurs déclencheurs dans ce
  chantier, chacun sa session).
- **Règle métier centrale, trouvée en discussion avec Saar (pas dans le LdB littéralement, mais
  cohérente avec lui)** : *"tu ne vises que si tu ne fais que ça"* — dégainer son arme ou changer de
  mode de tir est une transition d'état au même titre qu'un déplacement (`state_position`/
  `state_weapon`/`state_fire_mode`/`state_cover`/`state_vitesse` sur `combat_roster`, tous égaux).
  Cette règle unique résout mécaniquement, sans code séparé, trois questions initialement traitées
  comme indépendantes : immobilité (déplacement = transition interdite), incompatibilité avec
  Précipiter (vitesse doit rester inchangée), incompatibilité avec Rechargement (aucune autre
  mapAction autorisée). **Piège explicitement évité** : "exclusive" (générique) ≠ "immobile" — Charge
  *exige* un déplacement, un flag générique "exclusive ⇒ pas de move" aurait cassé Charge le jour de
  sa correction. Les deux notions gardées séparées par construction.
- **2 analyses critiques du plan, demandées par Saar avant tout code** (*"analyse critique de ta
  proposition"*, puis *"analyse critique de ton plan"*) — 7 + 3 points trouvés et corrigés avant
  codage, aucun après : mauvais numéro de migration prévisionnel (127 au lieu de 134, dérive P53
  anticipée puis confirmée en conditions réelles) ; type de colonne prévisionnel faux (`integer` au
  lieu de `smallint`, corrigé en relisant `57_combat_v3.js` avant d'écrire la migration) ; interaction
  avec le gap systémique connu "`current_initiative` ≤ 0 non géré" (`MANUELSYSCOMBAT.md` §3) — Tir
  visé (jusqu'à -10 INI) augmente fortement la probabilité de le déclencher, documenté séparément
  (**Dette INI3**, `docs/BUGIDENTIFIE.md`, non corrigé ici) ; duplication du check CaC entre
  `isAimEligible` et `isExclusiveDeclaration` — responsabilités séparées après correction (légalité
  intrinsèque de l'action vs combinaison avec d'autres attaques ce tour).
- **Codage backend (Étapes 0-3), vérifié à trois niveaux avant tout passage au client** : migration
  `134_combat_actions_aim_bonus_comp.js` (NOUVEAU, colonne `smallint nullable`, miroir exact de
  `fire_mode_bonus_comp`) — round-trip `down()`/`up()` réel testé en base (P52/P53/P54 respectés,
  numéro reconfirmé par `ls` au moment de coder : 133 déjà pris entre-temps par les chantiers
  Revers/Vault, comme anticipé). `socketCombatAnnouncement.js` (validation `aimTranches` recalculée
  serveur, jamais confiance au client) + `socketCombatHelpers.js` (`resolveAssaultAction`,
  `aim_bonus_comp` ajouté à `totalModComp` + ligne `breakdown`). **10 scénarios unitaires** sur
  `isAimEligible`/`getAimIneligibilityReasons` (node -e) + **test réel de bout en bout** sur
  `resolveAssaultAction` (fixture jetable en base réelle — campagne/personnage/battlemap/token/
  roster/arme créés puis explicitement supprimés, `resolveAssaultAction` n'acceptant pas de
  transaction, contrairement au reste du pipeline serveur) : Seuil et breakdown vérifiés corrects
  (nominal +3, contrôle négatif 0/absent), nettoyage confirmé après coup.
- **Collision évitée avec un travail concurrent non committé** : avant de toucher
  `socketCombatHelpers.js` pour l'Étape 3, `git diff` a révélé que `totalModComp`/`breakdown`
  (exactement la zone visée) étaient en cours de modification par un autre agent (correctif
  double-comptage du bonus double-arme, HEAD committé avait déjà une régression que la copie de
  travail était en train de corriger) — codage suspendu, signalé à Saar, repris seulement après
  confirmation explicite ("les autres agents sont en pause").
- **Inventaire UI exhaustif demandé par Saar avant tout code client** (*"tu as planifié... ou tu fais
  à l'arrache ?"*) — lecture complète de `AssaultRangedPanel.jsx` (composant partagé PJ/MJ) avant de
  proposer un emplacement. Placement confirmé : 3ᵉ option radio dans la section "Type de tir" (mode
  coup par coup), entre "Tir simple" et "Tir à répétition", mutuellement exclusive avec la
  répétition. **Tooltip par raison demandé par Saar** (*"Action impossible car - déplacement"*) —
  `getAimIneligibilityReasons` étendue en conséquence (liste de raisons françaises en dur, domaine
  Combat explicitement exempté de la règle i18n par `.claude/rules/react.md`, cohérent avec les
  tooltips combat existants).
- **Question de Saar ayant révélé un faux problème** : *"pourquoi `isDualWield` est figé à faux côté
  MJ ?"* — vérifié faux en lisant le code réel (`CombatGmDeclareWindow.jsx:94,808,810`), c'était un
  commentaire JSDoc obsolète dans `AssaultRangedPanel.jsx`, le câblage MJ était déjà pleinement
  fonctionnel et identique au joueur. Corrigé (documentation uniquement, zéro changement de
  comportement).
- **Codage client (Étapes 4-6, ×2 fenêtres PJ + MJ/PNJ)** : `combatSections.js` (affichage indicatif
  du coût INI) ; `AssaultRangedPanel.jsx` (option "Tir visé" + slider 0-5 tranches + grisage/tooltip
  par raison) ; `CombatActionWindow.jsx` et `CombatGmDeclareWindow.jsx` (état `aimTranches`,
  reconstruction de l'objet `mapActions`/`state`/`entry` pour l'éligibilité — **`entry` = `rosterEntry`/
  `activePnjEntry` (clés `state_*` préfixées, forme brute DB), pas `initialStates.current` comme
  supposé initialement dans le plan** — écart trouvé en relisant le code avant de coder, corrigé ;
  payload, `assaultValid` étendu). `git stash`/`pop` : 14 problèmes ESLint pré-existants confirmés
  inchangés (0 nouvelle erreur introduite).
- **Découverte finale de Saar, hors scope confirmé** : *"le TIR VISÉ, ça fonctionne sur une
  localisation VISÉE non ?!"* — vérifié en lisant la suite non encore lue de `REGLESYSCOMBAT.md`
  (p.229-230) : "Viser une Localisation précise" est une règle **entièrement distincte** (malus au
  Test pour choisir la zone touchée au lieu du 1D20 aléatoire, Corps -3/Jambes -5/Tête-Bras -7/zone
  spécifique -7 à -10), sans lien mécanique avec Tir visé (bonus au Test via sacrifice d'INI, aucune
  incidence sur la localisation). Déjà documentée et jamais implémentée sous l'identifiant **COM9**
  (`docs/BUGIDENTIFIE.md`, retrouvée telle quelle) — confirmée hors scope de ce chantier, proposée
  comme suite possible, non tranchée par Saar à la clôture de cette session.
- **Testé** : `node --check` (backend), 10 scénarios `isAimEligible`/`getAimIneligibilityReasons`,
  test réel `resolveAssaultAction` (fixture jetable + nettoyage vérifié), round-trip migration,
  ESLint client (0 nouvelle erreur vs baseline `git stash`), **SR + parcours navigateur confirmé
  fonctionnel par Saar** ("Fonctionnel").
- **Non testé** : scénarios de rejet (`COMBAT_DECLARE_ERROR`) en conditions réelles navigateur —
  seule la fonction pure sous-jacente et le cas nominal ont été vérifiés en direct ; combinaison Tir
  visé + Précipiter/Rechargement en conditions réelles (couverte par construction via la règle "zéro
  transition", pas re-testée manuellement scénario par scénario).
- **Dette ajoutée** : `docs/BUGIDENTIFIE.md` — **INI3** (`current_initiative` ≤ 0 non géré, gap
  systémique pré-existant, pas spécifique à Tir visé).
- Détail complet : `docs/PLAN_TIRVISE.md` (architecture, décisions, pièges, historique complet des
  révisions), `docs/BUGIDENTIFIE.md` "Dette INI3", `docs/MANUELSYSCOMBAT.md` §6.4 (mis à jour).

---

## Session 141 (suite 16 — correction) — `calcCarenceArmure` effacée (réouverture item 58) ✅ CLOS

- Suite directe de l'item 58 (audit combat 4 signalements) : la conclusion "fausse alerte" sur
  `calcCarenceArmure` non gaté par `encumbrance_enabled` a été réexaminée à la demande de Saar après
  qu'un agent signalant le point a relevé que l'infirmation reposait uniquement sur `ASBUILT.md`/
  `fr.json`/l'historique des options de campagne — jamais sur le texte LdB lui-même.
- **Recherche exhaustive relancée** : grep complet de `docs/REGLES/REGLESYSCOMBAT.md`,
  `REGLEARMURE.md` (confirmé mauvaise source — mécas/exosquelettes uniquement, pas les protections
  humaines), `REGLE_CREATION.txt`, `REGLECOMPETENCE.md` → **zéro citation, zéro page, aucune trace
  textuelle** de "carence"/"min_str"/"Force minimum". Seule trace : `docs/Old/JOURNAL2.md:5053`
  (Session 56, implémentation d'origine), taguée `(LdB)` **sans numéro de page** — contrairement à la
  quasi-totalité des autres entrées du même journal qui citent systématiquement une page précise.
- **Décision Saar** : "Sans justification, on comprend les mécanismes pour les écraser proprement" —
  effacement complet, pas un simple débranchement. Analyse préalable exhaustive (aucune écriture)
  confirmée par Saar avant tout code, avec double vérification explicite de ma confiance (100%)
  demandée avant chaque étape.
- **Décision sur `ref_equipment.min_str`** : conservée. Traitée comme donnée brute ordinaire dans
  l'admin (`equipment.js`, même liste que `price`/`protection`/`tech_level`), pas comme un artefact du
  calcul fabriqué — seule l'application en malus manquait de source, pas la donnée elle-même. Une
  vraie règle LdB sur la force minimale par arme pourrait exister dans un chapitre du livre non
  encore extrait dans `docs/REGLES/` ; supprimer la colonne aurait été irréversible pour zéro gain de
  propreté (donnée inerte = pas de dette, contrairement à du code d'application non sourcé).
- **Effacé** : `calcCarenceArmure` (`server/src/lib/charStats.js`, fonction + JSDoc entière) ; les 2
  sites d'appel dans `server/src/socket/socketCombatHelpers.js` (CaC attaquant + distance tireur —
  chacun avec sa variable `equipped*` dédiée, utilisée nulle part ailleurs) ; les termes dans
  `chancesAttaque`/`chancesDeReussite` ; les 2 entrées de breakdown "Carence armure" ; le segment
  `carence:` du log debug CaC. Import nettoyé. Confirmé : le défenseur (CaC comme distance) n'a
  jamais appliqué cette carence — asymétrie déjà voulue par construction, rien à harmoniser.
- **Documentation mise à jour pour un effacement propre** (pas seulement le code) :
  `docs/SYSTEME/COMBAT.md` (5 endroits), `docs/ASBUILT.md`, `docs/STRUCTURE_SYSCOMBAT.md`
  (4 endroits), `.claude/rules/blessures.md` (piège retiré), `CLAUDE.md` (entrée item 58 corrigée),
  `docs/EN_COURS.md` (item 58 corrigé), `docs/ROADMAP.md` (3 endroits, dont un item roadmap devenu
  obsolète retiré), `docs/PLAN_MUTATION2.md` et `docs/PLAN_TIRVISE.md` (chantiers actifs distincts,
  formules/références mises à jour). `docs/Old/JOURNAL2.md` laissé inchangé (convention historique
  déjà validée avec Saar — seule cette nouvelle entrée documente la correction).
- **Testé** : `node --check` sur les 2 fichiers serveur modifiés (0 erreur), grep exhaustif de tout
  le dépôt (hors `docs/Old/` et `Enclume-codex/`, chantier séparé) confirmant zéro référence
  résiduelle à "carence"/`calcCarenceArmure`.
  **SR + parcours combat réel confirmé fonctionnel par Saar** ("SR, fonctionnel, test OK").
- Détail complet : cette entrée. Origine : item 58 (`docs/JOURNAL6.md` "Session 141 (suite 16)").

## Session 141 (suite 19) — 2026-07-12 — Résistances naturelles (poison/maladie/radiation/drogue) ✅ CLOS

- Suite de la session Lot 2 (`docs/PLAN_MUTATION2.md`, Attributs secondaires REA/Souffle) : chantier
  distinct `docs/PLAN_RESNAT.md` — brancher la Résistance naturelle (LdB p.114), jamais consommée
  nulle part (`calcResistanceNaturelle`/`RES_NAT_TABLE` codées mais orphelines depuis toujours).
  Décision Saar : construire le calcul mécanique correct (attribut+mutations+avantages) maintenant,
  le Test de jeu lui-même (MJ déclare une Intensité, Seuil=Intensité−Modificateur, jet 1d20) différé
  à un chantier futur — aucun mécanisme "MJ déclare un Test hors combat" n'existe dans le code
  (vérifié exhaustivement).
- **Recherche pro exigée par Saar avant tout code** (Foundry Active Effects, PF2e système IWR) —
  a fait rejeter un premier plan (v1) qui inversait le signe à l'exécution selon `type` (rustine) au
  profit d'une correction à la source : **v2**.
- **Bug de données réel trouvé en base + croisé avec le texte LdB exact** (`REGLE_MUTATION.md`) : 6
  lignes (`ref_advantages` adv_031-034 "Résistance naturelle augmentée" ; `ref_mutations` "Résistance
  naturelle"×4, "Purulence", "Contagion") stockaient un delta **positif** pour un effet censé
  améliorer la résistance — avec `Seuil = Intensité − Modificateur`, ça dégradait le Seuil au lieu de
  l'améliorer. Cas le plus parlant : "Contagion" (immunité totale, sentinelle 9999) aurait rendu un
  personnage immunisé **systématiquement en échec**, l'exact opposé de la règle. Migration `136`
  (NOUVEAU) corrige les 6 lignes + normalise la divergence de clé `"drug"`(avantages)/`"drugs"`
  (mutations). 0 personnage réel n'avait jamais acquis ces lignes — zéro régression.
- `shared/polarisUtils.js` : `getAdvantageModForResistance` (résolveur générique, symétrique à
  `getAdvantageModForAttr` du Lot 2, aucune inspection de `type` — la donnée porte son signe).
  `advantageService.getAdvantages()` étend son `.select()`. 4 nouvelles sources de macro
  (`resistance_poison`/`maladie`/`radiation` + fix de `resistance_drogues`, buggée depuis toujours —
  exposait le NA brut au lieu du modificateur réel) aux 2 sites dupliqués (`char-sheet.js`,
  `socketDice.js`).
- **Addendum même session** : Saar signale l'absence de Résistance aux dommages/Résistances
  naturelles/Souffle sur la fiche personnage (vs liste LdB p.114 attributs secondaires). Consolidation
  de 5 fonctions (`calcResistanceDommages`/`calcResistanceNaturelle`/`calcResistanceDroguesInput`/
  `calcSeuils`/`calcSouffle`) de `charStats.js` (serveur seul) vers `shared/polarisUtils.js` — même
  principe que `calcREA` (Lot 2), consommées désormais des deux côtés, tous les appelants serveur
  redirigés (`statusService.js`, `damageService.js`, `socketCombatHelpers.js`, `char-sheet.js`,
  `socketDice.js` — jamais de transit par `charStats.js`, leçon Lot 2). `CharacterSheet.jsx` :
  `calcSecondary` gagne `mutationEffects`, 6 nouveaux `<SecondaryField>` ajoutés **après** l'existant
  (rien retiré, consigne explicite Saar). **Décision de scope délibérée** : "Résistance aux dommages"
  affichée en valeur de base seulement (FOR+CON) — `resolveTargetHit`/`resolveMeleeAction` ne
  consomment pas encore mutation/avantage (Lot 3 de `PLAN_MUTATION2.md`, non traité) — les inclure
  côté fiche seulement aurait affiché un bonus jamais appliqué en jeu. Même raison pour ne pas toucher
  au modificateur d'avantage sur "Choc" (`adv_030`/`adv_060`).
- **Testé** : `node --check` (tous fichiers serveur), round-trip migration 136 réel (byte-identique),
  9 scénarios unitaires purs, test bout-en-bout en base réelle (personnage existant, transaction
  annulée, 0 résidu — mutation+avantage combinés donnent bien un Seuil **amélioré**, stacking
  vérifié), non-régression numérique des 5 fonctions déplacées, ESLint client 0 nouvelle erreur
  (3 problèmes pré-existants confirmés via `git stash`), SR (`/api/health` 200). **Parcours navigateur
  confirmé fonctionnel par Saar** (capture d'écran fiche réelle : 6 nouveaux champs corrects).
- **Non testé** : parcours navigateur des macros (`resistance_poison`/etc. via `/macro-preview` et
  `MACRO_ROLL` réel) — seule la fiche a été vérifiée visuellement.
- **Suite immédiate — passe UI/UX (même session) ✅ CLOS, 3 itérations, toutes confirmées par Saar** :
  1. Mockup interactif (Artifact) proposant cartes groupées vs liste dense — Saar choisit un hybride
     (Réaction/Initiative en cartes, liste dense pour Choc/Dommages/Résistances naturelles/Souffle,
     Allures en cartes). `useSecondaryTooltip` extrait pour partager la logique de tooltip entre
     `SecondaryField` (cartes) et le nouveau `SecondaryListRow` (liste).
  2. Capture d'écran de la fiche réelle complète → Saar signale qu'elle est "encore plus massive" —
     vraie cause : le bloc Compétences (~60 lignes), pas les Attributs secondaires. **Accordéon sur
     6 blocs** (XP/Description/Attributs/Attributs secondaires/Compétences/Avantages — "En-tête" reste
     ancre fixe) + **mémorisation par TYPE de fiche**, pas par personnage (`localStorage`
     `charSheetAccordion:owned`/`:other` via la prop `isOwner` déjà disponible — demande explicite :
     "mes fiches perso ne s'affichent pas pareil que les autres") + **Attributs secondaires en 2
     colonnes** (gauche Choc+Dommages, droite Résistances naturelles+Souffle — deux listes indépendantes
     plutôt que l'entrelacement ligne-à-ligne de la maquette, jugé moins lisible, écart assumé et
     documenté). Nouveau `CollapsibleBlock`. `blockOpen` rechargé via `useEffect([isOwner,
     characterId])` — composant sans `key={characterId}` (dette Session 141 suite 9), sans quoi
     l'accordéon resterait figé sur le premier profil chargé.
  3. Regroupement Allures + Réaction/Initiative dans une même rangée de cartes ("gagner un max de
     place") avec séparateur discret (`separator` sur `SecondaryField`, trait attaché à la carte
     plutôt qu'un élément flex autonome — robuste au retour à la ligne).
  Testé à chaque itération : ESLint 0 nouvelle erreur (3 pré-existants confirmés `git stash`), `fr.json`
  valide, SR. **Parcours navigateur confirmé fonctionnel par Saar à chaque itération** ("Presque
  parfait" → "Conforme"). Non testé : bascule owned/other sur deux personnages réels avec capture
  dédiée ; fenêtre très étroite ; macros `resistance_*` via `/macro-preview`/`MACRO_ROLL`.
- **Chantier suivant identifié** : `docs/PLAN_MUTATION2.md` Lot 3 (Résistance aux Dommages + Choc) —
  scope déjà recentré, pas encore détaillé ligne à ligne. Le coder complétera aussi l'affichage fiche
  déjà en place (actuellement valeur de base seule, sans mutation/avantage, par construction).
- Détail complet : `docs/PLAN_RESNAT.md`.

## Session 141 (suite 20) — 2026-07-12 — Bonus féminin : règle fixe -2 FOR/+1 COO/+1 PRE + revalidation du bascule Sexe ✅ CLOS

- Signalement Saar : la mécanique `feminin_bonus` (remise forfaitaire invisible sur COO/PRE, Session
  141 suite 14) n'est pas compréhensible. Demande de simplification en règle fixe et lisible :
  Femme = FOR -2, COO +1, PRE +1 (abandon du choix de répartition libre que permet le LdB entre
  COO/PRE), avec exigence explicite de propreté ("pas de bricolage").
- **Antécédent retrouvé avant de coder (Session 141 suite 14, relu dans cette session)** : une
  première tentative de correctif direct sur COO/PRE avait déjà été abandonnée — elle plafonnait le
  spinner Mod.PC au quota, cassant l'achat PC normal au-delà du bonus. C'est ce qui avait motivé la
  remise forfaitaire. Vérifié que la simplification demandée par Saar (répartition fixe, plus de
  choix joueur) élimine structurellement cette source de complexité — aucun plafond de spinner n'est
  recréé, le mécanisme redevient un simple décalage de base, symétrique à FOR (jamais cassé depuis
  son introduction).
- **Vrai bug trouvé en testant le plan (captures Saar)** : basculer Sexe M↔F après avoir déjà réparti
  des points changeait silencieusement le total dépensé (base FOR/COO/PRE décalée) sans jamais
  revalider l'état — `Step1Attributes.jsx` recalculait `pointsRestants`/`canNext` à la main, jamais
  via `validateStep1` (seul le serveur l'appelait). Le garde-fou des spinners (`handleModPC`) empêche
  bien tout dépassement de budget au clic, mais le bascule Sexe le contournait entièrement. Deuxième
  trouvaille en creusant `validateStep1` lui-même : G1 traitait "budget dépassé" et "budget non
  dépensé" comme un seul avertissement contournable — un dépassement de budget n'était en réalité
  jamais rejeté, ni client ni serveur.
- **Vérifié contre le pattern déjà établi** (`CareersAllocator.jsx`/Étape 4, Lot 2, Session 139) :
  `useMemo` sur un validateur partagé, `canNext = !hasHardBlock`, erreur dure vs avertissement doux
  séparés — confirmé qu'aligner `Step1Attributes.jsx` dessus n'invente rien, referme juste un
  déphasage architectural entre les deux étapes déjà noté (Session 141 suite 12, "trouvé en creusant,
  pas un choix voulu" à propos d'Étape 4 vs Étape 1).
- `shared/polarisUtils.js` : `getAttributeBase(attrId, isFeminin)` (FOR:5, COO:8, PRE:8, sinon 7) —
  remplace `getFemininBonusDiscount`/`FEMININ_BONUS_MAX` (supprimés). `calcTotalCost` simplifié.
  `validateStep1` gagne **G1bis** (`totalCost > poolTotal` → erreur dure, distincte du simple solde
  non dépensé G1) ; G3 généralisé via `getAttributeBase`.
- `Step1Attributes.jsx` : `validation = useMemo(() => validateStep1(...))` remplace le calcul maison
  — `canNext = nom && validation.valide`, avertissement doux uniquement si `validation.valide` et
  `budgetIncomplete`. `handleSetFeminin` redevient un simple `setIsFeminin(val)` (plus de clamp
  spécial — toute invalidité issue du bascule est désormais détectée génériquement). Nouveau message
  i18n (`hard_block_warning`) affiché si `!validation.valide`.
- **Bug trouvé en testant ma propre correction (`node -e`)** : une valeur hors bornes (>20, possible
  juste après un bascule Sexe qui décale la base) fait sortir `COST_LOOKUP[valeur]` de la table
  (aucune entrée au-delà de 20) → `totalCost`/`pointsRestants` deviennent `NaN`, affiché littéralement
  dans le HUD. Corrigé : HUD affiche `—` au lieu du nombre tant que `!validation.valide`.
- `Step2Genotype.jsx` : angle mort fermé au passage (conséquence directe de la généralisation, pas une
  chasse au bug séparée) — son propre recalcul de `baseAttrs` ignorait `femininBonusEnabled` (aurait
  affiché une base FOR à 5 même option désactivée) ; utilise désormais `getAttributeBase` + lit
  `femininBonusEnabled` du store (déjà disponible, jamais consommé ici).
- `client/src/locales/creation.json` : `ruleFemininBonus` réécrit (règle fixe, plus de mention de
  répartition) + nouvelle clé `hard_block_warning`. `docs/OPTIONS_CAMPAGNE.md` OPT-02 mis à jour.
- **Testé** : `node --check` (`polarisUtils.js`, `creationService.js` inchangé), ESLint sur les 2
  fichiers React — 0 nouvelle erreur (`poolBase` non utilisé confirmé pré-existant via `git stash`),
  `creation.json` validé JSON. Scénarios `node -e` : `getAttributeBase` (3 bases), `validateStep1`
  déclenche G1bis correctement (recherche systématique k=9 à 12), déclenche G3 correctement sur les 2
  scénarios de bascule (COO maxée + bascule féminin → 21 rejeté ; FOR maxée + bascule masculin → 22
  rejeté). **Vérification en base réelle** (demande explicite Saar, pas seulement en théorie) : sur
  les 64 fiches de personnages non verrouillées existantes, aucune ne serait bloquée par le nouveau
  G1bis ; 0 personnage féminin en cours avec l'option active actuellement (test du nouveau plancher
  COO/PRE=8 vacuous faute de candidat, mais mécanisme validé synthétiquement). **SR + fonctionnel
  confirmé Saar.**
- **Non testé** : parcours navigateur réel du bascule Sexe M↔F↔M après répartition (blocage dur +
  résolution par décrément) — validé uniquement par instrumentation directe (`node -e`) et vérification
  en base, pas par un clic réel dans le Wizard.
- Détail complet : cette entrée.

## Session 141 (suite 21) — 2026-07-12 — `docs/PLAN_MODING.md` : pause levée + Étape 0 (extraction inventoryService.js) ✅ CLOS

- Reprise de `docs/PLAN_MODING.md`, en pause depuis Session 141 (suite 11) — 2026-07-09 dans l'attente
  de Tir visé (bloquant pour la Phase B, lots B2-B5). Tir visé clos entretemps (Session 141 suite 17).
  **Évaluation de reprise demandée par Saar** avant tout code : blocage confirmé levé (dette
  `TIRVISE` close ci-dessous), mais dérive P53 reconfirmée — migration 124 déjà consommée (124-135
  tous pris depuis, prochain numéro libre 136), `char-sheet.js` passé de 1928 à 2133 lignes depuis
  l'écriture du plan. **Vérifié sans impact** : la migration parallèle `131_split_equippable_stacks`
  (dual-wield, session concurrente) ne touche aucun des 16 accessoires de moding
  (`ref_equipment.location = NULL` pour tous, exclus du filtre de cette migration) — piège P7 du plan
  toujours valide tel quel.
- **Analyse critique demandée par Saar avant de reprendre le codage** : 1 vrai gap trouvé — l'anti-
  doublon `char_inventory_mods` (règle "un mod ne peut pas être installé deux fois sur la même arme")
  n'était protégé que par un `SELECT` applicatif hors transaction, pas par une contrainte DB. Fenêtre
  de course réelle avec un mod en stack ×2+ (pas seulement un double-clic) : deux requêtes
  concurrentes passent toutes deux le check avant que la première ne commite. Corrigé dans le plan :
  `UNIQUE(weapon_inv_id, equipment_id)` ajoutée au schéma + logique `install` catch la violation de
  contrainte (`23505`) en 409 — même précédent que `uq_char_mut_no_sub` (migration 109, char_mutations).
  1 point vérifié et écarté (contradiction apparente sur le contrat HTTP de la route DELETE après
  unification `removeItem` — `InventoryPanel.jsx:87` ignore la réponse, rafraîchissement 100% socket,
  aucun risque réel). Plan corrigé avant tout codage (contrainte + note ajoutées, historique des
  révisions daté).
- **Pause levée** : `docs/EN_COURS.md` — dette `TIRVISE` marquée close, roadmap "Sprint Tir visé"
  barrée, bandeau `PLAN_MODING.md` passé de "⏸ EN PAUSE" à "▶ REPRISE".
- **Étape 0 codée** : `server/src/services/inventoryService.js` (NOUVEAU) — extraction depuis
  `char-sheet.js` des 6 routes inventaire (`getInventory`/`quickEquip`/`addItem`/`updateItem`/
  `reloadWeapon`/`removeItem`) + 4 helpers (`isContainerAvailable`/`getDefaultContainer`/
  `getItemWithRef`/`resolveAmmoInit`) + 4 constantes (`VALID_CONTAINERS`/`VALID_SLOTS`/
  `ARMOR_SLOTS`/`WEAPON_SLOTS`) + 2 nouvelles constantes moding (`WEAPON_FAMILY`/`MOD_CATEGORY`,
  centralisées pour `modingService.js` à l'Étape 2). Convention `advantageService.js`/
  `mutationService.js` respectée : fonctions pures DB, pas de `req`/`res`/socket. Routes
  `char-sheet.js` réduites à parse req → service → socket → réponse, contrat HTTP externe strictement
  préservé (vérifié pour chaque route, notamment les 3 branches de POST /inventory et les 2 formes de
  retour de DELETE).
- **Dérive trouvée et gérée en lisant le code avant d'extraire** (pas dans le plan du 2026-07-09,
  fichier grossi entretemps par une session parallèle) : la logique dual-wield/armure
  (`isEquippableLocation`, `SYMMETRIC_SLOT_PAIRS` — 1+S+S, paires symétriques BG/BD et JG/JD) s'était
  entretemps insérée au milieu des routes à extraire. Déjà proprement modularisée par cette session
  parallèle (`server/src/lib/inventoryRules.js`, `shared/armorConstants.js`) — simplement importée
  dans `inventoryService.js`, pas redéfinie. **1 site d'appel externe trouvé et corrigé** :
  `getDefaultContainer` était aussi utilisé par la route drone `POST /:characterId/drone/cargo/:invId/
  drop` (hors scope Étape 0, non déplacée) — rebranché vers `inventoryService.getDefaultContainer`.
  `removeItem` accepte un `trxOrDb` optionnel (P7 du plan, réutilisé par `modingService.installMod` à
  l'Étape 2). 3 imports devenus morts dans `char-sheet.js` nettoyés (`isEquippableLocation`,
  `SYMMETRIC_SLOT_PAIRS`, `calcEncumbrancePenalty`).
- **Testé** : `node --check` 0 erreur sur les deux fichiers (pas d'ESLint côté serveur dans ce repo —
  confirmé, seul `client/eslint.config.js` existe). 13 scénarios réels en base (fixture jetable,
  cascade `ON DELETE CASCADE` sur `char_inventory.character_id` vérifiée pour le nettoyage) : stacking
  munitions (single→stack), conflit "mains déjà occupées" sur 2ᵉ arme 2M (409), split P57 (arme
  équipable ×2 sans slot → 2 lignes indépendantes quantity=1), armure 1+S+S (équipement slot C),
  reload avec consommation totale de munitions (ammo supprimée, arme rechargée), retrait partiel
  (décrément sur stack) et total, quick-equip GM, `getInventory` sur fiche vide — tous passés. SR
  confirmé (`/api/health` 200). **SR + tests confirmés fonctionnels par Saar.**
- **Non testé** : parcours navigateur réel (ajout/équipement/recharge/suppression via l'UI Inventaire)
  — seule la couche service a été exercée directement en base, pas cliqué dans l'UI.
- **Étapes 1-7 codées et testées dans la foulée (même session, "go" Saar) — Phase A ✅ TERMINÉE.**
  Migration `137_char_inventory_mods.js` (NOUVEAU — 136 pris entretemps par une session parallèle,
  P53 reconfirmé une 3ᵉ fois ; `.primary()` pas `.primaryKey()`, corrigé après vérification du style
  des migrations récentes) : table + `UNIQUE(weapon_inv_id, equipment_id)`, round-trip `down`/`up`
  réel vérifié (4 contraintes recréées à l'identique). `server/src/services/modingService.js`
  (NOUVEAU) : `getModingState`/`installMod`, réutilise `WEAPON_FAMILY`/`MOD_CATEGORY`/`removeItem`
  d'`inventoryService.js`. `shared/events.js` : `WS.MOD_INSTALLED` ajouté. Routes `GET/POST
  /:characterId/moding/state|install` dans `char-sheet.js` (minces, pattern identique aux routes
  inventaire). `client/src/lib/useCharacterSocket.js` : handler `onModInstalled` (même pattern que
  les 3 `onInventory*`). `client/src/character/ModingWindow.jsx` (NOUVEAU) : fenêtre flottante
  (pattern `TradeWindow.jsx`/`useDraggable`, classes `.combat-win-*` Palette A réutilisées + 7
  nouvelles classes `.moding-*` ajoutées à `index.css` pour le layout 2 colonnes — aucune existante
  ne couvrait ce besoin). `InventoryPanel.jsx` : bouton "Customisation" (visible `canEdit` — owner
  OU GM, **pas** `isGm` seul comme le bloc "Ajouter" voisin, correction du plan en codant : un joueur
  doit pouvoir installer un mod sur sa propre arme). `CharacterWindow.jsx` : état `modingOpen`,
  return passé en Fragment pour rendre `<ModingWindow>` en sibling (pas dans l'onglet Matériel — reste
  ouvert si on change d'onglet).
- **1 correctif trouvé en écrivant le composant** : `.btn-icon` (réservé aux icônes utilitaires ×/?/➤
  par sa propre doc CSS) utilisé par erreur sur le bouton texte "Installer" — retiré avant tout test.
- **Testé service (10 scénarios réels, fixture jetable + cascade vérifiée)** : `getModingState`
  (arme listée, mod en installable), `installMod` (décrément stock sans suppression si stack > 1,
  mod apparaît dans `installed_mods`), anti-doublon applicatif (409), **contrainte UNIQUE réelle
  vérifiée en base** (insert brut en double directement en SQL → violation `23505` interceptée,
  preuve que le correctif de l'analyse critique du 2026-07-12 fonctionne, pas seulement en théorie),
  P1 (item custom → 400), incohérence arme=mod (→400), stock épuisé sur 2ᵉ arme → suppression ligne.
  **Testé HTTP réel** (JWT signé, cookie réel, utilisateur GM réel) : `GET .../moding/state` et
  `POST .../moding/install` end-to-end, 404 correct sur tentative de réinstallation d'un mod déjà
  entièrement consommé. **Testé navigateur réel (Playwright headless, chromium déjà installé en
  local — pas de téléchargement)** : session ouverte via cookie JWT injecté, navigation
  `/session/:campaignId` → onglet PERSOS → personnage test → onglet Matériel → bouton
  "Customisation" → fenêtre ouverte (arme "Cougar" listée, mod "Poignée d'identification"
  installable) → clic "Installer" → **capture d'écran confirmant** : compteur d'en-tête passé à
  "0 mod installable", arme affichée "Cougar (1)", mod déplacé vers "Mods installés", **et
  l'inventaire (panneau du dessous) rafraîchi en temps réel sans reload** — la ligne "Poignée
  d'identification" disparaît du Sac entre les deux captures, preuve que `WS.MOD_INSTALLED` +
  le handler `onModInstalled` (Étape 5) fonctionnent réellement de bout en bout, pas seulement en
  isolation. **1 erreur console notée et investiguée** : 500 sur l'onglet "Fiche" (CharacterSheet,
  ouvert par défaut avant le clic sur Matériel) — confirmé sans rapport avec ce chantier (route
  `GET /:characterId` intacte depuis Session 141 suite 20, le personnage de test minimal n'a jamais
  eu de `char_attributes`/`char_archetype` — artefact de fixture, pas une régression). SR confirmé
  (`/api/health` 200) après chaque étape. Fixtures nettoyées (cascade `ON DELETE CASCADE` vérifiée
  à chaque fois, 0 résidu).
- **Incident post-livraison, résolu même session** : Saar signale le bouton "Customisation" invisible
  en session réelle après le commit. Diagnostic par instrumentation (pas de supposition) : commit
  `dfc1283` (fait par Saar, `git add . && git commit` suivant le rappel de fin de tâche) vérifié
  complet — les 23 fichiers attendus dont `CharacterWindow.jsx`/`InventoryPanel.jsx` sont bien dedans ;
  `InventoryPanel.jsx` relu sur disque, code du bouton intact et correctement gaté `canEdit` ; Vite
  confirmé servant `ModingWindow.jsx` sans erreur de compilation (`curl` direct sur le module, 200).
  Cause retenue (pas de régression code) : onglet navigateur resté ouvert pendant le codage — le HMR
  Vite n'a pas propagé le changement structurel de `CharacterWindow.jsx` (return transformé en
  Fragment pour accueillir `<ModingWindow>` en sibling). **Rechargement complet (Ctrl+Shift+R) →
  confirmé fonctionnel par Saar.**
- **Non testé** : désinstallation (hors scope Phase A par construction), parcours avec plusieurs
  mods/armes simultanés, comportement joueur non-GM (testé uniquement avec un compte GM — le bouton
  "Customisation" et la route serveur n'ont pas de garde `isGm`, seulement `canEdit`/ownership
  standard du fichier, mais pas re-vérifié avec un compte joueur réel).
- Détail complet : `docs/PLAN_MODING.md`.

## Session 141 (suite 22) — 2026-07-12 — Bug RD (Résistance aux Dommages) : signe inversé corrigé ⚠️ CLOS PARTIEL

- Trouvé en préparant `docs/PLAN_MUTATION2.md` Lot 3 (Résistance aux Dommages + Choc) : avant de
  détailler le lot ligne-à-ligne, lecture de `docs/REGLES/REGLESYSCOMBAT.md` (obligatoire avant toute
  mécanique combat) — le texte dit explicitement *"il faut ensuite **ajouter** le modificateur de
  Résistance aux Dommages... un personnage fort et résistant va ainsi **réduire** les dégâts, alors
  que ceux-ci seront peut-être **aggravés** chez un personnage plus faible."* Le code
  (`damageService.js`/`socketCombatHelpers.js`, duplicata inline) faisait
  `degatsNets = degautsBruts - etq - rd` — **soustrayait** `rd` au lieu de l'ajouter.
- **`RD_TABLE`/`calcResistanceDommages` (`shared/polarisUtils.js`) ne sont PAS en cause** — croisées
  contre la table brute transcrite du LdB p.114 (`docs/Old/AttributsTooltips.md:81-95`, valeurs
  identiques : FOR+CON 2-5→+6 ... 38-41→-5), la table est une transcription fidèle. Le bug est
  uniquement dans la formule d'application, pas dans la donnée — même principe que la correction des
  Résistances naturelles (suite 19) : corriger la pièce qui diverge de la source, jamais celle qui
  est déjà vérifiée.
- **`[VÉRIFIÉ]` par exécution réelle avant tout correctif** (pas seulement une lecture, conforme au
  protocole) : script `node -e` appelant `calcResistanceDommages` + les deux formules sur 3 profils
  (faible/moyen/fort) — la formule alors en place donnait bien un personnage faible (FOR/CON 4/4)
  moins touché (6 dégâts nets) qu'un personnage fort (FOR/CON 18/18, 14 dégâts nets) à dégâts bruts
  identiques (10) — l'inverse de la règle. **Saar a demandé une confirmation explicite sur la
  robustesse de la solution avant codage** (pas de bricolage) : confirmé que le correctif doit vivre
  dans la formule de consommation (pas dans la table, qui reste la seule pièce vérifiable contre le
  livre et aussi utilisée en affichage lecture-seule sur la fiche, `CharacterSheet.jsx:102`).
- **Corrigé** : `degautsBruts - (etq ?? 0) - rd` → `+ rd`, aux 2 sites réels (`damageService.js`
  `resolveTargetHit`, `socketCombatHelpers.js` branche PNJ auto-résolution de `resolveMeleeAction` —
  duplicata inline connu, non consolidé dans ce correctif, dette signalée mais hors scope "un bug à
  la fois"). Doc alignée sur le nouveau signe : `docs/SYSTEME/COMBAT.md`, `docs/MANUELSYSCOMBAT.md`,
  `docs/STRUCTURE_SYSCOMBAT.md`.
- **Effet de bord positif, pas fortuit** : ce correctif lève le "signe non trivial" resté ouvert dans
  `docs/PLAN_MUTATION2.md` Lot 3 pour `adv_018`/`adv_030`/`adv_060` — une fois la formule corrigée
  (addition directe), le résolveur générique déjà construit pour les Résistances naturelles
  (`getAdvantageModForResistance`) s'applique tel quel à RD, sans inversion conditionnelle par
  `type`. Débloque un Lot 3 propre.
- **Testé** : instrumentation réelle avant ET après correctif (3 profils, `node -e`,
  `calcResistanceDommages` exécutée directement), `node --check` sur les 2 fichiers serveur touchés,
  grep de sweep confirmant l'absence d'un 3ᵉ site avec l'ancien signe, SR (`/api/health` 200).
- **Non testé** : parcours combat réel en navigateur (CaC ou tir, personnage fort vs faible à dégâts
  bruts identiques) — scénario proposé à Saar, **explicitement laissé non testé sur sa décision**
  pour enchaîner directement sur le Lot 3.
- Détail complet : cette entrée. Pas de fichier `PLAN_*.md` dédié — correctif ponctuel trouvé et
  traité en ouvrant le Lot 3.

## Session 141 (suite 23) — 2026-07-12 — `docs/PLAN_MUTATION2.md` Lot 3 : Résistance aux Dommages + Choc câblés ✅ CLOS PARTIEL

- Suite directe du correctif RD (suite 22). Plan détaillé ligne-à-ligne, **analyse critique demandée
  par Saar avant tout code** (recherche pro, robustesse) : le pattern "résolveur générique, addition
  directe" (Foundry Active Effects, validé Lot 2/RESNAT) restait valable sans nouvelle recherche —
  la vraie trouvaille de l'analyse critique a été de niveau architecture interne, pas externe.
- **Consolidation trouvée en relisant le plan initial avant de coder** : la branche PNJ
  auto-résolution CaC (`socketCombatHelpers.js`, `resolveMeleeAction`) était un duplicata quasi
  identique de `damageService.resolveTargetHit` (jet de localisation, armure, RD, sévérité,
  blessure, test de Choc) — mon plan initial proposait d'y dupliquer une 2ᵉ fois le fetch
  mutations/avantages (même erreur que celle qui avait nécessité 2 correctifs pour le bug RD).
  Remplacé à la place par un seul appel à `resolveTargetHit` : ~50 lignes dupliquées → ~30 lignes,
  4 imports devenus morts retirés (`calcResistanceArmure`, `calcResistanceDommages`, `LOC_TABLE`,
  `SLOT_TO_WOUND_LOCATION`). Plus qu'un seul endroit calcule RD/Choc en résolution de combat.
- `shared/polarisUtils.js` : `RESISTANCE_TO_MUTATION_MOD` + `getMutationModForResistance` (symétrique
  à `getMutationModForAttr` Lot 1, colonnes fixes `char_mutation_effects_view` vs liste à réduire
  côté avantages) — couvre les 6 clés (damage/shock/poison/disease/radiation/drugs) pour rester
  cohérent avec `getAdvantageModForResistance`, même si Lot 3 n'en consomme que 2. `calcResistanceDommages`/
  `calcSeuils` gagnent chacune 2 paramètres (`mod_mutation`, `mod_advantage`), addition directe —
  correcte sans inversion grâce au correctif du bug RD (suite 22).
- `statusService.js` (`resolveShockTest`) + `damageService.js` (`resolveTargetHit`, **seul point
  d'insertion** pour les 4 appelants réels + la branche CaC consolidée) : fetch `getMutationEffects`/
  `getAdvantages` de la cible en parallèle avec le fetch armure existant (même garde
  `char_sheet_id_cible && characterIdCible`).
- `socketDice.js`/`char-sheet.js` (macros) : `seuil_etourdi`/`seuil_incons` complétées avec les mods
  (déjà câblées mais jamais avec RD/Choc) + **nouvelle macro `resistance_dommages`** (absente jusqu'ici
  — décision Saar de la construire dans cette passe, complète le parallèle avec les 4 macros
  résistances naturelles). Les 4 cases résistances naturelles refactorées pour utiliser
  `getMutationModForResistance` au lieu de `mutationEffects?.mod_res_X ?? 0` inline (petit nettoyage
  de cohérence, même helper).
- `CharacterSheet.jsx` : `calcSecondary` récupère RD/Choc avec mods désormais (fiche ET résolution
  combat rebranchées dans la même passe, plus d'écart) ; `seuilEtour`/`seuilIncons` recalculés via
  `calcSeuils` importé au lieu d'un duplicata inline jamais consolidé jusqu'ici ; import `polarisRound`
  devenu mort, retiré.
- **Testé** : 11 scénarios purs `node -e` (RD/Choc sans mod, mutation seule, avantage seul, cumul,
  `null`/liste vide, dérivation seuil inconscience), `node --check` sur les 5 fichiers serveur, ESLint
  client 0 nouvelle erreur (`git stash`/`pop`, 3 problèmes pré-existants confirmés inchangés), grep de
  sweep (aucun appel resté sur l'ancienne signature), **vérification en base réelle** (lecture seule,
  personnage réel porteur de la mutation "Squelette renforcé" — delta exact +2 RD / +3 seuil
  d'étourdissement confirmé), SR (`/api/health` 200).
- **Non testé** : parcours combat réel en navigateur (CaC/distance avec mutation/avantage RD ou Choc
  actif) — non demandé dans cette passe (cohérent avec le bug RD, suite 22, resté aussi non testé en
  navigateur sur décision Saar).
- **Incident git (sans rapport avec le code)** : mes fichiers de travail (correctif RD + code Lot 3)
  ont été balayés par un commit de la session parallèle Moding (`git add -A` sur un dépôt partagé),
  committés sous le message "Moding Phase A" (`dfc1283`/`17ac8bd`, déjà poussés). Contenu vérifié
  intact fichier par fichier — aucune perte, seuls les messages de commit ne décrivent pas ce
  contenu. Historique déjà poussé non réécrit (règle du projet).
- Détail complet : cette entrée, `docs/PLAN_MUTATION2.md` Lot 3 (à marquer clos).

## Session 141 (suite 24) — 2026-07-12 — Fiche perso : détail de calcul en tooltip pour les attributs secondaires ✅ CLOS

- Suite du Lot 3 (**confirmé fonctionnel par Saar en navigateur**) : demande d'ajouter, dans le
  tooltip de la fiche perso, le détail du calcul (Base/avantages/mutations) pour les attributs
  secondaires qui ont une vraie source de modificateur — pas juste le total déjà affiché.
- **Réutilise un pattern déjà en prod** (`iniTooltip`, texte multi-lignes joint par `\n`, déjà
  supporté par le CSS du tooltip `whiteSpace: 'pre-line'`) plutôt que d'en inventer un nouveau —
  confirmé à Saar avant codage (demande explicite de robustesse/architecture sérieuse).
- `shared/polarisUtils.js` : `getAdvantageRowsForAttr`/`getAdvantageRowsForResistance` (variante
  "liste nommée" de `getAdvantageModForAttr`/`getAdvantageModForResistance`, qui ne gardaient que la
  somme) — refactor `sumModByKey` sur un nouveau `filterModByKey` partagé, comportement des fonctions
  existantes strictement inchangé (vérifié par exécution réelle avant/après).
- **Décision Saar (question posée explicitement)** : mutations affichées en **total agrégé** ("Mutations : +2"),
  pas nommées individuellement — `char_mutation_effects_view` ne conserve que la somme côté client,
  afficher le détail par mutation aurait demandé un fetch supplémentaire (liste `char_mutations`, non
  chargée dans ce composant) pour un gain jugé secondaire. Avantages affichés nommés (déjà des lignes
  individuelles côté client, aucun fetch de plus).
- `CharacterSheet.jsx` : `buildSecondaryTooltips` (nouvelle fonction pure, à côté de `calcSecondary`)
  + 2 petits helpers locaux (`attrBreakdownTooltip` pour REA/Souffle, `resistanceBreakdownTooltip`
  pour Choc/RD/Résistances naturelles — pas un moteur générique pour seulement 9 stats fixes, cohérent
  avec le style existant du fichier). Description existante conservée telle quelle si aucun
  avantage/mutation actif (pas de breakdown trivial Base=Total, même logique que `iniTooltip`).
  Nouveau `useMemo` (`secondaryTooltips`) à côté de celui de `secondary`. 9 tooltips concernés :
  `reaction`, `souffle`, `seuilEtour`, `seuilIncons`, `resistanceDommages`, `resistancePoison`,
  `resistanceMaladie`, `resistanceRadiation`, `resistanceDrogues`. `modDom`/Allures non touchés
  (aucune source de modificateur, breakdown toujours trivial).
- `fr.json` : 3 nouvelles clés génériques réutilisées par les 9 stats (`breakdownBase`/
  `breakdownMutations`/`breakdownTotal`) plutôt que 27 clés spécifiques.
- **Testé** : 4 scénarios réels (`node -e` — aucun mod, avantage seul, mutation seule, cumul des
  deux, sortie exacte vérifiée), non-régression `getAdvantageModForAttr`/`getAdvantageModForResistance`
  après refactor (mêmes valeurs qu'avant), `node --check` sur `polarisUtils.js` + 5 fichiers serveur
  consommateurs (imports inchangés, purement additifs), `fr.json` validé JSON, ESLint client 0
  nouvelle erreur (3 problèmes pré-existants confirmés inchangés), SR (`/api/health` 200).
- **Non testé** : parcours navigateur réel (hover sur chaque tooltip avec un personnage réel porteur
  d'avantage/mutation actif) — fonctions testées unitairement, pas encore vues affichées dans le
  navigateur.
- Détail complet : cette entrée.

## Session 141 (suite 25) — 2026-07-12 — `docs/PLAN_MUTATION2.md` Lot 4 : Armure naturelle → RD + Arme naturelle ✅ CLOS

- Suite du Lot 3 (clos suite 23). Deux sous-lots planifiés ligne-à-ligne, puis codés dans la même
  session (protocole complet : plan écrit → analyse critique demandée par Saar (recherche externe) →
  vérification finale du pipeline avant tout code → code → run à vide → confirmation navigateur).
- **Décisions Saar actées avant code** : `natural_armor` (armure naturelle) est une constante
  toujours active qui modifie directement la Résistance aux dommages — **pas** une pièce de plus
  dans le mille-feuille `max+reste/2` de l'armure portée (aucune règle LdB sourcée pour une telle
  combinaison, décision explicite pour éviter d'inventer une mécanique non sourcée, même logique que
  la suppression de `calcCarenceArmure` Session 141 suite 16). Gate "après saisie" (Crocs/Corne) =
  brique de stockage seulement (le Test d'opposition Lutte qui pose le statut reste manuel/futur),
  "pas de narratif" (demande explicite Saar) → réutilise le statut `grappled` déjà pleinement
  fonctionnel (`token_statuses`), pas une nouvelle colonne inventée. Sélection d'arme naturelle = pas
  de nouveau mécanisme "changer d'arme" — le choix d'arme au CaC est déjà gratuit par déclaration
  (`MeleeCombatPanel.jsx`), confirmé par lecture avant d'accepter la première proposition de Saar
  (bouton "action complète").
- **Analyse critique demandée par Saar (recherche externe, avant tout code)** — 4 sources,
  3 décisions confirmées, 1 correction réelle trouvée : PF2e Foundry (issue #14837, Strikes
  mains-nues/naturelles/armes unifiés dans la même structure — confirme `skillId` inchangé, formule
  seule variable ; référence par id stable plutôt que position de tableau, déjà le cas avec
  `natural_weapon_char_mutation_id`) ; schéma Open5e (`damage_dice` en chaîne plate, confirme
  `natural_weapon_formula VARCHAR` plutôt qu'une structure éclatée) ; D&D5e/PF2e (Grappled = condition
  booléenne sur la cible, jamais un lien "saisi par X" — confirme le choix de ne pas tracer le
  grappler) ; précédent Lot 2 de ce même document (aucun système de bonus typés dans Polaris LdB —
  confirme que `natural_armor` peut être un simple ajout direct, pas une catégorie qui s'exclut).
  **Correction trouvée** : le gate "cible saisie" prévu en booléens inline dans `resolveMeleeAction`
  a été remplacé par `shared/naturalWeapons.js` (NOUVEAU), même patron que `shared/
  combatExclusiveActions.js` (Tir visé) — `getNaturalWeaponIneligibilityReasons`/
  `isNaturalWeaponEligible`, une seule fonction pure réutilisée client (tooltip immédiat) et serveur
  (rejet autoritaire), plutôt que de dupliquer une architecture déjà validée dans ce projet.
- **Vérification finale du pipeline avant tout code (exigée par Saar — "sûr à 100%, zéro zone
  d'ombre") — 2 vrais trous trouvés et corrigés avant d'écrire une ligne de code** :
  1. `weapon_inv_id` n'est jamais transmis en direct à `resolveMeleeAction` — c'est une colonne
     réelle de `combat_actions` (`54_combat.js`), écrite en Phase 1 par `socketCombatAnnouncement.js`
     depuis `mapActions.melee[]`, relue en Phase 2. Le plan initial sautait cette chaîne à 4 maillons
     — ajout d'une 3ᵉ colonne `combat_actions.natural_weapon_char_mutation_id` (miroir
     `aim_bonus_comp`, migration 134) + plomberie complète des 2 fenêtres de déclaration +
     l'annonce serveur.
  2. La fenêtre MJ (`CombatGmDeclareWindow.jsx`) n'a pas la même architecture que la fenêtre PJ — pas
     de fetch par personnage, mais un endpoint batché (`GET /battlemaps/:id/combat-equipment`,
     `battlemaps.js`) pour tout le roster en un appel. Un fetch par PNJ aurait réintroduit le N+1 que
     ce batch évite déjà — corrigé en étendant ce même endpoint (`naturalWeapons` par token).
- **Codé** : `shared/polarisUtils.js` (`getNaturalArmorMod`) ; 4 sites RD rebranchés
  (`damageService.js`, `socketDice.js`, `char-sheet.js`, `CharacterSheet.jsx`) ; migration `138`
  (2 colonnes `ref_mutations` + 1 colonne `combat_actions`, backfill des 4 mutations depuis le texte
  LdB exact) ; `shared/naturalWeapons.js` (NOUVEAU) ; `mutationService.getMutations()` étendu ;
  `battlemaps.js` (`/combat-equipment` + `naturalWeapons` par token) ; `resolveMeleeAction`
  (`socketCombatHelpers.js` — gate + formule, revalidation serveur complète, ownership + grapple) ;
  `socketCombatAnnouncement.js` (persistance) ; `CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx`
  (fetch/état/emit, PJ et MJ/PNJ, mutuellement exclusif avec l'arme d'inventaire) ;
  `MeleeCombatPanel.jsx` (radios grisées + tooltip d'inéligibilité).
- **Gap trouvé en vérifiant Corne, différé — nouvelle dette `[CHOC1]`** : bonus LdB "+1D6 Choc si le
  coup porte à la tête" non câblé — `calcResistanceArmure` calcule déjà un `prt` (protection_shock)
  mais `damageService.js` ne l'utilise jamais, aucun pool de "dommages de Choc" distinct des dégâts
  physiques n'existe dans le pipeline actuel ; câbler ce bonus demanderait d'abord de brancher ce
  pool, chantier séparé, hors scope de ce lot.
- **Point de règle soulevé par Saar en validant le parcours navigateur** : *"On ne peut pas frapper
  avec Cornes/griffes sans saisir l'adversaire ?"* — texte LdB (`REGLE_MUTATION.md`) relu directement
  pour trancher : Corne/Crocs sont conditionnées à *"après avoir effectué une saisie"* dans le texte
  source, aucune autre mécanique d'usage n'y est décrite pour ces deux mutations. Griffes/
  Excroissance osseuse rétractable n'ont, elles, aucune précondition dans le texte. Lecture RAW
  confirmée correcte (déjà ce qui était codé) — conservée telle quelle, pas de house-rule demandée.
- **Testé** : `node --check` 0 erreur (10 fichiers serveur/partagés), ESLint client 0 nouvelle erreur
  (`git stash` avant/après — 10 erreurs/8 warnings préexistants confirmés identiques, +1 warning
  `exhaustive-deps` sur le nouveau fetch mutations, même classe que 5 warnings déjà existants sur le
  fetch inventaire jumeau côté PJ, pas une nouvelle catégorie), round-trip migration 138 réel en base
  réelle (`down`→0 colonne→`up`→3 colonnes + 4 lignes backfillées, byte-identique, P53/P54
  respectés — nodemon avait déjà auto-appliqué la migration avant le test manuel, vérifié via
  `knex_migrations` avant tout appel), 8 scénarios purs (`getNaturalWeaponIneligibilityReasons`/
  `isNaturalWeaponEligible`/`getNaturalArmorMod`/non-régression `calcResistanceDommages`),
  3 scénarios en base réelle en transaction annulée (shape `getMutations()`/requête
  `battlemaps.js` sur une vraie mutation Griffes insérée temporairement, gate ownership
  `resolveMeleeAction` avec **rejet confirmé** sur un `char_sheet_id` forgé, lecture `token_statuses`
  réelle — 0 résidu après chaque rollback), SR (`/api/health` 200 tout du long malgré les
  redémarrages nodemon successifs), **parcours navigateur confirmé fonctionnel par Saar** (PJ et
  MJ/PNJ — Griffes utilisables librement, Crocs grisées puis débloquées selon le statut "Saisi" de
  la cible, Résistance aux dommages +3 sur la fiche avec "Peau renforcée").
- **Non testé** : les cas limites de la section H listés un par un (validation donnée globalement,
  pas point par point) ; bonus "deux armes"/Attaques multiples combiné à une arme naturelle en
  conditions réelles (couvert par construction — armes naturelles absentes de `char_inventory`,
  jamais comptées dans `deuxArmesBonus` — pas re-testé manuellement).
- Détail complet : `docs/PLAN_MUTATION2.md` Lot 4 (sous-lots A et B).

## Session 141 (suite 26) — 2026-07-12 — `docs/PLAN_MUTATION2.md` Lot 5 : Déblocage de compétences (`[CS7]`) ✅ CLOS

- Diagnostic `[VÉRIFIÉ]` par requêtes réelles : `SkillsPanel.jsx` (`activeMutations`) lisait
  `charAdvantages.type==='MUTATION'`/`.muta_numero` — champs inexistants en V2 (`char_advantages` n'a
  jamais eu ces colonnes depuis migration 99) → Set toujours vide → 10 compétences à prérequis
  MUTATION structurellement invisibles pour **100% des personnages**, sans exception (la boucle
  finale de `isVisible` exige le prérequis inconditionnellement, y compris pour un `is_learned=true`
  déjà acquis — vérifié en base, voir plus bas).
- **Correction de donnée trouvée et confirmée par Saar** : 8 des 10 lignes `ref_skill_requirements`
  référençaient encore l'ancien identifiant V1 (`muta_XXX`, table `ref_mutations` V1 migration 38,
  supprimée migration 94) — remappées par correspondance de nom (sans ambiguïté) vers le
  `mutation_id` V2 réel. Les 2 lignes restantes (`MAITRISE_DE_LA_FORCE_POLARIS`/
  `MAITRISE_DE_LECHO_POLARIS`) référençaient `muta_029` — **erreur confirmée par Saar : cette
  mutation n'aurait jamais dû exister** ("Sensibilité au Polaris" V1, aucune ligne V2 ne s'en
  approche). L'accès réel passe par l'Avantage `adv_079` "Force Polaris" (déjà seedé migration 123,
  texte LdB déjà en base confirmant ce gate). Migration `139_fix_ref_skill_requirements_mutations.js`
  (NOUVEAU) : remap des 8 valeurs + bascule des 2 lignes Polaris vers un nouveau type de prérequis
  `ADVANTAGE` (aucune contrainte DB ne l'empêchait, `type` est `text` libre).
- **2ᵉ trou trouvé en traçant `POST /skills/buy`** : seul `SKILL_MIN` était revalidé côté serveur.
  MUTATION/GENOTYPE n'étaient vérifiés nulle part — sans conséquence tant que le Set client restait
  vide, mais une fois la visibilité corrigée un POST forgé aurait pu acheter une compétence sans
  posséder la mutation/l'avantage. Fermé dans le même lot (revalidation serveur MUTATION/ADVANTAGE,
  toujours active, même esprit que SKILL_MIN).
- **Hors scope, transféré en dette séparée** (`docs/BUGIDENTIFIE.md` POL1, décision Saar) :
  `adv_078` "Polaris non maîtrisé" doit déclencher un tirage aléatoire de 2 pouvoirs Polaris sans
  jamais débloquer les 2 compétences Maîtrise — mécanique jamais construite, session dédiée future.
- Codé : `shared`/migration 139 ; `SkillsPanel.jsx` (nouvelle prop `charMutations`, `activeMutations`
  reconstruit depuis la vraie source, nouveau `activeAdvantageIds`, branche `ADVANTAGE` symétrique à
  MUTATION aux 2 sites de `isVisible`) ; `CharacterSheet.jsx` (état + fetch `charMutations`,
  `handleMutationsChanged` recharge désormais aussi cette liste, prop passée à `SkillsPanel`) ;
  `char-sheet.js` (`POST /skills/buy` — revalidation serveur MUTATION/ADVANTAGE toujours active).
- **Analyse critique demandée par Saar avant confirmation navigateur** — 3 points vérifiés en base
  réelle, aucun bloquant : (1) confirmé que les 10 compétences étaient invisibles pour 100% des
  personnages avant le fix (aucun risque de faire disparaître une compétence actuellement visible) ;
  (2) anomalie de donnée pré-existante trouvée — le personnage "Mr sourire" avait déjà
  `MAITRISE_DE_LA_FORCE_POLARIS` avec `is_learned=true, mastery=2` sans jamais avoir possédé
  `adv_079` ni aucune mutation (déjà invisible pour lui avant le fix à cause du même bug, reste
  cohérent avec la vraie règle après) ; (3) confirmé que `shared/careerSkills.js` (moteur Wizard) ne
  lit jamais `ref_skill_requirements` — gap pré-existant distinct, non aggravé, hors scope.
- **Test réel effectué avec du vrai personnage** (Saar : *"aucune donnée précieuse en dev"*) :
  "Mr sourire" utilisé comme personnage de test — `adv_079` octroyé via un insert direct
  `char_advantages` (le service `addAdvantage()` s'est révélé exiger un `char_pc_ledger` que ce
  personnage n'a pas — écart noté, pas creusé, hors scope) ; mutation "Contagion" octroyée via le
  vrai `mutationService.addMutation()`. **Parcours navigateur confirmé fonctionnel par Saar** :
  "Contagion" et "Maîtrise de la Force Polaris" (déjà apprise, mastery 2) visibles ; les 7 autres
  compétences mutation-gated + "Maîtrise de l'Écho Polaris" restent masquées comme attendu.
- **2 problèmes trouvés par Saar en testant, tous deux hors scope de ce lot** (règle "un bug à la
  fois") : (1) "Mr sourire" (humain) a accès à la compétence "Hybride", réservée aux génotypes
  hybride naturel/génohybride/technohybride — bug GENOTYPE distinct, à investiguer séparément ;
  (2) aucune interface ne permet d'ajouter un Avantage/Désavantage générique depuis le bloc
  "AVANTAGES & DÉSAVANTAGES" (le bouton "+" existant ne couvre que Mutations/Force Polaris/Autres,
  confirmé — la route serveur `POST /advantages` existe mais n'a jamais eu de UI). Les deux repris
  en sessions séparées.
- **Testé** : `node --check` 0 erreur (migration + route), ESLint client 0 nouvelle erreur (`git
  stash`/`pop` — 3 erreurs/2 warnings préexistants confirmés identiques sur les 2 fichiers touchés),
  round-trip migration 139 réel (`down()`→10 valeurs V1 dont `muta_029`→`up()`→8 valeurs V2 + 2
  lignes `ADVANTAGE`, byte-identique, P53/P54 respectés), 5 scénarios en base réelle en transaction
  annulée (sans mutation/avantage → rejet ; avec → satisfait ; avantage `removed_at` posé → rejet,
  confirme le filtre soft-delete), SR (`/api/health` 200 tout du long), **parcours navigateur
  confirmé fonctionnel par Saar**.
- **Non testé** : achat effectif via le bouton "+" en mode Progression pour les 8 mutations restantes
  et pour `MAITRISE_DE_LECHO_POLARIS` (seule "Contagion" et l'état déjà-appris de "Maîtrise de la
  Force Polaris" ont été vérifiés visuellement) ; rejet serveur `AppError` en conditions réelles
  (POST forgé) — vérifié seulement en transaction directe, pas via une vraie requête HTTP.
- Détail complet : `docs/PLAN_MUTATION2.md` Lot 5.

## Session 141 (suite 27) — 2026-07-12 — Bug GENOTYPE : compétence "Hybride" visible pour un personnage Humain ✅ CLOS

- Trouvé par Saar en testant le Lot 5 (`docs/PLAN_MUTATION2.md`), hors périmètre de ce lot, traité en
  session séparée (règle "un bug à la fois").
- **Diagnostic `[VÉRIFIÉ]`** : `ref_skills.HYBRIDE` avait **zéro ligne** dans
  `ref_skill_requirements` — jamais gaté depuis sa création, visible pour tout le monde. Recherche
  élargie : `type='GENOTYPE'` avait **zéro ligne dans toute la table**, ce mécanisme n'a jamais été
  alimenté malgré son support déjà codé dans `SkillsPanel.jsx`. Les 232 descriptions de compétences
  vérifiées : `HYBRIDE` est la seule à mentionner une restriction de génotype/mutation — cas isolé,
  pas un audit à refaire ailleurs. Texte LdB embarqué dans la description : accessible aux génotypes
  `HYB_NAT`/`GEN_HYB`/`TEC_HYB` **OU** à la mutation Amphibie (`mutation_id=2`) — 4 alternatives (OR).
- **Point d'architecture central** : le moteur existant (`isVisible`) traite toutes les lignes d'une
  compétence en ET — insuffisant ici (ajouter naïvement 4 lignes aurait rendu la compétence
  définitivement inachetable, personne n'ayant 3 génotypes à la fois). **Recherche externe demandée
  par Saar avant tout code** ("aucun bricolage toléré") : 5etools (compendium D&D5e figé, situation
  la plus proche d'Enclume) modélise ses prérequis de dons en **2 niveaux** — tableau externe = ET,
  valeur en tableau imbriqué = OU — schéma qui sert tout le contenu 5e depuis des années sans plus de
  profondeur. PF2e (Foundry) a un système `Predicate` **récursif** (`{or:[...]}`/`{and:[...]}`,
  imbrication illimitée), mais conçu pour du contenu communautaire arbitraire ("Rule Elements") — déjà
  écarté pour ce projet dans `docs/PLAN_TIRVISE.md`/Lot 2 de ce même plan (catalogue fixe, jamais
  écrit par un joueur). Décision : modèle à 2 niveaux (5etools), prouvé suffisant par les données
  réelles (`HYBRIDE` = seul cas, un seul niveau d'imbrication requis).
- **Codé** : migration `140_ref_skill_requirements_or_group.js` (NOUVEAU) — colonne
  `ref_skill_requirements.or_group` (text nullable, même convention que
  `ref_career_skills.choice_group`, migration 121) + 4 lignes `HYBRIDE` partageant
  `or_group:'HYBRIDE_ORIGIN'`. `shared/skillRequirements.js` (NOUVEAU) : `areRequirementsSatisfied
  (requirements, matchFn)` — évaluateur pur unique, pattern `naturalWeapons.js`/
  `combatExclusiveActions.js` (une seule fonction, client + serveur, aucune logique dupliquée).
  `SkillsPanel.jsx` : `isVisible` généralisé — MUTATION/ADVANTAGE/GENOTYPE passent tous par le même
  évaluateur ET/OU (SKILL_MIN reste séparé, forme différente : option de campagne + calcul de seuil).
  `char-sheet.js` (`POST /skills/buy`) : revalidation serveur étendue à GENOTYPE (même trou fermé au
  Lot 5, recouvert aussi pour ce cas — fetch `char_archetype.genotype_id` ajouté). `ref.js` expose
  `or_group`.
- **Bug ESLint auto-corrigé en cours de route** : `isIdentityReqSatisfied` non mémoïsé causait un
  warning `exhaustive-deps` sur `isVisible` — corrigé en l'enveloppant dans son propre `useCallback`
  (mêmes 3 dépendances : `activeMutations`/`activeAdvantageIds`/`genotypeId`), 0 nouveau warning.
- **Testé** : `node --check` 0 erreur (migration + 2 routes + shared), ESLint client 0 nouvelle
  erreur (retour exact aux 2 problèmes préexistants), round-trip migration 140 byte-identique, 9
  scénarios purs sur `areRequirementsSatisfied` (dont non-régression du cas Lot 5 à ligne isolée, et
  un cas à 2 groupes indépendants — ET entre groupes confirmé), 2 scénarios en base réelle en
  transaction annulée sur "Mr sourire" (Humain sans Amphibie → rejeté ; avec Amphibie ajoutée
  temporairement → satisfait, résidu 0 après rollback), SR (`/api/health` 200), **parcours
  navigateur confirmé fonctionnel par Saar** ("Hybride" disparue de la fiche de "Mr sourire").
- **Non testé** : cas positif en navigateur (génotype `HYB_NAT`/`GEN_HYB`/`TEC_HYB` réel rendant
  "Hybride" visible) — vérifié seulement par transaction directe, pas par un personnage réel de ce
  génotype en session ; achat forgé rejeté via une vraie requête HTTP (vérifié en transaction
  directe uniquement).
- Détail complet : ce fichier uniquement (bug isolé, hors `docs/PLAN_MUTATION2.md`).

## Session 141 (suite 28) — 2026-07-12 — `docs/PLAN_MODING_PHASEB.md` Groupe 1 : bonus fixes optique + architecture des slots exclusifs ✅ CLOS

Reprise du plan déjà entièrement rédigé et analysé en amont (architecture des slots validée Saar +
analyse critique passée). Session de codage pure — tous les fichiers concernés relus avant code
(`modingService.js`, `socketCombatHelpers.js:1239-1437`, `socketCombatAnnouncement.js`,
`combatExclusiveActions.js`, `inventoryService.js`, `ModingWindow.jsx`, `useCharacterSocket.js`) +
vérification en base réelle des 16 lignes `ref_equipment` (family='Armes', category='Accessoires
pour armes') avant d'écrire la migration.

**Gap trouvé pendant la vérification finale ("sûr à 100%" demandé par Saar), corrigé avant code** :
les 2 mods déjà installés en prod (Phase A) auraient eu `mod_slot = NULL` après l'`ALTER TABLE` sans
backfill explicite — le garde-fou d'exclusivité (contrainte UNIQUE) ne les aurait jamais vus lors
d'un swap futur, laissant deux mods du même slot coexister silencieusement (exactement le bug que
l'architecture doit empêcher). Migration corrigée pour backfiller `char_inventory_mods.mod_slot`
via jointure sur `ref_equipment`, en plus des 16 lignes catalogue. Vérifié aussi : apostrophes
typographiques (`’` U+2019, pas `'`) sur 4 des 16 noms — inspection des code points un par un avant
d'écrire les `WHERE name = ...` (silencieux sinon, aucune exception levée sur un `UPDATE` à 0 ligne
matchée) ; unicité globale des 16 noms dans toute la table confirmée (aucune collision hors
périmètre) ; `ref_equipment.location` NULL pour les 16 lignes confirmé (P57 — stacking légitime pour
le retour en inventaire lors d'un swap, aucun de ces accessoires n'est équipable).

**Incident de numérotation en cours de route (P53)** : le numéro 140 a été pris entre-temps par une
session parallèle (`140_ref_skill_requirements_or_group.js`, batch 105, déjà appliquée) — ma propre
migration, auto-appliquée par nodemon sous le même préfixe "140" mais un nom de fichier différent
(batch 106), a été renommée `141_ref_equipment_mod_slots.js` après coup, `knex_migrations` corrigé
par `UPDATE` ciblé (id 189, batch 106) pour refléter le renommage sans déclencher de ré-exécution —
même remédiation que l'incident P52 (Session 134).

**Codé** : migration `141_ref_equipment_mod_slots.js` (NOUVEAU) — `ref_equipment.mod_slot`/
`mod_requires_aim` (16 lignes catalogue réparties en 4 slots `optique`/`logiciel`/`canon`/`poignee`,
3 items hors Phase B laissés à `NULL`) + `char_inventory_mods.mod_slot` (snapshotté, backfillé) +
`UNIQUE(weapon_inv_id, mod_slot) WHERE mod_slot IS NOT NULL` (index partiel, pattern
`uq_char_mut_no_sub`/migration 96). `modingService.js` : `installMod` swap le slot dans la même
transaction (retour en inventaire via nouvelle fonction `returnModToInventory`, Coffre, stacking
P57 ; edge case catalogue supprimé loggé et skip proprement) ; nouvelle fonction pure
`calcWeaponModBonus(installedMods)` (Groupe 1 — cherche l'unique item `mod_slot='optique'` non
`mod_requires_aim`, bonus entier valide sinon `{total:0}`). `socketCombatHelpers.js`
(`resolveAssaultAction`, humanoïdes uniquement — pas le chemin drone) : fetch mods installés ajouté
au `Promise.all` existant, `weaponModComp` ajouté à `totalModComp`, entrée `breakdown` nommant
l'item précis. Aucun changement client : `MOD_INSTALLED` (déjà émis) déclenche déjà un refetch
complet de l'inventaire chez tous les clients connectés (`useCharacterSocket.js`, même mécanisme
que `INVENTORY_ADDED/UPDATED/REMOVED`), et l'acteur voit le swap directement dans la réponse HTTP de
`installMod` (`state.installableMods`, calculée après le swap dans la même transaction).

**Testé** : migration round-trip `down`/`up` byte-identique (16/16 lignes `mod_slot` correctes,
2/2 mods déjà installés backfillés, index restauré) ; 6 scénarios en base réelle (fixture jetable
sur un personnage réel, nettoyage vérifié à 0 résidu) — sans mod (`0`), 1 mod optique (`+4` exact),
swap vers un 2ᵉ mod optique (ancien revenu en inventaire, un seul actif, `+2`), mod `logiciel`
installé en parallèle (jamais compté, slot différent), swap vers la Lunette `mod_requires_aim=true`
(`0`, jamais confondu avec un bonus plat), contrainte UNIQUE rejetant une insertion brute
concurrente (`23505`) ; `node --check` 0 erreur sur les 3 fichiers ; SR (`/api/health` 200) ;
**fonctionnel confirmé Saar** ("All tests OK").
**Non testé** : parcours navigateur réel (Test de tir en combat avec un mod optique installé,
aucun changement client dans ce lot donc rien de visuel à observer hormis le breakdown du jet) —
scénario proposé, validé par Saar sur la base des tests service + DB réels, pas rejoué manuellement
en session de jeu.
**Reste à faire** : Groupe 2 (Lunette de visée — refonte du calcul Tir visé, `AIM_MAX_TRANCHES`,
plage UI `AssaultRangedPanel.jsx`), Groupe 4 (slot `logiciel`, 4 mécaniques à détailler
individuellement) — voir `docs/PLAN_MODING_PHASEB.md`.

## Session 141 (suite 29) — 2026-07-12 — Interface d'ajout Avantage/Désavantage + bug DELETE 500 pré-existant corrigé ✅ CLOS

- Demande Saar : le bouton "+" du bloc AVANTAGES & DÉSAVANTAGES ne permettait d'ajouter que
  Mutations/Force Polaris/Autres — aucune interface pour un Avantage/Désavantage générique du
  catalogue `ref_advantages`, alors qu'une route serveur `POST /advantages` existait déjà, jamais
  utilisée par aucune UI.
- **Point d'architecture trouvé avant tout code, soumis à Saar** : cette route existante appelle
  `addAdvantage()` — la fonction du Wizard Step5, qui exige une ligne `char_pc_ledger` (sinon erreur
  500) et débite réellement des PC. Pour un personnage déjà verrouillé, ce ledger est presque
  toujours épuisé (dette `pc_postcreation` jamais crédité) → l'octroi aurait échoué en pratique pour
  quasiment tout personnage réel. **Décision Saar : octroi narratif MJ, sans coût PC, MJ uniquement**
  — même philosophie que les Mutations (Lot D) et les notes "Autres" (Lot C), déjà dans ce panneau.
- **Codé** :
  - `advantageConstraints.js` : `validateAdvantage()` gagne `skipBudgetCheck` (saute uniquement
    `sufficient_pc` — le plafond `max_desavantage_pc`, règle de conception et non un budget, reste
    toujours appliqué).
  - `advantageService.js` : nouvelle fonction `grantAdvantage(sheetId, advantageId, acquiredDuring)`
    — mêmes contraintes que `addAdvantage` moins le budget, aucun contact avec `char_pc_ledger`, même
    effet de bord `adv_076→is_fertile`. Retourne une forme identique à `getAdvantages()`
    (name/type/... aplatis depuis `snapshot_data`/`refAdv`) — sans ça la ligne fraîchement ajoutée se
    serait affichée vide côté client jusqu'au prochain rechargement complet.
  - **Bug latent trouvé et corrigé avant qu'il ne devienne actif** : `removeAdvantage()` décrémentait
    `char_pc_ledger` inconditionnellement au retrait — avec l'octroi narratif (jamais crédité au
    ledger), un retrait aurait décrémenté à tort un budget jamais affecté par cet avantage. Corrigé :
    décrémentation seulement si `acquired_during === 'creation_step5'` (schéma migration 99 prévoyait
    déjà 4 valeurs possibles pour cette colonne, seule `creation_step5` a jamais été utilisée avant
    ce lot — confirme que la distinction était anticipée, pas inventée ici).
  - `char-sheet.js` : route `POST /advantages` (existante, jamais utilisée) — ajoute
    `if (!req.isGm) throw new AppError(403, ...)`, bascule `addAdvantage()` → `grantAdvantage()`.
  - `ref.js` : nouvelle route `GET /char-ref/advantages` (catalogue complet, même style que
    `/mutations`).
  - `AdvantagesPanel.jsx` : 4ᵉ bouton "Avantage/Désavantage" (grisé si `!isGm`, grille 2×2 au lieu de
    3 colonnes) ; nouvelle étape `'advantage'` (liste scrollable groupée Avantages/Désavantages,
    grisée si déjà possédé — seule vérification client, le reste validé serveur + message d'erreur
    affiché, pas de duplication des règles family_limit/is_unique/etc.) ; `handleAddAdvantage`.
  - `fr.json` : 6 nouvelles clés (`typeAdvantage`, `typeAdvantageSub`, `stepAdvantage`,
    `catalogAdvantages`, `catalogDisadvantages`, `alreadyOwned`).
- **Bug de production pré-existant trouvé en testant via une vraie requête HTTP (jamais fait avant
  pour cette route — les sessions précédentes testaient uniquement via appel direct de fonction,
  ce qui contourne Express)** : `DELETE /advantages/:id` (`char-sheet.js:633`) faisait
  `const { reason } = req.body` sans garde — Express 5 laisse `req.body` à `undefined` si aucun body/
  Content-Type n'est envoyé, ce qui est exactement le cas du bouton "×" existant
  (`AdvantagesPanel.handleRemove`, `api.delete(...)` sans body) → **500 à chaque clic, en production,
  depuis toujours, sans rapport avec ce chantier**. Le même fichier a déjà le bon pattern ailleurs
  (`req.body || {}`, route inventaire ligne 1008) — oubli isolé sur cette route précise. Corrigé
  (1 ligne). Saar informé et a confirmé vouloir le correctif dans la foulée.
- **Testé** : `node --check` 0 erreur (4 fichiers serveur), ESLint client 0 nouvelle erreur
  (`AdvantagesPanel.jsx` 0 problème, `SkillsPanel.jsx`/`CharacterSheet.jsx` retour exact aux 5
  problèmes préexistants confirmés), `fr.json` valide. **Tests en base réelle, y compris via de
  vraies requêtes HTTP (JWT signé pour un GM réel et un joueur réel de la même campagne, pas
  seulement des appels directs de fonction)** : `GET /char-ref/advantages` (200, 79 lignes) ;
  `POST /advantages` en GM → 201 avec la forme aplatie correcte ; en joueur non-GM → 403 confirmé ;
  octroi d'un avantage déjà possédé/unique → rejeté ; 2 désavantages cumulant >10 PC → rejeté
  (`max_desavantage_pc` confirmé toujours actif malgré `skipBudgetCheck`) ; `adv_076` narratif →
  `is_fertile` basculé puis restauré au retrait ; `DELETE /advantages/:id` sans body (exactement
  l'appel du bouton "×") → 500 avant correctif, 200 après ; ledger de "Mr sourire" (personnage sans
  `char_pc_ledger`) jamais requis ni touché tout du long ; base vérifiée propre après chaque test
  (résidus supprimés via les vraies routes, pas de reste hors l'état de test Lot 5 déjà connu). SR
  (`/api/health` 200 tout du long, malgré les redémarrages nodemon).
- **SR + parcours navigateur confirmé fonctionnel par Saar** : octroi MJ visible immédiatement dans
  la liste fusionnée, bouton "×" fonctionnel sans crash (bug 500 confirmé corrigé), bouton grisé
  pour un joueur non-GM.
- Détail complet : ce fichier uniquement (feature + bug corrigé dans la même session, hors tout
  plan `PLAN_*.md` existant).

## Session 141 (suite 30) — 2026-07-13 — `docs/PLAN_MODING_PHASEB.md` Groupe 2 : Lunette de visée ✅ CLOS

Reprise en session neuve sur un plan déjà rédigé (Groupe 2, "prêt à coder" depuis suite 28). Tous
les fichiers concernés relus dans cette session avant code : `AssaultRangedPanel.jsx`,
`CombatActionWindow.jsx` (entier), `combatSections.js`, `CombatModifiersWindow.jsx`, `battlemaps.js`
(`/combat-equipment`), `docs/REGLES/REGLESYSCOMBAT.md` (section Tir visé — obligatoire avant toute
mécanique combat, règle "STOP" du domaine). Vérification en base réelle des 16 accessoires + re-
confirmation "0 usage réel" de la Lunette générique avant migration.

**Trou d'architecture trouvé pendant la vérification, corrigé avant code** : le plan proposait de
passer `portee` à `getAimIniCost`/`getAimBonusComp`, appelées en **Phase 1 Déclaration**
(`socketCombatAnnouncement.js`) — or `portee` (`confirmedModifiers.portee`) n'existe que côté
`socketCombatResolution.js`/`socketCombatHelpers.js`, **Phase 2 Résolution**, jamais transmis à la
Déclaration. Première tentative de résolution (écarter l'enforcement du plafond LdB par portée,
traité comme narratif MJ) proposée à Saar, **corrigée par Saar** : rappel du principe des deux
phases — Phase 1 = intentions (pas de valeur numérique), Phase 2 = résolution serveur. Le coût
INI/bonus stocké à la Déclaration ne dépend que du niveau physique de la Lunette (`lunetteNiveau`) ;
le plafond LdB par portée s'applique comme un **clamp en Phase 2**, dans `resolveAssaultAction` —
qui connaît déjà `confirmedModifiers.portee` et lit déjà `action.aim_bonus_comp`. Nouvelle fonction
`getEffectiveAimBonus(aimBonusComp, {lunetteNiveau, portee})` — `LUNETTE_PORTEE_CAP` reste donc
utilisé (pas écarté comme envisagé un temps avant cette correction).

**Codé** : migration `142_ref_equipment_lunette_niveaux.js` (10 lignes "Lunette de visée niv. 1" à
"niv. 10" remplaçant la ligne générique `bonus="niv"`, `mod_slot='optique'`, `mod_requires_aim=true`,
`price=1000×niv²`). `shared/combatExclusiveActions.js` : `getAimBonusComp`/`getAimIniCost` en miroir
(contexte `{lunetteNiveau}`, écrêtage au plafond global au lieu du plafond fixe 5), `getLunetteNiveau`
(pure, même forme d'entrée que `modingService.calcWeaponModBonus` — Groupe 1), `getEffectiveAimBonus`
(clamp Phase 2). `socketCombatAnnouncement.js` : fetch `char_inventory_mods ⋈ ref_equipment` pour
l'arme déclarée (uniquement si `aimTranches>0`, évite une requête systématique), `lunetteNiveau`
re-dérivé serveur (jamais transmis par le client — le payload de déclaration reste inchangé,
`aimTranches` seul). `socketCombatHelpers.js` (`resolveAssaultAction`) : clamp via
`getEffectiveAimBonus`, réutilise `installedMods` déjà fetché pour Groupe 1 (aucune requête
supplémentaire). `inventoryService.js`/`battlemaps.js` : sous-requête scalaire `lunette_niveau`
ajoutée à 2 fetchs déjà existants (`/inventory` PJ, `/combat-equipment` MJ batché) — **aucun nouvel
appel réseau**, décision prise pour éviter de réintroduire le N+1 déjà évité côté MJ (précédent
Session 141 suite 25, armes naturelles). `combatSections.js`/`AssaultRangedPanel.jsx`/
`CombatActionWindow.jsx`/`CombatGmDeclareWindow.jsx` : slider Tir visé dynamique (`max` = plafond
Lunette si supérieur à 5), résumé recalculé avec le vrai coût.

**2 bugs réels trouvés et corrigés avant tout test** :
1. **Régression d'écrêtage** — la première version de `getAimBonusComp`/`getAimIniCost` renvoyait
   `0` (pas un écrêtage au plafond) dès que les points demandés dépassaient le plafond atteignable —
   cassait le comportement classique déjà en prod (demander 7 tranches sans lunette doit rester
   clampé à +5, pas tomber à +0). Trouvé en relisant mon propre code avant test, jamais poussé en
   base. Corrigé (`resolveAimPoints`, écrêtage explicite avant calcul du coût).
2. **Migration 142 — `weight` omis** : le premier `up()` ne copiait pas `weight` (0.1 dans la
   source pré-migration) vers les 10 nouvelles lignes — déjà auto-appliqué par nodemon (P53) avant
   d'être remarqué. Corrigé dans le fichier + réparation directe des 10 lignes déjà en base
   (`UPDATE ... SET weight=0.1`). `down()` initialement écrit avec des valeurs **devinées**
   (`tech_level:3`, `rarity:'20(20)'`) — retrouvées et corrigées via la source pré-migration
   (`docs/Old/script Extraction Excel/equipement/ref_equipments_data.js`, `base_nt:"II"`) croisée
   avec les 15 accessoires soeurs intacts en base (`tech_level=2`, `manufacturer="Trinicom"`,
   `rarity="15 (20)"`) — `price_modifier` seul reconstruit par analogie (best-effort, non vérifié
   caractère pour caractère, commenté comme tel).
- **Testé** : 21 scénarios purs (sans lunette identique à avant, lunette niv.7/10, écrêtage correct
  post-correctif, clamp Phase 2 par portée — courte→5 clampé, longue→7 non clampé), migration
  round-trip `down`/`up` byte-identique (post-correctif), scénario complet en base réelle (fixture
  jetable sur un personnage réel, nettoyage vérifié 0 résidu) couvrant tout le pipeline installation
  → déclaration → résolution, sous-requête `battlemaps.js` vérifiée en exécution directe,
  `node --check` 0 erreur (6 fichiers serveur/shared), ESLint 0 nouvelle erreur (comparaison ligne à
  ligne avant/après), SR (`/api/health` 200), **fonctionnel confirmé Saar** ("test validé").
- **Non testé** : parcours navigateur réel (slider étendu au-delà de 5, clamp visuel observé à la
  résolution selon la portée).
- **Incident git signalé, sans rapport avec le code** : une session parallèle a committé
  (`4c258cc`, déjà poussé sur `origin/master`) via un `git add -A` qui a embarqué la majorité des
  fichiers de ce chantier (`combatSections.js`, `shared/combatExclusiveActions.js`,
  `inventoryService.js`, `battlemaps.js`, `socketCombatAnnouncement.js`, `socketCombatHelpers.js`)
  sous un message sans rapport ("PLAN_MUTATION2 Lot 5, bug Hybride..."). Même pattern déjà documenté
  (Session 141 suite 23, incident "Moding Phase A"). Contenu vérifié intact par grep ligne à ligne +
  tous les tests ci-dessus repassés après coup — historique non réécrit, rien à corriger.
- Détail complet : `docs/PLAN_MODING_PHASEB.md` Groupe 2.

## Session 141 (suite 31) — 2026-07-13 — Transfert du skin Wizard (Section 12) vers le reste de l'interface ✅ CLOS

Demande Saar hors chantiers en cours, en deux conversations successives : "transférer le skin du
Wizard sur le reste de l'interface", avec une exigence répétée deux fois ("architecture propre, pas
de bricolage" / "tu peux coder UNIQUEMENT si architecture propre").

**Constat avant tout code** : 3 systèmes visuels coexistaient dans `client/src/index.css` (3130
lignes à l'ouverture du chantier) — Section 3 (tokens de base, bleu désaturé `#5b8dee`), Section 10
(HARD-SF HUD chamfré `.btn`/`.badge`, grep confirme un usage dans **25 fichiers** dont les fenêtres
de combat — pas un système propre au Dashboard comme supposé initialement), Section 11 (Combat
Window System, palette tactique dédiée `--combat-*`, commentaire code explicite marquant un choix
délibéré — laissée intacte, jamais dans le périmètre demandé par Saar), Section 12 (skin Wizard,
glassmorphism — dégradé `#061223→#102744`, halo radial pulsé `wizPulse`, accent cyan `#2FD7FF`,
police `Venus Rising`, variables `--wiz-*` redéclarées en double sous `.wiz-page` ET `.wiz-shell`).

**Architecture retenue** : pattern standard de migration de design tokens (primitives + alias
sémantiques), pas un renommage massif. Les `--wiz-*` montent dans `:root` (Section 3), déclarées une
seule fois — `.wiz-page`/`.wiz-shell` ne les redéclarent plus (juste un commentaire renvoyant vers
Section 3). Les tokens génériques déjà consommés par des centaines de points dans toute l'app
(`--bg-app`, `--bg-surface`, `--bg-panel`, `--bg-elevated`, `--bg-input`, `--bg-button*`,
`--color-primary`, `--color-primary-muted`, `--text-primary/secondary/muted`,
`--border-subtle/strong`, `--shadow-md`) deviennent des **alias** vers les primitives `--wiz-*` —
zéro renommage de point d'usage ailleurs dans l'app, tout le reste du code continue de fonctionner
sans modification.

**Lot 1 — Login + Dashboard (test)** :
- `.card`/`button`/`input` (Section 7) : glass (`background: var(--wiz-glass)`,
  `backdrop-filter: blur(12px)`), focus cyan sur les inputs (`input:focus` n'existait pas du tout
  avant — gap UX comblé au passage).
- `.btn`/`.btn-ghost`/`.btn-danger`/`.btn-gold`/`.btn-success`/`.badge`+variantes (Section 10) :
  retrait du chamfer (`clip-path`), remplacé par bordure classique + glass + halo cyan au survol
  (`box-sizing: border-box` déjà global en Section 2 — aucun décalage de taille).
- `.login-page`/`.login-card`/`.login-title` : fond dégradé skin Wizard + halo pulsé (`::after`,
  `::before` déjà pris par le filigrane logo existant), carte en verre dépoli.
- `DashboardPage.jsx` : classe `.dashboard` (jusque-là déclarée en CSS mais **jamais appliquée en
  JSX** — dead code trouvé en marchant) enfin reliée, avec le même traitement de fond.
- **3 bugs réels trouvés en lisant avant de coder** : `--border-normal` inexistant dans
  `DashboardPage.jsx` (`cardInput.border`) — inputs "Rejoindre"/"Créer campagne" sans aucune bordure
  visible ; `.login-error` référencée en JSX mais jamais stylée nulle part ; `.login-title` avec un
  var CSS mort (`--font-family` au lieu de `--font-display`), fonctionnait par accident car
  `'Venus Rising'` était cité en premier dans la liste de polices.
- Testé : équilibre des accolades CSS (script Node), ESLint 0 nouvelle erreur (`git stash`/
  `git stash pop`, 3 problèmes pré-existants confirmés inchangés), **parcours navigateur confirmé
  fonctionnel par Saar** ("C'est mieux. Beaucoup mieux.").

**Lot 2 — Pages de configuration de campagne** (`CampaignSettingsPage.jsx` + 5 `Section*.jsx` +
`sharedStyles.js`) :
- Inventaire complet des 6 fichiers (~1090 lignes) : architecture déjà centralisée autour d'un seul
  `sharedStyles.js` consommé par les 5 sections — bonne base, pas besoin de tout réécrire.
- Nouvelle classe **`.app-shell`** (fond dégradé + halo pulsé, réutilise l'animation `wizPulse`) —
  extraite de `.dashboard` (qui l'utilisait déjà) plutôt que dupliquée une 3ᵉ fois pour Settings ;
  `.dashboard` et `CampaignSettingsPage.jsx` la partagent désormais (`className="dashboard app-shell"`
  / `className="app-shell"`).
- **Nettoyage architectural, pas seulement des couleurs** : `sharedStyles.section`/`optionBtn`/
  `optionBtnActive`/`btnSecondary`/`btnDanger` supprimés — ces styles inline dupliquaient
  `.card`/`.btn`/`.btn-ghost`/`.btn-danger`/`.btn-toggle` déjà existants et déjà reskinnés au Lot 1.
  Tous les appels remplacés par les classes partagées (`className="card"`, `className="btn
  btn-ghost"`, `className="btn-toggle" data-active={...}`) dans les 5 fichiers Section. Un seul
  système de boutons/cartes dans toute l'app désormais.
- `.btn-toggle` (Section 10, jusque-là non touchée — dernier vestige de bleu figé en dur trouvé en
  élargissant le périmètre) reskinnée : grep confirme un seul autre usage (`DroneSheet.jsx`), risque
  faible.
- **3 nouveaux bugs réels trouvés** : `--bg-card` inexistant (`sharedStyles.section`), `--border-
  normal` inexistant ×4 dans `sharedStyles.js` (même bug que Lot 1, fichier différent), 6
  occurrences de bleu `#5b8dee`/`rgba(91,141,238,...)` figées en dur (checkbox `accentColor`,
  boutons actifs, liens "mode expert/simple") — jamais des vraies variables, donc désynchronisées du
  token `--color-primary` dès le Lot 1.
- **Incident évité** : tentative de vérification visuelle automatisée (Playwright, second serveur
  Vite de test sur le même `node_modules`) a produit une erreur `EPERM` sur `node_modules/.vite/deps`
  — signal de contention possible avec un serveur déjà en cours sur ce dossier. Process arrêté
  immédiatement (`TaskStop`) plutôt que d'insister ; `git status` reconfirmé propre (seuls les
  fichiers attendus modifiés, aucun résidu). Vérification visuelle finale laissée à Saar en
  navigateur réel, conforme à l'usage établi de ce projet plutôt que de forcer un outillage risqué.
- Testé : équilibre CSS, ESLint sur les 9 fichiers touchés (0 nouvelle erreur, `git stash`/
  `git stash pop` répété), grep de sweep (aucune référence résiduelle aux clés `sharedStyles`
  supprimées ni aux couleurs figées), **parcours navigateur confirmé fonctionnel par Saar** ("testé
  et magnifique").

**Hors scope confirmé/différé** : Section 11 (fenêtres combat) intacte, non touchée ;
`ChangelogPanel.jsx` (100% styles inline en hex littéral, zéro token — un reskin propre exigerait une
réécriture complète, pas une retouche) laissé tel quel ; `RegisterPage.jsx` (même bug
`--border-normal` trouvé au passage par grep, mais fichier séparé sans classe CSS partagée, jamais
dans le périmètre validé) non touché — candidats naturels d'une suite si Saar le souhaite.

**Non testé** : chaque toggle de `SectionCharacterSheet.jsx` (11 options de campagne) cliqué
individuellement — rendu visuel global confirmé, pas chaque interaction isolément.

Détail complet : `client/src/index.css`, `client/src/pages/{LoginPage,DashboardPage}.jsx`,
`client/src/components/campaignSettings/*`.

---

## Intégration commune — 2026-07-15 — moteur monde + tête cousin `bad0190` ✅

La branche `integration` et le worktree `/home/codex/Enclume-fusion` ont été créés depuis la tête
monde `92ae9a9`. La tête active du cousin `bad0190` a été importée par un merge à deux parents
(`1f048cd`). L'ancienne branche `origin/fusion-kiwi` `37703bf` a été exclue : son éditeur Surface v2
est incompatible en écriture avec le document monde v12.

Avant la fusion, le tag `backup/pre-fusion-20260715-110349` et l'archive
`/home/codex/backups/enclume-pre-fusion-20260715-110349` ont figé le bundle Git, la configuration,
`vtt_codex` et le volume MinIO avec sommes SHA-256. La base `vtt_fusion` a ensuite été restaurée
depuis ce dump, Redis isolé sur la base logique `2` et 23 objets/64 060 053 octets copiés vers le
bucket `enclume-assets-fusion`.

Résolution et validation :

- conflit documentaire `docs/EN_COURS.md` fusionné sans perdre l'historique monde ou la suite 31 ;
- état personnel `.obsidian/workspace.json` écarté et gitlink historique `Enclume-codex` retiré ;
- commentaire CSS contenant `*/` corrigé après détection par le build Lightning CSS ;
- dépendance de hook et variable `catch` inutilisée corrigées dans `CampaignSettingsPage.jsx` ;
- 124 tests monde/serveur et 28 tests Surface passent ;
- ESLint ciblé passe sans erreur ;
- build Vite de production et smoke Playwright Chromium passent ;
- les trois couples client/API répondent simultanément sur `8193/8194`, `8293/8294` et
  `8393/8394` ;
- les unités `enclume-fusion-client.service` et `enclume-fusion-server.service` sont actives et
  activées au démarrage.

Workflow durable : `docs/WORKFLOW_FUSION.md`. Autorités combat/monde :
`docs/FUSION_PROJET_COUSIN.md`.

**Publication distante différée** : le push HTTPS de `integration` a été refusé car le compte
système `codex` ne possède pas d'authentification GitHub non interactive. La branche et le
déploiement restent valides localement ; aucun identifiant du cousin n'a été réutilisé.

**Correctif d'accès public** : les services écoutaient correctement sur `0.0.0.0:8393` et `*:8394`,
mais UFW ne connaissait que les anciens ports. `8393/tcp` et `8394/tcp` sont désormais autorisés
publiquement, les URL client/API utilisent `89.92.219.211` et la redirection de la box répond sur les
deux ports. Vérification : HTTP 200 côté client et health API `ok`.

**Audit des modèles de personnages** : les 9 objets MinIO `characters/`, dont cinq GLB, sont
identiques entre les buckets source et fusion. Quatre personnages de `vtt_fusion` référencent leur
GLB. `vtt` possède en plus `Drone 1`, dont le GLB est bien copié mais dont la ligne personnage et les
relations ne sont pas dans `vtt_fusion`, ainsi que `Mechant` sans GLB. Aucune ligne vivante n'a été
importée implicitement depuis la base du cousin.

**Correctif CORS et audit compte** : après bascule vers l'URL publique, une page ouverte par l'URL
LAN ne pouvait plus envoyer son login car `CLIENT_URL` ne portait qu'une origine. Le nouveau
`CLIENT_URLS` est parsé par `server/src/lib/clientOrigins.js` et partagé entre Express et Socket.IO,
sans wildcard. Trois tests purs et deux parcours Playwright (LAN/public) passent. Les empreintes des
e-mails et hashes de mots de passe sont identiques dans `vtt`, `vtt_codex` et `vtt_fusion` : aucun
compte n'avait été supprimé ou réinitialisé.

Le correctif est complété par un proxy same-origin dans Vite : `VITE_API_URL` vide, `/api` et
`/socket.io` relayés vers `API_PROXY_TARGET` `127.0.0.1:8394`. Les requêtes de login, health checks et
handshakes Socket.IO restent sur le port `8393` vu du navigateur, aussi bien par l'adresse LAN que
publique. Les cookies `SameSite=Lax` ne dépendent donc plus d'un trajet LAN → API publique.

**Base commune pour le travail à deux** : après sauvegarde vérifiée dans
`/home/codex/backups/enclume-common-baseline-20260715-125308`, les anciennes têtes `bad0190` et
`92ae9a9` ont été conservées par tags. Les worktrees de développement ont été replacés sur le même
arbre fusionné, branches `dev/cousin` et `dev/monde`. Les deux adaptations locales masquées par
`skip-worktree` chez le cousin ont été sauvegardées dans l'archive et dans le stash
`pre-common-baseline-local-config-20260715`, puis remplacées par la configuration same-origin
canonique.

Le bucket partagé historique a été cloné vers `enclume-assets-cousin` et
`enclume-assets-monde` : 23 objets et 64 060 053 octets dans chaque copie, tailles et ETags
contrôlés objet par objet. Après migrations et redémarrage, les trois instances répondent ; 124
tests monde, 3 tests CORS, les deux builds de développement et les handshakes Socket.IO passent.

**Modèles de tokens de test importés depuis le poste de Saar** : les deux fichiers GLB 2.0 locaux
`Jon_Polaris_Realistic.glb` et `Jon_Polaris_Figurine.glb` ont été copiés dans le bucket
`enclume-assets-fusion`, sans remplacer le modèle du personnage Jon existant. Deux PNJ visibles et
supprimables ont été ajoutés à `La Beta-test Company` pour permettre des essais immédiats :

- `Test Jon réaliste` (`bfa678cf-52e8-4606-a061-3b8886f933f4`) ;
- `Test Jon figurine` (`837e7d98-bb66-40ef-ac69-902d0b49d43e`).

Les sommes SHA-256 des objets MinIO correspondent exactement aux fichiers sources et les deux
ressources répondent en HTTP 200 via le proxy d'assets. Cette opération ajoute uniquement des
données de test ; aucune bibliothèque ni logique de sélection de modèle n'a été introduite.

---

## Session 142 (Codex) — 2026-07-15 — Fenêtres structurelles et verrières ✅ CLOS

Le chantier ajoute des ouvertures vitrées natives au document Surface v12, sans les réduire à des
objets 3D décoratifs. `window`, `screen-window` et `skylight` reçoivent un UUID stable, une géométrie
métier validée et les canaux physiques compilés dans le snapshot commun.

**Architecture et correctifs de fond** :

- le catalogue intégré copie les métadonnées d'ouverture du manifeste dans
  `blueprint.geometry` ; 20 GLB déterministes sont fournis dans `output/structural_windows` ;
- la découpe murale utilise un intervalle vertical absolu et ne traite que les tranches réellement
  intersectées. Elle conserve l'allège, le linteau et les portions hors baie, pour murs droits comme
  courbes ;
- `screen-window` limite ses états runtime à ceux déclarés par le modèle. La route dédiée persiste
  l'état dans `world_feature_states`, incrémente la révision et diffuse la mutation ;
- mouvement, vision et fluides sont compilés séparément : une vitre n'est jamais praticable, et la
  vue dépend de l'état de l'écran ;
- une verrière ne peut remplacer qu'une vraie interface sol/plafond. Elle conserve un support
  praticable, ouvre la vue et bloque la traversée verticale ainsi que les fluides ;
- l'effaceur et les tests d'intersection traitent les fenêtres comme des ouvertures murales, et non
  comme des objets de grille ;
- la pose depuis le panneau du mur conserve sélection, panneau et aperçu GLB jusqu'à une validation
  effective.

**Testé** : 31/31 tests Surface ; suite `test:world` ; 3/3 tests de configuration serveur ; build
Vite de production ; validation du générateur et des 20 manifests/GLB ; smoke Playwright sans erreur
JavaScript ; scénario Playwright complet avec création d'une carte multi-niveau, sauvegarde d'une
fenêtre, d'un écran deux niveaux et d'une verrière, rejet HTTP 400 d'un état interdit, persistance de
l'état `mirror`, chargement des assets, puis sélection salle → mur → « Ajouter une fenêtre » avec
aperçu réel. Les données de campagne et de compte créées par ce scénario ont été supprimées.

**Non testé** : validation esthétique finale par le MJ sur ses propres textures et cartes. La
géométrie, la persistance et l'interaction ont été contrôlées sur une carte éphémère dédiée.

**Données** : le pack intégré est synchronisé au démarrage comme les autres builtins. Aucune donnée
de campagne existante n'est migrée et aucune rétrocompatibilité spéciale n'est ajoutée.

**Retour arrière** : revert du commit de session ; la sauvegarde complète du WIP antérieur reste
dans `/home/codex/backups/windows-wip-20260715-2115` (bundle, patch, archive et empreintes).

---

## Session 142 (Codex — suite) — 2026-07-15 — Fenêtres continues et contexte multi-étages stable ✅ CLOS

Cette suite retire la dernière dépendance UX des fenêtres au panneau de mur et corrige la cause du
clignotement des niveaux supérieurs. Les fenêtres restent des connecteurs structurels ; seul leur
point d'entrée dans l'éditeur rejoint le catalogue des objets 3D.

**Architecture et UX** :

- les `window` et `screen-window` intégrés sont regroupés sous **Objets 3D > Fenêtres** ; les choisir
  active un rayon de pose sur tout mur valide du niveau et non l'éditeur d'entité libre ;
- la pose conserve les métadonnées de découpe et crée `surface_data.connectors`, puis revient au
  mode sélection ; le panneau de mur ne contient plus que **Ajouter une porte** ;
- le générateur produit une seule vitre continue par baie, quel que soit le nombre de pans, sans
  traverse ni meneau intérieur ;
- `SLOT_03` des fenêtres-écrans est désormais libellé **Charnières**. Les boîtiers de commande ont
  un matériau `FIXED` séparé et ne suivent pas cette couleur ;
- chaque GLB de fenêtre-écran ne contient plus qu'un seul boîtier. Le champ validé
  `modelFacing: front|back` et le bouton **Retourner la fenêtre** choisissent sa face sans toucher au
  connecteur physique ;
- la convention de matériau `__SLOT_03__Hinges` complète le manifeste d'une fenêtre intégrée déjà
  posée : elle reçoit elle aussi le réglage **Charnières**, sans migration de carte ;
- le halo d'entité lit les bornes locales réelles du GLB après ses transformations internes, puis
  reçoit la même rotation d'instance que le modèle. Les dimensions déclaratives du blueprint ne
  peuvent plus l'envoyer dans un axe différent ;
- le volume actif ne dépend plus simultanément de la cible et de la position de caméra. Le joueur
  utilise la position de son token suivi ; le MJ et l'éditeur utilisent la cible de `MapControls` ;
- la position de caméra reste l'autorité exclusive du test avant/arrière des façades. Une salle
  voisine traversée par l'œil ne peut donc plus masquer les passerelles, connecteurs, objets 3D,
  tokens ou effets des niveaux supérieurs de la salle réellement observée.

**Cause racine reproduite** : un test place la caméra dans une salle voisine tout en gardant sa cible
dans une tour multi-niveau. L'ancien calcul choisissait la voisine et faisait disparaître la tour ;
le nouveau contrat conserve la tour comme contexte et utilise séparément la caméra pour l'occlusion.

L'audit de l'eau a également écarté le dernier nettoyage Saar de `Canvas3D` : ce commit retire des
props mortes et ajoute uniquement un fallback de déplacement MJ. La vraie erreur était dans la
hauteur géométrique de la nappe : `7,5 m` désignait le plan médian d'un plafond épais de `0,25 m`, et
le renderer retirait encore `0,02 m`. Sur la carte réelle à trois niveaux, l'eau traversait donc la
dalle. Elle utilise désormais sa face supérieure à `7,625 m`, puis un décalage positif de `0,02 m`.

**Testé** : 62/62 tests ciblés `cameraCutaway`, `surfaceData`, contrat Surface, bornes de sélection et
slots de matériaux ; build Vite ; contrôle syntaxique et exécution du générateur ; inspection des
20 GLB (aucun `Mullion`, huit slots de charnières, huit boîtiers avant et aucun boîtier arrière) ;
synchronisation serveur de 92 modèles ; health API ; calcul de la carte réelle donnant une nappe
unique à `7,625 m` ; puis parcours navigateur réel. La catégorie **Fenêtres** contient les 16 modèles
muraux, l'aperçu n'affiche qu'un boîtier, et le panneau d'une ancienne fenêtre-écran expose
**Retourner la fenêtre** et **Charnières**. La fenêtre créée pour le contrôle a été supprimée ; la
carte a retrouvé ses cinq connecteurs initiaux.

**Données** : aucune carte n'est migrée. Le démarrage serveur resynchronise seulement les manifests
et URLs des modèles intégrés. Les fenêtres déjà posées conservent leur connecteur et leur état ; le
nouveau GLB est repris par le cachebuster `mtime-size`.

**Retour arrière** : revert du commit de cette suite, puis redémarrage de
`enclume-codex-server.service` pour resynchroniser le manifeste précédent.

---

## Session 143 (Codex) — 2026-07-16 — Interactions 3D cohérentes et dalles empilées opaques ✅ CLOS

La capture d'une entité tournée a confirmé que la correction par boîte englobante restait
conceptuellement mauvaise : elle évaluait une orientation distincte du modèle et produisait encore
un volume jaune à 90°. La sélection GLB utilise désormais deux coques additives attachées à chaque
mesh. Elles héritent de toute la hiérarchie du modèle, y compris les pivots et animations, et ne
participent ni au raycast ni aux matériaux d'eau.

Le catalogue intégré inspecte aussi le chunk JSON de chaque GLB et copie ses noms de clips dans
`geometry.animationClips`. Les modèles possédant une animation d'ouverture reçoivent deux états
système (`closed`/`open`) avec une progression explicite. Le hook commun
`useModelStateAnimation.js` joue tous les clips dans le sens demandé, force la pose exacte au terme
et la maintient. Il équipe `EntityMesh` et `DoorConnectorModel`; l'état physique de la porte reste
le même état canonique déjà consommé par collision, navigation et LOS. Après resynchronisation,
43/92 blueprints sont ouvrables, dont 8/8 portes.

Les réglages couleur d'une entité libre ou d'un connecteur affichent maintenant un
`Object3DPreview` compact dans **Apparence**. Les quatre connecteurs horizontaux ont été renommés
**Dalle en verre 1x1/2x1/2x2/3x3**, rangés sous **Objets 3D > Dalles en verre** et retirés du panneau
de salle afin de conserver un seul parcours de pose structurelle.

Le défaut des salles empilées venait de la branche de rendu du plafond inférieur : lorsque le sol
supérieur était hors du niveau affiché, l'interface commune recevait encore `ceilingOpacity`. Le
contrat est maintenant explicite dans `horizontalInterfaceOpacity` : toute interface possédant un
`floorRoomId` est opaque ; seule une vraie toiture sans salle supérieure peut être découpée en
transparence.

Enfin, la configuration de campagne remplace **Zone dangereuse** par l'onglet rouge **Supprimer**.
Son panneau de droite contient l'avertissement irréversible et le bouton
**Confirmer la suppression** ; le `window.confirm` natif a été retiré.

**Testé** : 131/131 tests monde/serveur, 3/3 configuration, 6/6 tests ciblés animation/halo/opacité,
ESLint ciblé sans erreur et build Vite. Dans le navigateur intégré : 4 dalles visibles dans la
bonne catégorie, aperçus couleur d'une cuve et d'une fenêtre-écran, halo calé sur la cuve, porte
vitrée coulissante fermée → ouverte et maintenue → refermée, sol de la salle simple superposée
opaque, panneau de suppression et bouton de confirmation présents sans déclencher la suppression.
La porte utilisée a été remise dans son état fermé et aucune donnée de test n'a été laissée.

**Données** : le rafraîchissement du catalogue met à jour les états et les métadonnées d'animation
des blueprints système. Les instances existantes restent à l'état `0` fermé. Aucun document Surface
n'est migré et aucun mode de rétrocompatibilité n'est ajouté.

**Retour arrière** : revert du commit de session, redémarrage des services 8293/8294, puis
rafraîchissement du catalogue pour rétablir les états du commit précédent.

---

## Session 144 (Codex) — 2026-07-16 — Coupe d'étage, halo des portes et pose des verrières ✅ CLOS

La régression de rendu ne venait pas du principe des interfaces partagées, mais d'une attente
erronée introduite en Session 143 : `hasFloor` forçait toute interface portant un sol supérieur à
rester opaque, quel que soit l'étage affiché. Le contrat est désormais piloté uniquement par le
contexte d'affichage. Depuis l'étage bas, l'interface conserve l'opacité de coupe du plafond
courant ; depuis l'étage haut, le plafond inférieur est omis et le sol supérieur est opaque. Les
sols, plafonds et murs des étages strictement inférieurs restent toujours opaques.

La coupe des murs possède maintenant son propre garde-fou d'architecture : une façade ne peut
participer à la transparence que si son niveau est le niveau affiché ou si elle appartient au
volume multi-niveau actif. La règle de façade logique complète reste inchangée.

Le décalage jaune des portes avait une autre cause : `DoorConnectorModel` utilisait encore un
`ConnectorSelectionOutline` déclaratif, distinct du GLB, alors que les objets libres avaient déjà
adopté les coques attachées aux meshes. Les portes, fenêtres et fenêtres-écrans GLB utilisent
désormais ces mêmes coques et héritent donc directement des rotations, pivots et animations.

Enfin, le choix d'un `skylight` activait bien le mode connecteur, mais `Editor3D` ne conservait le
renderer structurel que pour `window` et `screen-window`. Il montait alors la scène des entités
libres, qui ne sait pas poser une interface horizontale. `skylight` est maintenant routé vers
`SurfaceEditorScene`, comme l'exige sa nature de connecteur structurel.

**Testé** : 65/65 tests ciblés (`horizontalSurfaceOpacity`, `cameraCutaway`, halo, document Surface
et géométrie des salles), 131/131 tests monde/serveur, 3/3 tests de configuration, ESLint ciblé sans
erreur et build Vite. Dans le navigateur intégré : étage 0 visible sans sol supérieur parasite, sol
supérieur opaque à l'étage 1, niveaux inférieurs opaques, halo d'une porte vitrée aligné sur son GLB,
puis pose et suppression d'une dalle en verre.

**Données** : la dalle de contrôle `connector:skylight:6:6:1:1x1` a été supprimée ; aucun connecteur
de test ne reste. Aucun document Surface n'est migré et l'état de la porte inspectée n'a pas été
modifié.

**Retour arrière** : revert du commit de Session 144, redémarrage de
`enclume-codex-client.service` et `enclume-codex-server.service`, puis vérification du healthcheck
sur 8293/8294.

---

## Session 145 (Codex) — 2026-07-16 — Autorité unique des interfaces horizontales ✅ CLOS

Le scénario utilisateur restait incorrect après la Session 144 : créer une salle au niveau 0,
monter au niveau 1 puis créer une salle par-dessus pouvait encore laisser voir le sol inférieur.
La correction d'opacité précédente ne traitait que le symptôme. La cause racine était une double
autorité de rendu : `roomHorizontalInterfaces` décidait des plafonds, tandis qu'une boucle séparée
dessinait tous les sols visibles directement depuis `surface.rooms`.

Le renderer ne possède plus de chemin spécial pour les sols de salle. Chaque interface horizontale
canonique choisit maintenant une unique face par contexte : `ceiling` tant que le niveau de son
`floorRoomId` n'est pas affiché, puis `floor` dès cet étage. Le même composant reçoit l'empreinte,
l'altitude et le propriétaire choisis ; un plan partagé ne peut donc plus conserver la matière ou
la géométrie de la salle basse après le changement d'étage.

Le choix est isolé dans `horizontalInterfaceRenderKind`, testé indépendamment de React. Il couvre
les interfaces partagées, les sols supérieurs sans plafond inférieur, les niveaux déjà dépassés et
les plafonds d'un volume multi-niveau actif. `horizontalInterfaceOpacity` ne s'applique plus qu'au
cas où l'interface a effectivement choisi la face plafond.

**Testé** : 24/24 tests ciblés (`horizontalSurfaceOpacity` et géométrie des salles), 131/131 tests
monde/serveur, 3/3 tests de configuration, ESLint ciblé sans erreur et build Vite. Une lecture de la
carte réelle `dazdazd` confirme trois interfaces à `y = 2,5 m` : chacune choisit la salle basse comme
plafond au niveau 0, puis son `floorRoomId` de niveau 1 comme sol au niveau 1. La session réelle a été
chargée au niveau 1 dans le navigateur sans erreur de rendu.

**Données** : aucune carte n'est modifiée ou migrée. Le diagnostic est en lecture seule et aucune
salle de test n'a été créée.

**Retour arrière** : revert du commit de Session 145, puis redémarrage de
`enclume-codex-client.service` et vérification du client 8293.

---

## Session 146 (Codex) — 2026-07-16 — Enveloppe basse sans intérieur ✅ CLOS

La règle précédente « tous les niveaux inférieurs restent opaques » était trop grossière : elle
conservait aussi leurs sols, plafonds et objets intérieurs. Le contrat a été séparé à la racine en
deux prédicats. La visibilité d'enveloppe conserve les structures des niveaux inférieurs ; la
visibilité d'intérieur n'accepte que le niveau affiché, sauf à l'intérieur du volume multi-niveau
actif.

Les murs continuent donc d'utiliser la visibilité d'enveloppe. Les portes, fenêtres, écrans et
entités dont le mode de pose canonique est `wall` la suivent également. Les interfaces horizontales,
escaliers, eaux et effets, entités libres et tokens utilisent la visibilité d'intérieur. Le même
choix est appliqué dans le renderer de jeu, l'éditeur et le picking : un contenu caché ne peut pas
rester sélectionnable.

`horizontalInterfaceRenderKind` ne choisit plus une face parce qu'elle se trouve simplement sous
le niveau courant. Il rend uniquement la face du niveau courant ou d'un volume multi-niveau actif.
Sur la carte réelle `ddfa2f40-d30f-4cff-a30d-891f7d448e66`, le sol bas à `y = 0` choisit `floor` au
niveau 0 puis `null` au niveau 1 ; l'interface à `y = 2,5 m` choisit `ceiling` au niveau 0 puis le
`floor` de la salle haute au niveau 1 ; la toiture à `y = 5 m` reste cachée au niveau 0 puis devient
le plafond découpé au niveau 1.

**Testé** : 51/51 tests ciblés (`surfaceData`, interfaces horizontales et coupe caméra), 131/131
tests monde/serveur, 3/3 tests de configuration et build Vite. ESLint ciblé ne signale aucune
nouvelle erreur ; `Editor3D` conserve 9 avertissements de dépendances de hooks déjà présents et
`Canvas3D` 3 avertissements déjà présents lorsque la règle `react-hooks/refs`, également antérieure,
est neutralisée.

**Non testé** : contrôle visuel automatisé après modification, le pilote du navigateur intégré
n'étant plus disponible au moment de la validation finale. Le scénario exact et ses données ont
été contrôlés en lecture seule avant la modification, puis son plan de rendu a été recalculé avec
le nouveau moteur.

**Données** : aucune carte n'est modifiée ou migrée. La distinction enveloppe/intérieur est une
règle de rendu et de picking dérivée des données v12 existantes.

**Retour arrière** : revert du commit de Session 146, redémarrage de
`enclume-codex-client.service` et `enclume-codex-server.service`, puis vérification du healthcheck
sur 8293/8294.

---

## Session 147 (Codex) — 2026-07-16 — Contexte caméra lié à l'étage ✅ CLOS

Le navigateur réel a révélé ce que les tests de plan de rendu ne montraient pas : au passage du
niveau 0 au niveau 1, `useCameraRoomId` conservait encore l'identité de la salle basse pendant que
son recalcul attendait 120 ms de frames 3D. Cette ancienne salle restait donc l'exception de volume
actif et autorisait son sol intérieur en même temps que le sol supérieur. Dans un onglet ralenti ou
sans assez de frames, cet état transitoire pouvait durer indéfiniment.

Le contexte persistant contient maintenant `{ displayLevel, roomId }`. Le renderer ne lit le
`roomId` que si son niveau correspond exactement au niveau actuellement affiché. Le changement de
niveau invalide donc l'ancien volume synchroniquement ; le calcul caméra peut ensuite résoudre la
salle du nouvel étage sans jamais réintroduire l'intérieur précédent. Cette règle corrige en même
temps le jeu, l'éditeur, les objets, tokens, effets et surfaces horizontales qui consomment ce
contexte.

**Testé** : 52/52 tests ciblés de caméra, coupe et géométrie ; ESLint ciblé sans erreur ; build
Vite. **Rectificatif Session 148** : la validation visuelle inscrite lors de cette session était
fausse. Le navigateur choisissait bien la salle haute, mais son plancher restait physiquement à
`y = 0` à cause d'une seconde faute indépendante dans la résolution de `yOverride`. La capture
n'établissait donc pas ce qui avait été affirmé. La vérification visuelle valide et reproductible
est celle de la Session 148 après correction de l'altitude et redémarrage complet.

**Données** : lecture seule de la carte `ddfa2f40-d30f-4cff-a30d-891f7d448e66`. Ses deux salles et
ses trois interfaces horizontales restent inchangées ; aucun objet ni connecteur de test n'est créé.

**Retour arrière** : revert du commit de Session 147, redémarrage des services 8293/8294, puis
contrôle du passage 0 → 1 sur la même session.

---

## Session 148 (Codex) — 2026-07-16 — Altitude canonique des planchers ✅ CLOS

Le diagnostic visuel a coloré séparément les sols bas et haut sans modifier la carte. Le plan de
rendu choisissait correctement `room:-3:0:5:6:1:1` au niveau 1, mais l'instrumentation du maillage
montrait `{ roomId: room:-3:0:5:6:1:1, y: 0 }`. La cause se trouvait dans `RoomSlab` : son paramètre
optionnel `yOverride` valait `null`, puis `Number(null)` produisait `0` et satisfaisait le test
`Number.isFinite`. Tous les sols de salle appelés sans surcharge étaient donc placés à l'altitude
zéro, quelle que soit leur salle propriétaire.

La résolution de hauteur est désormais une fonction pure et testée. `null` et `undefined`
retombent sur la base de la salle pour un sol et sur son sommet pour un plafond ; `0` n'est accepté
que lorsqu'il est fourni explicitement. Le renderer conserve l'interface horizontale comme autorité
du propriétaire et applique ensuite cette altitude canonique au maillage rectangulaire comme au
maillage courbe.

**Testé** : tests unitaires des interfaces, de la coupe caméra et des trois cas de hauteur ; suites
monde/serveur et configuration ; ESLint ciblé ; build Vite. Dans le navigateur authentifié, sur la
session `b27cbed4-fd59-4530-b43b-dae57c33f092`, le niveau 0 affiche son propre sol et le niveau 1
affiche une dalle opaque complète à `y = 2,5 m`, qui masque l'intérieur inférieur. Le contrôle est
refait après redémarrage des services et rechargement de la page, sans matériau de diagnostic.

**Données** : lecture seule de la carte `ddfa2f40-d30f-4cff-a30d-891f7d448e66`. Aucune salle,
dalle, entité ou connecteur de test n'est créé.

**Retour arrière** : revert du commit de Session 148, redémarrage des services 8293/8294, puis
contrôle visuel 0 → 1 sur la même session.

---

## Session 149 (Codex) — 2026-07-16 — Toitures exposées au niveau affiché ✅ CLOS

La règle « masquer l'intérieur des niveaux inférieurs » omettait aussi les plafonds sans salle
au-dessus. Or ces faces sont l'enveloppe extérieure de la carte : au niveau 1, le toit d'une salle
simple du niveau 0 doit rester visible sur le même plan que le sol d'une salle réellement présente
au niveau 1.

`horizontalInterfaceRenderKind` reçoit maintenant le niveau géométrique de l'interface. Une
interface avec plafond mais sans sol supérieur devient visible lorsque ce plan correspond au niveau
affiché. `horizontalInterfaceOpacity` la laisse alors opaque. Si un sol supérieur existe sur cette
empreinte, il conserve la priorité. Les régions de plafond des salles multi-étages étant uniquement
produites à leur vrai sommet, aucun plancher ou toit intermédiaire n'est créé par cette règle.

**Testé** : cas purs du toit exposé, du plan hors niveau, de la priorité du sol partagé et de
l'opacité ; tests de géométrie et coupe ; suites monde/serveur et configuration ; lint et build.
Après redémarrage complet, une copie isolée de la carte a reçu une salle simple témoin. Au niveau 1,
son toit opaque et le sol de la salle haute sont visibles simultanément et à la même altitude, en
mode édition comme en mode jeu. La copie est ensuite supprimée. Le contrôle final est refait sur la
carte originale, dont la salle simple voisine montre également son toit à côté du sol supérieur.

**Données** : la carte `ddfa2f40-d30f-4cff-a30d-891f7d448e66` reste inchangée. La battlemap de
validation et sa salle témoin ont été supprimées ; aucune carte nommée `TEST TEMPORAIRE TOIT CODEX`
ne reste en base.

**Retour arrière** : revert du commit de Session 149, redémarrage des services 8293/8294, puis
contrôle du niveau 1 avec une salle basse exposée et une salle haute côte à côte.
