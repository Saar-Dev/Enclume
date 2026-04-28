# JOURNAL CHANTIER — Fiche Personnage Polaris
> Mémoire externe du chantier "character" — indépendant du JOURNAL.md d'Enclume
> Dernière mise à jour : 2026-04-15 — Session 2 (complète)

---

## Contexte

Projet intégré dans Enclume. Deux domaines distincts dans le même monorepo :
- Domaine VTT (existant) : cartes, voxels, tokens, sessions, temps réel
- Domaine Character (nouveau) : fiche perso, compétences, inventaire, bourse, marchands, crafting, initiative, combat

Ces modules existaient en HTML/JS vanilla connectés à Google Sheets.
**Objectif : tout migrer dans Enclume** — PostgreSQL remplace Google Sheets comme pivot central.

Lien entre domaines : base PostgreSQL partagée + auth JWT partagée.
Lien technique : `character_id` (UUID) remplace le `fid` Google Sheets dans tous les modules.

Le développeur des modules joueur sera impliqué. La fiche perso est sa "porte d'entrée" —
une fois l'API disponible, il remplace ses appels Google Sheets par des appels API Enclume.

---

## Sources de vérité

| Source | Contenu |
|---|---|
| `Fiche_Polaris_Online_-_Vierge.xlsx` onglet Personnage | Structure visuelle et règles de calcul |
| `Fiche_Polaris_Online_-_Vierge.xlsx` onglet Compétences | Catalogue complet des compétences (structure cols A-G) |
| `FichePerso_v4.txt` | Documentation de conception Modules 1 à 6 (incohérences connues, résolues dans ce journal) |
| Ce journal | Décisions prises, questions résolues, plan arrêté — **source de vérité finale** |

---

## Structure de fichiers — décision arrêtée

```
Enclume/
  client/
    src/
      [existant intact — domaine VTT]
      character/        — nouveau domaine, composants React fiche perso
  server/
    src/
      [existant intact — domaine VTT]
      routes/
        character/      — nouvelles routes Express fiche perso
      db/
        migrations/     — migrations existantes (001-032) + nouvelles préfixées char_
```

**Pourquoi `character/` dans `src/` et pas à la racine :**
Vite (client) et Node/Express (server) ont `src/` comme point d'entrée.
Placer `character/` en dehors de `src/` rendrait les fichiers invisibles sans bricolage de config.

**Pourquoi on ne renomme pas l'existant en `vtt/` :**
Trop risqué — tous les imports seraient à mettre à jour sur un projet de 32 migrations stables.
Convention adoptée : le nouveau code va dans `character/`, l'ancien reste en place.
Migration progressive possible quand une zone est de toute façon modifiée.

---

## Ce qui est compris et validé

### Structure de l'onglet Compétences (Excel)
Colonnes : A=famille, B=nom parent, C=nom enfant (sous-compétence), D=marqueur, E=attributs (ex: COO/PER), G=description.
Certaines compétences ont plusieurs sous-entrées (ex: Arts martiaux > Lutte / Tech. défensives / Tech. offensives).
Certaines ont plusieurs variantes d'attributs (ex: Armes Spéciales en FOR/COO et en COO/COO = deux entrées BDD distinctes).

### Calcul score Base d'une compétence
`Base = AN(attr_1) + AN(attr_2)`. Si un seul attribut : `AN(attr) + AN(attr)` (doublé).

### Calcul Niveau Actuel (na) d'un attribut
`na = (base_level + pc_modifier + mod_genotype) - TOTAL_MALUS`
Plancher : `if (na < 3) na = 3`
Puis mapping na → AN via table de correspondance (objet JS statique).

### Modificateur génotype
Tiré de `ref_genotypes` selon le génotype choisi. 4 génotypes V1 : HUMAIN, HYB_NAT, TEC_HYB, GEN_HYB.

### Malus global
Ignoré en V1 (TOTAL_MALUS = 0). Viendra des modules armures/blessures futurs.

### Attributs secondaires — pas de table SQL
Tout calculé côté JS. Formules :
- REA = (ADA + PER) / 2
- Initiative = REA (valeur brute)
- Seuil Étourdissement = (FOR + CON + VOL) / 3
- Seuil Inconscience = Seuil_Étour + 10
- Vitesse Marche = (FOR + COO + ADA) / 3
- Vitesse Course = Marche × 2
- Mod_Dom : table fixe si FOR <= 21, sinon 5 + floor((FOR - 21) / 2)
- Arrondi Polaris : 0.5 arrondi vers le bas (ex: 16.5 → 16)

