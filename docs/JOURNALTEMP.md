# JOURNALTEMP — Contenu périssable
---

## Redesign Step 4 — Sous-step PROFESSIONS (CareersAllocator)
> Analyse préparatoire — source design : `docs/ClaudeDesign/project/Professions.dc.html`

### 1. Périmètre
Le design redessine **uniquement** le sous-step `careers` de la Step 4, rendu par
`client/src/components/creation/CareersAllocator.jsx` (798 l., appelé par `Step4Experience.jsx`).
Les autres sous-steps (âge, origines, formation, études, récap) ne sont pas touchés.

### 2. VÉRIFIÉ : aucune migration nécessaire — tout est déjà en base
Schéma lu dans `93_ref_careers.js` + `96_char_creation_tables.js`.

**`ref_careers` (colonnes déjà présentes, déjà renvoyées par `getStep4RefData` via `select('*')`) :**
- `points_per_year` → pool points de **compétence** = `points_per_year × années`
- `contact_frequency`, `ally_frequency`, `ally_type`, `opponent_frequency`, `enemy_rule`
  → les « Relations » du design (le proto inventait une formule ; les vraies fréquences sont ici)
- `restricted_geographic_origin`, `geographic_origin_details`, `description`, `illustration`
- `required_genotype`, `min_for..min_pre`, `min_attributes_logic` (prérequis, déjà validés backend)

**Tables liées :**
- `ref_career_titles` (min_years, max_years, title, salary_per_year, salary_formula)
  → progression salariale + **rang** (titre courant) + **économies cumulées**. Déjà chargée.
- `ref_career_point_categories` (category, sort_order) → catégories d'**avantages pro (5 pts/an)**.
  Déjà chargée dans `getStep4RefData` (`pointCategories`), **jamais consommée par l'UI** (dette connue).
- `ref_career_random_benefits` (roll 1..10, description) → **tirage 1D10** optionnel.
  ⚠️ **PAS chargée** par `getStep4RefData` actuellement → à ajouter.
- `ref_career_equipment` (equipment, sort_order) → matériel accessible. PAS chargée → à ajouter
  (affichage optionnel selon décision Saar).
- `ref_career_skills` (skill_id, family via JOIN, conditional) → déjà chargée.

**`char_careers` (destination, colonnes déjà présentes) :**
- `years`, `savings`, `pro_advantages` (jsonb), `random_picks` (jsonb), `setbacks` (jsonb)
- `reconcileCreation` STEP 3/careers (`creationService.js:378-394`) **persiste déjà** :
  `savings` (calculé backend via titres + `evaluateSalaryFormula`), `pro_advantages`,
  `random_picks`, `setbacks`, et applique `skillAllocations` (+ `openedSkills` → `is_learned`).
  → **L'UI actuelle n'envoie PAS** `proAdvantages`/`randomPicks`/`setbacks`/`openedSkills`.

### 3. Règles rulebook confirmées (`REGLE_PROFESSION.md`)
Par carrière, DEUX pools de points distincts par année :
1. **Compétences** : `points_per_year × années` (cap +3 par compétence — CAP=3 dans le proto, à
   confirmer vs REGLE_CREATION.txt).
2. **Avantages pro** : **5 pts/an**, répartis librement sur les catégories de la carrière
   (`ref_career_point_categories`).
- **Relations** dérivées : Contacts = `contact_frequency`/an, Alliés = 1 / `ally_frequency` ans,
  Opposants = 1 / `opponent_frequency` ans, Ennemis = règle d'échange (`enemy_rule` : 3 opposants → 1).
- **Bénéfices aléatoires (optionnel)** : tous les 5 ans, le joueur peut lancer 1D10
  (`ref_career_random_benefits`) **au lieu** de répartir les 5 pts d'avantages de la période.
- **Économies** : salaire du titre courant × années ; titres 7+ souvent en `salary_formula`
  (aléatoire, ex. `1D100*20`). `evaluateSalaryFormula` (`shared/polarisUtils.js:175`) ne gère que
  le format `\d+D\d+\*\d+`. Côté client : afficher `salary_per_year` si présent, sinon la formule
  marquée « aléatoire » (le montant réel est calculé au finalize backend).

### 4. Écart proto ↔ vrai modèle (ne PAS copier le proto tel quel)
- Proto : `PTS=5` points de compétence **par carrière** (flat) → FAUX. Vrai = `points_per_year × années`.
- Proto : relations via formule inventée (2/an…) → utiliser les vraies fréquences DB.
- Proto : `this.BASE` hardcodé → la « base » = maîtrise cumulée des backgrounds (déjà agrégée par
  `allSkills` dans le composant actuel via `selectedGeoItem/Soc/Training/HigherEd`).
