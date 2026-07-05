# JOURNAL6.md — Historique sessions Enclume
> Créé Session 133 — 2026-07-05
> Suite de JOURNAL5.md (archivé dans docs/Old/)

---
## Session 133 — 2026-07-05 — Migration 105 (« 37-bis ») : consolidation ref_skills (3ᵉ révision) ✅

> Aboutissement de l'audit ligne par ligne (251 lignes `ref_skills` + 94 `ref_skill_requirements`) documenté intégralement dans `docs/MIGRATION_37BIS.md`, mené sur plusieurs sessions (démarré Session 131 suite) suite à la corruption cumulée des migrations 37/74/103/103b. Objectif explicite de Saar : que ce soit la dernière révision de cette table.

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

> Suite de `docs/PLAN_LOT1_CAREERS.md` (plan validé point par point 9/9, session précédente). Corrige les `skill_id` erronés/manquants de `100_seed_ref_careers.js` (5 carrières : artisan_artiste, assassin, barman, chasseur_primes, contrebandier) par rapport à `docs/Character/Creation/REGLE_PROFESSION.md`.

### Bloc serveur
- `server/src/db/migrations/106_fix_ref_career_skills_lot1.js` **NOUVEAU** — 9 corrections (A1/A2 artisan_artiste, B1/B2/B3 assassin, C1 barman, D1/D2 chasseur_primes, E1 contrebandier) : voir table détaillée dans `PLAN_LOT1_CAREERS.md`. Aucune suppression sur `ref_careers` (id stable, évite le CASCADE `char_careers`). Garde-fou `getCareerIds` — lève une erreur explicite si une carrière ne résout pas d'id.
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
> implantés. Détail complet des plans : `docs/PLAN_LOT1_CAREERS.md` (déjà clos), `docs/PLAN_CAREER_SKILLS_FK.md`,
> `docs/PLAN_LOTS_3_6_CAREERS.md`.

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
  `docs/PLAN_CAREER_SKILLS_FK.md`.
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
  `docs/PLAN_LOTS_3_6_CAREERS.md`.
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