### Colonne S dans les compétences
Flag "Spécialisée". Ignoré en V1.

### Table `characters` existante dans Enclume
Contient uniquement les données techniques du token 3D. Aucune donnée Polaris dedans.
Le lien : `char_sheet.character_id → characters.id (UUID)`.

### Nom du personnage — deux champs distincts
- `characters.name` dans Enclume = nom court du token (ex: "Soleil")
- `char_identity.char_name` dans la fiche = nom officiel complet (ex: "Wayde SR-4476")
Ces deux champs sont indépendants et peuvent différer. Pas de doublon.

### Accès à la fiche
Lecture et écriture : joueur propriétaire (`characters.user_id`) OU rôle GM.

---

## Décisions d'architecture

- **PostgreSQL uniquement** — pas de SQLite, pas de standalone.
- **Composant React intégré** dans Enclume — pas d'iframe HTML.
- **Approche itérative** — module par module, pas tout d'un coup.
- **Pas de table `characters` recréée** — FK vers l'existante.
- **Migrations format `.js`** comme le reste d'Enclume (convention P30).
- **UUID partout** sauf exceptions documentées.
- **Données statiques de référence** (génotypes, compétences) : stockées en BDD.
- **Calculs** : côté client JS uniquement — le serveur ne calcule rien.
- **`pc_modifier`** : valeur agrégée en V1. Historique XP = module futur séparé.
- **`char_attributes`** : format ligne par ligne (une ligne par attribut par personnage).
- **`ref_genotypes`** : une colonne par attribut — une ligne par génotype.
- **`ref_skill_requirements`** : table séparée (one-to-many).
- **Route `GET /api/char-ref/skills`** : double SELECT + regroupement JS, prérequis imbriqués (Option B — eager loading). Décidé Session 2.
- **Sauvegarde champs numériques** : debounce 500ms dans `onChange` — pas de `onBlur`. `onBlur` sur champs texte uniquement. Décidé Session 2 après diagnostic Firefox.
- **BDD master** : `ref_skills`, `ref_genotypes` partagées entre toutes les campagnes, modifiables admin uniquement. Interface admin à prévoir en session future.

---

## Schéma SQL validé — V1

### Tables de référence (statiques)

**`ref_genotypes`**
```
id          TEXT PK        — 'HUMAIN', 'HYB_NAT', 'TEC_HYB', 'GEN_HYB'
label       TEXT           — nom affiché
mod_for     INT DEFAULT 0
mod_con     INT DEFAULT 0
mod_coo     INT DEFAULT 0
mod_ada     INT DEFAULT 0
mod_per     INT DEFAULT 0
mod_int     INT DEFAULT 0
mod_vol     INT DEFAULT 0
mod_pre     INT DEFAULT 0
```

**`ref_skills`**
```
id          TEXT PK        — ex: 'ACROBATIE', 'ARTS_MARTIAUX_LUTTE'
family      TEXT           — 'Physique', 'Combat', 'Mental'...
label       TEXT           — nom affiché
parent      TEXT           — NULL si pas de parent, sinon ex: 'ARTS_MARTIAUX'
attr_1      TEXT           — 'FOR', 'COO'...
attr_2      TEXT           — NULL si attr_1 x2
marker      TEXT           — valeurs officielles : NULL | '(-3)' | '(X)' | 'PN' | 'S'
description TEXT           — tooltip affiché sur la fiche
```

**`ref_skill_requirements`**
```
skill_id    TEXT FK→ref_skills.id
type        TEXT           — 'SKILL_MIN', 'MUTATION', 'GENOTYPE'
value       TEXT           — ex: 'INFORMATIQUE' ou 'MUT_QUEUE'
threshold   INT            — valeur minimale requise
PK(skill_id, type, value)
```

### Tables personnage (dynamiques)

**`char_sheet`** — table pivot
```
id              UUID PK DEFAULT gen_random_uuid()
character_id    UUID FK→characters.id ON DELETE CASCADE
chc             INT DEFAULT 11
created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
```

