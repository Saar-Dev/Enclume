# PLAN_REWORKFINAL — Redesign Step 4 · Sous-step PROFESSIONS
> Session 139 — 2026-07-08 · Master plan multi-lots (séquentiel)

Source design : `docs/ClaudeDesign/project/Professions.dc.html` (bundle Claude Design).
Analyse préparatoire complète : `docs/JOURNALTEMP.md` §1-9.
Cible : `client/src/components/creation/CareersAllocator.jsx` (rendu par `Step4Experience.jsx`,
sous-step `careers`).

---

## 0. PRINCIPES

- **Un lot = un plan complet → « Je code ? » → validation fonctionnelle → lot suivant.** Jamais deux
  lots dans un même plan.
- **Aucune migration pour les Lots 1-4** : toutes les données `ref_*` et les colonnes `char_careers`
  (`savings`, `pro_advantages`, `random_picks`, `setbacks`) existent déjà ; `reconcileCreation`
  les persiste déjà (`creationService.js:378-394`). L'UI ne les envoie simplement pas encore.
- **Dés = DicePanel réel** (clic joueur), jamais `Math.random` (Lot 4).
- **CSS** : classes `.wz4-*` dans `index.css` (Section 10/11). Zéro `style={}` visuel (on solde la
  dette de l'actuel gros objet `s={}`). `style={}` toléré uniquement pour layout calculé + valeurs
  dynamiques passées en CSS custom properties (ex. couleur d'un hex de carrière, largeur de jauge).
- **i18n** : toute string via `t('step4.…')`, clés ajoutées à `client/src/locales/fr.json`
  (namespace `creation`) AVANT usage.
- **Ne pas copier la structure interne du proto** (README bundle) : reproduire le **visuel**, câbler
  sur les vraies données. Écarts proto↔réel listés `JOURNALTEMP.md §4`.

### Décisions d'architecture (verrouillées Session 139 — cf. JOURNALTEMP §10)
- **Éligibilité = évaluateur pur partagé client/serveur** : `shared/careerEligibility.js` →
  `evaluateCareerEligibility(career, context) → { eligible, reasons[] }`, `context =
  { careers:[{career_id,years}], genotypeId, higherEd, attributes:{FOR..PRE} }`. Les 4 validateurs
  serveur (`creationService.js:61-123`) le consomment (fetch DB → build context → appel), l'UI le
  consomme (état wizard → build context → appel) : filtre « Accessibles » réel + « Ajouter » grisé +
  raisons affichées, jamais de divergence filtre↔finalize. Pattern maison (comme `polarisUtils.js`),
  **aucune dépendance** (lib json-rules-engine jugée sur-dimensionnée).
- **État d'allocation = `useReducer`** (transitions pures + sélecteurs `useMemo`), pas de useState
  éparpillés.
- **Data-driven préservé** : rendu 100 % depuis `refData`, provenance dérivée des données.
- **Réutiliser l'existant, ne rien recréer** : la courbe de coût compétences + le plafond par années
  existent déjà dans `shared/polarisUtils.js` (`calcSkillCost`, `getMaxMasteryByYears`) — le board les
  câble. Deux pools **constants** LdB par année : **10** points de compétence, **5** points
  d'avantages professionnels (distincts ; `ref_careers.points_per_year=5` ne doit PAS servir de
  budget skills). Contexte d'éligibilité client bâti depuis `useCreationStore` (step1 attributs,
  step2 génotype) — pas de prop-drilling.
- **Reporté (non imposé)** : migration des carrières vers Zustand `creationStore` (robuste à terme,
  gros refactor `Step4Experience`/`Summary` → lot dédié ultérieur si besoin).

---

## 1. MAPPING DONNÉES (source de vérité pour tous les lots)

| Besoin UI (design) | Source réelle | Chargé par `getStep4RefData` ? |
|---|---|---|
| Liste carrières, nom, illustration, desc | `ref_careers` | ✅ |
| Filtre Accessibles | `ref_careers.restricted_geographic_origin` | ✅ |
| Origine géo (détail) | `ref_careers.geographic_origin_details` | ✅ |
| Compétences groupées | `ref_career_skills` + `ref_skills.family` (JOIN) | ✅ (`skills[]`) |
| `conditional` (au choix) | `ref_career_skills.conditional` | ✅ |
| Rang / titre courant | `ref_career_titles` (min/max_years, title) | ✅ (`titles[]`) |
| Salaire / économies | `ref_career_titles.salary_per_year` / `salary_formula` | ✅ |
| Pool compétences | `ref_careers.points_per_year` × années | ✅ |
| Avantages pro (catégories, 5 pts/an) | `ref_career_point_categories` | ✅ (`pointCategories[]`) mais **jamais consommé** |
| Relations (fréquences) | `ref_careers.contact_frequency`, `ally_frequency`, `ally_type`, `opponent_frequency`, `enemy_rule` | ✅ (colonnes de `select('*')`) |
| Tirage 1D10 | `ref_career_random_benefits` (roll, description) | ❌ **à ajouter** (Lot 4) |
| Matériel accessible | `ref_career_equipment` | ❌ **à ajouter** (Lot 6) |

