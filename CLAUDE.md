# CLAUDE.md — Projet Enclume
> Session 136 — 2026-07-05

---

## RÈGLES ABSOLUES

CODE > conversation. Jamais travailler de mémoire. Lire les fichiers.
1. Lire le fichier concerné avant toute proposition.
2. Confirmer la lecture : *"Fichier [nom] lu. Trouvé : [...]. Continuer ?"*
3. Plan exact avant de coder — lignes touchées, ce qui change, ce qui ne change pas.
4. "Je code ?" une seule fois, plan complet.
5. Relire le fichier produit en entier avant livraison.
6. Confirmation fonctionnelle obligatoire avant étape suivante.
7. **Un seul bug à la fois.** Plan pour un bug → validation → bug suivant. Jamais deux bugs dans le même plan.
8. **Reprise depuis un résumé = nouvelle session.** Exécuter le protocole complet sans exception.

---

## PROTOCOLE

### Début de session
> **Reprise depuis un résumé = nouvelle session — le résumé ne remplace jamais la lecture.**

- `docs/EN_COURS.md` [[docs/EN_COURS|EN_COURS]] → si la prochaine étape n'est pas claire depuis `## ÉTAT COURANT` ci-dessous.
- `docs/ASBUILT.md` [[docs/ASBUILT|ASBUILT]] → si la tâche touche à l'architecture (nouvelles routes, migrations, nouveaux services).
- `docs/JOURNAL5.md` [[JOURNAL5]] (dernier `## Session N` uniquement) → si un bug précis nécessite l'historique d'une décision.
- **Fichiers domaine → chargés automatiquement** via `.claude/rules/` quand les fichiers source sont ouverts.

### Avant de coder
- Lire les fichiers concernés. Jamais de mémoire.
- Plan exact : lignes touchées, ce qui change, ce qui ne change pas.
- "Je code ?" une seule fois.
- Pour tout composant UI : inventaire exhaustif (chaque bouton/input/handler) avant "Je code ?".

### Pendant le développement
- **Run à vide autocentré obligatoire** à la fin de chaque étape.
- **Sessions analytiques (audit, investigation, debug) :** utiliser `docs/JOURNALTEMP.md` comme scratch pad. Contenu périssable — ne jamais inclure dans la lecture obligatoire. Consolider vers JOURNAL5.md en fin de session.

### Après chaque tâche confirmée fonctionnelle
- Appender [[JOURNAL5]]
- Mettre à jour le header date de tout fichier `.md` modifié.
- Proposer un scénario de test (étapes + résultat attendu) avant de passer à la suite.
- Fin de session : mettre à jour [[docs/EN_COURS|EN_COURS]], [[docs/ROADMAP|ROADMAP]], [[docs/ASBUILT|ASBUILT]], [[CLAUDE]]
- Fin de session : mettre à jour [[client/public/CHANGELOG|CHANGELOG]] — `## vN — date — titre`.
- Rappeler le push Git :
```powershell
git add .
git commit -m "Session N — ..."
git push origin master
```

### Fermeture de bug
Toute clôture ✅ exige :
- **Testé :** [ce qui a été vérifié]
- **Non testé :** [ce qui reste] → si non vide : `⚠️ clos partiel`

### Jamais
- Coder sans confirmation.
- Réécrire un fichier sans l'avoir relu dans cette session.
- Avancer sans confirmation fonctionnelle.
- Écrire "probablement / suppose / certainement" sur une cause non lue → `[INCONNU]` + `[DBG-X]`.
- Proposer un plan couvrant plusieurs bugs simultanément → un seul bug par plan.
- Traiter un résumé de conversation comme substitut à la lecture obligatoire des fichiers.
- Proposer un correctif par contournement ou patch arithmétique quand l'architecture correcte existe — toujours la solution robuste et pérenne, même pour un bug mineur.

---

## DÉTECTEUR DE DÉRIVE