**`char_identity`**
```
char_sheet_id       UUID PK FK→char_sheet.id ON DELETE CASCADE
player_name         TEXT
char_name           TEXT
height              NUMERIC(4,1)
weight              NUMERIC(5,1)
skin                TEXT
eyes                TEXT
hair                TEXT
build               TEXT
distinctive_signs   TEXT
hand_pref           TEXT           — 'R', 'L', 'A'
```

**`char_archetype`**
```
char_sheet_id   UUID PK FK→char_sheet.id ON DELETE CASCADE
genotype_id     TEXT FK→ref_genotypes.id
age             INT
sex             TEXT
is_fertile      BOOLEAN DEFAULT FALSE
origin_geo      TEXT
origin_soc      TEXT
training_base   TEXT
higher_ed       TEXT
```

**`char_attributes`**
```
char_sheet_id   UUID FK→char_sheet.id ON DELETE CASCADE
attr_id         TEXT           — 'FOR','CON','COO','ADA','PER','INT','VOL','PRE'
base_level      INT NOT NULL DEFAULT 7
pc_modifier     INT DEFAULT 0
PK(char_sheet_id, attr_id)
```

**`char_skills`**
```
char_sheet_id   UUID FK→char_sheet.id ON DELETE CASCADE
skill_id        TEXT FK→ref_skills.id
mastery         INT DEFAULT 0
is_learned      BOOLEAN DEFAULT FALSE
PK(char_sheet_id, skill_id)
```

### Ce qui n'existe pas en base (calculé JS uniquement)
- Modificateur génotype, Niveau actuel (na), Aptitude Naturelle (AN)
- Score Base compétence, Total compétence
- Tous les attributs secondaires (REA, Initiative, seuils, vitesses, Mod_Dom)

---

## Périmètre V1

### Dans le scope
- Module 1 : Identité ✅
- Module 2 : Archétype / Génotype ✅
- Module 3 : Attributs primaires (8 + Chance) ✅
- Module 4 : Attributs secondaires (calcul JS) ✅
- Module 5 : Compétences (affichage + calcul + saisie maîtrise) ✅
- Tables de référence : ref_genotypes, ref_skills, ref_skill_requirements ✅

### Hors scope V1
- Colonne S (spécialisations)
- Module 6 : Mutations & Pouvoirs Polaris
- Malus global, Armures, Blessures, Munitions, Inventaire, Argent, XP historique

---

## Historique des sessions

### Session 1 — 2026-04-14
Phase apprentissage/compréhension + décisions d'architecture complètes.
26 questions posées, toutes répondues.
Découverte tardive de l'écosystème complet (7 modules JS, Google Sheets comme pivot).
Décision : tout migrer dans Enclume, Google Sheets abandonné.
Structure de fichiers arrêtée. Schéma SQL validé.
Aucun code produit.
Prochaine étape : répondre Q20+Q21 puis migrations SQL.

---

## Session 1 — suite (même journée)

### Migrations produites et appliquées ✅
- `33_char_ref_genotypes.js` — table + seed 4 génotypes
- `34_char_ref_skills.js` — table vide (seed manuel à prévoir)
- `35_char_ref_skill_requirements.js` — table vide (seed manuel à prévoir)
- `36_char_sheet.js` — 5 tables dynamiques (char_sheet, char_identity, char_archetype, char_attributes, char_skills)
- Batch 13 — 4 migrations — SR OK

### Routes API produites et validées ✅
- `server/src/routes/character/char-sheet.js` — 7 routes
- `server/src/index.js` — 2 lignes ajoutées (import + montage)
- SR OK

### Règle générale actée
Toujours privilégier le robuste au rapide. Pas de solution rapide, pas de rework.

### Prochaine étape
Composant React — `client/src/character/` — fiche personnage V1.
Périmètre : Modules 1+2+3+4 (identité, archétype, attributs, attributs secondaires).
Module 5 (compétences) après validation des modules précédents.

---

## Session 1 — suite (même journée, suite)

### CharacterWindow produite et validée ✅
- `client/src/character/CharacterWindow.jsx` — fenêtre flottante extraite de Sidebar
- Drag header + resize coin bas-droite — handlers stables via refs miroirs (correction à-coups)
- Onglets : Feuille / Bio & Info / Paramètres
- Illustration déplacée dans Bio & Info
- Montée dans SessionPage comme DicePanel
- SR + test fonctionnel OK

