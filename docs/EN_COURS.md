# EN COURS — Dettes actives et prochaines étapes
> Dernière mise à jour : 2026-07-08 Session 141 (suite 5)
> Contenu : dettes actives + roadmap + points de vigilance permanents.
> Historique complet : voir `docs/JOURNAL6.md`, `docs/Old/JOURNAL5.md et `docs/Old/JOURNAL4.md` et `docs/Old/JOURNAL3.md`

---

## ⚡ PROCHAINE ÉTAPE EXACTE

> Lire ce bloc en PREMIER. Il indique quoi faire maintenant, dans quel ordre, et vers quel fichier aller.

> **CHANTIER REDESIGN STEP 4 PROFESSION → ✅ TERMINÉ (8/8 lots)** — plan maître archivé :
> **`docs/Old/PLAN_REWORKFINAL.md`**.
> **PROCHAINE ACTION IMMÉDIATE — Session 141 (suite 5), en cours** : `polaris_latent` (OPT-04)
> a été élargi par Saar en un chantier de correction plus large d'`AdvantagesPanel.jsx` (bug
> pré-existant trouvé en cours de route : le composant date d'avant la migration 99, "char_advantages
> V2", et ne correspond plus au schéma réel). Plan complet, découpé en 5 lots, dans
> **`docs/PLAN_ADVANTAGESPANEL.md`** — **le Lot A est détaillé ligne-à-ligne et prêt à coder**
> (fichiers exacts, migration, contraintes, signature de fonctions). Reprendre directement ce
> fichier plutôt que de replanifier : lire les fichiers qu'il cite, confirmer la lecture, puis
> "Je code ?" avant d'implémenter. Lots B (affichage liste, même fichier mais tâche séparée), C
> ("Autres" texte libre), D ("Mutations" en jeu) restent à planifier en détail chacun leur tour.
> Lot E (`SkillsPanel.jsx activeMutations`, dette `[CS7]`) est backlog, non prioritaire.
> **Chantier Options de campagne (item 41) : `young_penalty` (OPT-10) ✅ câblée — Session 141
> (suite 4)** (7/11 faites : `ambiance`, `random_mutations`, `feminin_bonus`, `random_pro_advantages`,
> `skill_prerequisites`, `skill_max_level`, `young_penalty`). Malus FOR/PRE 16-19 ans
> (`REGLE_CREATION.txt` « PERSONNAGES TRÈS JEUNES (OPTIONNEL) ») — `getAgeEffects()`
> (`shared/polarisUtils.js`) ne couvrait jusqu'ici que le malus de vieillesse 30+, jamais 16-19 ans
> (code mort, pas un conflit de source cette fois). Gaté par `settings.young_penalty`, non applicable
> par attribut si sa valeur de base est déjà ≤7. Analyse à charge : aperçu `AgeSelector.jsx` reste basé
> sur `baseAge` (pas `finalAge`), imprécision assumée par Saar (cohérent avec le malus 30+ existant,
> jamais corrigé) ; péremption `char_attributes.base_level` et modificateur génotype caché tous deux
> vérifiés non risqués. **PROCHAINE OPTION À CÂBLER : à définir avec Saar** — voir item "41." (4/11
> restantes : `polaris_latent`, `revers`, `skill_natural_prog`, `celebrity`).
> **Item 46 (hors chantier options de campagne) : Formation "Autodidacte" ✅ câblée — Session 141
> (suite 3)** — 7 points libres réellement répartissables (mécanique de base, jamais un toggle
> campagne), voir détail ci-dessous.
> **Item 47 (hors chantier, interruption ponctuelle) : Correction dé D100/D10 3D ✅ CLOS — Session
> 141 (suite 5)** — `PLAN_DICEREWORK3.md`, voir détail ci-dessous. Le chantier `PLAN_ADVANTAGESPANEL.md`
> (ligne 14 ci-dessus) reste la prochaine action réelle à reprendre.

**47. Correction animation 3D dé D100 (percentile) + D10 ✅ CLOS — Session 141 (suite 5) (2026-07-08)**
   → Signalement Saar (hors chantier en cours) : faces non alignées, résultat serveur ≠ affiché
     ("30+7" pour un roll serveur de 1), dé des unités visuellement cassé. Diagnostic [VÉRIFIÉ] par
     instrumentation réelle (`tools/inspect-glb.js` sur les `.glb` commités) : les tables
     `D10_FACE_GLB`/`D10U_FACE_GLB`/`D10T_FACE_GLB` (`diceMath.js`) ne correspondaient à aucune face
     réelle, jamais recalculées correctement depuis leur introduction Session 65.
   → Recherche pro demandée par Saar (`byWulf/threejs-dice`, `Dice So Nice!`) : confirme le pipeline
     de rendu existant (normale → orientation caméra) déjà standard industrie ; piste "réactiver le
     D10 procédural" explicitement écartée par Saar (dés procéduraux médiocres, D20 procédural
     impossible à texturer proprement — raison probable du passage aux `.glb` Session 65).
   → `D10_FACE_GLB`/`D10U_FACE_GLB` (dupliquées à la main pour le même fichier `D10.glb`, relevé par
     Saar) fusionnées en `D10_GLB_NORMALS` unique, `d10_units` dérivée automatiquement. `D10T_FACE_GLB`
     (D100.glb, fichier distinct) recalibrée indépendamment. Harnais de calibration temporaire
     `/dev/dice-calibration` (composant autonome, retiré après usage) — Saar a lu les 20 valeurs
     réelles en direct sur les vrais modèles. Code mort D10 procédural supprimé (`DiceMesh.jsx`,
     `diceMath.js`).
   → **Testé :** dérivation référence stricte + bijection 0-9 vérifiées, ESLint 0 erreur introduite
     (2 warnings préexistants confirmés), **SR + jet D100 réel en session confirmé fonctionnel par
     Saar**. **Non testé :** scénarios limites un par un (00/100), retrait de dé en cours d'animation.
   → **Addendum demandé par Saar une fois le bug corrigé** : l'outil de calibration rendu
     **permanent** (`/dev/dice-calibration` reste, pas retiré) et **généralisé aux 7 dieType** —
     `client/src/lib/devFaceClusters.js` (k-means calculé à la volée depuis la géométrie chargée,
     zéro vecteur transcrit à la main) + `getClosestFaceValue()` (`diceMath.js`, affiche "le code
     prévoit : X" à côté de chaque face). Limite connue non bloquante : arête/pointe parfois affichée
     sur D8/D20 dans l'outil, **confirmée absente en jeu réel** par Saar (artefact outil, pas un bug
     — investigué en profondeur via le vrai `GLTFLoader`, décision de ne pas creuser plus loin).
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 5)", `docs/PLAN_DICEREWORK3.md`.

**46. Wizard Step 4 — Formation "Autodidacte" (7 points libres) ✅ CLOS — Session 141 (suite 3) (2026-07-08)**
   → Hors chantier "Options de campagne" (item 41) — mécanique de base LdB toujours active, pas un
     toggle campagne. Signalement Saar : "Autodidacte" affichait un texte informatif ("7 points
     libres...") sans aucune UI de répartition ni application de bonus — confirmé par lecture
     (`ref_background_skills` ne contient aucune ligne pour ce background ; le commentaire de la
     migration `98_ref_backgrounds.js` l'annonçait déjà : "gérés côté UI", jamais fait).
   → Réflexion préalable en plusieurs tours (clarifications + analyse à charge demandée par Saar
     avant tout code) : budget ≤7 points/+2 max par compétence (sous-consommation autorisée),
     compétences éligibles restreintes explicitement par Saar à **hors `(X)` réservées ET hors
     compétences à prérequis `SKILL_MIN`** (†, `ref_skill_requirements`) — exclusion plus stricte
     que la lettre de la règle (`REGLE_CREATION.txt:1026-1033`, qui autorise les `(X)` sous
     validation MJ jamais outillée dans le Wizard). Vérifié en base avant de concevoir l'UI : 29
     compétences éligibles sur 232 (10 familles) — liste plate groupée par famille retenue plutôt
     qu'un accordéon (volume trop faible pour le justifier).
   → `shared/autodidacte.js` (NOUVEAU) : règle pure (`isAutodidacteEligible`/
     `getAutodidacteEligibleIds`/`validateAutodidacteAllocations`), importée à l'identique côté
     client et serveur — zéro duplication de la règle d'éligibilité. `AutodidacteAllocator.jsx`
     (NOUVEAU) : widget de répartition monté dans `BackgroundSelector` (sous-étape Formation), zéro
     nouvelle classe CSS (réutilise `.wiz4-*` du board Avantages pro, Lot 4). `creationService.js` :
     `resolveAutodidacteSkills` réutilise tel quel le pipeline existant des bonus d'origine
     (`bgSkillsToApply`/`upsertSkillBonus`/`baseMastery`) — aucune modification de
     `shared/careerSkills.js` (P55) nécessaire.
   → **Analyse à charge demandée par Saar avant codage — 1 vrai bug trouvé et corrigé** :
     `handleSelectTraining`/`handleSelectGeoOrigin`/`handleSelectSocialOrigin` (`Step4Experience.jsx`)
     réinitialisaient l'état en cascade sur **tout** clic de carte, y compris un re-clic sur la carte
     déjà sélectionnée — un joueur ayant réparti ses 7 points pouvait les perdre sur un simple
     re-clic accidentel. Fix : garde `if (code === valeur actuelle) return` ajoutée aux 3 handlers
     (corrige au passage le même défaut préexistant sur `higherEd`/`conditionalChoices`, effet de
     bord positif). 2 correctifs mineurs additionnels : validation serveur tolérante aux entrées à 0
     point (ignorées plutôt que rejetées, évite un blocage dur pour un artefact bénin) ; garde de
     chargement dans `AutodidacteAllocator` si `refSkills` pas encore résolu.
   → **Testé** : `node --check` (shared + serveur) 0 erreur, ESLint client 0 erreur introduite (1
     erreur préexistante `Step4Experience.jsx:89` `remainingPC` confirmée via `git stash`), SR +
     **parcours navigateur confirmé fonctionnel par Saar**.
   → **Non testé** : les 6 scénarios détaillés un par un (validation donnée globalement "Test OK") ;
     re-clic accidentel sur la carte Autodidacte déjà sélectionnée (fix du bug trouvé en analyse à
     charge) en conditions réelles navigateur ; vérification directe `char_skills.mastery` en base
     post-`reconcileCreation` réel.
   → Détail complet : `docs/JOURNAL6.md` "Session 141 (suite 3)".

**44. Redesign Step 4 Profession (rework multi-lots) — ✅ TERMINÉ (8/8 lots) — Session 139/140**
   → Plan maître (archivé) : `docs/Old/PLAN_REWORKFINAL.md` (8 lots). Design source : `docs/ClaudeDesign/project/Professions.dc.html`.
   → **Lot 0 ✅ CLOS** : `shared/careerEligibility.js` (évaluateur pur, raisons structurées) +
     `creationService.js` (4 validateurs `validateCareer*` → 1 `checkCareerEligibility`, parité stricte
     `reasons[0]`). Testé : parité 12/12 (node -e), SR + fonctionnel confirmé Saar.
   → **Lot 1 ✅ CLOS** : `shared/careerSkills.js` (`computeSkillAllocation`, réutilise
     `calcSkillCost`/`getMaxMasteryByYears` de polarisUtils — code mort jusqu'ici, 1er consommateur) +
     `education` dans `getStep4RefData`. Correction de modèle trouvée en lisant `REGLE_CREATION.txt:
     1103-1128,1250-1263` avant de coder : plafond compétence professionnelle = table par années
     cumulées (+2 études) ; plafond compétence d'origine non-pro = **fixe +5** (pas
     `getMaxMasteryByYears(0)=3` comme écrit initialement au plan). Invisible (ni payload ni UI).
     Testé : `node --check`, tests unitaires isolés (node -e), `getStep4RefData` vérifié en base
     réelle (12/12 lignes `ref_career_education`), SR + confirmé Saar.
   → **Lot 2 ✅ CLOS** : `CareersAllocator.jsx` réécrit (rail/agebar/detail/board GLOBAL/foot,
     `useReducer`, CSS `.wiz4-*`), payload `skillAllocations` per-career → top-level global,
     `reconcileCreation` STEP4 valide désormais le budget (Q2) via `computeSkillAllocation`. **2 bugs
     `-Infinity` trouvés et corrigés** (compétences réservées `(X)` avec bonus d'origine, puis
     compétences `(X)` professionnelles sans bonus d'origine — règle `REGLE_CREATION.txt:1129-1132`
     découverte en cours de route : une `(X)` est accessible dès qu'une carrière retenue la liste).
     Détail complet : `docs/JOURNAL6.md` "Lot 2". Testé : SR + fonctionnel confirmé Saar (filtres,
     sélection, board avec compétences `(X)` pro/non-pro, plafonds 5/10/13 conformes).
   → **Lot 3 ✅ CLOS** : onglet Carrière & économies (lecture seule) — table `.wiz4-prog`
     (titres/salaires triés, ligne courante surlignée) + encadré `.wiz4-ecobox` (économies pour la
     durée engagée) + tuile agebar « Économies de départ » (placeholder `—` remplacé). Reproduit
     exactement la formule serveur (`salaire du titre courant × années`, déjà persistée par
     `reconcileCreation`) — aucune migration, aucun changement serveur. `estimateSalaryFormula()`
     (nouveau, `shared/polarisUtils.js`) : estimation moyenne déterministe pour les salaires à formule
     aléatoire (jamais de `Math.random` en lecture seule), marquée `*`. Vérification base réelle
     (scénario Saar : 3 ans Chasseur de primes + 2 ans Cultivateur/Éleveur = 3500 sols, conforme).
     **Bugfix associé** : filtre carrières par défaut `'all'` → `'eligible'` (dette [CAR-DEF] repérée
     lors des tests Lot 2, signalée par Saar). Détail complet : `docs/JOURNAL6.md` "Lot 3".
     Testé : `node --check`/ESLint 0 erreur, `estimateSalaryFormula` isolé, non-régression
     `evaluateSalaryFormula`, SR + fonctionnel confirmé Saar. Non testé : les 8 scénarios détaillés un
     par un (validation globale « ook »), confirmation visuelle navigateur du bugfix filtre.
   → **Migration 120 (fix, hors lots)** : `ref_career_point_categories` manquantes sur 4 carrières Lot 1
     (`artisan_artiste`, `assassin`, `barman`, `contrebandier`) — trouvé en lisant avant de planifier
     le Lot 4 (même angle mort que la migration 106, jamais corrigé pour cette table). Vérification
     exhaustive des 30 sections restantes de `REGLE_PROFESSION.md` demandée par Saar : 30/30 conformes,
     bug isolé aux 4 carrières identifiées. `chasseur_primes` (5ᵉ carrière du lot) a 0 ligne
     légitimement (absent de la LdB p.156). Détail : `docs/JOURNAL6.md` "Migration 120".
   → **Lot 4 ✅ CLOS** : Avantages pro (5 pts/an **par métier**, `REGLE_CREATION.txt:1151-1159`) —
     `shared/careerAdvantages.js` (`computeProAdvantageAllocation`, pattern `careerSkills.js`) +
     validation serveur Q3 (`reconcileCreation`) + onglet "Avantages pro" (steppers, réutilise les
     classes CSS du board compétences, zéro nouvelle classe) + gating "Suivant" étendu. **Cas limite
     trouvé en relecture avant livraison** : métier à 0 catégorie (`chasseur_primes`) bloquait
     indéfiniment sans le fix `budget=0` si aucune catégorie. Détail complet : `docs/JOURNAL6.md`
     "Lot 4". Testé : 6 scénarios unitaires isolés, `getStep4RefData` vérifié en base réelle, ESLint/
     `node --check` 0 erreur (1 erreur pré-existante non liée), SR + fonctionnel confirmé Saar.
   → **Lot 5 ✅ CLOS** : Compétences « au choix » (`PLAN_REWORKFINAL §7`). Migration
     `121_ref_career_skills_choice_groups.js` (colonne `choice_group` + 24 lignes T3 réécrites en vrais
     enfants `ref_skills.parent`, groupées par `choice_group` scopé `career_id` + 4 doublons inertes
     supprimés Diplomate/Espion + 4 lignes Soldat d'élite flag corrigé `conditional=false`). **Avant
     tout code (demande Saar « sûr à 100% »)** : re-vérification directe de `REGLE_PROFESSION.md` (pas
     seulement du plan déjà écrit) sur les cas les plus ambigus + requêtes SQL réelles (44 lignes,
     `is_category`/`parent`, absence de collision) — 0 écart trouvé, tout confirmé avant codage.
     `shared/careerSkills.js` : nouvelle `validateChoiceGroups` (exclusivité par groupe). Payload
     `openedSkills` (déjà câblé serveur/moteur de coût depuis le Lot 2, jamais envoyé par le client
     avant ce lot) désormais rempli par `Step4Experience.jsx`. `CareersAllocator.jsx` : reducer étendu
     (2 nouvelles actions + purge au retrait de carrière), nouveau bloc UI "Compétences au choix"
     (checkbox T1 solo / radio T3 exclusif), verrouillé tant que le métier n'est pas retenu. **Gap
     trouvé en relecture avant livraison** : `provenanceFor` (tag de provenance du board) ne couvrait
     pas les compétences "au choix" ouvertes — corrigé. Détail complet : `docs/JOURNAL6.md` "Lot 5".
     Testé : migration round-trip `down`/`up` byte-identique en base réelle, `validateChoiceGroups`
     (6 scénarios `node -e`), `node --check`/ESLint 0 erreur introduite, SR, fonctionnel confirmé Saar
     ("All ok"). Non testé : vérification directe `char_skills.is_learned` en base post-finalisation.
   → **Nettoyage UI associé** : icône hexagonale du rail carrières retirée (`.wiz4-hex` + style inline
     `--hex`), colonne rail réduite `296px`→`246px`. `careerHexColor()` conservé (tags de provenance).
   → **Lot 6 ✅ CLOS — Session 140** : Tirage 1D10 (`PLAN_REWORKFINAL §8`). Migration
     `122_ref_career_random_benefits_lot1_and_points_alt.js` (colonne `points_alt` + backfill 37
     lignes `roll=10` + 50 lignes manquantes Lot 1). `shared/careerAdvantages.js`
     (`computeRandomBudgetDelta`, nouveau) + `creationService.js` (validation `randomPicks` + Q3
     étendu) + `WizardCreation.jsx` (`SocketProvider` monté pour la première fois dans le Wizard) +
     `CareersAllocator.jsx` (bloc UI + overlay `DiceRoller` réel, jamais `Math.random`). **Enquête
     Chasseur de primes** (demandée par Saar) : un extrait qu'il pensait être sa page LdB s'est avéré
     être un artefact de mise en page dupliquant Mercenaire — confirmé, 0 catégorie reste légitime
     pour ce métier ; le Lot 6 dissocie quand même "jet disponible" de "conversion en points" pour
     respecter sa table de tirage imprimée sans budget automatique. **Bug trouvé après 1er test
     navigateur** (Saar a soupçonné une mauvaise réutilisation du système de dés — à raison) :
     `DICE_RESULT` n'inclut jamais `dieType` server-side, tout jet hors `SessionPage` retombait sur un
     D6 — voir **P56**. **Bonus même session** : `Step3Mutations.jsx` "Lancer 1D20" converti en jet
     réel (même mécanique), `DiceLights.jsx` extrait en composant partagé. Détail complet :
     `docs/JOURNAL6.md` "Session 140". Testé : migration round-trip byte-identique, 8 scénarios
     unitaires `computeRandomBudgetDelta`, ESLint 0 erreur introduite, SR + fonctionnel confirmé Saar
     (Lot 6 après fix + D20 Step3). Non testé : les 4 rejets serveur en conditions réelles,
     `char_careers.random_picks` vérifié en base post-`reconcileCreation` réel.
   → **Chantier Redesign Step 4 Profession terminé (8/8 lots). Plan archivé : `docs/Old/PLAN_REWORKFINAL.md`.**
     Lots 7/8 (relations `char_relations` + panneau fiche perso / matériel inventaire) jamais cadrés
     en détail (`PLAN_REWORKFINAL §9-10`) —
     à reprendre comme chantier séparé si prioritaire. Prochaine migration disponible : **123**
     (122 consommée Session 140).

**45. Wizard Step1 — Description physique + Main directrice (2D10) ✅ CLOS — Session 139 suite 5 (2026-07-08)**
   → Hors chantier Redesign Step4. Ajout au Wizard des champs de la fiche perso (taille/poids/peau/
     corpulence/yeux/cheveux/signes particuliers) + Main directrice avec bouton "Définir" (tirage 2D10
     client, pattern identique au tirage aléatoire `Step3Mutations.jsx`). Schéma DB déjà complet
     (`char_identity`, migration 36) — **aucune migration**. `reconcileCreation` STEP1 étendu (insert/
     merge `char_identity`), champs optionnels/non bloquants (règle LdB confirmée narrative, pas
     mécanique — seule la Main directrice a un vrai tirage).
   → **Bug préexistant découvert (non corrigé, voir dette HP1)** : `hand_pref` est lu depuis `char_sheet`
     (colonne inexistante) au lieu de `char_identity` dans `socketCombatHelpers.js` et `char-sheet.js`
     (route inventaire) — la mécanique Main directrice retombe toujours sur `'R'` en combat.
   → Détail complet : `docs/JOURNAL6.md` "Session 139 (suite 5)".
   → **Testé** : `JSON.parse`/`node --check`/ESLint 0 erreur introduite, SR + fonctionnel confirmé Saar.
   → **Non testé** : scénarios détaillés un par un, vérification base réelle post-`reconcileCreation`.

**43. Fiche personnage consultable en permanence pendant le Wizard (fenêtre "peek") ✅ CLOS — Session 139 (2026-07-07)**
   → Plan complet rédigé en amont : `docs/STE6_FINAL.md`. `CharacterWindow.jsx` réutilisé inchangé
     (prop `forceReadOnly`) — zéro nouveau composant d'affichage. `finalizeCreation` →
     `reconcileCreation` (pattern reconciliation, payload partiel autorisé, rejouable — reset
     `is_fertile`/`char_skills`/`char_careers`/`char_advantages`+ledger avant réapplication) +
     `lockWizard` + `getCharacterPreview`. Migration 119 (`char_sheet.wizard_locked_at`) — sépare
     propriété "assistant" (rejouable) de propriété "runtime" (fiche éditable post-verrouillage).
     `routes/characters.js` : filtre liste gate désormais sur `wizard_locked_at` (au lieu de
     `creation_state`) pour ne jamais exposer un brouillon en cours au reste de la campagne.
   → Détail complet (déviations trouvées en codant vs le plan écrit, notamment l'appel
     `setCharacters` du store omis car inutile et risqué) : `docs/JOURNAL6.md` "Session 139".
   → **Testé** : `node --check`/ESLint 0 erreur, round-trip migration 119, SR + parcours fonctionnel
     confirmé par Saar.
   → **Non testé** : les 8 scénarios détaillés un par un de `docs/STE6_FINAL.md` §15 (validation
     donnée sur "SR et fonctionnel" globalement).
   → Prochaine migration disponible : **120** (119 consommée cette session).

**0. ~~MIGRATION 37-BIS (ref_skills) — migration 105~~** ✅ CLOS — Session 133 (2026-07-05). Détail complet : `docs/Old/JOURNAL5.md` "Session 133", `docs/Old/MIGRATION_37BIS.md`.

**1. ~~Lot 1 carrières — migration 106~~** ✅ CLOS — Session 134 (2026-07-05). 9 corrections `ref_career_skills` (voir `docs/Old/PLAN_LOT1_CAREERS.md` + `docs/JOURNAL6.md` "Session 134"). Round-trip `up`/`down`/`up` testé byte-identique + validation fonctionnelle navigateur confirmée par Saar (wizard Step4, 5 carrières).

**2. ~~Lots 2-6 carrières (32 carrières)~~ ✅ CLOS — Session 134 suite (2026-07-05)**
   → Migrations 108 (lot2) + 112-116 (lots 3-6) : 32 carrières + illustrations incluses directement. Détail complet : `docs/Old/PLAN_LOTS_3_6_CAREERS.md`, `docs/JOURNAL6.md` "Session 134 suite".
   → **Effet de bord majeur** : `ref_career_skills.skill_id` n'avait aucune FK vers `ref_skills.id` (PIÈGE 1) et `skill_group` était un texte libre jamais aligné avec `ref_skills.family` (bug de fragmentation UI trouvé en cours de route). Corrigé en profondeur — voir item "2bis" ci-dessous.
   → 2 bugs `required_genotype` trouvés et corrigés (valeurs inventées ne correspondant à aucun `ref_genotypes.id`) : `hybride_trident` → `GEN_HYB`, `techno_hybride` → `TEC_HYB`.
   → Prérequis (espion + autres, cf. PIÈGE 7 `JOURNALCOUCHE4.md`) : **non traité**, reste à faire (voir dette ci-dessous).
   → **Testé** : 37/37 carrières en base, 0 orphelin FK, 0 carrière sans illustration, round-trip `up`/`down`/`up` par migration, wizard Step4 confirmé fonctionnel par Saar (toutes carrières + génotypes).
   → **Non testé** : —

**2bis. ~~FK ref_career_skills.skill_id + suppression skill_group~~ ✅ CLOS — Session 134 suite (2026-07-05)**
   → Migration 111 : `ALTER TABLE` ajoute `FOREIGN KEY (skill_id) REFERENCES ref_skills(id) ON DELETE RESTRICT` + `DROP COLUMN skill_group`. Détail : `docs/Old/PLAN_CAREER_SKILLS_FK.md`.
   → Backend `creationService.js:133` (`getStep4RefData`) : JOIN `ref_skills` pour récupérer `family` (remplace le texte libre).
   → Frontend `CareersAllocator.jsx:44-46` : regroupement par `sk.family` au lieu de `sk.skill_group`.
   → **Dette identique non traitée** : `ref_background_skills.skill_id` a le même défaut (pas de FK) — table différente, hors scope (`98_ref_backgrounds.js:49`).
   → **Testé** : FK active (insert invalide rejeté, code Postgres `23503`), round-trip `up`/`down`/`up`, wizard Step4 confirmé fonctionnel (regroupement par famille correct).
   → **Non testé** : —

**3. ~~Wizard Step3 Mutations — mutations réelles (`ref_mutations`) au lieu du mock~~ ✅ CLOS — Session 136 (2026-07-05)**
   → ~~[[docs/PLAN_MUTATION|PLAN_MUTATION]]~~ ✅ CLOS — Session 135 (2026-07-05). Migration `109_mutation_stacking.js`
     (`stack_deltas` JSONB + réécriture `char_mutation_effects_view`) + upsert `count` dans
     `creationService.js:245-269` (`ON CONFLICT` sur l'index partiel `uq_char_mut_no_sub`). Testé (3
     scénarios formule + upsert anti-doublon, transactions Postgres annulées). Détail complet + incident
     lié au bug d'encodage `ref_mutations` (migration `108_fix_ref_mutations_encoding.js`, découvert et
     corrigé en aparté) : `docs/JOURNAL6.md` "Session 135". Plan archivé : `docs/Old/PLAN_MUTATION.md`.
   → ~~[[docs/PLAN_STEP4|PLAN_STEP4]]~~ ✅ CLOS — Session 136 (2026-07-05). Migration 117
     (`ref_mutation_subtypes.description`) + backend (`getStep3RefData`, route `/step3/ref`,
     `randomMutationsEnabled`) + réécriture complète `Step3Mutations.jsx` (achat + tirage aléatoire
     réel D100, variantes libellées vs rulebook, relance D100 sur doublon `is_unique`) +
     `mutationsMeta` pour `WizardReview.jsx` (plus d'accès i18n/DB). Correctif UX post-fonctionnel :
     halo de confirmation au clic (`.wiz3-card-flash`, `index.css`). Détail complet :
     `docs/JOURNAL6.md` "Session 136". Plan archivé : `docs/Old/PLAN_STEP4.md`.
   → **Testé** : SR + fonctionnel confirmé par Saar (parcours Step3), halo de confirmation confirmé
     fonctionnel. Lint/syntaxe validés sur tous les fichiers touchés.
   → **Non testé** : round-trip migration 117, achat stackable 2× et tirage D20/D100 en conditions
     réelles navigateur, toggle `random_mutations`.
   → Prérequis carrières (espion, soldat_elite_*, officier_militaire_souterrain, etc.) : à traiter dans une migration dédiée, cf. PIÈGE 7 `JOURNALCOUCHE4.md`.

**42. Fix `cost_pc` « Organe sensoriel manquant » (migration 118) + présentation cartes Step3 ✅ CLOS — Session 138 (2026-07-06)**
   → Signalement Saar (capture rulebook) : gain de PC faux pour "Organe sensoriel manquant" dans Step3. Vérification exhaustive des 45 lignes `ref_mutations` vs `docs/Character/Creation/REGLE_CREATION.txt:812-898` demandée par Saar avant tout plan (44/45 correctes).
   → Migration 118 : `cost_pc` corrigé sur 4 sous-types (smell/touch 0→1, hearing 1→2, sight 2→3 ; taste inchangé). Round-trip `down`/`up` byte-identique testé via appel direct des fonctions du module.
   → `Step3Mutations.jsx` : titre de carte tronqué (`overflow`/`ellipsis`/`nowrap`) → variante déplacée sur sa propre ligne (`st.cardVariant`, pattern repris de `st.rollSubtype`), troncature retirée de `st.cardName`. Bénéficie aussi à la vue "tirage aléatoire" (même style réutilisé).
   → **Effet de bord repéré (non corrigé, voir dette [MUT1])** : `Purulence` a `cost_pc = -2` en base, incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) — pourrait l'exclure du filtre `cost_pc >= 0` en méthode achat libre.
   → Détail complet : `docs/JOURNAL6.md` "Session 138".
   → **Testé** : valeurs DB conformes à la rulebook, round-trip migration, ESLint 0 erreur, confirmation visuelle navigateur par Saar (coûts + titres non tronqués).
   → **Non testé** : achat effectif d'une des 4 mutations corrigées (dépense PC réelle, `finalizeCreation`).
   → Prochaine migration disponible : **119** (118 consommée cette session).

---

**35. ~~Wizard Phase 2 — corrections bugs B1/B5/B6/B8/B9 + A3 (store) ✅ Sessions 127–128~~**
   → B1 ✅ : variable `st` écrasée Step3Mutations (st→sub dans .map)
   → A3 ✅ : Zustand store `creationStore.js` — `getPcDispo()` dérivé, cascade null setters, PC budget temps réel
   → B5 ✅ : `addSkills` mastery = 0 → `sk.bonus ?? 0` (CareersAllocator)
   → B6 ✅ : unicité mutation non vérifiée → guard `meta.is_unique` dans `handleAdd`
   → B8 ✅ : doublon `classes_moyennes` → fusion + `allowed_parents` + filtre mis à jour
   → B9 ✅ : slider max=1 quand PC=0 → `disabled` + `max` corrigé
   → i18n ✅ : `wizard.step`, `wizard.pc_label`, `step3.none`, `step3.noneDesc`
   → Nav ✅ : bouton Précédent manquant dans sélection méthode Step3
   → **A1 ✅ Session 128 suite** : migrations 98 + 99 appliquées — 102 migrations totales

**36. ~~Wizard COUCHE 3 — Backend steps 4 & 5 ⚠️ clos partiel Session 129~~**
   → `advantageConstraints.js` : registre contraintes R1-R6 (exists/not_already_owned/unique/family/pc_max/sufficient)
   → `advantageService.js` : getAdvantages + addAdvantage (trx-or-db) + removeAdvantage (soft-delete)
   → `creationService.js` : getStep4RefData/State + validateAndPersistStep4 (snapshot + backgrounds + carrières + âge) + rollbackStep4 (snapshot-before + purge orphans) + getStep5RefData
   → `routes/creation.js` : monté `/api/creation` — 6 routes step4 + step5 — ownership guard param
   → `char-sheet.js` : advantages V1 → V2 (advantageService)
   → `index.js` : mount `/api/creation`
   → Fix rollback : purge skills hors snapshot (`whereNotIn`)
   → **Non testé** : aucune route appelée depuis le client

**37. ~~Wizard COUCHE 4a — câblage frontend → backend steps 0-3 ⚠️ clos partiel Session 129 suite 2~~**
   → `creationService.js` : +5 fonctions (`startCreation`, `validateAndPersistStep1/2/3`, `finalizeCreation`)
   → `creation.js` : +5 routes (`POST /start`, `/:sheetId/step1/2/3`, `/:sheetId/finalize`)
   → `creationStore.js` : réécriture — +`sheetId`, `campaignId`, `isStarting`, `startError`, `startCreation()` (axios)
   → `WizardCreation.jsx` : réécriture — `useParams` + `callStep` helper + handlers async
   → `Step1Attributes.jsx` : canNext + payload étendu — `App.jsx` : route path
   → `DashboardPage.jsx` : bouton "Créer un personnage" par card campagne
   → Fix : `fetch` relatif → `api` axios (fetch partait vers Vite port 5173 → 404)
   → **Testé** : SR ✅, start ✅ (bouton "Commencer" fonctionnel)
   → **Non testé** : steps 1-3 depuis client, finalizeCreation

**38. ~~Wizard COUCHE 4b ✅ clos Session 129 suites 3–5~~**
   → `CareersAllocator.jsx` : prop `careers` DB, `selectedCareerId` UUID, `allSkills` useMemo ✅
   → `Step4Summary.jsx` : réécriture 101L — suppression "PC dépensés x/20" ✅
   → `Step4Experience.jsx` : fetch refData, `finalAge` (base + études.years_added + carrières) ✅
   → `WizardCreation.jsx` : step4/5 async + rollback DELETE step4 + étape 6 (aperçu CharacterSheet) ✅
   → `Step5Advantages.jsx` : création 119L — toggle avantages/désavantages ✅
   → `WizardHeader.jsx` : stepper 6 étapes cliquables (dots + lignes + labels) ✅
   → `Step3Mutations.jsx` : "Aucune mutation" déplacée vers menu d'achat (UX) ✅
   → `100_seed_ref_careers.js` : 5 carrières seedées (ref_careers + skills + titles) ✅
   → `101_fix_background_names_encoding.js` : 8 noms corrompus (mojibake) corrigés ✅ — **104 migrations**
   → `creation.json` : S2-1 + S2-2 copy, `step2.conditionsTitle` manquant ✅
   → `index.css` : classes `.wiz-stepper*` ajoutées ✅
   → **Testé** : SR ✅, grille carrières ✅, âge final ✅ (19+2+6=27), step4→5→6→finalize ✅, step indicator ✅, encodage ✅
   → **Non testé** : steps 1-3 depuis client, multi-carrières avec skills partagées

**39. ~~Wizard COUCHE 5 — architecture client-primary ✅ Session 130~~**
   → Migration 102 : DROP `char_creation_snapshot` (FSM snapshot supprimé)
   → `creationService.js` : réécriture ~280L — `finalizeCreation` transaction unique (step1→step5)
   → `creation.js` : routes nettoyées — seul `POST /finalize` avec payload complet
   → `creationStore.js` : `highestStep` + merge semantics `setStep1Data` + `pcNet` dans `getPcDispo`
   → `WizardCreation.jsx` : `navigateToStep` (highestStep guard) + `handleFinalize` — plus d'appels FSM
   → `WizardReview.jsx` : nouveau composant pur store (remplace CharacterSheet en étape 6)
   → Step1/2/3/4/5 : hydratation `initialData` — retour arrière conserve les données
   → **Testé** : SR ✅, migration 102 ✅
   → **Non testé** : flux complet navigation retour → modifier → finaliser

**40. ~~Options de campagne — migration 104 (settings JSONB) + campaignSettingsService ✅ Session 132~~**
   → `campaignSettingsService.js` (SETTINGS_SCHEMA + getCampaignSettings) — source unique, remplace 5 lectures dupliquées
   → Migration 104 : `campaigns.settings JSONB` — consolide 6 colonnes + 11 nouvelles options, DROP `campaign_rules`
   → 3 bugfixes composants (`SectionDice` closures, `SectionGameRules` état manquant, `SectionTokens` désync) + bugfix `CampaignSettingsPage` (formRef→formData, onglets)
   → 7 fichiers déplacés vers `client/src/components/campaignSettings/` + i18n FR/EN complétés
   → **Testé** : SR ✅, combat inchangé ✅, persistance 11 options ✅, upload token non écrasé ✅, navigation onglets ✅
   → **Non testé** : effet mécanique des 11 options (stockage/lecture seulement — voir `docs/optionCampagne/JOPT.md`)

**41. Options de campagne — effets mécaniques (5/11) : `ambiance` ✅, `random_mutations` ✅, `feminin_bonus` ✅, `random_pro_advantages` ✅, `skill_prerequisites` ✅ — Session 141** ← EN COURS, un par un
   → Audit complet des 11 options dans `docs/Old/optionCampagne/PLAN_OPTCAMP.md` (Niveau 1/2/3 par complexité)
   → `ambiance` : mock supprimé (`WizardCreation.jsx`), `startCreation`/`creationStore` transmettent la vraie valeur, `finalizeCreation` revalide via `validateStep1` (code mort réactivé, `shared/polarisUtils.js:187`)
   → `random_mutations` : câblée Session 136 (masque la carte "Tirage aléatoire" Step3 si désactivée)
   → `feminin_bonus` : câblée Session 137 — élargie en cours de route à Sexe/Fécondité (Step1 pose `char_archetype.sex`, Step3 override via mutations Asexué/Androgyne/Autofécondation, Step5 désavantage Fécondité `adv_076` avec blocage si mutation stérilisante). Détail complet : `docs/PLAN_SEXE.md`, `docs/JOURNAL6.md` "Session 137".
   → `random_pro_advantages` : câblée Session 141 — gate le bloc "Tirage 1D10" (`CareersAllocator.jsx`, Lot 6 Session 140) selon le toggle, même pattern que `random_mutations`/`feminin_bonus`. Détail complet : `docs/JOURNAL6.md` "Session 141".
   → `skill_prerequisites` : câblée Session 141 (suite) — conflit de source résolu (`OPTIONS_CAMPAGNE.md` vs `CHARACTER.md`, confirmé option réelle par Saar). Gate `SKILL_MIN` dans `SkillsPanel.isVisible` (client, fermé par défaut) **+ revalidation serveur `POST /skills/buy`** (réutilise `calcSkillTotal` de `charStats.js`, déjà éprouvée en combat) — première option de ce chantier à toucher la fiche personnage en jeu (pas seulement le Wizard) et à fermer le gap côté serveur. `GET /char-sheet/:characterId` renvoie désormais `settings` (canal réutilisable pour les 6 options restantes). Détail complet : `docs/JOURNAL6.md` "Session 141 (suite)".
   → **Testé** : SR ✅, parcours Wizard confirmé fonctionnel par Saar (options Wizard) ; parcours fiche personnage (MJ, PNJ, mode Progression) confirmé Saar pour `skill_prerequisites` — cascade de prérequis (Culture générale → Électronique/Informatique/Médecine → Chirurgie) vérifiée correcte
   → **Non testé** : les 8 scénarios détaillés de `PLAN_SEXE.md` un par un (validation donnée sur le parcours global) ; bascule ON→OFF en cours de wizard pour `random_pro_advantages` (non prévu par le design) ; rejet serveur `POST /skills/buy` par appel direct (masqué côté UI, non testé hors lecture de code)
   → **Prochain** : à définir avec Saar (6/11 restantes)

**41. Wizard COUCHE 4c → analyse terminée (session 2026-07-05 suite) : deux dossiers distincts, à ne plus confondre**
   → `PLAN_COUCHE4.md` (architecture wizard step-by-step, câblage frontend→backend) : confirmé **obsolète** — remplacé par COUCHE 5 (architecture client-primary, Session 130). Archivé par Saar dans `docs/Old/`.
   → `JOURNALCOUCHE4.md` (audit seeding carrières lots 1-6) : **toujours valide et exploitable**. Déplacé dans `docs/Old/` (réorganisation documentaire) mais reste la référence du seeding — voir item "1." en tête de fichier.
   → [WIZ-1] Filtrer personnages incomplets (creation_state ≠ 'complete') dans la liste Dashboard — dette indépendante, toujours ouverte
   → [WIZ-2] Synchroniser les deux compteurs PC (store header vs local CareersAllocator) — dette indépendante, toujours ouverte
   → [WIZ-3] Formation "apprentissage_technique" → choix de spécialité — dette indépendante, toujours ouverte
   → [S4-C1] ~~Seeder les ~24 carrières restantes~~ ✅ CLOS Session 134 suite — 37/37 carrières en base
   → [S4-C2] ~~Illustrations carrières depuis MinIO~~ ✅ CLOS Session 134 suite — 37/37 carrières ont leur illustration

**34. ~~Cluster N — UI combat~~** (en cours)
   → COM23 ✅ Session 127 : `TokenLabel` sprite CanvasTexture — label occludé par murs
   → FEAT3 ✅ Session 127 : `TokenActiveDisk` ring dorée — token actif combat
   → COM21 ✅ Session 127 : collision token-token — `isCellFree` DB direct + déplacement partiel (règle Polaris)
   → **COM20** ← PROCHAINE ÉTAPE : arme + munitions dans CombatActionWindow / CombatGmDeclareWindow

** Notes Saar (user) :
Projet en cours et priorité user : 
- Wizard : seeder les careers (en cours, item "2." ci-dessus) et les mutations (planifié, item "3." ci-dessus — PLAN_STEP4 + PLAN_MUTATION)
- Wizard : Step 4 Expérience (Origine, Milieu et formation) doivent imapcter réellement la fiche personnage
- Wizard : Step 4 Profession : revoir l'UI intégralement pour la clarté
- Option de campagne : Implanter les options de campagne relative au Wizard


---

## État global

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **127 migrations appliquées** (122_ref_career_random_benefits_lot1_and_points_alt — Session 140 ;
  121_ref_career_skills_choice_groups — Session 139 ;
  120_fix_ref_career_point_categories_lot1 — Session 139 ;
  119_char_sheet_wizard_lock — Session 139 ;
  118_fix_ref_mutations_organe_sensoriel_manquant — Session 138 ;
  117_ref_mutation_subtypes_description — Session 136 ;
  109_mutation_stacking + 108_fix_ref_mutations_encoding — Session 135 ;
  116_seed_ref_careers_lot6 — Session 134 suite ; deux numéros 108/109 distincts coexistent, voir P53)
- Migrations : voir `docs/ASBUILT.md` § Base de données

---

## En attente de validation fonctionnelle

**FEAT2-A — LOS outil menu radial ✅ MVP clos (ligne + overlay)**
- V1–V6 validés avant ajout caméra v2

**FEAT2-C — Caméra LOS v2 (épaule droite) ✅ clos complet — Session 112**
- `client/src/lib/useCameraLOS.js` réécrit — service complet (feature-as-service, ARCHI_REWORK.md)
- Canvas3D.jsx : zéro logique LOS — 1 appel `useCameraLOS(...)` + 4 callables `{ losLine, onTokenClick, onPointerUp, clearLine }`
- FEAT2-B (LOS automatique pipeline assaut) → sprint futur

---

## Dettes actives

> Détail technique de chaque bug → [`docs/BUGIDENTIFIE.md`](BUGIDENTIFIE.md)

| ID | Description | Priorité |
|---|---|---|
| ST1 | Badge statut illisible sur token canvas (texte trop petit) | Haute — Sprint 14-2 |
| ST3 | Fenêtre THUG STATUTS trop petite — overflow des icônes statuts | Moyenne |
| CH1 | Historique chat perdu au F5 (rechargement page) | Haute |
| COM2 | Vérif statut arme absente côté GM | Moyenne |
| COM7 | Multi-attaque CaC : duplicata / bouton grisé | Moyenne |
| COM9 | Viser une localisation précise — non implémenté | Moyenne — sprint dédié |
| — | "Changer le mode de tir" — non implémenté | Moyenne — sprint futur |
| — | Sprint Annonce v2 — actions en lecture seule | Moyenne — sprint futur |
| DR2 | Drone : déplacement absent | Basse — sprint futur |
| INI1 | Surprise critique (roll=1) → initiative=1 | Basse |
| INI2 | Initiative non recalculée après blessure en combat | Basse — post-REWORK-08 |
| AU1 | `useDiceAudio.js` — sons dés | Basse |
| TC1 | `.gitattributes:3` — attribut invalide | Très basse |
| DCO1 | `onTokenRotate` dead code Canvas3D/Scene | Très basse |
| VX1 | `getVoxelSurfaceTop` — pas de cas slope/wedge | Très basse |
| — | Kiwi P-SRV-5 — ports Docker non restreints | Infra |
| — | Logs debug `index.js` — conservés volontairement | Infra |
| **KIWI2** | Import GLB token : local ✅ / Kiwi ❌ | **Haute** — Cluster R |
| **CS4** | Catégorie "Techniques" + liste compétences | Moyenne — Cluster O |
| **CS5** | Compétence réservée (X) : ouverture 1 XP, reste -3 | Moyenne — Cluster O |
| **CS6** | Force Polaris = Avantage (pas Mutation) | Moyenne — Cluster O |
| **CS7** | `SkillsPanel.jsx:135-141` (`activeMutations`) lit `charAdvantages` (`type==='MUTATION'`/`muta_numero`, schéma V2 jamais eu ces champs) au lieu de `char_mutations` (vraie table) → Set toujours vide → **10 compétences** à prérequis `type:'MUTATION'` (`MUTATION_CONTAGION`, `MUTATION_CONTROLE_MOLECULAIRE`, `MUTATION_EMPATHIE`, `MUTATION_METAMORPHOSE`, `MUTATION_PURULENCE`, `MUTATION_RADIATIONS`, `MUTATION_SONAR`, `MUTATION_AGILITE_CAUDALE`, `MAITRISE_DE_LA_FORCE_POLARIS`, `MAITRISE_DE_LECHO_POLARIS`) structurellement invisibles pour tout personnage, quelle que soit la mutation réellement possédée — `[VÉRIFIÉ]` en base réelle Session 141 (suite 5), même cause racine que `AdvantagesPanel.jsx` (voir `docs/PLAN_ADVANTAGESPANEL.md`) mais rayon d'impact plus large (10 compétences, pas seulement Polaris) | Non prioritaire — ajouté au backlog, voir `docs/PLAN_ADVANTAGESPANEL.md` |
| **COM20** | Phase 1 : afficher arme (munitions + type) | Moyenne — Cluster N |
| **COM21** | Collision tokens : deuxième bloqué | Moyenne — Cluster N |
| **COM23** | ~~Label token : fixe, ne rentre pas dans les murs~~ | ✅ Session 127 |
| **FEAT3** | ~~Token actif : cercle de sélection~~ | ✅ Session 127 |
| **UI2** | Alignement dés | Basse — Cluster Q |
| **UI3** | Dé 100 : affichage chat | Basse — Cluster Q |
| **WIZ-1** | Personnages incomplets (creation_state ≠ 'complete') visibles dans la liste | Moyenne — COUCHE 4c |
| **WIZ-2** | Deux compteurs PC (header store vs CareersAllocator local) | Basse — cosmétique |
| **WIZ-3** | Formation "apprentissage_technique" → choix de spécialité non implémenté | Moyenne — COUCHE 4c |
| **CAR1** | Mécanisme "au choix" (`conditional:true`) non implémenté — 34 occurrences lots 2-6 | Moyenne — Step4 UI |
| **CAR2** | `ref_background_skills.skill_id` sans FK vers `ref_skills.id` (même défaut que `ref_career_skills` avant migration 111) | Basse — pas de bug connu, préventif |
| **CAR3** | Prérequis carrières (espion, soldat_elite_*, officier_militaire_souterrain, etc.) non insérés dans `ref_career_prerequisites` | Moyenne — migration dédiée post lots 2-6 |
| **DBG-C1** | `character.user_id` null quand GM crée pour joueur absent (steps 1-3) | Moyenne — sprint futur |
| **JSON1** | `client/src/locales/en.json` invalide — guillemets non échappés `deleteMapConfirm` (préexistant, cassait déjà avant Session 132) | **Haute** — casse tout le fichier EN |
| **OPT-W1** | 4/11 options de campagne (polaris_latent, revers, skill_natural_prog, celebrity) sans effet mécanique branché — `ambiance` ✅ Session 132 suite, `random_mutations` ✅ Session 136, `feminin_bonus` ✅ Session 137, `random_pro_advantages`/`skill_prerequisites` ✅ Session 141, `skill_max_level` ✅ Session 141 (suite 2), `young_penalty` ✅ Session 141 (suite 4) | Moyenne — en cours un par un |
| **OPT-W2** | `style={}` visuel dans les 7 fichiers `client/src/components/campaignSettings/*` (convention CSS) | Basse |
| **MUT1** | `Purulence` (`mutation_id` 30) — `cost_pc = -2` en base, incohérent avec la convention positive des autres mutations "Désavantage" (Difformités) ; `Step3Mutations.jsx:254` (`cost_pc >= 0`) pourrait l'exclure de la liste achetable | Basse — à investiguer |
| **HP1** | Main directrice : `socketCombatHelpers.js:550` et `char-sheet.js:810` lisent `hand_pref` sur `char_sheet` (colonne inexistante) au lieu de `char_identity.hand_pref` → toujours `'R'` par défaut, quel que soit le choix réel du joueur | Moyenne — mécanique jamais appliquée en combat |

---

## Roadmap

- ~~**Sprint Dégâts Drone**~~ ✅ → B6 (Loc) + B7 (Dmg) — Clos Sessions 94
- **Sprint Drones 2d** — auto-announcement drone → voir `docs/Old/PLAN_DRONESYSCOMBAT.md`
- **Sprint Drones 2e** — resolveDroneAutoAction
- **Sprint Drones 3** — Télépilotage (drone lié à PJ pilote)
- **Sprint PLAN 14-1** — Menu contextuel token (right-click → ajouter/retirer statuts)
- **Sprint PLAN 14-2** — Affichage badges (SVGs `docs/Character/Statuts/`, Canvas3D)
- **Sprint PLAN 14-3** — FIX-D + mécaniques enforced (bypass défense stunned/surprised)
- ~~**Sprint stunted_until_turn**~~ ✅ — supplanté par Sprint 14-0 — voir PLAN 14
- **Sprint CaC 4b** — validation fonctionnelle requise avant
- **Sprint Annonce v2** — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- **Sprint Tooltips Compétences** — SkillsPanel bouton ⓘ (déjà codé Session 73)
- **Sprint Waypoints** — déplacement points intermédiaires (déclaration serveur, alt+clic)
- **Sprint Page Santé Serveur** — `/api/health/detailed` (mémoire, uptime, températures)
- **D2 Jets Favoris** — drag-to-reorder macros (sort_order UI)
- **i18n combat+équipement** — 18 composants hors scope (sprint dédié futur)

---

## Points de vigilance permanents

- "La Forêt Maudite" — pas de default_battlemap_id → ne jamais utiliser pour les tests
- token.owner_id — mort → toujours character_id → characters.user_id
- socket dans dependency arrays — tout useCallback qui émet doit inclure socket (P3)
- ordre déclaration React — callback A qui appelle B doit être déclaré APRÈS B (P4)
- coordonnées voxel — données brutes en base, +0.5 uniquement dans le rendu visuel
- reconnectTrigger — ne jamais appeler socket.disconnect/connect depuis Sidebar
- PE14 pos_y/pos_z — pos_y base = Z Three.js, pos_z base = Y Three.js
- charStats.js — fonctions pures, jamais d'accès DB dans ce fichier
- redis.js — maintenance Redis dans REST (POST/DELETE), pas dans handlers WS reliques (PE25)
- resolveEntityState — returning doit inclure battlemap_id (PE26)
- collisionMoveToken — hdel systématique ancienne case, hset conditionnel layer (PE24)
- PE27 moveType — calculé client (feedback) ET recalculé serveur (validation). Si discordance → refus silencieux
- Token GM sans char_sheet → ENTITY_MOVE_REQUEST ignoré silencieusement — comportement documenté V1
- Lerp EntityMesh — useFrame dans sous-composants (pas EntityMesh parent) — règle des hooks
- DiceMesh useMemo — deps [geoDef.type, color, dieType] — dieType obligatoire pour D10 (PE32)
- D10 Html overlay — position=[0,0,0] — ne pas déplacer (PE33)
- P49 — promotion blessures : always GET /wounds si promoted === true (ne pas ajouter wound localement)
- PI11 — polarisRound : source unique `shared/polarisUtils.js` — jamais redéfini localement
- PC41 — Express 5 : routes sans `/` initial → 404 silencieux — toujours `'/:id/foo'`
- PC42 — `WHERE NOT col = 'val'` exclut les NULL en PostgreSQL → toujours `(col IS NULL OR col != 'val')`
- PC43 — `orderByRaw('CASE WHEN ? IS NOT NULL ...')` : PostgreSQL ne peut pas inférer le type UUID sans cast → éviter pour les UUID, préférer le JS post-fetch
- PC44 — `io.fetchSockets()` nécessaire quand le GM clique Agir pour un slot joueur (socket ≠ joueur)
- PC45 — `combat_actions.type` (serveur, valeur brute) ≠ `action_key` (client, clé UI) — deux colonnes distinctes, valeurs identiques pour 'melee'. Confondre les deux → 0 résultat sur les queries
- PC46 — `meleePrecheckId` dans `CombatOverlay` : `activeMeleeAction?.id ?? playerActiveMeleeAction?.id ?? null` — stable en RESOLUTION. `useEffect` doit inclure `[meleePrecheckId, socket]` — re-tourne à chaque reconnexion (SocketProvider crée nouvelle instance)
- PL-Q1 — `getSemanticHTML()` Quill 2.0 retourne vide — utiliser `querySelector('.ql-editor').innerHTML`
- PL-Q2 — Quill insère la toolbar comme `previousElementSibling`, pas à l'intérieur du container — guard `classList.contains('ql-container')`
- PL-Q3 — `containerRef.current` peut être null dans le cleanup React 19 — toujours capturer en variable locale en début d'effect
- PL-Q4 — `editor.destroy()` n'existe pas en Quill 2.0 public API
- P53 — nodemon auto-applique les migrations dès l'écriture du fichier + numéro "disponible" d'`EN_COURS.md` peut être obsolète (travail parallèle non resynchronisé) — détail complet dans `CLAUDE.md`
- P54 — ne jamais rappeler `mig.up(knex)` manuellement sans vérifier `knex_migrations` au préalable (nodemon peut l'avoir déjà appliquée) — un second appel traite des données déjà correctes comme corrompues et peut les détruire silencieusement — détail complet dans `CLAUDE.md`
- P56 — `DICE_RESULT` (socketDice.js) n'inclut jamais `dieType` dans son payload — tout composant qui anime un jet hors `SessionPage` doit le fournir lui-même (constante si formule fixe) sous peine de retomber sur un D6 par défaut — détail complet dans `CLAUDE.md`