→ "rapide / suppose / probablement / certainement / évidemment / je pense que / devrait" → STOP. Tous les fichiers lus ?
→ Diagnostic de cause racine sans lecture de code → STOP. `[INCONNU]` + `[DBG-X]`.
→ Fermer un bug sans "Testé / Non testé" → STOP.
→ "Je code ?" pour la 2e fois sur le même sujet → STOP. Plan complet → code directement.
→ Question de diagnostic console F12 → STOP. Lisible dans le code source ?
→ Créer événement WS / composant / fonction → STOP. Existe déjà ?
→ Implémenter mécanique de combat → STOP. `docs/REGLESYSCOMBAT.md` lu dans cette session ?
→ Conversation reprise depuis un résumé → STOP. Protocole début de session complet avant toute proposition.
→ Plan mentionnant deux bugs ou plus → STOP. Un bug à la fois.
→ Déclarer `[VÉRIFIÉ]` après lecture du code uniquement → STOP. Lire = `[HYPOTHÈSE]`. `[VÉRIFIÉ]` = instrumenté + observé en exécution.
→ Proposer un correctif sur une cause `[HYPOTHÈSE]` non instrumentée → STOP. Étape instrumentation obligatoire d'abord.
→ Bug non reproductible avant analyse → STOP. Documenter les conditions, ne pas analyser à l'aveugle.
→ Solution "temporaire" / "pour l'instant" / "patch rapide" proposée → STOP. Concevoir pour la durée dès le départ.

---

## PROJET

Enclume — VTT maison. Sessions privées 4–8 joueurs, Raspberry Pi 4.
Stack : React 19 + Vite / Node.js + Express + Socket.io / PostgreSQL + Redis + MinIO / Three.js R3F / Zustand / JWT httpOnly.
Zustand déjà en place pour les fonctionnalités existantes — tout nouveau domaine (ex : wizard création) suit le même pattern. Jamais de state local inter-étapes ou inter-composants quand un store existe.
Monorepo : `client/` + `server/` + `shared/` + `docs/`.
Démarrage : `.\start.ps1` depuis `Enclume/`. Vérification : `http://localhost:3001/api/health` + `http://localhost:5173`.
Git — toujours depuis `Enclume/`, jamais depuis `server/` ou `client/`.
Serveur Alpha "Kiwi" : `http://89.92.219.211:8193` — voir `docs/SERVEURDISTANTKIWI.md`.

**Nomenclature docs :**
| Préfixe | Rôle |
|---|---|
| `docs/SYSTEME/*.md` | Spécifications techniques d'implémentation (lire sur demande via rules) |
| `docs/REGLE*.md` | Sources de vérité règles Polaris (LdB) — source absolue |
| `docs/MANUEL*.md` | Synthèse technique des règles (séquences, pipeline) |
| `docs/PLAN_*.md` | Planifications réalisées ou en cours |
| `docs/ARCHI_REWORK.md` | Bible des reworks actifs |
| `docs/ARCHI_REWORK_DONE.md` | Specs complètes des reworks achevés |
| `.claude/rules/*.md` | Règles domaine — chargées automatiquement (path-scoped) |

---

## ÉTAT COURANT — Session 136 (2026-07-05)

- Phase 0 ✅ / Phase 1 ✅ / Phase 2 en cours
- **122 migrations stables** (117_ref_mutation_subtypes_description — Session 136 ;
  109_mutation_stacking + 108_fix_ref_mutations_encoding — Session 135 ;
  deux numéros 108/109 distincts coexistent avec le seeding carrières, voir P53)

**Session 136 — PLAN_STEP4 : mutations réelles dans le Wizard Step3 ✅ clos :**
- Migration 117 (`ref_mutation_subtypes.description` + backfill 4 lignes CGA) ; backend
  `getStep3RefData()` (mutations + `subtable` + `skills` imbriqués, pattern `Map` identique à
  `getStep4RefData`), route `GET /:sheetId/step3/ref`, `randomMutationsEnabled` propagé depuis
  `startCreation`.