### Routes de référence produites et validées ✅
- `server/src/routes/character/ref.js` — GET /api/char-ref/genotypes
- SR OK

### CharacterSheet produite et validée ✅
- `client/src/character/CharacterSheet.jsx` — Modules 1+2+3+4
- Chargement + création automatique de fiche au montage
- Module 1 : identité, description physique
- Module 2 : archétype, génotype (dropdown depuis API), biographie
- Module 3 : tableau attributs — base éditable, modif génotype calculé, PC éditable, na calculé, AN calculé
- Module 4 : attributs secondaires tous calculés (REA, Initiative, seuils, vitesses, Mod_Dom)
- Sauvegarde au blur — pattern cohérent avec CharacterWindow
- SR + test fonctionnel OK — calculs et sauvegarde validés

### Règle actée cette session
Jamais hardcoder des données qui existent en BDD — même si on les connaît toutes.

### Prochaine étape
1. Seed `ref_skills` (fichier préparé par le développeur — format à confirmer)
2. Module 5 : Compétences — affichage + calcul Base + saisie Maîtrise
3. Mise à jour documentation FichePerso (doc de conception à réécrire proprement)

Problèmes identifiés :

14 labels corrompus en base — caractère \uFFFD (U+FFFD) en fin de label, remplace probablement †
14 IDs avec _ final — remplace probablement le † du label officiel
ref_skill_requirements vide — seed jamais effectué
MAJ.js généré par IA — données inventées, à jeter, ne pas utiliser
Mutation "Instabilité moléculaire" absente de mutation_bdd.js
Source de vérité confirmée : ExtractSKILL.xlsx colonne F

IDs corrompus identifiés :
BUREAUCRATIE_, CARTOGRAPHIE_, CRYPTOGRAPHIE_, NAVIGATION_, RECHERCHE_DINFORMATIONS_, STRATEGIE_, CHIRURGIE_, ELECTRONIQUE_, FALSIFICATION_, INFORMATIQUE_, MECANIQUE_, PIRATAGE_INFORMATIQUE_, ELOQUENCE_PERSUASION_, SCIENCES_CONNAISANCES_SPECIALISEES_ARMES_SYSTEMES_DARMEMENT
Migrations concernées : 34 (table), 37 (seed) — toutes deux appliquées.

---

## Session 2 — 2026-04-15

### Contexte de démarrage
Migrations 37-39 déjà appliquées en base (corrections IDs ref_skills, seed ref_skill_requirements).
Pièges PC7-PC12 documentés. BDD propre. Module 5 prêt à coder.

### Décisions d'architecture prises cette session

**Route `GET /api/char-ref/skills` — Option B (eager loading)**
Prérequis imbriqués dans chaque skill : `{ ...skill, requirements: [...] }`.
Double SELECT + regroupement JS côté serveur. Les prérequis sont des attributs des compétences,
pas des entités indépendantes — Option B canonique pour ce cas.

**BDD master (pas de BDD par campagne)**
`ref_skills` et `ref_genotypes` partagées entre toutes les campagnes.
Modifiables par admin uniquement. Interface admin à prévoir en session future (pas urgente).
En attendant : GM peut modifier directement en BDD pour les tests.

**Sauvegarde champs numériques : debounce 500ms**
`onBlur` sur `<input type="number">` non fiable dans Firefox (spinners ne déclenchent pas onBlur
de manière cohérente). Pattern pro standard : debounce 500ms dans `onChange`.
`onBlur` conservé uniquement sur les champs texte (identity, archetype).
Refs miroirs (`attrsRef`, `localMasteryRef`) mises à jour synchroniquement dans `onChange`
pour que le debounce lise toujours la valeur courante.

**Feedback save : `✓` dans le header CharacterWindow**
Option C retenue — indicateur global dans le header, 1 seconde.
Prop `onSaved` passée de CharacterWindow → CharacterSheet → SkillsPanel.
Timer avec clearTimeout + cleanup au démontage (évite update sur composant démonté).

### Livrables produits et validés ✅

**`server/src/routes/character/ref.js`**
- Ajout `GET /api/char-ref/skills` — 231 compétences + prérequis imbriqués
- Double SELECT + regroupement JS — SR OK, fetch console validé