Persistance (`char_careers`, déjà prête) : `years`, `savings` (calculé backend), `pro_advantages`
(jsonb), `random_picks` (jsonb), `setbacks` (jsonb, réserve), + `char_skills` via `skillAllocations`.

---

## 1bis. CONTRATS VERROUILLÉS (données + payload) — passe de design global

> Résultat de la passe de verrouillage (Session 139). Ces 2 contrats sont figés **avant tout code**
> des lots suivants ; chaque lot ne fait que **remplir sa tranche** sans restructurer.
> Investigation : fiche perso (`CharacterSheet` = SkillsPanel + AdvantagesPanel, **pas** de carrières
> ni relations), inventaire (`char_inventory` + items custom + `char_sheet.sols`), schéma `char_*`.

### Contrat A — Modèle de données de bout en bout
| Donnée | Table / colonne | État | Lot |
|---|---|---|---|
| Carrière retenue | `char_careers` (career_id, years) | existe | 2 |
| Compétences (maîtrise) | `char_skills` (skill_id, mastery, is_learned) | existe | 2 (+5 openedSkills) |
| Économies | `char_careers.savings` **+ agrégation → `char_sheet.sols`** | table existe ; agrégation à ajouter | 3 |
| Avantages pro (répartition) | `char_careers.pro_advantages` (jsonb cat→pts) | existe | 4 |
| Tirage 1D10 | `char_careers.random_picks` (jsonb) | existe | 6 |
| **Relations** | **`char_relations` (NOUVELLE TABLE)** : `char_sheet_id`, `type`(contact/ally/opponent/enemy), `count`(int), `note`(text), `linked_character_id`(FK characters, null), `career_id`(FK, null) | **à créer** | 7 |
| Matériel | `char_inventory` (equipment_id→`ref_equipment`, ou custom) | existe | 8 |

→ **UNE seule migration sur tout le rework = `char_relations`** (Lot 7). Tout le reste réutilise
l'existant. Migration conçue **une fois**, proprement (pièges P52-P54). Nouveau panneau fiche perso
(`CharacterSheet`) pour afficher carrières + relations (Lot 7).

### Contrat B — Payload `reconcile({ step4 })` (forme cible, remplie par tranches)
```
step4 = {
  age, originGeo, originSoc, training, higherEd,
  appliedSkills: [skill_id],              // choix "au choix"/background (Lot 5)
  skillAllocations: { skill_id: target }, // GLOBAL (Lot 2) — MIGRE hors de careers[]
  careers: [{
    career_id, years,
    proAdvantages: { category: pts },     // Lot 4
    randomPicks: [ ... ],                 // Lot 6
  }],
  relations: [{ type, count, note, linkedCharacterId, careerId }],  // Lot 7
  pcSpent,
}
```
- **Changement structurel clé (Lot 2)** : `skillAllocations` passe de **per-career** à **global**
  (cohérent avec le pool global + « une compétence montée une fois »). `reconcileCreation` STEP4
  applique + valide le coût global via `shared/careerSkills.js`.
- **Rétro-compat** : tant que Lot 2 n'est pas livré, le payload reste per-career (assistant actuel
  intact). La bascule per-career→global se fait **dans** le Lot 2 (UI + serveur ensemble).