- `Step3Mutations.jsx` réécrit entièrement (mocks supprimés) : 45 mutations réelles, variantes
  (Difformités, Organe sensoriel manquant/suppl., Résistance naturelle) libellées avec les vrais
  termes de la rulebook (vérifiés dans `REGLE_MUTATION.md`/`REGLE_AVANTAGES.md` avant codage —
  "légère/importante", pas "mineure/majeure" comme supposé initialement), tirage aléatoire sur un
  vrai D100 par plage avec relance sur doublon `is_unique`. `mutationsMeta` alimente
  `WizardReview.jsx` sans accès i18n/DB.
- Correctif UX post-fonctionnel (demande Saar) : halo de confirmation temporaire (`.wiz3-card-flash`,
  `index.css`) sur la carte cliquée — préférée à un déplacement de la liste de sélection.
- **Testé :** SR + fonctionnel confirmé par Saar (parcours Step3), halo confirmé fonctionnel,
  lint/syntaxe validés sur tous les fichiers touchés (`node --check`, `JSON.parse`, ESLint).
- **Non testé :** round-trip migration 117, achat stackable 2× et tirage D20/D100 en conditions
  réelles navigateur, toggle `random_mutations`.
- Détail complet : `docs/JOURNAL6.md` "Session 136".

**Session 135 — Bug encodage `ref_mutations` (migration 108) + PLAN_MUTATION stacking (migration 109) ✅ clos :**
- Bug découvert lors du run à vide sur PLAN_MUTATION : `95_seed_ref_mutations.js` insère du texte
  mojibake (octets UTF-8 mal réinterprétés en Windows-1252 puis ré-encodés) — 44/45 lignes
  `ref_mutations`, 4/4 `ref_mutation_subtypes`, 4 `ref_mutation_skills` corrompues. `108_fix_ref_mutations_encoding.js`
  (NOUVEAU) : transformation CP1252 déterministe et réversible, cross-vérifiée contre `docs/Character/Creation/REGLE_MUTATION.md`.
- **Incident et remédiation** (voir P54 ci-dessous) : rappel manuel redondant de `up()` après
  l'auto-application par nodemon a corrompu 6 lignes (remplacement `�`) ; réparation par extraction
  regex a introduit un second bug (décalage de `description`) ; corrigé définitivement par valeurs
  en dur cross-vérifiées. Détail complet : `docs/JOURNAL6.md` "Session 135".
- `109_mutation_stacking.js` (NOUVEAU) : colonne `ref_mutations.stack_deltas` (JSONB) sur les 9 lignes
  à incrément non-linéaire + réécriture `char_mutation_effects_view` (`SUM(base + (count-1) × COALESCE(delta, base))`).
- `creationService.js:245-269` (`finalizeCreation` STEP 3) : upsert `ON CONFLICT` sur l'index partiel
  `uq_char_mut_no_sub` — mutation stackable achetée 2× dans le même lot → `count` incrémenté au lieu
  de violer la contrainte unique.
- **Testé :** formule de stacking (3 scénarios), upsert anti-doublon, round-trip migration 109
  (`down`/`up`, jamais deux `up()` de suite), 45/45+4/4+10/10 lignes décodées sans anomalie —
  tout via transactions Postgres annulées ou vérifications directes en base.