**`client/src/character/SkillsPanel.jsx`** — nouveau fichier
- Groupement par famille
- Calcul Base = AN(attr_1) + AN(attr_2), attr_2 null → AN(attr_1) × 2 (PC4)
- Total = Base + mastery, jamais clampé (PC11)
- Algorithme visibilité ordre strict : (X) → SKILL_MIN → MUTATION → GENOTYPE
- MUTATION masqués en V1 (PC9)
- SKILL_MIN évalue le Total de la prérequise (PC10), calculé depuis localMastery réactif
- Debounce 500ms par skill_id dans onChange
- `localMasteryRef` miroir synchrone pour lecture correcte dans le debounce
- Cleanup timers au démontage

**`client/src/character/CharacterSheet.jsx`** — Modules 1 à 5
- Ajout `refSkills`, `charSkills` dans le state
- Chargement `GET /api/char-ref/skills` en parallèle avec genotypes au montage
- `genotypeData` mémoïsé (useMemo)
- `getModGen` stabilisé (useCallback dépendant de genotypeData)
- `naMap`, `anMap`, `secondary` mémoïsés (useMemo)
- `anMap` passé à SkillsPanel — SkillsPanel ne re-rend que si attributs/génotype changent
- `attrsRef` + `chcRef` miroirs synchrones pour le debounce
- Debounce 500ms unique (bulk) pour tous les attributs
- Debounce 500ms pour chc
- Cleanup timers au démontage
- Prop `onSaved` reçue et appelée après chaque save réussi

**`client/src/character/CharacterWindow.jsx`**
- State `saved` + `savedTimerRef` avec clearTimeout
- `handleSaved` : setSaved(true) → 1s → setSaved(false), timer redémarre si save rapide
- Cleanup timer au démontage
- `✓` vert dans le header (style `savedDot`)
- `onSaved={handleSaved}` passé à CharacterSheet

### Problèmes rencontrés et résolus

**Sauvegarde attributs et maîtrise non fonctionnelle**
Diagnostic : `onBlur` sur `<input type="number">` non fiable dans Firefox.
Solution : remplacement par debounce 500ms dans `onChange`. Pattern standard des pros.

**Closure stale sur attrsRef**
Premier correctif (useEffect miroir tardif) insuffisant — le useEffect s'exécute après le rendu,
donc après le blur potentiel. Correction finale : mise à jour synchrone de la ref dans onChange,
ET au chargement API (attrsRef.current = newAttrs avant setAttrs).

### Problèmes identifiés — à traiter session suivante

Les points suivants ont été observés lors des tests visuels mais non corrigés cette session
(hors scope Module 5 fonctionnel) :

- Arts martiaux n'apparaît pas dans Combat contact → problème de données en BDD
- "Armes sous-marines" affichée comme catégorie au lieu de compétence → données BDD
- Libellés attributs peu clairs pour compétences à double entrée (ex: COO/PER vs FOR/COO)
  → afficher le label complet "Armes lourdes (COO/PER)" au lieu des codes attributs seuls
- Alignement irrégulier dans Communication/Relations sociales → à investiguer
- Champ texte libre manquant derrière "Instrument de musique" → backlog UX

### État en fin de session
Modules 1 à 5 fonctionnels et validés.
Sauvegarde fiable sur tous les champs (texte et numériques).
Feedback visuel `✓` opérationnel.
231 compétences affichées (vs 234 attendues — delta accepté, à vérifier visuellement sur la fiche).

### Prochaine étape
Corrections visuelles/données identifiées ci-dessus, puis Session 3 (intégration dev externe).
Voir ROADMAP_CHARACTER.md pour le détail.

---

## Session 3 — 2026-04-16

### Contexte de démarrage
Session 2 stable confirmée (Modules 1-5). Objectif : Module 6 Avantages & Désavantages + corrections données BDD compétences.

### Décisions d'architecture prises cette session

**`char_advantages` remplace `char_mutations`**
La ROADMAP prévoyait deux tables séparées (`ref_mutations` + `char_mutations`). Décision : une seule table `char_advantages` absorbe mutations ET texte libre. `type = 'MUTATION' | 'OTHER'`. Plus simple, plus extensible.