- `career_name`/`titles` (envoyés aujourd'hui) : redondants avec `ref_careers` — supprimés du payload
  au Lot 2 (le serveur relit la base).

---

## 1ter. DÉCISIONS VERROUILLÉES & FAITS VÉRIFIÉS (auto-suffisant — agent vierge)

**Décisions Saar (verrouillées Session 139) :**
- **Skin** : Option A (wiz premium) — classes `.wiz4-*` dans `index.css` Section 12 ; variables
  `--wiz-*` disponibles car Step4 rendu sous `.wiz-shell` (index.css:1812-1825).
- **Dés** : DicePanel réel (`client/src/components/DicePanel.jsx`), jamais `Math.random` (Lot 6).
- **Q1** : `ref_careers.points_per_year` (=5) **ignoré** ; skills = constante **10/an**.
- **Q2** : trou serveur (reconcile ne valide pas le coût skills) **corrigé au Lot 2**.
- **Q3** : une compétence = **un** niveau (jamais de doublon) ; pool skills **GLOBAL** = Σ(10×années) ;
  avantages pro **PAR MÉTIER** (5×années).
- **Relations** : nouveaux champs fiche perso (jauge `count` int + `note` texte + lien PNJ optionnel)
  → table `char_relations` (Lot 7).
- **Matériel** : brancher `char_inventory` + `savings`→`char_sheet.sols` (Lot 8).

**Modèle compétences (= LdB `REGLE_CREATION.txt:1103-1128, 1250-1263`) :**
- Coût via `shared/polarisUtils.js` `calcSkillCost` (courbe 1/2/3/5/7…, **×2 hors-profession**,
  `(X)` 1 pt → -3, `PN` gratuit ≤ +5).
- Plafond via `getMaxMasteryByYears(Σ années des métiers listant la compétence, +2 si études sup.)`.
- `isPro` = compétence dans la liste d'≥1 métier retenu. `current` = base d'origines (`bgSkills.bonus`).

**Faits vérifiés (code lu Session 139) :**
- `calcSkillCost` + `getMaxMasteryByYears` = **code mort** (jamais consommés en prod ; Lot 1 = 1er
  consommateur → tester à fond).
- `refSkills` (catalogue + markers) : **absent** de `getStep4RefData` ; dispo via route existante
  `GET /api/char-ref/skills` (`routes/character/ref.js`) → **réutiliser**.
- `ref_career_education` : **absent** de `getStep4RefData` (lu seulement côté serveur) → à ajouter (Lot 1).
- `career.skills` = `{ skill_id, family, conditional }` (pas de label/marker → besoin du catalogue).
- Fiche perso (`CharacterSheet`) = SkillsPanel + AdvantagesPanel **seulement** (ni carrières ni
  relations) → nouveau panneau au Lot 7.
- **Une seule migration** sur tout le rework = `char_relations` (Lot 7).
- Design source : `docs/ClaudeDesign/project/Professions.dc.html` (+ README bundle : reproduire le
  visuel, pas la structure interne du proto).

---

## 2. DÉCOUPAGE EN LOTS

| Lot | Titre | Statut |
|---|---|---|
| **0** | **Fondation éligibilité** : `shared/careerEligibility.js` + rebranchement serveur | ✅ CODÉ + validé Saar |
| **1** | **Fondation moteur de coût (invisible)** : `getStep4RefData` (+`education`), serveur **Q2** (`reconcileCreation` valide le coût via `calcSkillCost` + payload `skillAllocations` global), **tests unitaires** du modèle. Aucun UI. | à planifier → **prochain** |
| **2** | **UI** : réécriture `CareersAllocator` (rail + barre d'âge + détail onglets + **board GLOBAL** compétences), filtre « Accessibles » réel, `useReducer`, CSS `.wiz4-*`, i18n. Économies → Lot 3. | cadré |
| **3** | Onglet Carrière & économies (table titres/salaires + cumul, lecture seule) | ✅ CODÉ + validé Saar |
| **4** | Avantages pro (5 pts/an **par métier** → `pro_advantages`) | ✅ CODÉ + validé Saar |
| **5** | Compétences « au choix » (`conditional` → radios → `openedSkills`) | cadré |
| **6** | Tirage 1D10 via DicePanel (`ref_career_random_benefits` → `random_picks`) | cadré |
| **7** | Relations (champs fiche perso : entier + texte + lien PNJ + persistance) | à investiguer |
| **8** | Matériel accessible (inventaire + menu GM création objets) | à investiguer |

> **Re-découpage (validé Saar)** : le moteur de coût (`calcSkillCost`, jamais utilisé en prod, +
> règle cumul + validation serveur Q2) est isolé en **fondation invisible testable** (comme le Lot 0)
> AVANT la réécriture UI qui le consomme. Évite d'empiler un mécanisme risqué dans une grosse UI.

---

## 3. LOT 0 — Fondation : évaluateur d'éligibilité partagé  [PLAN DÉTAILLÉ]

**Objectif** : une source unique de vérité pour « une carrière est-elle accessible à ce
personnage ? », consommée par le serveur (validation) ET le client (filtre + bouton grisé + raisons).
Supprime la divergence filtre géo↔finalize.

**Fichiers touchés**
- `shared/careerEligibility.js` (**NOUVEAU**) : fonction pure, aucune dépendance DB.
  ```
  evaluateCareerEligibility(career, context) → { eligible: bool, reasons: Reason[] }
  Reason = { code:'prereq'|'genotype'|'attributes'|'education', ...params }
    prereq     → { careerId, careerName, minYears }
    genotype   → { genotypeId, genotypeLabel }
    attributes → { failed:[{attr, have, min}] }
    education  → { present:bool, fields:[...] }   // present=false → "nécessite des études
                                                  // supérieures : X" ; present=true (mauvaise
                                                  // filière) → "nécessite les études : X"
  career  = ligne ref_careers + { prerequisites[], education[] }  (noms prérésolus par l'appelant :
            l'évaluateur reste pur, il ne fait aucune requête — l'appelant fournit careerName/
            genotypeLabel déjà lus en base pour que les params soient formatables)
  context = { careers:[{career_id, years}], genotypeId, higherEd, attributes:{FOR..PRE} }
  ```
  **Raisons STRUCTURÉES (codes + params), jamais de texte FR** → le serveur les formate vers ses
  messages actuels, le client les traduira via i18n (Lot 1). L'évaluateur collecte **toutes** les
  raisons (pour le client).
  Règles (portées des 4 validateurs actuels) : prérequis (`prerequisites[]` vs `context.careers`),
  génotype (`required_genotype` vs `genotypeId`), attributs (`min_*` vs `attributes`),
  études (`education[]` vs `higherEd`).
- `server/src/services/creationService.js` : les 4 `validateCareer*` (l.61-123) + leurs 4 appels
  (l.357-363) sont **remplacés par UNE fonction** `checkCareerEligibility(sheetId, careerId, trx)`
  (vérifié : aucun autre appelant en prod) : un seul fetch DB (prereqs + noms, génotype+label,
  attributs, higher_ed + education), build career+context avec **noms prérésolus**, appel évaluateur
  pur, retour `{ valide, erreur }` formaté depuis `reasons[0]`. Le point d'appel reconcile passe de
  4 lignes à 1.
  **PARITÉ STRICTE** : ordre d'évaluation figé **[prereq, genotype, attributes, education]**
  (= ordre d'appel actuel) → `reasons[0]` = message identique à aujourd'hui. Fallbacks préservés
  (`?` attribut manquant, `label ?? id` génotype, `prereqCareer?.name`). **Dettes préservées, NON
  corrigées** : `prerequisite_logic` et `min_attributes_logic` (AND/OR) restent ignorées comme
  actuellement (AND implicite). Zéro changement visible.

**Ce qui NE change PAS** : schéma DB, refData, UI, messages d'erreur utilisateur (identiques,
formatés depuis `reasons[0]`).

**Tests 0** (méthode **snapshot avant/après**, pas « je crois que c'est pareil ») :
1. AVANT refactor — capturer verdict + message actuels pour les cas à contrainte : Assassin
   (prérequis), Hybride du Trident (génotype), Soldat d'élite (attributs), Diplomate/Érudit/Médecin
   (études), + un cas éligible.
2. APRÈS refactor — assérer message identique pour chaque cas.
3. Vérif directe de l'évaluateur pur (`reasons` structurées correctes, multi-échecs collectés).
Tout via `node -e` inline (jamais de fichier dans `server/` — piège P53) ; SR ; ESLint 0 erreur.

> **Note Lot 1** : `getStep4RefData` ne charge pas `ref_career_education` — à ajouter au Lot 1 pour
> que le client puisse évaluer la contrainte études (le serveur, lui, la lit déjà en direct).

---

## 4. LOT 1 — Fondation moteur de coût (invisible)  [PLAN DÉTAILLÉ]

**Objectif** : établir la mécanique de coût compétences correcte (helper partagé testé + données)
AVANT l'UI qui la consomme. Invisible à l'écran, testable en isolation (pattern Lot 0). **Ne touche
pas** le payload actuel ni `reconcileCreation` (ceux-ci changent au Lot 2 avec l'UI) → l'assistant
actuel continue de fonctionner tel quel.

**Modèle (cf. §1ter, = LdB `REGLE_CREATION.txt:1103-1128,1250-1263`)** :
- Une compétence = un niveau. Coût = `calcSkillCost` (courbe, ×2 hors-pro, basé strictement sur
  l'appartenance à une carrière — les études supérieures ne comptent jamais pour le coût). `isPro` =
  dans la liste d'**≥1 métier retenu**. Pool skills = **global** = Σ(10 × années). PN gratuit ≤ +5.
  `current` = base d'origines (`bgSkills.bonus`).
- **Plafond (corrigé après lecture de la source, Lot 1 codé)** : DEUX cas distincts, pas une formule
  unique — compétence **professionnelle** (listée par ≥1 métier retenu, ou par les études sup. qui
  comptent pour +2 ans comme une profession, ligne 1254) → `getMaxMasteryByYears(Σ années + 2 si
  études sup. la listent)` ; compétence **d'origine non-professionnelle** (géo/social/formation, pas
  dans la liste d'un métier) → plafond **fixe +5** (ligne 1122-1128), **pas**
  `getMaxMasteryByYears(0)=3` comme écrit initialement dans cette section.

**Fichiers touchés** :
- `shared/careerSkills.js` (**NOUVEAU**) — helper pur, réutilise `calcSkillCost`/`getMaxMasteryByYears` :
  ```
  computeSkillAllocation(skillAllocations, ctx) → {
    budget, totalCost, remaining,
    perSkill: [{ skillId, current, target, isPro, cost, cap, capped }],
    errors: [{ code:'over_budget'|'over_cap', ... }]
  }
  skillAllocations = { skill_id: targetMastery }   // GLOBAL
  ctx = { careers:[{skills:[skill_id], years}], higherEdSkills:[skill_id], baseMastery:{skill_id:n}, refSkills }
  budget = Σ(10 × years) ; cap(skill) = getMaxMasteryByYears(Σ years listant skill (+2 études))
  ```
  Utilisé par le client (board : coût/restant/plafond) ET le serveur (validation) au Lot 2.
- `server/src/services/creationService.js` `getStep4RefData` : ajouter **`education`** par carrière
  (additif, sûr) — requis au filtre éligibilité client (Lot 2).
- refSkills : **réutiliser** la route existante `GET /api/char-ref/skills` (pas de nouveau catalogue).

**Ce qui NE change PAS** : schéma DB, payload, `reconcileCreation`, UI, Lot 0. (Aucune régression.)

**Tests Lot 1** (node -e inline, jamais de fichier dans `server/` — P53) :
- `calcSkillCost` : in-pro vs hors-pro (×2), franchissement +5→+6 (coût 1 puis 2), `(X)` (ouverture
  -3), `PN` gratuit ≤ +5.
- `getMaxMasteryByYears` : bornes (1→3, 2→5, 3-5→7, 6-10→10, 11-20→13, 21+→15).
- `computeSkillAllocation` : cumul années sur compétence partagée (Barman+Assassin) → plafond cumulé ;
  dépassement budget → `over_budget` ; dépassement plafond → `over_cap` ; cas nominal OK.
- `getStep4RefData` renvoie `education` par carrière (vérif structure).
- SR + ESLint (shared/server hors périmètre lint → `node --check`).

---

## 5. LOT 2 — UI : réécriture CareersAllocator + board global  [✅ CLOS]

> **Contradiction résolue au lancement** : lecture du design source `Professions.dc.html` (logique
> complète, pas que le CSS) → board confirmé **GLOBAL** (une ligne/compétence, un compteur de points
> restants global), pas « par métier ». Les **avantages pro** (Lot 4) restent, eux, par métier.
> Implémenté tel quel, testé fonctionnel Saar.
>
> **Découverte règle en cours de route (compétences réservées `(X)`, à retenir pour le Lot 5)** :
> `REGLE_CREATION.txt:1129-1132` — une compétence spéciale/réservée est accessible dès qu'elle est
> **listée par une carrière retenue**, pas seulement via un bonus d'origine ou un déblocage explicite.
> `computeSkillAllocation` (`shared/careerSkills.js`) calcule `isLearned = isPro ||
> openedSkills.includes(skillId) || (baseMastery[skillId] ?? 0) > 0`. Le malus « base -3 » du premier
> point investi (ligne 1115) s'applique quand même dans tous les cas — ce n'est pas un blocage, juste
> un coût plus élevé. Détail complet (2 bugs `-Infinity` trouvés et corrigés) : `JOURNAL6.md` "Lot 2".

**Décisions verrouillées** : skin **Option A** (wiz premium). Classes **`.wiz4-*`** (cohérent avec
`.wiz3-*`), dans `index.css` Section 12. Variables `--wiz-*` disponibles car Step4 est rendu sous
`.wiz-shell` (index.css:1812-1825, déclare toutes les `--wiz-*`). Couleur d'hexagone = **HSL
déterministe dérivée de `career.code`** (hash → teinte) — réutilisée par les tags de provenance.
État = **`useReducer`** (transitions pures). Filtre « Accessibles » = **évaluateur du Lot 0**.
Board = **global**, coût via `shared/careerSkills.js`. Payload `skillAllocations` **global** +
validation serveur `reconcileCreation` (Q2) via le même helper.

**Objectif** : layout complet + flux « sélectionner → consulter → ajouter/retirer » un métier **+
board GLOBAL d'allocation des compétences** (cœur fonctionnel). Onglet Carrière & économies =
coquille (→ Lot 3), onglet Avantages = coquille (→ Lot 4). Économies **hors lot** (barre d'âge :
« — » en attendant Lot 3).

**Fichiers touchés**
- `client/src/components/creation/CareersAllocator.jsx` — réécriture complète du rendu ; l'objet
  `s={}` visuel (l.390-797) est **supprimé** au profit des classes `.wiz4-*`.
- `client/src/index.css` — bloc `.wiz4-*` ajouté en fin de Section 12 (après l.2058 zone Step3/1).
- `client/src/locales/fr.json` (namespace `creation` → `step4.*`) — nouvelles clés.
- `client/src/components/creation/Step4Experience.jsx` — **1 changement** : passer `baseAge` à
  `CareersAllocator` (l.341-355) : `baseAge={age + (selectedHigherEdItem?.years_added ?? 0)}`
  (« âge de départ » de la phase carrières = âge + années d'études déjà ajoutées).

**Correspondance classes design → `.wiz4-*`** (design Professions.dc.html l.11-139 → tokens wiz) :
`wz-cols→wiz4-cols`, `wz-rail→wiz4-rail`, `wz-seg/segbtn(.on)→wiz4-seg/segbtn`,
`wz-railrow(.sel/.added)→wiz4-railrow`, `wz-hex→wiz4-hex` (clip-path hexagone, couleur via custom
prop `--hex`), `wz-railname/railmeta/restr/retenu→wiz4-*`, `wz-main→wiz4-main`,
`wz-agebar/ageitem/agev(.hi/.gold)/agesep/agenote→wiz4-*`,
`wz-detail/dtop/illus/dinfo/dtitle/drang/ddesc/dactions→wiz4-*`,
`wz-yearctl/yearval/stepbtn/addbtn(.dis)→wiz4-*`, `wz-tabs/tab(.on)/tabbody→wiz4-*`,
`wz-block/geo/groups/grplbl/chips/chip→wiz4-*`, `wz-foot/prev/status(.ok)/next(.dis)→wiz4-*`.
Mapping couleurs : accent `#5b8dee`→`var(--wiz-blue-bright)` ; texte `--text-primary`→`--wiz-white`,
`--text-session-mid`→`--wiz-metal-1`, `--text-session-lo`→`--wiz-metal-3` ; surfaces plates →
`var(--wiz-glass)` + `var(--wiz-glass-border)` ; radius → `var(--wiz-radius)`.

**Structure JSX cible**
- `.wiz4-cols` (grid 296px | 1fr)
  - `.wiz4-rail` : `.wiz4-seg` (2 boutons Tous/Accessibles) + `filteredCareers.map` → `.wiz4-railrow`
    (hex initiale [1re lettre `name`], `.wiz4-railname` nom, `.wiz4-railmeta` éco/an + rang + ⚠,
    badge `.wiz4-retenu` si retenu)
  - `.wiz4-main` :
    - `.wiz4-agebar` : Âge de départ (`baseAge`) / Années de carrière (Σ years retenus) / Âge actuel
      (`baseAge`+Σyears, `.hi`) / Économies de départ (`.gold`, **« — »** — calcul réel en Lot 1c)
    - `.wiz4-detail` (si `career`) : `.wiz4-illus` (img asset), titre, `.wiz4-drang`
      (débute `eco` · rang · débloque N compétences), desc, `.wiz4-dactions` (stepper années −/＋ +
      bouton Ajouter/Retirer)
    - `.wiz4-tabs` (Métier | Carrière & économies | Avantages pro)
    - `.wiz4-tabbody` : onglet Métier = `.wiz4-geo` (origine géo) + `.wiz4-groups` (par famille →
      `.wiz4-grplbl` + chips) ; onglets Carrière/Avantages = `.wiz4-note` « à venir »
    - **`.wiz4-board`** (sous le détail) : board d'allocation — steppers actifs sur les compétences
      **du métier sélectionné** (budget par métier, Q3) — voir sous-section ci-dessous.
    - `.wiz4-foot` : Précédent / `.wiz4-status` / Suivant

**État = `useReducer`** (reducer pur `careersReducer`, actions ci-dessous). Champs : `filter`
('all'|'eligible'), `selectedCareerId`, `years`, `activeTab` ('metier'|'carriere'|'avant'),
`hoverCareerId` (surbrillance provenance), `skillAllocs` (map skill_id→**targetMastery** du métier en
cours ; le coût est dérivé via `calcSkillCost`, jamais stocké).
Le committed (`selectedCareers`) reste piloté par les props `onAdd/onRemove` (report Zustand = lot
ultérieur).

**Helpers** :
- `careerHexColor(code)` → `hsl(hash % 360, 55%, 55%)` déterministe (partagé rail + provenance).
- `getTitleForYears(titles, years)` (existe déjà l.30-33, conservé) → rang courant.
- `buildEligibilityContext(...)` → assemble le `context` pour l'évaluateur Lot 0 depuis les props
  (attributs step1, génotype step2, études, carrières retenues). (Économies : aucun helper en Lot 1.)

**Handlers (inventaire exhaustif)** — via `dispatch` sur `careersReducer` :
| Élément | Action | Comportement |
|---|---|---|
| Segment Tous | `SET_FILTER 'all'` | affiche toutes les carrières |
| Segment Accessibles | `SET_FILTER 'eligible'` | garde `evaluateCareerEligibility(...).eligible` (Lot 0) |
| Ligne rail (clic) | `SELECT_CAREER id` | toggle ; reset `years=1`, `activeTab='metier'`, `skillAllocs={}` |
| Ligne rail (hover) | `SET_HOVER id/null` | surbrillance des compétences apportées (board) |
| Onglet ×3 | `SET_TAB k` | change onglet |
| Stepper − / ＋ | `SET_YEARS y∓1` | borné 1..min(50, remainingPC) ; reset `skillAllocs` |
| Skill − / ＋ (board) | `ALLOC_SKILL {id,±1}` | borné : pool restant > 0 (＋), cap +3, allouable si métier courant |
| Ajouter | `handleAdd()` | si éligible & pool skills du métier soldé → `onAdd(id,name,titles,years,{...skillAllocs})` puis reset |
| Retirer | `onRemove(index)` | via props |
| Précédent | `onPrev()` | props |
| Suivant | `onNext()` | actif si ≥1 métier retenu **et** points de compétence tous répartis |

**Sous-section — Board d'allocation `.wiz4-board` [TEL QU'IMPLÉMENTÉ — le texte ci-dessus était la
version pré-clarification GLOBAL, remplacée]**
- Sous le détail : agrégation de TOUTES les compétences d'origine (géo/soc/formation/études) +
  celles des métiers **retenus** (committés, pas le métier consulté seul), groupées par famille
  (`.wiz4-bgrp`, label sticky). Steppers actifs sur **toute** ligne du board (pas de `.locked`) :
  une compétence d'origine non-professionnelle reste allouable jusqu'à son plafond fixe +5
  (`REGLE_CREATION.txt:1122-1128`).
- **Modèle de budget = GLOBAL** (confirmé `§1ter`, pas par métier) : un seul pool = Σ(10 × années de
  tous les métiers retenus), un seul compteur `.wiz4-poolrem` de points restants. Les **avantages
  pro** (Lot 4, pas encore codé) resteront par métier (5×années chacun).
- Coût/plafond via `shared/careerSkills.js` (`computeSkillAllocation`/`getSkillCap`, Lot 1) — **jamais
  recalculé en JSX**. Seules les compétences **réellement touchées par le joueur**
  (`state.skillAllocations`) sont passées à `computeSkillAllocation` ; le plafond de chaque ligne
  (touchée ou non) vient de `getSkillCap`, calculable indépendamment du coût.
- **Compétences réservées `(X)`** : accessibles dès qu'elles sont listées par une carrière retenue
  (`REGLE_CREATION.txt:1129-1132`), pas seulement via un bonus d'origine — voir encart en tête de
  section et `JOURNAL6.md` "Lot 2" pour le détail des 2 bugs `-Infinity` trouvés et corrigés.
- Validation serveur (Q2) : `reconcileCreation` STEP4 appelle `computeSkillAllocation` sur le payload
  global `step4.skillAllocations` (rejet `AppError` si `errors.length>0`), upsert `char_skills`
  absolu ensuite.

**Compat props** : `CareersAllocator` a gagné `baseAge`, `attributes`, `genotypeId`, `higherEd`,
`refSkills`, `initialSkillAllocations`, `onSkillAllocationsChange`. `onAdd` réduit à 4 args
(`careerId, careerName, careerTitles, years` — `skillAllocations` n'y transite plus, il est global).

**Clés i18n** : namespace réel = `client/src/locales/creation.json` (pas `fr.json` comme écrit plus
haut dans ce plan — fichier dédié, chargé par `i18n.js`). Clés `step4.career_filter_*`,
`career_tab_*`, `career_age_*`, `career_board_*`, `career_status_*`, `career_ineligible_*`, etc.
ajoutées (liste complète dans le fichier).

**Fichiers touchés (réel)** : `CareersAllocator.jsx` (réécriture complète), `index.css` (bloc
`.wiz4-*`), `client/src/locales/creation.json`, `Step4Experience.jsx` (nouvelles props +
`skillAllocations` state + `handleSkillAllocationsChange`), `server/src/services/creationService.js`
(Q2), `shared/careerSkills.js` (2 fixes `(X)` + export `getSkillCap`).

**Ce qui NE change PAS** : schéma DB, autres sous-steps/composants, `Step4Summary.jsx`,
`WizardReview.jsx`, `WizardCreation.jsx`.

**Tests** : voir `JOURNAL6.md` "Lot 2" (Testé/Non testé complet).

---

## 5. LOT 1c — Onglet Carrière & économies (lecture seule)  [✅ CLOS]

> **Implémenté tel que cadré**, classes finales `.wiz4-prog`/`.wiz4-ecobox` (cohérent `.wiz4-*`, pas
> `.wz4-*` comme écrit initialement dans ce brouillon). Point de conception ajouté au lancement : le
> serveur (`reconcileCreation` STEP4) calcule les économies persistées comme `salaire(titre courant
> pour years) × years` (pas une accumulation par palier traversé) — le Lot 3 reproduit exactement
> cette formule côté client, sans jamais appeler `Math.random()` (nouveau `estimateSalaryFormula()`,
> moyenne déterministe pour les titres à `salary_formula`, marquée `*`). Détail complet + vérification
> base réelle (scénario Saar 3500 sols) : `docs/JOURNAL6.md` "Lot 3".

- Table `.wiz4-prog` : Années | Titre | Salaire/an, ligne courante surlignée (`.cur`) selon
  `displayYears` (déjà calculé Lot 2).
- Encadré `.wiz4-ecobox` : économies pour la durée engagée du métier consulté (`salaire titre courant
  × displayYears`) + note fixe/aléatoire.
- Tuile agebar « Économies de départ » (placeholder `—` depuis le Lot 2) : Σ sur les métiers **retenus**
  du même calcul (`salaryPerYear × years` par métier), `*` si au moins une carrière utilise une formule.
- Données : `career.titles[]`. Salaire : `salary_per_year` sinon `salary_formula` estimée
  (`shared/polarisUtils.js` `estimateSalaryFormula`, même regex partagée que `evaluateSalaryFormula`
  utilisée par le serveur, format `\d+D\d+\*\d+`).
- Clés i18n : `career_prog_years`, `career_prog_title`, `career_prog_savings`, `career_eco_cumul`,
  `career_eco_note_random`, `career_eco_note_fixed`.
- **Bugfix associé (dette [CAR-DEF] repérée aux tests Lot 2)** : filtre carrières par défaut
  `'all'` → `'eligible'` (`CareersAllocator.jsx` `initialReducerState`).
- Tests : voir `JOURNAL6.md` "Lot 3" (Testé/Non testé complet).

---

## 6. LOT 2 — Avantages pro (5 pts/an)  [✅ CLOS]

> **Implémenté tel que cadré**, plus une fondation invisible + un correctif de données trouvé en
> lisant avant de coder (méthode Lot 0/1) :
> - **Migration 120 (hors lot)** : 4 des 5 carrières du Lot 1 (`artisan_artiste`, `assassin`,
>   `barman`, `contrebandier`) n'avaient **aucune** ligne `ref_career_point_categories` en base
>   (angle mort jamais corrigé par la migration 106) — sans ce fix, leur onglet Avantages pro aurait
>   été vide/cassé. `chasseur_primes` (5ᵉ carrière) a 0 ligne légitimement (absent de la LdB p.156).
>   Vérification exhaustive des 30 sections restantes de `REGLE_PROFESSION.md` (30/30 conformes).
> - `shared/careerAdvantages.js` (`computeProAdvantageAllocation`), pattern identique à
>   `careerSkills.js` — fonction pure réutilisée client+serveur. Cas limite trouvé en relecture avant
>   livraison : un métier à 0 catégorie calculait un budget `5×années` invendable (bloquait
>   "Suivant" indéfiniment) — fix `budget = 0` si aucune catégorie.
> Détail complet : `docs/JOURNAL6.md` "Migration 120" / "Lot 4".

- Onglet Avantages pro : liste `point_categories` du métier (triées `sort_order`, déjà chargées par
  `getStep4RefData`) + stepper d'allocation (réutilise les classes CSS `.wiz4-skill`/`.wiz4-ctl`/
  `.wiz4-sbtn` du board compétences — zéro nouvelle classe) ; pool = 5 × années **du métier retenu** ;
  verrouillé (message dédié) tant que le métier n'est pas ajouté ; message dédié si 0 catégorie.
- Payload : `proAdvantages` (map catégorie→pts) par métier dans `careerEntries` (Contract B `§1bis`),
  remonté par `CareersAllocator` (état `proAdvAllocations` keyed par `career_id`, purge automatique
  au retrait de carrière) → `Step4Experience.buildPayload`. Backend `reconcileCreation` STEP4 valide
  désormais le budget (Q3) via `computeProAdvantageAllocation` avant l'insert `char_careers`
  (`pro_advantages` déjà géré côté colonne, jamais rempli avant ce lot).
- Gating global : tous les métiers retenus doivent avoir leur pool d'avantages entièrement réparti
  avant Suivant (nouveau statut `career_status_adv_left`).
- Tests : voir `JOURNAL6.md` "Lot 4" (Testé/Non testé complet).

---

## 7. LOT 3 — Compétences « au choix » (`conditional`)

- Dette [CAR1] (34 occurrences). Groupes conditionnels → **bouton radio** pour sélectionner la
  compétence retenue parmi les options « au choix ».
- Payload : `openedSkills` (liste des skill_id réellement ouverts) → `reconcileCreation` (`is_learned`).
- Tests : sélection exclusive par groupe ; skill ouverte débloque son alloc dans le board.

---

## 8. LOT 4 — Tirage 1D10 (DicePanel réel)

- Backend : `getStep4RefData` charge `ref_career_random_benefits` (roll, description) → imbriqué
  dans `careers[].randomBenefits[]` (pattern Map identique aux autres). Route inchangée.
- UI : bouton « Lancer 1D10 » actif si années ≥ 5 dans un métier compatible → déclenche
  **DicePanel** (`client/src/components/DicePanel.jsx`, API à lire au début du lot) → résultat réel
  → affiche le bénéfice correspondant → `randomPicks` dans payload (`char_careers.random_picks`).
- Règle : optionnel, tous les 5 ans, **au lieu** des 5 pts d'avantages de la période (interaction
  avec Lot 2 à cadrer précisément à ce moment).
- Tests : jet réel via DicePanel ; résultat mappé ; persistance `random_picks`.

---

## 9. LOT 5 — Relations (fiche perso)

- **Investigation requise** : `char_traits` (jsonb `params`) vs nouvelle table/colonnes. Décision
  Saar : jauge numérique (entier, conversion pts→PNJ à discrétion GM) + champ TEXT libre + lien
  optionnel vers fiche PNJ.
- Fréquences source : `contact_frequency`, `ally_frequency`, `opponent_frequency`, `enemy_rule`.
- Touche : `CharacterWindow.jsx` (affichage fiche perso) + section wizard + persistance (probable
  migration). Plan détaillé à rédiger au lancement du lot.

---

## 10. LOT 6 — Matériel accessible

- Backend : charger `ref_career_equipment`.
- UI : brancher l'inventaire du personnage (`InventoryPanel.jsx`) + menu GM de création d'objets
  (système équipement existant `ref_equipment`/`char_inventory`). Plan détaillé au lancement.

---

## 11. SUIVI

| Lot | Plan détaillé | Codé | Testé Saar |
|---|---|---|---|
| 0 — Fondation éligibilité | ✅ (§3) | ✅ parité 12/12 | ✅ SR + fonctionnel |
| 1 — Fondation moteur coût | ✅ (§4) | ✅ | ✅ SR + « Test OK » |
| 2 — UI (board global) | ✅ re-détaillé au lancement | ✅ | ✅ SR + fonctionnel |
| 3 — Économies | ✅ (§5) | ✅ | ✅ SR + fonctionnel |
| 4 — Avantages pro | ✅ (§6) | ✅ | ✅ SR + fonctionnel |
| 5 — « Au choix » | — | — | — |
| 6 — Tirage 1D10 | — | — | — |
| 7 — Relations | — | — | — |
| 8 — Matériel | — | — | — |