- Proto : données CAREERS en dur → utiliser `refData.careers`.
- README bundle : reproduire le **visuel**, pas la structure interne du proto.

### 5. Layout cible (design)
Deux colonnes : rail gauche (296px, liste carrières + segment Tous/Accessibles) + colonne
principale (barre d'âge → détail à 3 onglets [Métier / Carrière & économies / Avantages pro] →
board de compétences global agrégé avec tags de provenance → pied nav). Tokens CSS = identiques à
`index.css` (`colors_and_type.css` du bundle == design system Enclume).

### 6. Conventions à respecter (dette actuelle du composant)
- **CSS** : l'actuel `CareersAllocator` viole la convention (gros objet `s={}` visuel). Le redesign
  doit passer par des classes `.wz-*` dans `index.css` (Section 10/11). → décision Saar (ampleur).
- **i18n** : clés `step4.*` dans `creation.json` — beaucoup de strings du design absentes
  (onglets, relations, avantages, tirage, économies…). Strings FR en dur interdites.

### 7. Points à trancher avec Saar
- [Q1] CSS : classes `.wz-*` dans index.css (convention) OU tolérer style-objet le temps du MVP ?
- [Q2] i18n : créer toutes les clés maintenant (recommandé) ?
- [Q3] Matériel accessible (`ref_career_equipment`) : afficher ou hors scope première passe ?
- [Q4] Relations : les 4 textarea du proto — persistées où ? (aucune colonne texte relations dans
  `char_careers` ; candidats : `char_traits`, ou hors persistance MVP = infos MJ). À clarifier.
- [Q5] CAP compétence (+3) et règle « au choix » (`conditional`, dette [CAR1]) : dans cette passe ?

### 8. DÉCISIONS SAAR (verrouillées)
- **Dés** : tout jet = **DicePanel réel** (clic joueur), jamais `Math.random`. Composants confirmés :
  `client/src/components/DicePanel.jsx`, fiche perso `client/src/character/CharacterWindow.jsx`,
  inventaire `client/src/character/InventoryPanel.jsx`.
- **Q1 Relations** : ajouter des **champs dédiés sur la fiche perso**. Mécanique = jauge numérique
  (entier) permettant de convertir des points en PNJ (à discrétion GM) + **champ TEXT libre**, avec
  **lien optionnel vers une fiche PNJ**. → persistance char-side requise (à investiguer : migration
  vs `char_traits`) + affichage CharacterWindow.
- **Q2 i18n** : oui, toutes les clés proprement.
- **Q3 conditional** : à faire dans le chantier (bouton radio) — NON différé.
- **Q4 matériel** : brancher l'**inventaire du character** + menu GM de création d'objets (via
  InventoryPanel / système équipement existant).
- **Mode de travail** : SÉQUENTIEL (un lot à la fois, plan complet + validation avant lot suivant).

### 9. SÉQUENCE PROPOSÉE (à confirmer par Saar)
- **Lot 1 — Backbone CareersAllocator** : layout 2 colonnes (rail Tous/Accessibles + barre d'âge +
  détail onglets), onglet Métier (compétences groupées), onglet Carrière & économies (table titres/
  salaires + cumul, read-only, données prêtes), board compétences global + tags provenance + stepper
  (cap +3, alloc = points_per_year × années), ajout/retrait métier, gating. CSS `.wz-*` index.css +
  clés i18n. Onglet Avantages = coquille (Lot 2). Backend RAS.
- **Lot 2 — Avantages pro (5 pts/an)** : alloc sur `point_categories` → payload `proAdvantages` →
  `char_careers.pro_advantages` (backend prêt).
- **Lot 3 — Compétences « au choix » (`conditional`)** : radio par groupe → `openedSkills` payload.
- **Lot 4 — Tirage 1D10** : charger `ref_career_random_benefits` dans `getStep4RefData` + bouton →
  DicePanel réel → `random_picks` (backend persiste déjà).
- **Lot 5 — Relations** : champs fiche perso (entier + texte + lien PNJ) + persistance + affichage
  CharacterWindow + section wizard. (investigation char sheet, probable migration)
- **Lot 6 — Matériel / inventaire** : inventaire de carrière + intégration InventoryPanel + menu GM.

### 10. RECHERCHE — bonnes pratiques & architecture (Session 139)
Sources : json-rules-engine (CacheControl), json-rules-engine-simplified (RXNT), PCGen (générateur
RPG open-source data-driven), React docs `useReducer`.