**`linked_skill_id` sur `ref_mutations`**
Colonne TEXT ajoutée sur `ref_mutations` (pas de FK — flexibilité). Lien vers la compétence spéciale débloquée par la mutation. 9 liens peuplés. muta_029 débloque 2 compétences : `linked_skill_id = 'MAITRISE_DE_LA_FORCE_POLARIS'`, deuxième lien (`MAITRISE_DE_LECHO_POLARIS`) géré en logique métier client documentée (PC14).

**`attr_1 = 'CHC'` = catégorie structurelle**
Toute entrée `ref_skills` avec `attr_1 = 'CHC'` est un groupe visuel pur (pas une compétence jouable). Contrainte NOT NULL respectée. `SkillsPanel` filtre ces entrées via guard `if (skill.attr_1 === 'CHC') return false`.

**Règle 3 MUTATION activée (PC9 levé)**
`SkillsPanel` évalue désormais les prérequis MUTATION depuis `charAdvantages`. Exception : une compétence `(X)` dont tous les prérequis MUTATION sont satisfaits devient visible même sans `is_learned = true` — la mutation prime sur le marker réservé.

**Force Polaris dans `char_skills`, pas `char_advantages`**
Les pouvoirs Polaris sont des compétences (`ref_skills`). Sélection via `AdvantagesPanel` → `is_learned = true` dans `char_skills`. Toggle possible.

**Chargement `refMutations` au montage, pas à l'ouverture de modale**
`refMutations` doit être disponible immédiatement dans `handleAddMutation` pour enrichir la réponse POST avec `mutation_nom`. Chargé via `useEffect([], [])` au montage de `AdvantagesPanel`.

### Migrations produites et appliquées ✅
- `40_char_advantages.js` — table `char_advantages` + colonne `linked_skill_id` sur `ref_mutations` + 9 UPDATEs liens mutation→skill — Batch 14 OK

### Scripts SQL correctifs appliqués ✅
- `fix_ref_skills.sql` — 17 parents fantômes insérés, markers corrigés (S→(-3) sur Arts martiaux, S→(X) sur Armes Spéciales, typo FOO→FOR), renommage ACCROBATIE→ACROBATIE, FK morte PILOTAGE_NAVIRES_LEGERS corrigée, prérequis Mécanique/Chirurgie/Falsification ajoutés
- `fix_special_skills_markers.sql` — MUTATION_* et POUVOIRS_POLARIS_* : marker S/NULL → (X)
- `fix_polaris_requirements.sql` — prérequis MUTATION muta_029 ajoutés sur MAITRISE_DE_LA_FORCE_POLARIS et MAITRISE_DE_LECHO_POLARIS
- Ajout manuel : prérequis MUTATION_AGILITE_CAUDALE → muta_026

### Routes API produites et validées ✅
Dans `char-sheet.js` :
- `GET  /api/char-sheet/:characterId/advantages` — liste avec JOIN ref_mutations (mutation_nom, linked_skill_id)
- `POST /api/char-sheet/:characterId/advantages` — ajout MUTATION (avec incrément level si déjà présente) ou OTHER
- `DELETE /api/char-sheet/:characterId/advantages/:id` — suppression ou décrémentation level

Dans `ref.js` :
- `GET /api/char-ref/mutations` — catalogue ref_mutations complet trié par muta_numero

### Composants produits et validés ✅
- `AdvantagesPanel.jsx` — Module 6 complet : liste, modale 3 boutons, mutations, Force Polaris (toggle is_learned), texte libre
- `SkillsPanel.jsx` — Règle 3 MUTATION active, guard CHC, accordéon familles (Langues replié par défaut)
- `CharacterSheet.jsx` — Bloc 6 AdvantagesPanel monté, state charAdvantages, chargement séparé

### Pièges découverts cette session

**PC13 — `attr_1 = 'CHC'` = catégorie — jamais calculer**
Toute compétence avec `attr_1 = 'CHC'` est un groupe structurel. Base = 0, pas d'affichage maîtrise/total. `SkillsPanel` les filtre via guard en tête de `isVisible`.

**PC14 — muta_029 débloque deux compétences Polaris**
`linked_skill_id = 'MAITRISE_DE_LA_FORCE_POLARIS'` uniquement en BDD. `MAITRISE_DE_LECHO_POLARIS` est débloquée par la même logique (même prérequis muta_029 dans `ref_skill_requirements`) — pas besoin de colonne array.

