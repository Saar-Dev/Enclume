# PLAN_REWORKFINAL — Redesign Step 4 · Sous-step PROFESSIONS
> Session 139 — 2026-07-07 · Master plan multi-lots (séquentiel)

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
(jsonb, Lot 2), `random_picks` (jsonb, Lot 4), `setbacks` (jsonb, réserve), + `char_skills` via
`skillAllocations`/`openedSkills`.

Payload actuel (`Step4Experience.buildPayload`) envoie seulement : `career_id, career_name, titles,
years, skillAllocations`. Manquent (à ajouter par lot) : `proAdvantages` (L2), `openedSkills` (L3),
`randomPicks` (L4).

---

## 2. DÉCOUPAGE EN LOTS

| Lot | Titre | Statut |
|---|---|---|
| 1a | Squelette layout + rail + barre d'âge + détail (onglet Métier) + nav | à planifier en détail → **prochain** |
| 1b | Board compétences global (agrégation + provenance + stepper cap+3 + gating) | cadré |
| 1c | Onglet Carrière & économies (table titres/salaires + cumul, lecture seule) | cadré |
| 2 | Avantages pro (5 pts/an → `pro_advantages`) | cadré |
| 3 | Compétences « au choix » (`conditional` → radios → `openedSkills`) | cadré |
| 4 | Tirage 1D10 via DicePanel (`ref_career_random_benefits` → `random_picks`) | cadré |
| 5 | Relations (champs fiche perso : entier + texte + lien PNJ + persistance) | à investiguer |
| 6 | Matériel accessible (inventaire + menu GM création objets) | à investiguer |

---

## 3. LOT 1a — Squelette + rail + barre d'âge + onglet Métier  [PLAN DÉTAILLÉ]

**Décisions verrouillées** : skin **Option A** (wiz premium). Classes **`.wiz4-*`** (cohérent avec
`.wiz3-*`), dans `index.css` Section 12. Variables `--wiz-*` disponibles car Step4 est rendu sous
`.wiz-shell` (index.css:1812-1825, déclare toutes les `--wiz-*`). Couleur d'hexagone = **HSL
déterministe dérivée de `career.code`** (hash → teinte) — réutilisée par les tags de provenance (1b).

**Objectif** : coquille visuelle + flux « sélectionner → consulter → ajouter/retirer » un métier,
sur données déjà fonctionnelles. Pas de board d'allocation (1b), onglet Carrière = table économies
(1c, hors 1a → coquille), onglet Avantages = coquille (Lot 2).

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
      (`baseAge`+Σyears, `.hi`) / Économies de départ (`.gold`, estimation via helper) + note
    - `.wiz4-detail` (si `career`) : `.wiz4-illus` (img asset), titre, `.wiz4-drang`
      (débute `eco` · rang · débloque N compétences), desc, `.wiz4-dactions` (stepper années −/＋ +
      bouton Ajouter/Retirer)
    - `.wiz4-tabs` (Métier | Carrière & économies | Avantages pro)
    - `.wiz4-tabbody` : onglet Métier = `.wiz4-geo` (origine géo) + `.wiz4-groups` (par famille →
      `.wiz4-grplbl` + chips) ; onglets Carrière/Avantages = `.wiz4-note` « à venir »
    - `.wiz4-foot` : Précédent / `.wiz4-status` / Suivant

**État local (`useState`)** : `filter` ('all'|'eligible'), `selectedCareerId`, `years`,
`activeTab` ('metier'|'carriere'|'avant'), `hoverCareerId` (posé mais inerte en 1a, consommé en 1b).

**Helpers** :
- `careerHexColor(code)` → `hsl(hash % 360, 55%, 55%)` déterministe.
- `getTitleForYears(titles, years)` (existe déjà l.30-33, conservé) → rang courant.
- `estimateSavings(career, years)` → Σ par bande de titre : `salary_per_year × nbAnnées` ;
  bandes en `salary_formula` (aléatoire) marquées → note astérisque (le montant réel = backend
  au finalize). Utilisé par la barre d'âge (1a) et l'onglet économies (1c).

**Handlers (inventaire exhaustif)** :
| Élément | Handler | Comportement |
|---|---|---|
| Segment Tous | `setFilter('all')` | filtre off |
| Segment Accessibles | `setFilter('eligible')` | exclut `restricted_geographic_origin` |
| Ligne rail (clic) | `handleSelectCareer(id)` | toggle sélection ; reset `years=1`, `activeTab='metier'` |
| Ligne rail (hover) | `setHoverCareerId(id/null)` | inerte 1a (préparé 1b) |
| Onglet ×3 | `setActiveTab(k)` | change onglet |
| Stepper − / ＋ | `setYears(y∓1)` | borné 1..min(50, remainingPC) |
| Ajouter | `handleAdd()` | `onAdd(id,name,titles,years,{})` puis reset (skillAllocs vide en 1a) |
| Retirer | `onRemove(index)` | via props (retrait du métier retenu) |
| Précédent | `onPrev()` | props |
| Suivant | `onNext()` | actif si `selectedCareers.length>0` (gating skills = 1b) |