**Constat clé — éligibilité carrières.** Le backend valide DÉJÀ 4 contraintes
(`validateCareerPrerequisites/Genotype/Attributes/Education`, `creationService.js:61-123`). Ce sont
des **prédicats purs** sur un contexte : `{ careers:[{career_id,years}], genotypeId, higherEd,
attributes:{FOR..PRE} }`. Le client possède déjà tout ce contexte en mémoire (step1 attributs,
step2 génotype, step4 études + carrières retenues). Mais l'UI actuelle filtre « Accessibles » sur
le seul flag géo → **divergence** : une carrière peut passer le filtre puis échouer au finalize.

**Pattern pro retenu = moteur d'éligibilité déclaratif partagé client/serveur** (principe
json-rules-engine : mêmes règles des deux côtés). MAIS adopter la LIB json-rules-engine serait
**sur-dimensionné** ici (4 prédicats simples, code-defined, Pi self-host) : elle vise des règles
nombreuses/changeantes/éditées par des non-devs. → **Décision : évaluateur maison pur dans `shared/`**
(pattern déjà éprouvé du projet : `shared/polarisUtils.js`), pas de dépendance.
- `shared/careerEligibility.js` : `evaluateCareerEligibility(career, context) → { eligible, reasons[] }`.
- Serveur : les 4 validateurs deviennent « fetch DB → build context → appel évaluateur partagé ».
- Client : build context depuis l'état wizard → MÊME évaluateur → filtre « Accessibles » + bouton
  « Ajouter » désactivé + affichage des raisons, strictement alignés sur le backend. Zéro divergence.

**État d'allocation (React).** L'allocation (carrières, points compétence, avantages, années,
provenance) = état interdépendant complexe → pattern pro = `useReducer` (transitions pures +
sélecteurs dérivés `useMemo`) plutôt que useState éparpillés (actuel). PCGen confirme l'approche
**100 % data-driven** (rendu généré depuis les données, jamais de carrière codée en dur) — déjà notre
cas via `ref_*`, à préserver. NB convention CLAUDE.md : state inter-étapes → Zustand (`creationStore`) ;
migration complète des carrières vers le store = option robuste mais hors périmètre immédiat (à
flaguer, pas à imposer maintenant).

**Rejeté (anti-sur-ingénierie)** : lib json-rules-engine (overkill), migration Zustand complète
maintenant (report). **Retenu** : évaluateur `shared/` + `useReducer` local + data-driven préservé.

### 11. CORRECTION (Saar) — deux pools distincts + la courbe existe déjà
> Mon erreur initiale : (a) confusion 10 skills / 5 avantages, (b) « courbe à créer » alors qu'elle
> existe. Cause racine : `polarisUtils.js` pas lu en entier. Corrigé ci-dessous.

**DEUX pools distincts, constantes LdB (extrait Saar, « Expérience préliminaire »), par ANNÉE :**
- **10 points de COMPÉTENCE** (skills) → répartis via la courbe de coût, plafond par années.
- **5 points d'AVANTAGES professionnels** (Contacts/Alliés/Opposants/Ennemis/Célébrité + catégories
  `ref_career_point_categories`) → Lot 2.
- (+ option : 5 pts supplémentaires via tirage table des Revers — random, Lot 4.)
Ce sont des **constantes** (10 et 5), PAS `ref_careers.points_per_year`.

**⚠️ `ref_careers.points_per_year = 5` (seed) est trompeur** : le code actuel l'utilise comme budget
SKILLS (`totalBudget = points_per_year × years`) → **budget skills faux (5 au lieu de 10)**. À
trancher : skills = **10 × années** (constante LdB) ; que devient la colonne `points_per_year` ?
(vestige / à repurposer avantages=5 / ignorer). → question ouverte pour le Lot 1.

**La courbe de coût EXISTE DÉJÀ dans `shared/polarisUtils.js`** (à RÉUTILISER, ne rien recréer) :
- `calcSkillCost(skillId, currentMastery, targetMastery, isPro, isLearned, refSkills)` → { cost }
  (L81-122) : 1 jusqu'à +5, 2 pour +6-10, 3/5/7 pour +11/12/13, +2/niveau après ; **×2 hors-pro** ;
  `(X)` réservée (1 pt → -3) ; `PN` gratuit ≤ +5.
- `getMaxMasteryByYears(years)` (L127-134) : plafond maîtrise 3/5/7/10/13/15 selon années.

