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
  appliedSkills: [skill_id],              // choix "au choix" des BACKGROUNDS uniquement (déjà câblé)
  openedSkills: [skill_id],               // choix "au choix" des CARRIÈRES (Lot 5) + futur Formation (Lot 6)
                                           // champ déjà lu par reconcileCreation (§7.3) — jamais envoyé avant Lot 5
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
| **1** | **Fondation moteur de coût (invisible)** : `getStep4RefData` (+`education`), serveur **Q2** (`reconcileCreation` valide le coût via `calcSkillCost` + payload `skillAllocations` global), **tests unitaires** du modèle. Aucun UI. | ✅ CODÉ + validé Saar |
| **2** | **UI** : réécriture `CareersAllocator` (rail + barre d'âge + détail onglets + **board GLOBAL** compétences), filtre « Accessibles » réel, `useReducer`, CSS `.wiz4-*`, i18n. Économies → Lot 3. | ✅ CODÉ + validé Saar |
| **3** | Onglet Carrière & économies (table titres/salaires + cumul, lecture seule) | ✅ CODÉ + validé Saar |
| **4** | Avantages pro (5 pts/an **par métier** → `pro_advantages`) | ✅ CODÉ + validé Saar |
| **5** | Compétences « au choix » (`conditional`, 44 lignes réelles → 6 types distincts, migration `choice_group` + corrections de données) | ✅ CODÉ + validé Saar (migration 121) |
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

## 7. LOT 5 — Compétences « au choix » (`conditional`)  [✅ CLOS]

> **Implémenté tel que cadré en §7.4**, après re-vérification de la source primaire (`REGLE_PROFESSION.md`)
> et de la base réelle immédiatement avant codage (demande Saar « code seulement si sûr à 100% ») —
> aucun écart trouvé avec l'audit ci-dessous. Migration `121_ref_career_skills_choice_groups.js`,
> round-trip `down`/`up` testé en base réelle byte-identique. Un gap trouvé en relecture avant
> livraison (règle 5) : `provenanceFor` (tag de provenance du board) ne couvrait pas les compétences
> "au choix" nouvellement ouvertes — corrigé dans le même lot. Détail complet : `docs/JOURNAL6.md`
> "Lot 5".

> Dette [CAR1], réévaluée à 44 occurrences réelles (pas 34, chiffre initial approximatif). Hypothèse
> de départ du plan (« bouton radio par métier ») **invalidée par la donnée réelle** — voir recherche
> Foundry VTT dnd5e (Advancement System, type `Trait` : `grants[]` + `choices[]` indépendants) qui a
> révélé l'angle mort avant tout code. Audit exhaustif des 44 lignes `ref_career_skills.conditional=true`
> fait ligne par ligne contre `docs/Character/Creation/REGLE_PROFESSION.md` (méthode identique aux
> migrations 106/118/120) — **aucune ligne prise au hasard, aucune supposée**.

### 7.0 Constat central : `conditional` conflate 6 phénomènes différents

Le flag booléen unique `ref_career_skills.conditional` a été utilisé pour au moins 6 situations
distinctes du texte source, qui n'ont pas le même traitement mécanique possible :

| Type | Définition | Traitement |
|---|---|---|
| **T1 — Optionnel isolé** | Une seule compétence concrète, réellement facultative selon le texte, aucune alternative énumérée | Case à cocher indépendante (`choice_group = NULL`) |
| **T2 — Alternative fermée réelle** | Le texte dit « X **ou** Y » entre deux compétences concrètes distinctes | Radio à 2 (ou N) options fixes (`choice_group` partagé) |
| **T3 — Catégorie/famille à développer** | La ligne DB pointe vers une catégorie (`is_category=true`) ou vers UN enfant choisi comme proxy d'un choix qui porte en réalité sur toute la famille (`ref_skills.parent`) | Remplacer par les enfants réels, `choice_group` partagé (radio) |
| **T4 — Sous-variante de carrière non modélisée** | Le texte conditionne la compétence à un sous-type de la carrière que le schéma ne modélise pas (ex. « équipage des navires de pêche seulement », « spécialiste sécurité ») | Dégénère en T1 (case à cocher) — le joueur tranche lui-même, faute de sous-type traqué |
| **T5 — Choix ouvert non énumérable** | Le texte autorise « toute autre Compétence liée au domaine », sans liste fermée | **Hors scope** — aucun schéma ne peut représenter un pool infini ; le composant fixe cité (s'il existe) reste sélectionnable via T3, le reste est une dette documentée |
| **T6 — Gating par prérequis** | La compétence se débloque par années d'ancienneté et/ou capacité spéciale (Force Polaris), pas par un choix du joueur | **Hors scope Lot 5** — mécanisme de gating distinct, pas un « au choix » |

**Convention retenue (tranchée à partir de la source, cas Barman)** : seul le marqueur explicite
« **(au choix)** » (ou équivalent univoque comme « une Compétence au choix ») déclenche un traitement
T2/T3 (choix mécanique fermé). Un simple « X **ou** Y » sans ce marqueur reste un registre descriptif
— traité T1 (compétence optionnelle indépendante, pas de `choice_group`). Distinction vérifiée par
contraste direct dans le texte source : Soldat/Milicien dit « Armes spéciales **(au choix)** »,
Soldat d'élite dit juste « Armes spéciales » (sans marqueur, pour la même compétence) — le marqueur
absent/présent est bien un signal intentionnel du texte, pas un hasard de rédaction.

**Anomalies de données trouvées** (à trancher — pas des cas « au choix » du tout) :
- **Doublons inertes** : plusieurs lignes `conditional=true` sur le **même** `skill_id` déjà rendu
  professionnel par une autre ligne `conditional=false` du même métier → aucun effet mécanique
  aujourd'hui ni après Lot 5 (`isProSkill` teste une appartenance booléenne, pas un compteur).
- **Flag `conditional` contredit par le texte** : une ligne marquée conditionnelle alors que le texte
  ne dit **pas** « au choix » pour cette carrière précise (comparaison entre variantes de la même
  famille de carrières qui, elles, disent bien « au choix »).

### 7.1 Audit ligne par ligne (44 lignes, groupées par traitement)

**T1 — Case à cocher isolée (10 lignes, aucun changement de donnée nécessaire)**
| Carrière | skill_id | Texte source |
|---|---|---|
| Barman | `FUSIL_ARMES_DEPAULES` | `:194` « Armes de poing **ou** Fusils/Armes d'épaule » — pas de marqueur « (au choix) » (convention §7.0) → reste un bonus optionnel indépendant, `ARMES_DE_POING` (déjà non-conditionnel) inchangé, aucune migration |
| Marchand itinérant/Conteur | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` | `REGLE_PROFESSION.md:804` « au choix » |
| Officier militaire (Souterrain/Surface) ×2 | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` | `:1228` « au choix » |
| Officier naval/Navigateur (civile/militaire) ×2 | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` | `:1143` « au choix » |
| Scientifique/Ingénieur | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` | `:1745` « au choix » |
| Sous-marinier | `CHASSE_PISTAGE` | `:2035` « équipage des navires de pêche seulement » (T4→T1) |
| Technicien/Mécanicien | `PIRATAGE_INFORMATIQUE` | `:2114` « pour les spécialistes de la sécurité informatique » (T4→T1) |
| Technicien/Mécanicien | `CRYPTOGRAPHIE` | `:2108` « pour les spécialistes de la sécurité » (T4→T1) |

**T3 — Catégorie/famille à développer en groupe (24 lignes, migration de données requise)**
| Carrière | Ligne DB actuelle | Texte source | Enfants réels disponibles (`ref_skills.parent`) |
|---|---|---|---|
| Officier militaire (Souterrain/Surface) ×2 | `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION` (enfant unique) | `:1225` « Techniques spéciales (au choix) » — **mapping confirmé correct** : `docs/REGLES/REGLECOMPETENCE.md:191-195` définit la compétence Armes spéciales comme couvrant « toutes les techniques spéciales de combat » ; décision de mapping déjà documentée `docs/Old/JOURNALCOUCHE4.md:574` | 2 enfants `ARME_SPECIALE_CONTACT` (FOR/COO, COO/COO), même groupe que Soldat/Milicien |
| Artisan/Artiste | `COMMERCE_TRAFIC` (catégorie) | `:77-78` « Commerce/Trafic (Artisanat, Œuvres d'art…) » | 7 enfants existants (aucun ne dit littéralement Artisanat/Œuvres d'art — lacune catalogue mineure, non bloquante) |
| Artisan/Artiste | `SCIENCES_CONNAISANCES_SPECIALISEES` (catégorie) | `:79-81` « éventuellement…Botanique, Chimie » | `BOTANIQUE`, `PHYSIQUE_CHIMIE` couvrent les exemples |
| Chasseur de primes | `ARTS_MARTIAUX` (catégorie) | `:243-244` « une Compétence au choix » | `LUTTE`, `TECHNIQUES_DEFENSIVES`, `TECHNIQUES_OFFENSIVES` |
| Marchand | `COMMERCE_TRAFIC` (catégorie) | `:731` « au choix » | 7 enfants |
| Marchand itinérant | `EXPRESSION_ARTISTIQUE_COMEDIE_CONTE` (enfant unique choisi comme proxy) | `:800-801` « Expression artistique (au choix, Conte, Musique, etc.) » | `DANSE`, `CHANT`, `COMEDIE_CONTE`, `INSTRUMENT_DE_MUSIQUE` |
| Marchand itinérant | `COMMERCE_TRAFIC` (catégorie) | `:802-803` « au choix » | 7 enfants |
| Médecin/Chirurgien | `SCIENCES_CONNAISANCES_SPECIALISEES` (catégorie) | `:931-935` « Médecine…Biologie/Physiologie…Cybertechnologie…Génétique…Psychologie…etc. » | **Filtré par cohérence métier** (décision Saar) : `MEDECINE`, `BIOLOGIE_PHYSIOLOGIE`, `PHARMACOLOGIE`, `PSYCHOLOGIE` + `GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE`, `_BIOTECHNOLOGIE_GENIE_GENETIQUE` (6 au total, pas les 19 enfants Sciences) |
| Ouvrier/Docker | `MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE` (enfant unique) | `:1320-1321` « Mécanique (Générateurs…, **ou toute autre Compétence liée au domaine**) » | 6 enfants `MECANIQUE` pour la partie énumérable ; clause ouverte = T5 hors scope |
| Prostitué(e) | `EXPRESSION_ARTISTIQUE_COMEDIE_CONTE` (enfant unique) | `:1678-1679` « au choix » | 4 enfants `EXPRESSION_ARTISTIQUE` |
| Prêtre du Trident | `SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION` (enfant unique) | `:1601-1604` « selon spécialité : Administration/Gestion, Médecine, Psychologie, Sciences politiques » | Les 4 exemples existent tous comme enfants → groupe restreint à ces 4 |
| Scientifique/Ingénieur | `GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE` (enfant unique) | `:1749-1750` « Génie technique (au choix) » | 9 enfants `GENIE_TECHNIQUE` (tous — famille homogène 100% technique/ingénierie, aucun filtre nécessaire) |
| Scientifique/Ingénieur | `SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE` (enfant unique) | `:1746-1747` « au choix, en fonction du domaine de recherche ou d'activité » | **Filtré par cohérence** (justifié par le prérequis carrière `:1742` « Études supérieures Sciences/**Sciences humaines** ou École d'ingénieur » — couvre donc sciences dures ET humaines) : 14 enfants — `BIOLOGIE_PHYSIOLOGIE`, `GEOLOGIE`, `GEOGRAPHIE`, `HISTOIRE_ARCHEOLOGIE`, `PHYSIQUE_CHIMIE`, `PSYCHOLOGIE`, `SCIENCES_POLITIQUES`, `SOCIOLOGIE`, `ZOOLOGIE`, `ARMES_SYSTEMES_DARMEMENT`, `ASTROPHYSIQUE_ASTRONOMIE`, `BOTANIQUE`, `CRIMINALISTIQUE`, `ECONOMIE` — écartés : `MEDECINE`, `PHARMACOLOGIE` (turf Médecin), `ADMINISTRATION_GESTION`, `DROIT_LEGISLATIONS`, `FINANCES` (pas de la recherche) |
| Soldat d'élite ×4 variantes | `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` (enfant unique) | `:1911` « Arts martiaux (au choix) » | `LUTTE`, `TECHNIQUES_DEFENSIVES`, `TECHNIQUES_OFFENSIVES` |
| Soldat/Milicien | `ARTS_MARTIAUX_LUTTE` (enfant unique) | `:1820` « Arts martiaux (au choix) » | 3 enfants `ARTS_MARTIAUX` |
| Soldat/Milicien | `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION` (enfant unique) | `:1820-1821` « Armes spéciales (au choix) » | 2 enfants `ARME_SPECIALE_CONTACT` (FOR/COO, COO/COO) — texte sous bullet « Combat (contact) », donc pas les variantes distance |
| Technicien/Mécanicien | `SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE` + `_GEOLOGIE` (2 lignes, même choix) | `:2106-2108` « en rapport avec le domaine, ex Chimie, Géologie, Physique » | **Fusionné en UN SEUL `choice_group`, filtré par cohérence** (profession manuelle/mécanique, pas de prérequis « sciences humaines » contrairement à Scientifique) : 3 enfants seulement — `PHYSIQUE_CHIMIE`, `GEOLOGIE`, `ARMES_SYSTEMES_DARMEMENT` (technicien d'armement plausible) — le reste (sciences humaines/médicales/administratives) écarté |
| Technicien/Mécanicien | `MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS` (enfant unique) | `:2112-2113` « Mécanique (au choix) » | 6 enfants `MECANIQUE` |
| Érudit/Archéologue | `SCIENCES_CONNAISANCES_SPECIALISEES` (catégorie) | `:513-514` « au choix, en général Archéologie, Géographie, Histoire, etc. » | **Filtré par cohérence** (spécialiste de l'histoire/recherche de la connaissance, `:501-503`) : 9 enfants — `HISTOIRE_ARCHEOLOGIE`, `GEOGRAPHIE`, `SOCIOLOGIE`, `SCIENCES_POLITIQUES`, `DROIT_LEGISLATIONS`, `ECONOMIE`, `PHYSIQUE_CHIMIE`, `GEOLOGIE`, `ASTROPHYSIQUE_ASTRONOMIE` — écartés : compétences médicales (`MEDECINE`, `BIOLOGIE_PHYSIOLOGIE`, `PHARMACOLOGIE`, `PSYCHOLOGIE`), administratives (`ADMINISTRATION_GESTION`, `FINANCES`), et sans rapport (`ZOOLOGIE`, `BOTANIQUE`, `CRIMINALISTIQUE`, `ARMES_SYSTEMES_DARMEMENT`) |

**T2 — Alternative fermée réelle** : aucune ligne. Barman (`:194`, « Armes de poing ou Fusils/Armes
d'épaule ») en était l'unique candidat pressenti (dette [CAR-C3] session 134) ; reclassé T1 après
lecture directe de la source (pas de marqueur « (au choix) », voir §7.0 et T1 ci-dessus) — décision
prise à partir de la source, pas arbitrairement.

**Anomalies de données — nettoyage (4+4 lignes)**
| Carrière | skill_id | Constat | Action |
|---|---|---|---|
| Diplomate | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` ×3 conditionnelles | Texte `:439-441` « trois nations au choix » — mais une 4ᵉ ligne **non-conditionnelle** du même skill_id existe déjà pour ce métier → `isProSkill` est déjà vrai sans elles, les 3 lignes conditionnelles n'ont aujourd'hui et n'auront jamais aucun effet mécanique (le schéma ne trace pas de sous-type « nation ») | Supprimer les 3 lignes redondantes ; documenter la nuance « 3 nations » comme non modélisée |
| Espion | `CONNAISSANCE_DES_NATIONS_ORGANISATIONS` ×1 conditionnelle | Texte `:590-592` : 2 lignes auto (« communauté d'origine », « lieu d'opération ») + « **une autre Compétence au choix** » = n'importe quelle compétence, pas spécifiquement celle-ci. Le skill est déjà pro via les 2 lignes auto → la 3ᵉ ligne conditionnelle est inerte, et en plus ne modélise pas le bon pool (elle répète le même skill_id au lieu d'un choix ouvert) | Supprimer la ligne conditionnelle ; documenter la clause comme non modélisée (T5) |
| Soldat d'élite ×4 variantes | `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION` | Texte `:1912` : « **Armes spéciales**, Combat armé... » — **sans** « (au choix) », contrairement à Soldat/Milicien (`:1820-1821`, qui lui l'a). La ligne est marquée conditionnelle par erreur (probable copie depuis Soldat/Milicien sans revérifier le texte propre à Soldat d'élite) | Repasser `conditional=false` (compétence automatique, pas un choix) |

**Hors scope Lot 5 — dette documentée, pas un « au choix » (2 lignes)**
| Carrière | skill_id | Texte source | Nature |
|---|---|---|---|
| Hybride du Trident | `MANOEUVRES_SOUS_MARINES` | `:658` « peut être remplacée par Hybride, voir la section génotypes » | Substitution liée au génotype, pas un choix libre — relève du système génotype/hybride, pas de Lot 5 |
| Prêtre du Trident | `MAITRISE_DE_LA_FORCE_POLARIS` | `:1608` « à partir de la troisième année seulement » + capacité Polaris requise | Gating par prérequis (années + capacité spéciale), mécanisme distinct d'un « au choix » |

### 7.2 Décisions — TOUTES RÉSOLUES (validées Saar, Session 139)

- ~~Q1 — Officier militaire, mapping « Techniques spéciales »~~ **RÉSOLU** : mapping confirmé correct
  (`docs/REGLES/REGLECOMPETENCE.md:191-195` + `docs/Old/JOURNALCOUCHE4.md:574`, voir T3 ci-dessus).
  Rejoint le groupe `ARME_SPECIALE_CONTACT` avec Soldat/Milicien.
- ~~Q1bis — Périmètre des corrections d'anomalies~~ **RÉSOLU (« oui »)** : les anomalies trouvées
  (doublons Diplomate/Espion, bug `conditional` Soldat d'élite) sont corrigées **dans** la migration
  du Lot 5, pas dans une migration séparée.
- ~~Q2 — Payload choix de carrière~~ **RÉSOLU** : champ dédié **`openedCareerSkills`**, séparé de
  `appliedSkills` (backgrounds). Raison validée : `appliedSkills` n'est jamais purgé (origines figées
  après Step 4 sous-étapes géo/social/formation), alors que les choix de carrière doivent être purgés
  au retrait d'une carrière (même pattern que `PRUNE_ALLOCATIONS`/`PRUNE_ADV` déjà dans
  `CareersAllocator.jsx`) — un champ séparé évite tout risque qu'un nettoyage carrière efface par
  erreur un choix d'origine sans rapport, ou inversement. Cohérent avec Foundry VTT dnd5e (chaque
  source de choix — classe, background, race — stocke ses choix séparément, jamais fusionnés).
- ~~Q3 — Médecin/Chirurgien, enfants hors famille~~ **RÉSOLU (« oui, on inclut »)** :
  `GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE` et `GENIE_TECHNIQUE_BIOTECHNOLOGIE_GENIE_GENETIQUE`
  rejoignent le `choice_group` du Médecin malgré le changement de famille (`Techniques` au lieu de
  `Connaissances`) — le groupe de choix n'est donc pas nécessairement composé des enfants d'UNE seule
  famille `ref_skills.parent`, il peut piocher dans plusieurs familles si le texte LdB le justifie.

### 7.3 Correction Q2 — le champ séparé existe déjà, pas besoin de l'inventer

En rédigeant le plan ligne-à-ligne, lecture de `creationService.js:328-440` (bloc STEP4 de
`reconcileCreation`) : **`step4.openedSkills` est déjà un champ de payload distinct de
`appliedSkills`, déjà câblé serveur ET moteur de coût** :
- `creationService.js:424` : `computeSkillAllocation(..., { ..., openedSkills: step4.openedSkills || [] })`
- `creationService.js:435` : `isLearned = (step4.openedSkills || []).includes(skillId)` pour `char_skills.is_learned`
- `shared/careerSkills.js:58,79` : `ctx.openedSkills` déjà consommé par `computeSkillAllocation`
- `P55` (`CLAUDE.md`) l'anticipait déjà explicitement : *« openedSkills.includes(skillId) —
  déblocage explicite (Avantage Formation, **Lot 5**) »*, écrit dès le Lot 2.

Seul manque : **le client ne l'envoie jamais** — `Step4Experience.jsx:buildPayload()` (`:164-185`)
n'inclut pas `openedSkills` dans l'objet retourné (seul `appliedSkills` y est). Conséquence actuelle
(avant Lot 5) : `is_learned` est **toujours `false`** en base pour tout le monde, silencieusement —
Lot 5 corrige ce trou au passage.

**Décision Q2 confirmée, implémentation corrigée** : champ séparé = **`openedSkills`** (existant,
pas `openedCareerSkills` à créer). `appliedSkills` reste réservé aux backgrounds (Step1-Step4
géo/social/formation/études), `openedSkills` sert aux choix « au choix » de carrière (Lot 5) — et,
plus tard, à l'avantage aléatoire « Formation » (Lot 6, `random_picks` → ajoute une compétence dans
`openedSkills`). Contract B (`§1bis`) mis à jour ci-dessous pour lister les deux champs séparément
(le commentaire original « appliedSkills : choix "au choix"/background (Lot 5) » était trompeur —
`appliedSkills` = backgrounds uniquement, `openedSkills` = tout le reste).

### 7.4 Mécanisme technique — plan ligne-à-ligne

**Migration `12X_ref_career_skills_choice_groups.js` (NOUVEAU)**
1. `ALTER TABLE ref_career_skills ADD COLUMN choice_group text NULL` (symétrique migration 98).
2. **24 lignes T3** : DELETE la ligne catégorie/enfant-proxy actuelle, INSERT les enfants réels avec
   `choice_group` partagé. Noms de groupe réutilisables entre métiers (scopés par `career_id` dans
   toutes les requêtes, aucune collision possible) :

   | `choice_group` | Enfants (`ref_skills.parent`) | Métiers concernés |
   |---|---|---|
   | `arts_martiaux_choice` | `ARTS_MARTIAUX_LUTTE`, `_TECHNIQUES_DEFENSIVES`, `_TECHNIQUES_OFFENSIVES` | Chasseur de primes, Soldat/Milicien, Soldat d'élite ×4 |
   | `armes_speciales_choice` | `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION`, `_CONTACT_COORDINATION_COORDINATION` | Officier militaire ×2, Soldat/Milicien |
   | `commerce_choice` | 7 enfants `COMMERCE_TRAFIC` (tous) | Artisan/Artiste, Marchand, Marchand itinérant |
   | `expression_choice` | 4 enfants `EXPRESSION_ARTISTIQUE` (tous) | Marchand itinérant, Prostitué(e) |
   | `mecanique_choice` | 6 enfants `MECANIQUE` (tous) | Ouvrier/Docker, Technicien/Mécanicien |
   | `genie_technique_choice` | 9 enfants `GENIE_TECHNIQUE` (tous) | Scientifique/Ingénieur |
   | `sciences_choice` (Prêtre, liste fermée) | 4 enfants nommés (`ADMINISTRATION_GESTION`, `MEDECINE`, `PSYCHOLOGIE`, `SCIENCES_POLITIQUES`) | Prêtre du Trident |
   | `sciences_choice` (Artisan, filtré) | `BOTANIQUE`, `PHYSIQUE_CHIMIE` | Artisan/Artiste |
   | `sciences_choice` (Médecin, filtré) | `MEDECINE`, `BIOLOGIE_PHYSIOLOGIE`, `PHARMACOLOGIE`, `PSYCHOLOGIE` + `GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE`, `_BIOTECHNOLOGIE_GENIE_GENETIQUE` (6) | Médecin/Chirurgien |
   | `sciences_choice` (Érudit, filtré) | `HISTOIRE_ARCHEOLOGIE`, `GEOGRAPHIE`, `SOCIOLOGIE`, `SCIENCES_POLITIQUES`, `DROIT_LEGISLATIONS`, `ECONOMIE`, `PHYSIQUE_CHIMIE`, `GEOLOGIE`, `ASTROPHYSIQUE_ASTRONOMIE` (9) | Érudit/Archéologue |
   | `sciences_choice` (Scientifique, filtré) | 14 enfants — `BIOLOGIE_PHYSIOLOGIE`, `GEOLOGIE`, `GEOGRAPHIE`, `HISTOIRE_ARCHEOLOGIE`, `PHYSIQUE_CHIMIE`, `PSYCHOLOGIE`, `SCIENCES_POLITIQUES`, `SOCIOLOGIE`, `ZOOLOGIE`, `ARMES_SYSTEMES_DARMEMENT`, `ASTROPHYSIQUE_ASTRONOMIE`, `BOTANIQUE`, `CRIMINALISTIQUE`, `ECONOMIE` | Scientifique/Ingénieur |
   | `sciences_choice` (Technicien, filtré) | `PHYSIQUE_CHIMIE`, `GEOLOGIE`, `ARMES_SYSTEMES_DARMEMENT` (3) | Technicien/Mécanicien |

   **Convention retenue (tranchée Saar, remplace un premier essai mécanique « etc. = tout ouvrir »)** :
   chaque enfant candidat doit être **cohérent avec le concept du métier** (flavor text + prérequis +
   compétences déjà listées), jamais une inclusion automatique de toute la famille `ref_skills.parent`
   sous prétexte que le texte se termine par « etc. ». Justifications par métier :
   - **Médecin** (`:931-935`) → spécialités cliniques + les 2 `GENIE_TECHNIQUE` nommées explicitement
     (Cybertechnologie/Génétique) malgré le changement de famille (décision Q3).
   - **Prêtre du Trident** (`:1601-1604`, liste fermée sans « etc. ») → strictement les 4 noms cités.
   - **Érudit/Archéologue** (`:501-514`, « recherche de la connaissance », « spécialiste de
     l'histoire ») → sciences humaines/historiques + sciences dures liées aux techniques de datation
     (Physique/Chimie, Géologie) et à l'archéoastronomie ; écarté tout ce qui est clinique/médical ou
     purement administratif.
   - **Scientifique/Ingénieur** (`:1733-1752`) → le **seul** métier dont le prérequis (`:1742`)
     couvre explicitement « Sciences/**Sciences humaines** ou École d'ingénieur » : justifie
     d'inclure aussi les sciences humaines (politique, sociologie, économie), en plus des sciences
     dures — reste le plus large des quatre, mais toujours filtré (pas de Médecine/Pharmacologie,
     qui est le terrain du Médecin, ni d'Administration/Droit/Finances, pas de la recherche).
   - **Technicien/Mécanicien** (`:2095-2114`) → le plus restreint : profession manuelle/mécanique
     sans le même prérequis « sciences humaines », seules les sciences appliquées directement liées
     à la réparation/maintenance sont retenues.
   - `GENIE_TECHNIQUE` (Scientifique) reste non filtré : famille 100% technique/ingénierie, aucune
     incohérence possible avec le métier.

3. **4 lignes anomalies (doublons inertes)** : DELETE les 3 lignes `CONNAISSANCE_DES_NATIONS_ORGANISATIONS`
   conditionnelles de Diplomate + la 1 ligne conditionnelle d'Espion (garder intactes les lignes
   `conditional:false` du même skill_id pour ces métiers).
4. **4 lignes anomalie (flag erroné)** : UPDATE les 4 lignes `ARMES_SPECIALES_CONTACT_FORCE_COORDINATION`
   de Soldat d'élite (×4 variantes) → `conditional:false` (compétence automatique, pas un choix).
5. **10 lignes T1** : aucune opération, `choice_group` reste `NULL` par défaut.
6. `down()` : restaure les valeurs originales (copie exacte conservée dans le fichier, pattern
   106/118/120) + `DROP COLUMN choice_group`. Round-trip `up`/`down`/`up` testé, byte-identique.

**`shared/careerSkills.js`** : **aucun changement**. `ctx.openedSkills` déjà consommé correctement
(ligne 79). Nouvelle fonction pure exportée **`validateChoiceGroups(openedSkillIds, careerSkillRows)
→ { errors: [{code:'multiple_choice', choiceGroup, skillIds}] }`** — regroupe les lignes
`conditional:true` par `choice_group` (ignore les `choice_group` null, ce sont des T1 solo sans
contrainte d'exclusivité), rejette si `openedSkillIds` contient plus d'1 skill_id du même groupe pour
le même métier. Fonction pure, testable en isolation (node -e, pattern Lot 1).

**`server/src/services/creationService.js`**
- `getStep4RefData` (`:130-169`) : **aucun changement de code** — `select('rcs.*')` (`:140`) remonte
  `choice_group` automatiquement dès que la colonne existe.
- `reconcileCreation` STEP4 (`:328-440`) :
  - `:402-403` (`careerSkillRows = ...where({ conditional: false })`) → devient : lignes
    `conditional:false` **OU** (`conditional:true` **ET** `skill_id` dans `step4.openedSkills`).
    Symétrique à `getBackgroundSkillsToApply` (`:48-52`).
  - **Nouveau** avant la boucle `char_skills` (après `:404`, avant `:406`) : pour chaque carrière
    retenue, appeler `validateChoiceGroups(step4.openedSkills || [], toutes les lignes conditionnelles
    de ce career_id)` → `AppError(400, ...)` si un groupe a plus d'1 choix.
  - `:424`, `:435` : **aucun changement** (déjà corrects, cf. §7.3).

**`client/src/components/creation/Step4Experience.jsx`**
- Nouveau `useState` : `openedSkills` (array), init `initialData?.openedSkills ?? []`.
- Nouveau `handleOpenedSkillsChange` (callback, pattern `handleSkillAllocationsChange:45`).
- `buildPayload()` (`:164-185`) : ajouter `openedSkills` à l'objet retourné.
- `<CareersAllocator>` (`:348-371`) : nouvelles props `initialOpenedSkills={openedSkills}`,
  `onOpenedSkillsChange={handleOpenedSkillsChange}`.

**`client/src/components/creation/CareersAllocator.jsx`**
- Reducer (`initialReducerState`/`careersReducer`, `:34-87`) : nouveau champ `openedSkills` (array),
  init depuis `initialOpenedSkills` (3ᵉ élément du tuple d'init, pattern `initialSkillAllocations`/
  `initialProAdvantages`).
- Nouvelles actions : `TOGGLE_OPENED_SKILL {skillId}` (T1 solo — toggle indépendant) et
  `SELECT_CHOICE_GROUP_SKILL {careerId, choiceGroup, skillId}` (T3 — remplace toute sélection
  précédente du même groupe pour ce métier, jamais deux actifs à la fois — même logique que le radio
  natif de `BackgroundSelector.jsx:130-144`).
- Nouveau `useEffect` de purge (pattern `:307-313`, `PRUNE_ALLOCATIONS`/`PRUNE_ADV`) :
  `PRUNE_OPENED_SKILLS` sur changement de `selectedCareers` — retire de `state.openedSkills` tout
  skill_id dont la ligne conditionnelle d'origine appartient à un métier retiré.
- `boardSkillIds` (`:246-253`) et `skillAllocationCtx.careers[].skills` (`:256-260`) : le filtre
  `!sk.conditional` devient `!sk.conditional || state.openedSkills.includes(sk.skill_id)`.
- `skillAllocationCtx.openedSkills` (`:263`, actuellement `[]` en dur) → `state.openedSkills`.
- Nouveaux `useEffect` de remontée payload (pattern `:316-322`) : `onOpenedSkillsChange?.(state.openedSkills)`.
- **UI, onglet Métier** (`:522-549`, bloc `groupedSkills`) : les compétences `conditional` de
  `groupedSkills` gagnent un contrôle interactif (au lieu du simple suffixe texte `(au choix)`
  actuel, `:540`) — algorithme de regroupement identique à `BackgroundSelector.jsx:111-119`
  (`choice_group || __solo_${skill_id}`), rendu radio/checkbox identique (`:129-146`).
  **Verrouillé tant que le métier consulté n'est pas `isAdded`** (même UX que l'onglet Avantages pro,
  `career_adv_locked`, `:589-590`) — message dédié sinon.

**i18n (`client/src/locales/creation.json`)** : nouvelles clés `step4.career_choice_title`,
`career_choice_locked`, `career_choice_solo_label` (namespace `creation`, avant usage).

### 7.5 Tests prévus (une fois le point ouvert Médecin tranché)

- Parité : les 10 lignes T1 + les 24 lignes T3 (après migration) donnent le même total de compétences
  « déblocables » qu'avant, juste réorganisées en groupes cohérents.
- Groupe radio : sélection exclusive par `choice_group`, changement de sélection libère l'ancienne.
- Case à cocher isolée : toggle indépendant, ne dépend d'aucune autre ligne.
- `isPro`/coût : une compétence choisie devient professionnelle (`isProSkill` vrai) et rejoint le board
  global avec le bon plafond (`getSkillCap`), sans régression sur P55 (compétences réservées `(X)`).
- Retrait de carrière : purge des choix orphelins (même pattern que `PRUNE_ALLOCATIONS`/`PRUNE_ADV`
  existants).
- Round-trip migration (`up`/`down`) byte-identique sur les 44 lignes, comme 106/118/120.

---

## 8. LOT 6 — Tirage 1D10 (jet réel + animation, narratif uniquement)  [PLAN DÉTAILLÉ]

> Cadrage fait avant code (lecture exhaustive demandée par Saar) : `DicePanel.jsx`, `DiceRoller.jsx`,
> `DiceMesh.jsx`, `diceMath.js`, `Canvas3D.jsx`, `SocketContext.jsx`, `socket/index.js`,
> `socketDice.js`, `CareersAllocator.jsx`, `Step4Experience.jsx`, `shared/careerAdvantages.js`,
> `creationService.js`, `REGLE_PROFESSION.md` (table « Avantages professionnels aléatoires »),
> migrations 93/100/108/112-116/120. Décisions Saar : (1) rendu **visuel réel** (animation du dé),
> pas besoin du panneau flottant `DicePanel` complet puisque le dé à lancer (1D10) est fixé par le
> code — un bouton dédié suffit ; (2) le texte du bénéfice tiré est **narratif uniquement, aucune
> modification automatique de la fiche de personnage**, sauf l'interaction de budget explicitement
> prévue par la règle (« au lieu de » / « ou N points ») ; (3) **aucun retour en arrière** — une fois
> une tranche jetée, le résultat est définitif (pas d'annulation/relance), confirmé Saar.
>
> **Auto-critique faite avant code (relecture ciblée) — 2 défauts bloquants corrigés dans ce plan** :
> lumière manquante sur le dé isolé (§8.0) et mauvais niveau de montage du socket (§8.0/§8.6, aurait
> spammé `SESSION_JOIN`) ; 2 défauts importants corrigés (positionnement CSS de l'overlay, garde
> anti-course sur le jet, §8.6) ; 1 point (`roll===10` codé en dur) rendu 100 % pilotable par la
> donnée. Le point « sync combat au `SESSION_JOIN` » un temps signalé comme non lu a été relu en
> entier (`socket/index.js:97-156`) : confirmé sans effet de bord (gaté sur l'existence d'un token de
> combat, jamais le cas pour un personnage en cours de création).

### 8.0 Réutilisation confirmée (aucun code d'animation à recréer)

- `DiceRoller.jsx` + `DiceMesh.jsx` + `diceMath.js` sont **déjà 100 % autonomes** — zéro dépendance à
  Canvas3D/battlemap/session de jeu, juste `@react-three/fiber` + `@react-three/drei` + GLB publics
  (`/models/D10.glb`). `diceMath.js` est explicitement « zéro import React, zéro accès DB » (fichier
  pur). Réutilisation : monter `<Canvas camera={{position:[15,15,15], fov:60}}><DiceRoller
  payload={...} onDone={...}/></Canvas>` en overlay dans le Wizard — même mécanique que
  `SessionPage.jsx:1109-1110`, sans jamais toucher à Canvas3D lui-même.
- **Lumière — piège vérifié** : `DiceMesh.jsx` (`:336-399`) utilise `THREE.MeshStandardMaterial`
  (PBR), qui rend plat/sombre sans lumière directionnelle. Le rendu correct dans `SessionPage` vient
  du rig de **`Canvas3D.jsx:889-892`** (`ambientLight intensity=0.8` + **2** `directionalLight`), pas
  du `ambientLight intensity=0.4` interne à `DiceRoller` qui n'est qu'un complément ponctuel. Le
  `<Canvas>` isolé du Wizard doit donc reproduire ces 3 lumières — **dupliquées** (3 lignes JSX,
  triviales) dans un petit composant propre au Wizard, **jamais extraites en composant partagé** :
  factoriser obligerait à modifier `Canvas3D.jsx` pour qu'il consomme le composant commun, ce qui
  contredirait « Canvas3D.jsx : zéro modification » (§8.9) — un fichier critique combat/rendu que ce
  lot n'a aucune raison de toucher.
- Le Wizard n'a **aucune connexion socket** aujourd'hui (`WizardCreation.jsx` n'importe pas
  `SocketProvider`). `campaignId` y est déjà disponible (`useParams`, `WizardCreation.jsx:20`) et
  poussé dans `useCreationStore` (`setCampaignId`, `:26,47`) — `Step4Experience.jsx` peut donc lire
  `campaignId` directement depuis le store, sans prop-drilling depuis `WizardCreation`.
  `SESSION_JOIN` (`socket/index.js:38-48`) ne vérifie que l'appartenance à la campagne
  (`campaign_members`) — aucun obstacle à rejoindre la room depuis le Wizard. Sync combat au join
  (`:97-156`, lu en entier) : émet seulement vers le socket qui rejoint, gaté sur l'existence d'un
  token de combat pour ce personnage — jamais le cas en cours de création, confirmé sans effet de bord.
- **Niveau de montage du `SocketProvider` — piège évité** : il doit envelopper `WizardCreation.jsx`
  (le `<div className="wiz-shell">`, jamais démonté pendant tout le Wizard), **pas**
  `CareersAllocator` — ce dernier est démonté/remonté à chaque va-et-vient sur le sous-step Carrières
  (`Step4Experience.jsx` le rend conditionnellement, `:351-376`), ce qui réémettrait `SESSION_JOIN` à
  chaque remontage (rebuild Redis + `SESSION_USER_JOINED` broadcasté aux autres membres de la
  campagne, pour rien). `CareersAllocator` consomme le socket via `useSocket()` (contexte fourni par
  le parent), il ne monte jamais son propre `SocketProvider`.
- **Jamais `Math.random`** (contrairement à `Step3Mutations.jsx:117,140`, tirage D100/D20 en clair
  côté client, accepté en Session 136 mais **explicitement écarté pour ce lot** par Saar) : le jet
  passe par `socket.emit(WS.DICE_ROLL, { formula: '1d10' })` → le serveur (`socketDice.js:16-73`)
  calcule seul le résultat (`parseDice`) et le broadcast (`DICE_RESULT`) — jet non trafiquable,
  cohérent avec `docs/SYSTEME/DICE.md`.
- **`DicePanel.jsx` n'est PAS réutilisé tel quel** (widget flottant multi-dés avec roue/favoris/macros,
  hors-sujet pour un jet unique 1d10 imposé) — seul le mécanisme socket + `DiceRoller` (animation)
  est repris. `DicePanel`/`socketDice.js` restent inchangés.

### 8.1 Trou de données trouvé (même angle mort que la migration 120)

Les **5 carrières du Lot 1** (`artisan_artiste`, `assassin`, `barman`, `chasseur_primes`,
`contrebandier`, seedées `100_seed_ref_careers.js`) n'ont **aucune ligne** dans
`ref_career_random_benefits` — jamais seedée à l'origine (confirmé : aucune occurrence de
`ref_career_random_benefits` dans `100_seed_ref_careers.js` ni `106_fix_ref_career_skills_lot1.js`).
La table « Avantages professionnels aléatoires » existe pourtant dans `REGLE_PROFESSION.md` pour
Artisan/Artiste (lignes 99-119, déjà lues) — à vérifier de la même façon pour les 4 autres carrières
à l'implémentation (audit exhaustif ligne à ligne, méthode 106/118/120/121).

### 8.2 Règle du budget (source, vérifiée 22/22 lignes seedées + 1/1 lue en source = 23/23)

`REGLE_PROFESSION.md:99-102` (et identique sur les 22 autres carrières déjà seedées, grep exhaustif) :
*« Tous les 5 ans, le joueur peut choisir d'effectuer librement un jet d'1D10 dans la liste suivante,
au lieu de répartir ses 5 points d'Avantages professionnels automatiques »*, et le résultat 10 dit
toujours *« Un avantage aléatoire au choix ou **7** points à répartir sur les Avantages professionnels
automatiques »* — texte strictement identique sur les 22 lignes `roll:10` actuellement en base
(migrations 108/112-116) + la ligne Artisan/Artiste lue directement dans la rulebook (23/23,
0 écart). Les 4 carrières Lot 1 restantes seront vérifiées à l'implémentation (probable mais pas
encore lu = `[HYPOTHÈSE]`).

**Conséquence mécanique retenue (seule partie non-narrative de ce lot)** : pour chaque tranche de
5 ans d'un métier retenu (`⌊années/5⌋` tranches), le joueur peut choisir de lancer 1D10 **à la place**
d'allouer manuellement les 5 points de cette tranche dans l'onglet Avantages pro (Lot 4). Choisir le
jet retire 5 pts du budget `computeProAdvantageAllocation` (Lot 4) pour cette tranche ; si le résultat
est 10 **et** que le joueur choisit explicitement l'option « points » (plutôt que le bénéfice
narratif), la tranche rend **7** pts au lieu de 5 (net +2). Aucun autre effet du texte narratif
(compétence, mutation, salaire, Allié/Contact/Célébrité) n'est appliqué automatiquement — ces
notions relèvent du Lot 7 (Relations, pas encore construit) ou restent d'ordre narratif à la table.
Le nombre de points (7) n'est **jamais** envoyé par le client : le serveur le relit dans
`ref_career_random_benefits.points_alt` (nouvelle colonne, §8.3) pour recalculer le budget —
principe déjà appliqué par `socketDice.js` (« le serveur est le seul responsable du calcul »).

### 8.3 Migration `122_ref_career_random_benefits_lot1_and_points_alt.js` (NOUVEAU)

1. `ALTER TABLE ref_career_random_benefits ADD COLUMN points_alt integer NULL` (symétrique aux
   migrations 98/121).
2. `UPDATE ... SET points_alt = 7 WHERE roll = 10` sur les 22 lignes déjà seedées (valeur uniforme
   vérifiée §8.2).
3. INSERT des ~50 lignes manquantes (5 carrières × 10, à confirmer ligne à ligne contre
   `REGLE_PROFESSION.md` avant écriture, comme 106/118/120/121) pour `artisan_artiste`, `assassin`,
   `barman`, `chasseur_primes`, `contrebandier`, `points_alt=7` sur leur ligne `roll=10` (à vérifier,
   pas supposé).
4. `down()` : `DROP COLUMN points_alt` + suppression des lignes insérées (les 22 lignes existantes ne
   sont pas supprimées, seul `points_alt` repasse `NULL`). Round-trip `up`/`down`/`up` testé en base
   réelle, byte-identique (P53/P54 respectés — vérifier `knex_migrations` avant tout rappel manuel).

### 8.4 Backend — `server/src/services/creationService.js`

- `getStep4RefData` (`:130-169`) : nouveau fetch `db('ref_career_random_benefits').select('*')
  .orderBy(['career_id','roll'])`, nouvelle entrée `randomBenefits: []` dans `careersMap` (pattern
  identique à `titles`/`prerequisites`/`pointCategories`), boucle de push symétrique. Route inchangée.
- `reconcileCreation` STEP4 (zone `:378-400`, avant l'insert `char_careers`) : pour chaque carrière
  retenue, valider `career.randomPicks` (défaut `[]`) — chaque entrée `{ blockIndex, roll,
  useAsPoints }` : `blockIndex` entier dans `[0, ⌊years/5⌋ − 1]`, `roll` doit correspondre à une ligne
  `ref_career_random_benefits` existante pour ce `career_id`, au plus un pick par `blockIndex`
  (rejet sinon), `useAsPoints` autorisé seulement si la ligne trouvée a `points_alt` non nul.
  Violation → `AppError(400, ...)`. Puis calcul de `randomBudgetDelta` via
  `computeRandomBudgetDelta(career.randomPicks, benefitRowsDeCetteCarriere)` (§8.5), injecté dans
  l'appel existant à `computeProAdvantageAllocation` (Q3) avant validation du budget.
  `random_picks: JSON.stringify(career.randomPicks || [])` (déjà présent `:398`) — inchangé, mais
  désormais persisté après validation au lieu d'être pris tel quel.

### 8.5 `shared/careerAdvantages.js` — nouvelle fonction pure

```js
computeRandomBudgetDelta(picks, benefitRows) → number
// Σ sur picks : -5 par pick valide, +row.points_alt si pick.useAsPoints && row.points_alt != null
```
Fonction pure sans accès DB, réutilisée client (UI live) et serveur (validation) — jamais deux
implémentations divergentes (même pattern que `computeSkillAllocation`/`computeProAdvantageAllocation`
existants). `computeProAdvantageAllocation` (`:11-38`) gagne un paramètre `ctx.randomBudgetDelta`
(défaut 0) additionné à `budget` — **aucun changement** de signature pour les appelants existants qui
ne le passent pas (rétro-compatible, Lot 4 non affecté hors carrières utilisant le Lot 6).

### 8.6 Client — `CareersAllocator.jsx`

- Reducer : nouveau champ `randomPicks` (map `career_id → [{blockIndex, roll, useAsPoints}]`), init
  4ᵉ élément du tuple (`initialRandomPicks`, pattern `initialProAdvantages`/`initialOpenedSkills`).
  Nouvelles actions `SET_RANDOM_PICK {careerId, blockIndex, roll}`, `TOGGLE_RANDOM_POINTS {careerId,
  blockIndex}` (n'agit que si la ligne a `points_alt`), `PRUNE_RANDOM_PICKS` (purge au retrait de
  carrière, pattern `PRUNE_ADV`). Aucune action d'annulation/relance (confirmé Saar : un jet est
  définitif) — pas de `CLEAR_RANDOM_PICK`.
- `advResult`/`allAdvSpent` (`:220-236`) : `ctx` de `computeProAdvantageAllocation` gagne
  `randomBudgetDelta: computeRandomBudgetDelta(state.randomPicks[career.id] ?? [], career.
  randomBenefits ?? [])`.
- **Nouveau bloc UI**, dans l'onglet `avant` (`:671-709`), seulement si `(career.pointCategories ??
  []).length > 0 && isAdded` : section « Tirage 1D10 » listant `⌊committedEntry.years/5⌋` tranches.
  Par tranche non jetée : bouton « Lancer 1D10 ». Une fois jetée : valeur + texte narratif de
  `career.randomBenefits` + mention fixe **« Narratif — n'affecte pas automatiquement la fiche de
  personnage »** ; bascule « Convertir en 7 points d'Avantages pro » affichée uniquement si la ligne
  tirée a `points_alt != null` (**jamais** un test en dur `roll===10` — 100 % piloté par la donnée, au
  cas où une des 4 carrières Lot 1 pas encore lues placerait l'option ailleurs). Cette bascule seule
  modifie le budget affiché immédiatement ; le texte narratif des 9 autres résultats ne modifie rien.
- **Garde anti-course sur le jet** : nouveau champ reducer `awaitingRandomRoll` (`{careerId,
  blockIndex}` ou `null` — dans le `useReducer`, pas un `useState` séparé, cohérent avec le reste de
  l'état transitoire du composant, ex. `hoverCareerId`). Nouvelle action `SET_AWAITING_ROLL
  {careerId, blockIndex}`. Au clic sur « Lancer 1D10 », tous les autres boutons de tranche (même
  carrière et autres carrières) sont désactivés tant que `awaitingRandomRoll` n'est pas `null`, pour
  éviter qu'un double-clic ou qu'un jet lancé ailleurs par le même joueur (autre onglet, chat `/r`) au
  même instant ne soit attribué par erreur à la mauvaise tranche. `careerId`/`blockIndex` sont capturés
  dans `awaitingRandomRoll` **au moment de l'émission** et jamais re-dérivés de « la carrière
  actuellement sélectionnée » à la résolution du résultat — l'overlay plein écran (ci-dessous) bloque
  déjà tout changement de sélection pendant l'affichage, mais la résolution reste explicitement liée à
  la tranche capturée, pas à l'état courant de l'UI.
- Mécanique du jet : socket obtenu via `useSocket()` (`SocketContext.jsx`, fourni par le
  `SocketProvider` monté dans `WizardCreation.jsx` — voir §8.0, `CareersAllocator` ne monte jamais son
  propre `SocketProvider`) — au clic : `socket.emit(WS.DICE_ROLL, { formula: '1d10' })`, écoute du
  prochain `DICE_RESULT` pour `userId === user.id` (tant que `awaitingRandomRoll` n'est pas `null`),
  puis monte l'overlay `<Canvas><DiceLights/><DiceRoller payload={...} onDone={...}/></Canvas>`
  (`DiceLights` = petit composant local dupliquant les 3 lumières, voir §8.0).
  **Overlay en `position: fixed; inset: 0` + z-index au-dessus du reste du Wizard** (le plan cliquable
  « fermer n'importe où » de `DiceRoller` capte les clics dans les limites du `<canvas>` — doit donc
  couvrir tout le viewport, pas juste la zone du bouton). À la fermeture (clic, comportement natif
  `DiceRoller`), résultat mappé et persisté dans `state.randomPicks`, `awaitingBlockIndex` remis à
  `null`.
- Nouvelles props : `initialRandomPicks`, `onRandomPicksChange` (pas de prop `campaignId` — le socket
  vient du contexte `SocketProvider`, pas d'un prop-drilling supplémentaire).

### 8.7 Client — `WizardCreation.jsx` et `Step4Experience.jsx`

- **`WizardCreation.jsx`** : enveloppe le rendu principal (`<div className="wiz-shell">`,
  `:124-...`) dans `<SocketProvider campaignId={campaignId}>` (import `../../lib/SocketContext.jsx`).
  Montée une seule fois pour toute la durée du Wizard (jamais démontée entre les steps/sous-steps) —
  voir §8.0 pour la raison (éviter le spam `SESSION_JOIN` si le montage était plus bas dans l'arbre).
  Aucun autre changement à ce fichier.
- **`Step4Experience.jsx`** : nouveau `useState randomPicks` (init `initialData?.randomPicks ?? {}`),
  `handleRandomPicksChange` (pattern `handleProAdvantagesChange`).
  `buildPayload()` (`:166-188`) : `careerEntries` gagne `randomPicks: randomPicks[c.career_id] || []`.
  `<CareersAllocator>` (`:352-375`) : nouvelles props `initialRandomPicks={randomPicks}`,
  `onRandomPicksChange={handleRandomPicksChange}` (pas de `campaignId` à transmettre, cf. §8.6).

### 8.8 i18n (`client/src/locales/creation.json`)

Nouvelles clés `step4.career_random_title`, `career_random_block`, `career_random_roll_btn`,
`career_random_rolling`, `career_random_narrative_note`, `career_random_points_toggle`,
`career_random_points_label` (namespace `creation`, ajoutées avant usage).

### 8.9 Ce qui NE change PAS

Schéma `char_careers` (`random_picks` déjà présent, migration 96) ; architecture « pool plat » du
Lot 4 (pas de sous-pools par tranche, juste un delta agrégé) ; `DicePanel.jsx`/`socketDice.js`/
`Canvas3D.jsx` (zéro modification, réutilisés tels quels) ; onglets Métier/Carrière, board
compétences global.

**Dette documentée (pas bloquante pour ce lot)** : aucun écran fiche personnage ne relit
`char_careers.random_picks` après la création — le texte narratif tiré est stocké mais invisible une
fois le Wizard terminé (aucune UI ne le consomme aujourd'hui). Relève probablement du futur panneau
« Carrières » de la fiche perso (Lot 7 ou ultérieur), pas de ce lot.

### 8.10 Tests prévus

- `computeRandomBudgetDelta` isolé (`node -e`) : 0 pick → 0 ; 1 pick normal → −5 ; 1 pick roll=10 +
  `useAsPoints` → +2 (7−5) ; 2 picks → −10 ; `useAsPoints` sur une ligne sans `points_alt` → ignoré/
  rejeté.
- Migration 122 : round-trip `up`/`down`/`up` byte-identique (colonne + 5 carrières), vérification
  `knex_migrations` avant tout rappel manuel (P53/P54).
- `reconcileCreation` : rejet si `blockIndex` hors bornes, `roll` inconnu pour la carrière, doublon de
  `blockIndex`, `useAsPoints` sans `points_alt`.
- SR + parcours navigateur : clic bouton → animation 3D réelle du dé (lumière correcte, pas de rendu
  terne) → overlay fermable en cliquant n'importe où sur l'écran (pas seulement sur le canvas) →
  résultat affiché avec mention narrative → toggle points affiché seulement si `points_alt` présent →
  budget Avantages pro recalculé visible immédiatement → purge au retrait de la carrière →
  persistance `random_picks` vérifiée en base après `reconcileCreation` réel.
- Navigation Précédent/Suivant entre sous-steps de Step4 pendant qu'un métier est retenu : une seule
  connexion socket (un seul `SESSION_JOIN`/`SESSION_USER_JOINED`), pas de reconnexion à chaque
  va-et-vient sur le sous-step Carrières (vérifie que le `SocketProvider` est bien monté dans
  `WizardCreation`, pas plus bas).
- Double-clic rapide sur deux boutons « Lancer 1D10 » (même carrière ou deux carrières) : un seul jet
  en vol à la fois, les autres boutons désactivés tant que `awaitingRandomRoll` n'est pas `null`.

---

## 9. LOT 7 — Relations (fiche perso)

- **Investigation requise** : `char_traits` (jsonb `params`) vs nouvelle table/colonnes. Décision
  Saar : jauge numérique (entier, conversion pts→PNJ à discrétion GM) + champ TEXT libre + lien
  optionnel vers fiche PNJ.
- Fréquences source : `contact_frequency`, `ally_frequency`, `opponent_frequency`, `enemy_rule`.
- Touche : `CharacterWindow.jsx` (affichage fiche perso) + section wizard + persistance (probable
  migration). Plan détaillé à rédiger au lancement du lot.

---

## 10. LOT 8 — Matériel accessible

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
| 5 — « Au choix » | ✅ (§7) | ✅ | ✅ SR + fonctionnel |
| 6 — Tirage 1D10 | ✅ (§8) | — | — |
| 7 — Relations | — | — | — |
| 8 — Matériel | — | — | — |
