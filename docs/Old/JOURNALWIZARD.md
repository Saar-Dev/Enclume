# JOURNALWIZARD.md — Audit Wizard Création Personnage
> Rédigé session 127 — 2026-06-30
> Fichiers lus : REGLE_CREATION.txt (partial), REGLE_MUTATION.md, REGLE_PROFESSION.md (partial, ~15/27 professions), REGLE_AVANTAGES.md, PLAN_CREATION_E1+2.md, PLAN_CREATION_E3.md, PLAN_CREATION_E4.md, PLAN_CREATION_E5.md, WizardCreation.jsx, WizardCreationPage.jsx, WizardHeader.jsx, Step0Method.jsx, Step1Attributes.jsx, Step2Genotype.jsx, Step3Mutations.jsx, Step4Experience.jsx, AgeSelector.jsx, BackgroundSelector.jsx, CareersAllocator.jsx, mockStep4Data.js, migrations/92_ref_advantages.cjs, migrations/95_..., migrations/96_ref_mutations.cjs

---

## ÉTAT GÉNÉRAL

**Existant :** UI mockup complète étapes 0–4. Plans détaillés étapes 1–5. Migrations 92–96 (données de référence). i18n utilisé partout dans les composants lus.

**Manquant :** Étape 5 (AdvantagesPanelV2 prévu mais absent). Aucun appel API (tout mock). Pas de Zustand store centralisé. Step4Summary.jsx non lisible (fichier retourné corrompu lors de la lecture).

---

## B — BUGS TECHNIQUES

**B1 — CRASH : variable `st` écrasée dans Step3Mutations.jsx**
Ligne 282, la modal sous-types itère `.map(st => ...)`. `st` est aussi le nom de l'objet de styles global. Dans ce scope, `st.subtypeBtn`, `st.subtypeDesc`, `st.cancelBtn` retournent `undefined` → crash silencieux ou rendu vide. À renommer le paramètre du map (ex: `sub`).

**B2 — Rollback `pcDispo = 20` hardcodé au retour étape 2**
`WizardCreation.jsx` ligne ~51 : `onPrev={() => { setPcDispo(20); setStep(1) }}`. Si le joueur a dépensé N PC en attributs (étape 1), le retour depuis l'étape 2 restaure à 20 au lieu de `20 - pcSpentStep1`. Budget PC corrompu.

**B3 — Rollback étape 3 → étape 2 ajoute toujours 5 PC**
Ligne ~68 : `onPrev={() => { setPcDispo(prev => prev + 5); setStep(2) }}`. Génotype Humain = 0 PC, TEC_HYB Déserteur = 4 PC. Le +5 systématique est faux pour ces cas.

**B4 — Coût TEC_HYB ignoré dans WizardCreation.jsx**
Ligne ~46 : `data?.genotypeId === 'TEC_HYB' ? 4 : 5`. TEC_HYB normal = 5 PC, TEC_HYB Déserteur = 4 PC. La logique inverse les valeurs : normal déduit 4 (faux), et ne tient pas compte de `isDeserter` qui est dans `data`.

**B5 — addSkills accumule des maîtrises à 0 dans CareersAllocator.jsx**
`addSkills` reçoit `bonus = 0` comme paramètre par défaut et l'utilise au lieu de `sk.bonus`. Toutes les compétences de background s'affichent avec mastery = 0, le tableau est visuellement correct mais les valeurs sont toutes nulles.

**B6 — Unicité non vérifiée dans Step3Mutations méthode ACHAT**
`handleAdd()` ne vérifie pas `meta.is_unique`. Le joueur peut ajouter la même mutation unique plusieurs fois.

**B7 — Step 5 non rendu mais accessible**
`WizardCreation.jsx` : `setStep(5)` n'a pas de bloc `{step === 5 && ...}`. L'appui sur "Suivant" en étape 4 rend un écran vide sans erreur.

**B8 — Doublon `classes_moyennes` dans mockStep4Data.js**
`socialOrigins` contient deux objets avec `code: 'classes_moyennes'` (parent_code: 'station_moyenne' et 'grande_cite'). `selectedSocItem = filteredSocialOrigins.find(s => s.code === originSoc)` ne trouve que le premier match. Le deuxième est invisible pour la récupération des compétences.

**B9 — Slider CareersAllocator : max = 1 quand remainingPC = 0**
`max={Math.min(20, remainingPC > 0 ? remainingPC : 1)}` → si PC épuisés, le slider s'arrête à 1 année mais reste actif. UX confuse — le joueur peut toujours glisser même si "Ajouter" est désactivé.

---

## A — ARCHITECTURE / PLANS

**A1 — Conflit numérotation migrations : PLAN_E4 et PLAN_E5 revendiquent tous les deux la migration 097**
PLAN_CREATION_E4.md référence "migration 097" pour `ref_backgrounds`. PLAN_CREATION_E5.md référence aussi "migration 097" pour les tables avantages étape 5. Les migrations réelles s'arrêtent à 096. À réconcilier avant implémentation.

