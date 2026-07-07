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