**Board Lot 1** = wiring de ces fonctions (pas de 1:1) : coût d'un +1 via `calcSkillCost`, plafond via
`getMaxMasteryByYears`, `isPro` = compétence listée par une profession retenue, markers `(X)`/`PN`
via `refSkills`. Ces fonctions existent mais **ne sont pas câblées** dans `CareersAllocator` actuel
(modèle naïf 1:1).

**Trou de robustesse (à trancher)** : `reconcileCreation` STEP4 n'appelle pas `calcSkillCost` — il
insère `char_skills.mastery = targetMastery` tel quel (le client fait foi). Fermer côté serveur au
Lot 1 (validation via `calcSkillCost`) ou lot dédié ? → question ouverte.

**DÉCISIONS SAAR (verrouillées) :**
- **Q1** : `ref_careers.points_per_year` → **IGNORER** (skills = constante 10×années). Colonne laissée
  telle quelle (dette cosmétique).
- **Q2** : trou serveur → **CORRIGER dans le Lot 1** (`reconcileCreation` valide Σ`calcSkillCost` ≤
  10×années par métier).
- **Q3** : budget **PAR MÉTIER, segrégué** — chaque métier dépense **ses** 10×années (compétences)
  sur **ses** compétences + **ses** 5×années (avantages, Lot 2) sur **ses** catégories. Pas de pool
  global. (= déjà la sémantique per-career du composant actuel ; le board du mock reste visuel/agrégé
  mais steppers actifs uniquement sur le métier sélectionné.)

### 13. MODÈLE COMPÉTENCES CORRIGÉ (Saar + LdB confirmé) — REMPLACE mon erreur « par métier »
`REGLE_CREATION.txt:1250-1263` (Niveau max) + 1103-1118 (coût/hors-pro). Confirme la logique Saar.
- **UNE compétence = un niveau de maîtrise** sur la fiche. **Jamais de doublon par métier.**
- **Coût = courbe de niveau** (`calcSkillCost`), indépendant du métier payeur (points fongibles).
- **De profession (coût normal)** si dans la liste d'**≥1 métier retenu** ; sinon **hors-profession ×2**.
- **Plafond** = `getMaxMasteryByYears(années CUMULÉES des métiers listant la compétence)` (+2 si études
  sup. listent la compétence). LdB L1262-1263 : « les années se cumulent ».
- **Pool skills = GLOBAL** = Σ(10 × années) tous métiers confondus. (≠ mon « per-métier » erroné.)
- **PN** : gratuit ≤ +5 (déjà dans `calcSkillCost`). **`current`** = base d'origines (`bgSkills.bonus`).
- **Avantages pro (5/an) = PAR MÉTIER** (sur les catégories du métier) — seul l'aspect per-métier subsiste.
- **Board** = GLOBAL (comme le mock) : 1 ligne/compétence, 1 stepper, 1 compteur de points restants.
- **Impact payload/reconcile** : `skillAllocations` devient **global** (skill_id→targetMastery) au
  niveau step4, plus per-career. `reconcileCreation` applique + valide le coût total ≤ pool global.

### 12. VÉRIFICATION Lot 1 (Étape 1 — code lu, zéro mémoire)
- **`calcSkillCost` + `getMaxMasteryByYears` = CODE MORT** (grep repo) : jamais consommés en prod
  (seul `COST_LOOKUP` sert dans Step1 pour les attributs). Lot 1 = **1er consommateur** → aucun
  précédent à copier, à tester à fond isolément.
- **`refSkills` (catalogue + markers)** : PAS dans `getStep4RefData`. Dispo via route existante
  **`GET /api/char-ref/skills`** (`routes/character/ref.js`) — utilisée par `CharacterSheet` →
  `SkillsPanel`. Côté wizard : n'existe qu'en **mock** (`mockStep4Data.js`). → réutiliser la route
  (DRY) plutôt qu'un 2e catalogue.
- **`ref_career_education`** : PAS dans `getStep4RefData` (chargé seulement dans `checkCareerEligibility`
  serveur). → à ajouter côté careers refData pour le filtre client.
- **`career.skills`** (getStep4RefData) = `{ skill_id(=ref_skills.id), family, conditional }` — **pas**
  de `label` ni `marker` → besoin du catalogue `refSkills` pour afficher + `calcSkillCost`.
- **base/current maîtrise** = `bgSkills.bonus` (origines) + carrières retenues, agrégé par `allSkills`
  (`CareersAllocator.jsx:62-107`).
- **`ref_skills.marker`** ∈ { `(X)`, `(-3)`, `PN`, `•`, `PREREQ`, null }.
- **`reconcileCreation` STEP4** insère `char_skills.mastery=targetMastery` sans validation coût (trou
  Q2 confirmé).