**A2 — `char_personal_advantages` (migration 095) vs `char_advantages` (PLAN_E5) : deux schémas incompatibles**
Migration 095 crée `char_personal_advantages(char_sheet_id, advantage_id, type)` — table simple sans historique. PLAN_E5 prévoit `char_advantages` avec `removed_at TIMESTAMPTZ`, `snapshot_data JSONB`, `subtype_code`, `custom_value` — soft-delete complet. La migration existante devra être remplacée ou étendue lors de l'implémentation de l'étape 5.

**A3 — Pas de Zustand store pour la création**
Tout l'état est dans `WizardCreation.jsx` (`step`, `pcDispo`). Les données de chaque étape (attributs, génotype, mutations, backgrounds, carrières) ne sont pas persistées entre étapes. Naviguer en arrière puis en avant efface tout. Pour l'intégration backend, décision à prendre : store Zustand centralisé OU état piloté par API (POST progressif + char_sheet.creation_state).

**A4 — Deux versions de mockStep4Data.js en circulation**
La session de lecture a retourné deux versions différentes avec des valeurs incompatibles (`points_per_year` 10 vs 5, présence/absence de `contact_frequency`, `ally_frequency`, `equipment`). Un seul fichier existe sur disque (confirmé par Glob). La version lue directement a `points_per_year: 5`. Vérifier si une ancienne version persistait dans un état React en mémoire.

**A5 — `showHigherEd = training === 'education_scolaire'`**
L'enseignement supérieur n'est accessible que si la formation est 'education_scolaire'. Vérifier contre REGLE_CREATION.txt si d'autres formations peuvent y donner accès (non confirmé dans la portion lue).

**A6 — `career_id` dans `selectedCareers` = `career.code` (string) alors que migration 095 attend un UUID**
`handleAdd` → `onAdd(career.code, years)` → `setCareers([..., { career_id: careerId }])`. Dans la migration, `char_careers.career_id UUID REFERENCES ref_careers(id)`. Rupture à l'intégration backend : il faudra passer l'UUID, pas le code.

**A7 — Filtrage "Accessibles" dans CareersAllocator incorrectement simplifié**
`filter === 'eligible'` → filtre par `!c.restricted_geo`. Mais les restrictions dépendent de l'origine géographique du joueur, pas d'une simple présence/absence du champ. Une carrière `restricted_geo: 'Très peu dans l'Alliance polaire'` n'est pas interdite si le joueur vient d'une grande cité hégémonique.

**A8 — `filteredTrainings` : deux entrées `education_scolaire` avec codes identiques**
Dans `trainings`, `education_scolaire` apparaît deux fois (parent_code: 'classes_moyennes' et 'classes_superieures'). Même `code` string → la DB ne pourra pas avoir deux lignes avec le même code si `code` est UNIQUE. Probablement à fusionner ou à gérer via `allowed_parents`.

---

## R — FIDÉLITÉ AUX RÈGLES

**R1 — Points de profession : 10 pts/an (LdB + PLAN_E4) vs 5 pts/an (mockStep4Data.js)**
La règle Polaris est univoque : 10 points de compétence par an de profession. PLAN_CREATION_E4.md confirme. `mockStep4Data.js` a `points_per_year: 5` pour toutes les 5 carrières. Le composant affiche `career.points_per_year * years` — le calcul serait faux à l'intégration si la DB seed suit les règles.

**R2 — Méthode aléatoire mutations : pool de 6 mutations seulement**
`MOCK_MUTATION_IDS = [1, 7, 11, 14, 17, 20]`. La vraie règle : D100 dans 50 mutations numérotées 01–100 avec plages. Mock trop restrictif pour représenter la mécanique réelle.

**R3 — Mutations à coût négatif non gérées dans la méthode ACHAT**
`Purulence` a `cost_pc = -2` dans migration 096 (mutation qui rapporte des PC). Le filtre `cost_pc >= 0` de la méthode achat l'exclut. Décision à prendre : les mutations "rapportant des PC" sont-elles accessibles par achat ou seulement par tirage aléatoire ?

**R4 — AgeSelector : pas de synchronisation avec les années de carrière**
Un joueur qui choisit 16 ans (minimum) et 8 ans de carrière aurait en réalité 24 ans. L'âge est réglé librement avant les carrières. Il manque soit un recalcul de l'âge minimum, soit un affichage de l'âge résultant dans Step4Summary.

**R5 — Années d'études supérieures (`years_added: 2`) non comptabilisées dans l'âge**
`higherEds[x].years_added = 2`. Ni dans `AgeSelector` ni dans `CareersAllocator` ce +2 n'est pris en compte. L'âge final du personnage sera sous-évalué de 2 ans si enseignement supérieur.

**R6 — Génotype : `mod_ADA` et `mod_PER` absents de Step2Genotype.jsx**
Les modificateurs génotype dans PLAN_E1+2 incluent ADA et PER. La structure `attributes` dans GENOTYPES ne les liste pas. `HYB_NAT` a `Adaptation +1` (présent), `GEN_HYB` a `Adaptation... absent` dans la liste. À vérifier ligne par ligne contre les règles.

