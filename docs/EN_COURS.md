# EN COURS — Dettes actives et prochaines étapes
> Dernière mise à jour : 2026-07-05 Session 136
> Contenu : dettes actives + roadmap + points de vigilance permanents.
> Historique complet : voir `docs/JOURNAL6.md`, `docs/Old/JOURNAL5.md et `docs/Old/JOURNAL4.md` et `docs/Old/JOURNAL3.md`

---

## ⚡ PROCHAINE ÉTAPE EXACTE

> Lire ce bloc en PREMIER. Il indique quoi faire maintenant, dans quel ordre, et vers quel fichier aller.

> Items "0." à "3." (seeding carrières + mutations) tous clos depuis Session 136. Aucune étape
> unique explicitement désignée par Saar pour la suite — voir item "41." (options de campagne,
> un par un, déjà en cours) et "Notes Saar" ci-dessous pour les pistes ouvertes (Step4 Expérience,
> Step4 Profession UI). À clarifier avec Saar en début de prochaine session.

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
   → Prochaine migration disponible : **118** (117 consommée cette session).
   → Prérequis carrières (espion, soldat_elite_*, officier_militaire_souterrain, etc.) : à traiter dans une migration dédiée, cf. PIÈGE 7 `JOURNALCOUCHE4.md`.

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

**41. Options de campagne — effets mécaniques (1/11) : `ambiance` ✅ câblée — Session 132 suite** ← EN COURS, un par un
   → Audit complet des 11 options dans `docs/optionCampagne/PLAN_OPTCAMP.md` (Niveau 1/2/3 par complexité)
   → `ambiance` : mock supprimé (`WizardCreation.jsx`), `startCreation`/`creationStore` transmettent la vraie valeur, `finalizeCreation` revalide via `validateStep1` (code mort réactivé, `shared/polarisUtils.js:187`)
   → **Testé** : SR ✅, fonctionnel ✅
   → **Prochain** : `feminin_bonus` (sélecteur Sexe toujours affiché, prop `isFeminin` ignorée `_deprecated` dans `Step1Attributes.jsx:36`)

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
- **122 migrations appliquées** (117_ref_mutation_subtypes_description — Session 136 ;
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
| **OPT-W1** | 9/11 options de campagne (feminin_bonus, polaris_latent, random_pro_advantages, revers, skill_prerequisites, skill_max_level, skill_natural_prog, young_penalty, celebrity) sans effet mécanique branché — `ambiance` ✅ câblée Session 132 suite, `random_mutations` ✅ câblée Session 136 (masque la carte "Tirage aléatoire" Step3 si désactivée) | Moyenne — en cours un par un |
| **OPT-W2** | `style={}` visuel dans les 7 fichiers `client/src/components/campaignSettings/*` (convention CSS) | Basse |

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