- **Non testé :** parcours réel dans le wizard (`Step3Mutations.jsx` utilise encore le mock, confirmé
  par Saar — attendu tant que PLAN_STEP4 n'est pas implémenté, désormais débloqué).
- Plan archivé : `docs/Old/PLAN_MUTATION.md`.

**Session 134 suite — Lots 2-6 carrières (32 carrières) + FK ref_career_skills ✅ clos :**
- Migrations 108-109 (lot2), 111 (FK + suppression `skill_group`), 112-116 (lots 3-6). **37/37 carrières** en base, illustrations incluses directement dans chaque migration de seed (plus de migration séparée comme au lot 1).
- **Correction architecturale majeure** : `ref_career_skills.skill_id` a désormais une vraie FK vers `ref_skills.id` (`ON DELETE RESTRICT`) ; `skill_group` (texte libre jamais aligné avec `ref_skills.family`, source d'un bug de fragmentation UI) supprimé — le regroupement UI utilise désormais `ref_skills.family` via JOIN (`creationService.js:133`, `CareersAllocator.jsx:44-46`). Détail : `docs/Old/PLAN_CAREER_SKILLS_FK.md`.
- 2 bugs `required_genotype` trouvés et corrigés (`hybride_trident` → `GEN_HYB`, `techno_hybride` → `TEC_HYB` — valeurs inventées ne correspondant à aucun `ref_genotypes.id`).
- Détail complet : `docs/Old/PLAN_LOTS_3_6_CAREERS.md`, `docs/JOURNAL6.md` "Session 134 suite".
- **Testé :** 37/37 carrières, 0 orphelin FK, 0 carrière sans illustration, round-trip `up`/`down`/`up` par migration, wizard Step4 confirmé fonctionnel par Saar (carrières + génotypes + regroupement par famille).
- **Non testé :** branchement UI de `ref_career_equipment`/`ref_career_random_benefits`/`ref_career_point_categories` (peuplés mais non consommés par le code — chantier séparé) ; prérequis carrières (`ref_career_prerequisites`, non insérés).

**Session 134 — Migration 106 : correction lot 1 carrières (ref_career_skills) ✅ clos :**
- `106_fix_ref_career_skills_lot1.js` (NOUVEAU) : 9 corrections `skill_id`/`conditional` sur 5 carrières (artisan_artiste, assassin, barman, chasseur_primes, contrebandier) vs `REGLE_PROFESSION.md`. Aucune suppression `ref_careers`. C3 barman (armes au choix) hors scope. 93 lignes finales.
- **Incident et remédiation** : test round-trip via `npx knex migrate:down` a ciblé par erreur `99_char_advantages_v2.js` au lieu de 106 (tri lexical des noms de fichiers — voir P52 ci-dessous), droppant `char_advantages` + `char_pc_ledger.pc_postcreation`. Table vide au moment de l'incident, confirmé par Saar (aucune perte). Schéma restauré immédiatement, bookkeeping `knex_migrations` réparé. Détail complet : `docs/JOURNAL6.md` "Session 134".
- Round-trip de 106 refait proprement via appel direct des fonctions `up`/`down` du module (contourne le piège CLI) : byte-identique confirmé.
- **Testé :** 9 corrections vérifiées en base (93 lignes), round-trip `up`/`down`/`up` ✅, schéma `char_advantages` restauré ✅, wizard Step4 sur les 5 carrières confirmé par Saar (« all ok »)
- **Non testé :** —

**Session 133 — Migration 37-bis : consolidation ref_skills (3ᵉ révision) ✅ clos :**
- `105_ref_skills_37bis.js` (NOUVEAU) : `attr_1` nullable + colonne `is_category` (remplace le sentinel `attr_1='CHC'`) ; 2 suppressions (`MUTATION`, `ARMES_SATELLITES`) + re-parentage 8 mutations vers `CONTROLE_DES_MUTATIONS` ; 11 labels + 4 attrs + 113 markers corrigés (legacy `'S'` → vraie valeur LdB) ; 1 déplacement `ref_skill_requirements`. 249 lignes finales (251−2).
- `up`/`down` testés en base réelle : round-trip byte-identique vérifié (diff exit 0 sur les 251 lignes pré-migration).
- `SkillsPanel.jsx` : sentinel `attr_1==='CHC'` → `is_category` (8 catégories rejoignent le regroupement UI : Arts martiaux, Connaissance milieu naturel, Langages spécifiques, Langue ancienne, Langue étrangère, Manœuvre d'armure, Mécanique, Tactique). En-tête de colonnes par famille fusionné avec le nom de famille (contre-proposition Saar) — remplace le libellé générique "Compétence" répété, garde repli/dépli.
- **Effet de bord identifié et validé (pas un bug)** : les compétences `(X)` corrigées (ex-`'S'`) suivent désormais la règle de visibilité normale (masquées tant que non apprises) — comportement identique à `Pouvoirs Polaris`, confirmé voulu par Saar.
- **Testé :** round-trip DB ✅, regroupement 17 catégories en navigateur (normal + Progression) ✅, repli/dépli en-tête fusionné ✅
- **Non testé :** achat XP d'une compétence `(X)` nouvellement corrigée en mode Progression (logique inchangée, non re-testée explicitement)

**Dettes actives :**
- `SkillsPanel.jsx:155` (`isVisible`) — `if (skill.attr_1 === 'CHC') return false` code mort (jamais atteint vu les points d'appel actuels) — cosmétique, sans impact
- `server/src/routes/character/ref.js:38` — commentaire "234 skills" obsolète (table à 249 lignes désormais) — cosmétique
- **Résiduel split-brain** — `COMBAT_STATE_SYNC` reconnexion RESOLUTION — sprint futur
- "Changer le mode de tir" — non implémenté — sprint futur
- `useDiceAudio.js` — sons dés
- `.gitattributes:3` — attribut invalide
- Kiwi P-SRV-5 — ports Docker non restreints à 127.0.0.1
- `onTokenRotate` dead code Canvas3D/Scene
- `getVoxelSurfaceTop` — pas de cas slope/wedge
- Sprint Annonce v2 — actions précédentes en lecture seule (GmDeclareWindow + ActionWindow)
- Surprise critique (roll=1) → initiative=1 — à analyser
- [DBG-C1] Owner wizard — `character.user_id` null quand GM crée pour joueur absent (steps 1-3 non implémentés)
- **[WIZ-1]** Personnages incomplets (creation_state ≠ 'complete') visibles dans la liste — à filtrer côté Dashboard/liste
- **[WIZ-2]** Deux compteurs PC (header store vs CareersAllocator local) — cosmétique, sprint COUCHE 4c
- **[WIZ-3]** Formation "apprentissage_technique" → choix spécialité non implémenté — sprint COUCHE 4c
- **[JSON1]** `client/src/locales/en.json` invalide — guillemets non échappés `deleteMapConfirm` (préexistant) — casse tout le fichier EN
- **[OPT-W1]** 9/11 options de campagne sans effet mécanique branché (Wizard/SkillsPanel/CharSheet) — `ambiance` et `random_mutations` câblées — sprint futur
- **[OPT-W2]** `style={}` visuel dans `client/src/components/campaignSettings/*` (convention CSS) — basse priorité
- **[CAR1]** Mécanisme "au choix" (`conditional:true`) non implémenté dans le wizard — 34 occurrences lots 2-6 carrières, nécessite bouton radio/toggle Step4 UI (MVP) avant refonte complète

---

## PIÈGES CRITIQUES

**P1 — token.owner_id mort**
→ Toujours : `token.character_id → characters.user_id`.

**PE14 — coordonnées entités pos_y/pos_z inversés**
`pos_y` DB = profondeur (Z Three.js). `pos_z` DB = altitude (Y Three.js).
```js
{ pos_x: pos.x, pos_y: pos.z, pos_z: pos.y }  // Three.js → DB
```

**BUG C — weapon_inv_id ≠ item_id**
`ref_equipment_skill_assoc.item_id` FK → `ref_equipment.id`, pas `char_inventory.id`.
Pattern : `weapon_inv_id → char_inventory.equipment_id → ref_equipment_skill_assoc WHERE item_id = equipment_id`.
Erreur → skillTotal = 0, assaut toujours raté.

**P51 — effectiveMalus formule exacte**
```js
effectiveMalus = calcWoundPenalty(wounds) - calcEncumbrancePenalty(weight, FOR)  // ≤ 0
chancesDeReussite = skillTotal + totalDiffMod + effectiveMalus
```

**PC27 — Entité ≠ PNJ**
`!token.character_id` = entité de décor. PNJ = `character.type === 'pnj'`.

**P3 — socket dans les dependency arrays**
Tout `useCallback` qui émet via socket doit inclure `socket` dans ses deps.

**[R8-27] — socket.campaignId / socket.role dépendance implicite post-REWORK-08**
`socket.campaignId` et `socket.role` restent settées dans SESSION_JOIN. Les helpers de `socketCombat.js` (`resolveMeleeAction`, `resolveReloadAction`, `COMBAT_MELEE_DEFENSE_CONFIRM`) les utilisent via `io.fetchSockets()` pour retrouver des sockets tiers. Supprimer ces deux lignes de SESSION_JOIN casse le CaC PJ↔PJ silencieusement.

**P52 — `knex migrate:down`/`migrate:latest` (CLI) ciblent par tri lexical des fichiers, pas par `knex_migrations`**
Numéros de migration à largeur inégale (`99_...` vs `100_...`-`106_...`) trient mal en lexical (`'9' > '1'`) : `migrate:down` sans argument peut rollback la mauvaise migration silencieusement (vécu Session 134 — `99_char_advantages_v2.js` droppé au lieu de `106_...`). Pour tester un round-trip `up`/`down` d'une migration précise : **appeler directement les fonctions exportées du module** (import du fichier + `await mig.down(knex)` / `await mig.up(knex)`), jamais la CLI knex brute sur ce projet.

**P53 — nodemon auto-applique les migrations dès qu'un fichier est écrit dans `server/`**
`server/src/index.js:103` appelle `db.migrate.latest()` au démarrage. `nodemon` (aucun `nodemonConfig` dans `package.json`) watch tout `server/` par défaut → toute écriture de fichier (même un script de test `.cjs`) déclenche un restart qui auto-applique les migrations en attente, avant tout test contrôlé. Vécu Session 134 suite : collision de numéro de migration (107 déjà pris) + crash serveur temporaire (bookkeeping désynchronisé après renommage). Vécu à nouveau Session 135 : mes migrations 108/109 (encodage + stacking mutations) coexistent avec deux autres fichiers 108/109 du seeding carrières (numéros dupliqués, sans collision de fichier ni conflit fonctionnel — tables disjointes — mais numérotation trompeuse pour toute lecture future). **Procédure sûre** : écrire tous les scripts de vérification/test en `node -e` inline (Bash), jamais de fichier dans `server/`, pour éviter tout redéclenchement pendant les tests. Avant de vérifier le prochain numéro de migration libre : toujours `ls server/src/db/migrations/` (ne pas se fier uniquement à EN_COURS.md, qui peut être en retard sur un travail parallèle non documenté).

**P54 — jamais rappeler `mig.up(knex)` manuellement sans vérifier `knex_migrations` au préalable**
Conséquence directe de P53 : si nodemon a déjà auto-appliqué la migration entre son écriture et le test manuel, un second appel direct à `up()` traite des données **déjà correctes** comme si elles étaient corrompues. Vécu Session 135 : `decodeMojibake()` rappelée sur du texte déjà décodé — les caractères déjà propres (code point ≤ 0xFF) sont repoussés comme octet UTF-8 isolé, produisant une séquence invalide que Node remplace silencieusement par `�` (**aucune erreur levée**, donc aucun signal d'alerte avant relecture manuelle du résultat). 6 lignes `ref_mutations` endommagées avant qu'un caractère non mappable ne fasse enfin planter la boucle. **Procédure sûre** : toujours `SELECT` la table `knex_migrations` (`WHERE name = '...'`) avant tout appel manuel à `up()`/`down()` ; pour un round-trip, ne jamais enchaîner deux `up()` sans `down()` entre les deux.

---

## CONVENTIONS

**Communication :**
- SR = Serveur Redémarré sans erreur. Si erreur → copier intégralement.
- Félicitations ≠ validation.
- **CaC = Corps à corps** (melee). **CC = Coup par coup** (mode de tir, tir unique distance).

**CSS (Session 76) :**
- Bouton → `className="btn"` ou variante (`.btn-ghost`, `.btn-danger`, `.btn-gold`, `.btn-icon`, `.btn-toggle`, `.btn-tool`)
- Badge → `className="badge badge-gm"` etc.
- `style={}` = layout/position calculé uniquement (width, flex, margin, top) — jamais visuel.
- Valeurs visuelles dynamiques → CSS custom property.
- Classes dans `index.css` Section 10 — modifier une classe = modifier partout.

**i18n :**
- Aucune string UI hardcodée. Toujours `useTranslation` → `t('section.cle')`.
- Source unique : `client/src/locales/fr.json`. Ajouter la clé avant de l'utiliser.
- Combat (12) + équipement (6) : hors scope — sprint dédié futur.