**R7 — Lecture REGLE_PROFESSION.md incomplète**
Seulement ~15/27 professions ont été lues (jusqu'à Mineur partiel). Les professions Officier Naval, Officier Militaire, Ouvrier, Pilote de chasse, Pirate, Policier, Prêtre du Trident, Prostituée, Scientifique, Soldat, Soldat d'élite, Sous-marinier, Technicien, Techno-hybride, Veilleur, Voleur n'ont pas été vérifiées contre les données mock. Le careersList du mock ne contient que 5 carrières.

**R8 — REGLE_CREATION.txt : lignes 1107–1352 non lues**
La portion finale des règles (probablement archétypes détaillés, règles avancées) n'a pas été vérifiée. Les archétypes (Jeune premier, Héritier, etc.) sont mentionnés dans les premières lignes mais leurs stats complètes n'ont pas été croisées.

---

## C — CONVENTIONS CSS / I18N

**C1 — Tous les composants de création utilisent des styles inline (violation convention projet)**
Convention projet : `className="btn"` ou variantes, `style={}` uniquement pour layout/position calculé, valeurs visuelles dans `index.css`. Tous les composants mockup (`Step1Attributes.jsx`, `Step2Genotype.jsx`, etc.) utilisent des objets `const s = {...}` ou `const st = {...}` entièrement inline. La refonte vers classes CSS index.css Section 10 sera nécessaire avant livraison.

**C2 — Boutons sans className="btn"**
Aucun bouton dans les composants de création n'utilise les classes partagées `.btn`, `.btn-ghost`, `.btn-danger`, etc.

**C3 — BackgroundSelector.jsx : strings hardcodées en français**
Lignes 93, 110–112, 116–118 : `"Bonus de compétences"`, `"7 points libres à répartir..."`, `"Choisissez une spécialité : Aquaculture..."` — non passées par `t()`.

**C4 — CareersAllocator.jsx : nombreuses strings non i18n**
`"Tous"`, `"Accessibles"`, `"PC : X / Y"`, `"Compétence"`, `"Base"`, `"Maîtrise"`, `"Total"`, `"Récapitulatif des compétences"`, `"Professions sélectionnées"`, `"Avantages pro"`, `"Salaire"`, `"Âge"`, `"Coût total"`, `"Compétences"`.

**C5 — WizardCreation.jsx : strings hardcodées dans getInfos()**
Les badges d'info par étape (`"Ambiance : X — Y Points d'Attributs"`, etc.) non passés par `t()`.

**C6 — Step0Method.jsx : URL MinIO hardcodée localhost**
`const BG_URL = 'http://localhost:9000/enclume-assets/assets/PolarisCharacter01.jpg'` — ne fonctionnera pas sur Kiwi ni en prod. À externaliser via variable d'environnement ou config.

---

## POINTS POSITIFS

**P1 — Migrations 92 / 95 / 96 : très solides**
`ref_advantages` (76 entrées, tous les avantages et désavantages du LdB), `ref_mutations` normalisé avec tables de jointure (discounts, incompatibilities, skills, subtypes), view SQL `char_mutation_effects_view` — conception de DB propre et complète.

**P2 — REGLE_MUTATION.md ↔ Migration 096 : cohérence élevée**
Les 50 mutations avec plages D100 correctes, cost_pc cohérents, Parasite/Symbiote/Régénération avec `max_cumul_group`, remises félin→griffes/vision nocturne — fidèle au LdB.

**P3 — Step1Attributes.jsx : logique propre et complète**
Pool d'attributs, coût non-linéaire via `COST_LOOKUP`, bonus féminin (COO/PRE +2, FOR min 5), `canNext = pointsRestants === 0`, tooltips — fonctionnel et fidèle aux règles.

**P4 — Step2Genotype.jsx : UX claire**
Carousel → détail → confirmation. Prévisualisation attributs avant/après. Case Déserteur TEC_HYB bien gérée. Bon choix de design.

**P5 — Plans E1–E5 : documentation d'architecture complète**
Décisions documentées : rollback strategies, state machine progression, API routes, migration naming, dettes connues — travail de planification de qualité.

**P6 — mockStep4Data.js : backgrounds bien construits**
4 origines géo, 5 sociales avec cascades parent_code, 5 formations, 8 études supérieures avec compétences détaillées — suffisant pour un mockup représentatif.

---

## FICHIERS NON LUS (à compléter avant implémentation)

- `Step4Summary.jsx` — contenu non accessible (erreur de lecture)
- `migrations/93_ref_careers.cjs` — structure de ref_careers inconnue
- `migrations/93_seed_ref_careers_lot1-6.cjs` — seed careers inconnue
- `migrations/94_drop_char_advantages_ref_avantages.cjs` — impact drop inconnu
- `REGLE_CREATION.txt` lignes 1107–1352
- `REGLE_PROFESSION.md` lignes 1107–2383 (~12 professions)