**Compat props** : signature `CareersAllocator` conservée + ajout `baseAge`. `pcDispo,
selectedCareers, careers, onAdd, onRemove, onNext, onPrev, selected*Item` inchangés.

**Clés i18n à ajouter** (`step4.*`) : `career_filter_all`, `career_filter_eligible`,
`career_tab_metier`, `career_tab_carriere`, `career_tab_avant`, `career_tab_soon`,
`career_age_start`, `career_age_years`, `career_age_current`, `career_age_savings`,
`career_age_note`, `career_geo_origin`, `career_skills_pro`, `career_years_in`, `career_retained`,
`career_restricted`, `career_starts`, `career_unlocks_skills`, `career_eco_estimate_note`.
(`career_add`, `career_remove`, `career_none`, `prev`, `next` existent déjà.)

**Ce qui NE change PAS** : `Step4Experience` (hors ajout `baseAge`), backend, payload, autres
sous-steps, autres composants wizard.

**Tests 1a** : SR sans erreur ; sélection carrière (surbrillance rail + détail) ; filtre Tous/
Accessibles (⚠ restreints masqués en Accessibles) ; stepper années borné ; Ajouter → badge Retenu +
bouton Retirer + carrière dans `selectedCareers` ; Retirer → retour état ; onglet Métier affiche géo
+ compétences groupées ; onglets Carrière/Avantages = coquille « à venir » ; barre d'âge cohérente ;
nav Précédent/Suivant (Suivant actif dès 1 métier retenu) ; ESLint 0 erreur.

---

## 4. LOT 1b — Board compétences global

- Section `.wz4-board` sous le détail : agrégation de TOUTES les compétences des métiers retenus +
  celles du métier en cours de consultation, groupées par famille (`.wz4-bgrp`, label sticky).
- Chaque ligne `.wz4-skill` : label, **tags de provenance** `.wz4-provtag` (un par métier/origine
  qui apporte la compétence, couleur du métier), base (maîtrise backgrounds), stepper +/- , total.
- Logique d'agrégation : réutiliser/adapter le `allSkills` (useMemo) actuel (`CareersAllocator.jsx:
  62-103`) — il agrège déjà géo/soc/formation/études + métiers retenus + métier courant.
- Règles : pool = Σ(`points_per_year`×années) des métiers retenus ; **cap +3** par compétence
  (à confirmer vs `REGLE_CREATION.txt`) ; seules les compétences du métier courant sont allouables
  (surbrillance `.wz4-skill.hl` au survol d'un métier du rail) ; verrou `.locked` sinon.
- **Gating** `.wz4-status` : « ajoute un métier » / « reste N pts » / « ✓ tout réparti ».
- Clés i18n : `career_board_title`, `career_board_hint`, `career_points_remaining`,
  `career_status_none`, `career_status_skills_left`, `career_status_ok`, `career_provenance_origin`.
- Tests : alloc +/- respecte pool + cap ; provenance correcte ; gating bloque Suivant tant que
  pts>0 ; retrait métier réconcilie l'alloc.

---

## 5. LOT 1c — Onglet Carrière & économies (lecture seule)

- Table `.wz4-prog` : Années | Titre | Économies, ligne courante surlignée (`.cur`) selon `years`.
- Encadré `.wz4-ecobox` : économies cumulées sur N années + note (formule aléatoire → astérisque).
- Données : `career.titles[]`. Salaire : `salary_per_year` sinon `salary_formula` marquée aléatoire
  (calcul réel = backend `evaluateSalaryFormula`, `shared/polarisUtils.js:175`, format `\d+D\d+\*\d+`).
- Clés i18n : `career_prog_years`, `career_prog_title`, `career_prog_savings`, `career_eco_cumul`,
  `career_eco_note_random`, `career_eco_note_fixed`.
- Tests : table correcte par carrière ; ligne courante suit le stepper années ; cumul cohérent.

---

## 6. LOT 2 — Avantages pro (5 pts/an)

- Onglet Avantages pro : liste `point_categories` du métier + stepper d'allocation ; pool =
  5 × années ; « N pts à placer » ; verrouillé tant que le métier n'est pas ajouté.
- Payload : ajouter `proAdvantages` (map catégorie→pts) dans `handleAddCareer` +
  `Step4Experience.buildPayload` → `career.proAdvantages` (backend `char_careers.pro_advantages`
  déjà géré).
- Gating global : « reste N pts d'avantages à placer » avant Suivant.
- Tests : alloc respecte 5×années ; persistance vérifiée en base après finalize.

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
| 1a | — | — | — |
| 1b | — | — | — |
| 1c | — | — | — |
| 2 | — | — | — |
| 3 | — | — | — |
| 4 | — | — | — |
| 5 | — | — | — |
| 6 | — | — | — |