**PC15 — Règle 1 (X) et mutations : ordre d'évaluation**
Une compétence `(X)` avec prérequis MUTATION satisfait est visible même sans `is_learned`. Le pré-calcul `mutationsSatisfied` doit précéder la Règle 1. `mutationReqs.length > 0 AND every(r => activeMutations.has(r.value))`.

**PC16 — `refMutations` chargé au montage, pas à l'ouverture de modale**
`handleAddMutation` enrichit la réponse POST depuis `refMutations` local. Si chargement différé (à l'ouverture modale), premier ajout affiche `muta_0xx` au lieu du nom. Fix : `useEffect` sans dépendances au montage.

**PC17 — markers MUTATION_* et POUVOIRS_POLARIS_* doivent être `(X)`**
Le seed original avait `marker = 'S'` sur ces compétences. `'S'` n'est jamais testé dans `isVisible` → compétences toujours visibles. Correction via `fix_special_skills_markers.sql`. Ne jamais seeder ces compétences avec `marker = 'S'`.

### Problèmes identifiés — à traiter session suivante
- Affichage compétences : groupement par `family` ne reflète pas la hiérarchie parent/enfant visuellement — remise à plat complète nécessaire
- Mémorisation état accordéon entre rechargements (localStorage ou state persistant)
- Catégorie "Connaissances" : Commerce/Trafic, Tactique orphelins visuellement (parents CHC non affichés comme en-têtes)

### État en fin de session
Modules 1 à 6 fonctionnels et validés.
`char_advantages` stable. Mutations, Force Polaris, texte libre opérationnels.
Règle 3 MUTATION active — compétences débloquées par mutations correctement visibles.
39 migrations stables + 1 nouvelle (40). 3 scripts SQL correctifs appliqués.

### Prochaine étape
1. Remise à plat affichage compétences (hiérarchie visuelle parent/enfant)
2. Mémorisation accordéon
3. Intégration développeur externe (Session 4 renommée)
Voir ROADMAP_CHARACTER.md pour le détail.

---

## Session 4 — 2026-04-27

### Contexte de démarrage
Session 3 stable confirmée (Modules 1-6). Objectif : correction encodage UTF-8 ref_skills + remise à plat arborescence CHC dans SkillsPanel.

### Migrations produites et appliquées ✅
- `44_char_fix_encoding.js` — correction encodage UTF-8 sur 12 lignes `ref_skills` (labels et familles corrompus avec `??`)

### Composants produits et validés ✅
- `SkillsPanel.jsx` — arborescence CHC : groupes structurels affichés comme sous-en-têtes `<tr>` non-jouables dans le tableau, enfants indentés (`paddingLeft: 14px`). Fragment React avec key sur chaque bloc groupe (PC19).

### État en fin de session
Modules 1 à 6 stables. 44 migrations appliquées.
Arborescence compétences corrigée visuellement. Labels UTF-8 propres.

---

## Session 37 (VTT) — 2026-04-28 — Chantier XP

### Contexte
Chantier XP inséré avant la Session 5 Character planifiée. Implémentation du module Expérience (XP) — dépense de compétences et distribution GM.

### Décisions d'architecture

**Stockage XP — Option A (colonnes sur char_sheet)**
`xp_total INT DEFAULT 0` — cumul mémoire des XP reçus (lecture seule, jamais éditable directement).
`xp_available INT DEFAULT 0` — XP disponibles à dépenser (éditable GM uniquement).
Pas de table `char_xp_log` en V1 — backlog UX1.

**Déblocage compétence (X)**
Coût fixe 3 PE (niveaux -3→0). `mastery` reste 0 après déblocage — jamais de valeur négative en base. `is_learned` passe à `true`. PC11 inchangé.

**Calcul côté serveur**
Fonctions XP ajoutées dans `charStats.js` (existant). Serveur = source de vérité. Client = miroir pour affichage uniquement.

**Mode Progression**
Toggle dans la section Expérience de `CharacterSheet`. Active une colonne `+` avec coût en PE dans `SkillsPanel`. Achat immédiat (pas de panier). Mise à jour locale après achat (pas de rechargement réseau).

**Droits**
- Distribution XP : GM uniquement (`PUT /xp`)
- Dépense XP : owner ou GM (`POST /skills/buy`)
- `xp_total` : lecture seule pour tous (valeur mémoire)
- `xp_available` : éditable GM uniquement, lecture seule joueur

### Migrations produites et appliquées ✅
- `45_char_xp.js` — `xp_total` + `xp_available` sur `char_sheet`

### Fichiers serveur modifiés ✅
- `charStats.js` — ajout `getCoutAugmentation()`, `getCoutDeblocageX()`, `getCoutTotal()` (fusionné sur l'existant)
- `char-sheet.js` — `assertOwnerOrGm` retourne `{ character, isGm }` ; nouvelle route `PUT /:characterId/xp` (GM) ; nouvelle route `POST /:characterId/skills/buy`

### Fichiers client modifiés ✅
- `CharacterSheet.jsx` — states `xpTotal`, `xpAvailable`, `progressionMode` ; section Expérience entre en-tête et description ; `handleSkillBought` pour mise à jour locale ; `xp_total` lecture seule pour tous
- `SkillsPanel.jsx` — props `progressionMode`, `xpAvailable`, `onSkillBought` ; colonne achat avec bouton `+{cout} PE` ; `handleBuy` async
- `fr.json` — clés `character.xp.*`

### Barème XP compétences (source : Livre de Base Polaris)
| Niveau visé | Coût |
|---|---|
| -3 à +5 | 1 PE |
| +6 à +10 | 2 PE |
| +11 | 3 PE |
| +12 | 5 PE |
| +13 | 7 PE |
| +14 | 9 PE |
| +15 | 11 PE |
| Déblocage (X) | 3 PE (fixe) |

### Pièges découverts cette session

**PC20 — charStats.js existait déjà**
`charStats.js` existait avec `calcSkillTotal`, `calcAttributeAN`, `getGenotypeModForAttr`, `ATTR_LABELS` utilisés par `socket/index.js`. Ne jamais produire ce fichier comme "nouveau" sans l'avoir lu. Les fonctions XP ont été ajoutées à la fin du fichier existant.

### Risque documenté
`charStats.js` reconstruit depuis une archive de conversation (pas dans Git). Faible risque d'écart avec la version réelle si des modifications avaient été faites entre la sauvegarde et aujourd'hui. À surveiller sur les calculs mécaniques existants (jets d'entités).

### État en fin de session
Module XP stable et validé fonctionnellement.
45 migrations appliquées. SR clean. Tests visuels OK.

### Prochaine étape
Session 5 Character : UX9 (mémorisation accordéon), UX10 (fix toggle Force Polaris), puis intégration dev externe.

### Corrections post-validation session 37

**Bugs identifiés après confirmation fonctionnelle initiale :**

1. **Sauvegarde XP non testée** — `xp_available` se sauvegarde correctement via debounce 500ms + `PUT /xp`. Confirmé fonctionnel après investigation.

2. **Joueurs pouvaient modifier la maîtrise librement** — `PUT /skills` accessible à owner ET GM. Corrigé : `PUT /skills` restreint GM uniquement. Input maîtrise dans `SkillsPanel` conditionné par `isGm` (prop ajoutée). Joueur voit la valeur en `<span>` readonly.

3. **Double-clic sur bouton achat** — guard `if (buyingSkillId) return` inefficace car `setBuyingSkillId` est asynchrone (React batch). Corrigé : `isBuyingRef` ref synchrone — `isBuyingRef.current = true` avant le try, `false` dans le finally. `buyingSkillId` retiré des deps de `handleBuy`.

4. **Colonne Maîtrise — deux aspects** — GM : input numérique. Joueur : `<span style={s.readonly}>` avec signe explicite (`+N`). Visuellement distinct, cohérent avec le modèle de droits.

**Pièges découverts :**

**PC21 — guard synchrone sur achat XP**
`setBuyingSkillId` est asynchrone — ne pas l'utiliser comme guard contre les double-clics.
Pattern correct : `const isBuyingRef = useRef(false)` + `isBuyingRef.current = true` synchrone avant le try.

**Fichiers modifiés (corrections) :**
- `char-sheet.js` — `PUT /skills` GM uniquement + `assertOwnerOrGm` retourne `{ character, isGm }` partout
- `CharacterSheet.jsx` — `isGm={isGm}` passé à SkillsPanel
- `SkillsPanel.jsx` — prop `isGm`, input maîtrise conditionnel, `isBuyingRef`, colonne maîtrise GM/joueur

**État final session 37 :** Chantier XP complet et stable. 6 fichiers modifiés/créés.
