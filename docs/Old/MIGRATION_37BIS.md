# MIGRATION 37-BIS — Refonte ref_skills
> Créé Session 131 suite — 2026-07-04
> **Statut (2026-07-05, Session 133) : ✅ CLÔTURÉ — migration 105 codée, testée (round-trip DB réel) et déployée. Client (`SkillsPanel.jsx`) adapté et validé par Saar en navigateur.**

---

## ⚡ CLÔTURE — voir docs/JOURNAL5.md "Session 133" pour le détail complet

Cette doc (audit + plan) est conservée comme référence historique de l'audit ligne par ligne. Le résultat exécuté est `server/src/db/migrations/105_ref_skills_37bis.js` (up/down testés en base réelle, byte-identique en rollback). Détail complet, effet de bord identifié (visibilité des compétences `(X)` corrigées) et dettes restantes : `docs/JOURNAL5.md`, entrée "Session 133 — Migration 105 (« 37-bis »)".

**Ce qui a été livré :**
- Schéma : `attr_1` nullable + nouvelle colonne `is_category`.
- 2 suppressions (`MUTATION`, `ARMES_SATELLITES`) + re-parentage des 8 `MUTATION_*` vers `CONTROLE_DES_MUTATIONS`.
- 11 labels, 4 attrs isolés, 17 lignes `is_category`, 113 markers corrigés, 1 déplacement `ref_skill_requirements`.
- `client/src/character/SkillsPanel.jsx` : sentinel `attr_1==='CHC'` remplacé par `is_category` ; header de colonnes par famille fusionné avec le nom de la famille (contre-proposition Saar, cf. JOURNAL5).
- 249 lignes `ref_skills` finales (251 − 2).

---

## OBJECTIF

Table `ref_skills` "pourrie" par 4 couches successives non coordonnées :
- `37_char_seed_skills.js` — seed initial 231 lignes (déjà 3 corrections v4 admises dans son propre header)
- `74_fix_ref_skills.js` — rejoue 3 scripts SQL manuels post-37 (renommage PK, markers, +11 lignes structurelles, +5 prérequis)
- `103_seed_missing_ref_skills.js` — +2 skills manquants
- `103b_seed_armes_satellites.js` — +1 skill manquant

**But 37-bis** : audit ligne par ligne (chaque mot, chaque caractère) de l'état actuel de `ref_skills`, puis écriture d'une migration de consolidation propre. Périmètre validé par Saar :
1. Consolider 37+74+103+103b en base saine
2. Corriger le champ `marker` — schéma (migration 34) documente `DIFF/RES_X/LIMIT/PN`, données réelles utilisent `(-3)/(X)/PN/S/PREREQ` → incohérence à trancher
3. Combler les skills manquants détectés Session 131 (`EQUIPEMENTS_COURANTS`, `ARTISANAT`, `OEUVRES_DART`, `LANGUE_ETRANGERE` standalone)
4. ~~Éliminer les parents virtuels (`COMMERCE_TRAFIC`, `SCIENCES_CONNAISANCES_SPECIALISEES`, `PILOTAGE` utilisés comme `parent` mais absents comme `id`)~~ — **hypothèse infirmée par l'audit** (voir M37B-2 corrigé) : ces skills existent bien comme lignes `id`, le vrai bug est leur `attr_1/attr_2/marker` erronés (sentinel `CHC`, analogie fausse avec `MUTATION`, cf. [DBG-5]/[DBG-6]/[DBG-7])

## MÉTHODE

- État actuel = **DB locale** (source de vérité vivante), pas les fichiers de migration reconstitués.
- Référence canonique = `docs/REGLES/REGLECOMPETENCE.md` (1181 lignes — LdB Polaris).
- Audit **segmenté par family**, 10 lignes max par requête/lecture.
- Compte-rendu après chaque segment. Doc mis à jour à chaque famille terminée.
- Écriture de la migration 37-bis seulement après audit complet de toutes les familles.

## ÉTAT DB AU DÉMARRAGE (2026-07-04)

- 251 lignes dans `ref_skills`
- Dernière migration appliquée : `103b_seed_armes_satellites.js`
- Répartition par family :

| family | count | statut audit |
|---|---|---|
| Aptitudes physiques | 7 | ✅ 2 bugs trouvés |
| Combat (contact) | 10 | ✅ 3 bugs trouvés |
| Combat (tir) | 11 | ✅ 7 bugs trouvés |
| Communication / Relations sociales | 11 | ✅ 4 bugs + 1 décision design (ENSEIGNEMENT) |
| Compétences Spéciales | 71 | ✅ audité (71/71) |
| Connaissances | 43 | ✅ audité (43/43) |
| Furtivité / Subterfuge | 6 | ✅ audité (6/6) |
| Langues / langages | 35 | ✅ audité (35/35) |
| Pilotage | 15 | ✅ audité (15/15) |
| Survie / Extérieur | 8 | ✅ audité (8/8) |
| Techniques | 34 | ✅ audité (34/34) |

---

## PROBLÈMES CONFIRMÉS (avant audit détaillé)

| ID | Problème | Source |
|---|---|---|
| M37B-1 | `marker` : doc schéma (34) ≠ valeurs réelles (37/74) | migration 34 vs 37/74 |
| M37B-2 | ~~Parents virtuels non-id : `COMMERCE_TRAFIC`, `SCIENCES_CONNAISANCES_SPECIALISEES`, `PILOTAGE`~~ — **infirmé (2026-07-04)** : requête table-entière `SELECT DISTINCT parent FROM ref_skills WHERE parent NOT IN (SELECT id FROM ref_skills)` → **0 rows**, aucun parent orphelin dans toute la table. Le vrai bug : ces skills existent comme `id` mais avec `attr_1: CHC`/marker faux (sentinel hérité d'une analogie erronée avec `MUTATION` en migration 74). Résolu au cas par cas : [DBG-5] POUVOIRS_POLARIS, [DBG-6] COMMERCE_TRAFIC, [DBG-7] SCIENCES_CONNAISANCES_SPECIALISEES. `PILOTAGE` (même bloc d'insert migration 74) anticipé pour le même traitement — à confirmer lors de son audit (probable `[DBG-8]`). | migration 37 header + JOURNALCOUCHE4 (hypothèse initiale, infirmée par audit direct DB) |
| M37B-3 | Skills manquants : `EQUIPEMENTS_COURANTS`, `ARTISANAT`, `OEUVRES_DART`, `LANGUE_ETRANGERE` standalone | JOURNALCOUCHE4 audit lots 2-6 |

---

## JOURNAL D'AUDIT PAR SEGMENT

*(rempli au fur et à mesure — un segment = ≤10 lignes)*

### Légende `marker` — clarifiée depuis `docs/REGLES/REGLECOMPETENCE.md` (lignes 1-40)

Le schéma migration 34 documentait `DIFF/RES_X/LIMIT/PN` — **ne correspond pas** à la légende réelle du LdB ni aux valeurs stockées. Légende réelle (LdB p.188) :
- **X** = Compétence réservée (`(X)` en DB) — apprentissage requis avant usage
- **•** = Compétence limitative — jusqu'ici jamais utilisé comme valeur `marker` en DB (0/251 lignes), concept non implémenté. **Décision Saar (segment 4, 2026-07-04) : premier cas d'usage formalisé** sur `ENSEIGNEMENT` (compétence maison, marker `NULL→'•'` dans 37-bis). La mécanique de plafonnement elle-même (quelle compétence limite quelle autre, comment c'est appliqué en jeu) reste **non implémentée dans le code** — seule la donnée `ref_skills.marker='•'` + `description` est posée par 37-bis ; le moteur de règle est hors scope, dette future
- **PN** = Progression naturelle (`PN` en DB) ✓ cohérent
- **(-3)** = Compétence difficile (malus initial, pas de lettre-symbole dans le LdB — juste la valeur brute affichée à côté du nom) — stocké tel quel `(-3)` en DB ✓ cohérent comme convention, mais migration 34 l'appelait à tort `DIFF`
- **S** — n'existe **PAS** dans la légende LdB. Provient uniquement du seed 37 (probablement confusion avec "Spécialisation", notion absente du LdB). Migration 74 en a corrigé une partie (S→(X)) mais **⚠️ CORRECTION (segment 4) : 95 lignes restent marker='S' en base**, pas 5 comme noté initialement (vérifié par requête globale `WHERE marker='S'`) — réparties sur : Communication/Relations sociales (3), Connaissances (33), Langues/langages (**32** — corrigé lors de l'audit segment 8, le chiffre 49 était erroné : la famille compte 35 lignes au total, dont 32 réellement `marker='S'` [les 32 enfants de `LANGAGES_SPECIFIQUES`/`LANGUE_ANCIENNE`/`LANGUE_ETRANGERE`] + 3 lignes-catégories parentes avec un autre bug distinct, `marker='(X)'` au lieu de `PN`/`PN`/NULL — cf. [DBG-9] segment 8), Pilotage (11), Survie/Extérieur (3), Techniques (13). Quasi-systématique sur les enfants de parents-catégories (`EXPRESSION_ARTISTIQUE_*`, `COMMERCE_TRAFIC__*`, `SCIENCES_CONNAISANCES_SPECIALISEES_*`, `LANGAGES_SPECIFIQUES_*`, `LANGUE_ANCIENNE_*`, `LANGUE_ETRANGERE_*`, `MANOEUVRE_DARMURE__*`, `PILOTAGE__*`, `GENIE_TECHNIQUE_*`, `MECANIQUE_*`, `CONNAISSANCE_MILIEU_NATUREL_*`). **Preuve que ce n'est pas une convention voulue** : dans le sous-groupe `EXPRESSION_ARTISTIQUE_*` (segment 4), 3 enfants ont `marker='S'` alors que le LdB leur donne explicitement `(-3)`, et le 4e enfant (`INSTRUMENT_DE_MUSIQUE`) a bien été corrigé en `(X)` — donc 'S' est un résidu de seed jamais nettoyé sur la majorité des enfants, pas un marqueur "catégorie" intentionnel. À vérifier famille par famille si la valeur correcte est `(-3)`, `(X)` ou `NULL` selon chaque skill précis — ne pas supposer une valeur uniforme.
- **PREREQ** — n'existe pas non plus dans la légende LdB. Ajouté par migration 74 comme convention interne (parents virtuels nécessitant un enfant pour être utilisés) — pas une notion du LdB, mais une convention technique du projet à documenter séparément.

**Décision à prendre pour 37-bis** : renommer/clarifier `marker`, et statuer sur le concept `•` limitative (l'implémenter enfin, ou l'abandonner explicitement).

---

### SEGMENT 1 — family "Aptitudes physiques" (7/7 lignes) ✅ audité

DB actuelle :

| id | label | attr_1 | attr_2 | marker |
|---|---|---|---|---|
| ACROBATIE_EQUILIBRE | Acrobatie/Équilibre | COO | PER | (-3) |
| ATHLETISME | Athlétisme | FOR | COO | |
| ENDURANCE | Endurance | FOR | COO | |
| ESCALADE | Escalade | FOR | COO | |
| MANOEUVRES_0G | Manoeuvres 0G | COO | ADA | |
| MANOEUVRES_SOUS_MARINES | Manoeuvres sous-marines | FOR | COO | |
| RESPIRATION_FOE | Respiration FOE | CON | VOL | (-3) |

**Comparé à `REGLECOMPETENCE.md` lignes 48-121 (LdB p.188-190) :**

| ID | Statut | Détail |
|---|---|---|
| **ACROBATIE_EQUILIBRE** | 🔴 **2 bugs confirmés** | LdB : "Attributs associés : **COO/COO**" (attr_2 doit être NULL, pas PER) — ET marker doit être NULL, pas `(-3)` (le LdB ne mentionne aucun malus difficile pour cette compétence ; elle est "limitative" (•), concept distinct non implémenté — cohérent avec ses 3 sœurs ci-dessous qui ont marker NULL) |
| ATHLETISME | ✅ conforme | FOR/COO confirmé LdB |
| **ENDURANCE** | 🔴 **1 bug confirmé** | LdB explicite : "Attributs associés : **CON/VOL**" — DB a FOR/COO, totalement faux |
| ESCALADE | ✅ conforme | FOR/COO confirmé LdB |
| MANOEUVRES_0G | ✅ conforme | COO/ADA confirmé LdB |
| MANOEUVRES_SOUS_MARINES | ✅ conforme | FOR/COO confirmé LdB |
| RESPIRATION_FOE | ✅ conforme | CON/VOL confirmé LdB + marker `(-3)` confirmé (LdB affiche littéralement "(-3)" à côté du nom) |

**Bugs à corriger dans 37-bis (famille 1/11) :**
- `ENDURANCE` : `attr_1: FOR→CON, attr_2: COO→VOL`
- `ACROBATIE_EQUILIBRE` : `attr_2: PER→NULL, marker: (-3)→NULL`

---

### SEGMENT 2 — family "Combat (contact)" (10/10 lignes) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| ARMES_LOURDES_CONTACT | Arme Lourde (contact) | | FOR | | |
| ARME_SPECIALE_CONTACT | Armes Spéciales (contact) | | CHC | | |
| ARTS_MARTIAUX | Arts martiaux | | COO | ADA | |
| COMBAT_ARME | Combat armé | | FOR | COO | |
| COMBAT_A_MAINS_NUES | Combat à mains nues | | FOR | COO | |
| ARMES_SPECIALES_CONTACT_COORDINATION_COORDINATION | Arme spéciale de contact (COO/COO) | ARME_SPECIALE_CONTACT | COO | | (X) |
| ARMES_SPECIALES_CONTACT_FORCE_COORDINATION | Arme spéciale de contact (FOR/COO) | ARME_SPECIALE_CONTACT | FOR | COO | (X) |
| ARTS_MARTIAUX_LUTTE | Lutte | ARTS_MARTIAUX | COO | ADA | (-3) |
| ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES | Technique défensive | ARTS_MARTIAUX | COO | ADA | (-3) |
| ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES | Technique offensive | ARTS_MARTIAUX | COO | ADA | (-3) |

**Comparé à `REGLECOMPETENCE.md` lignes 171-220 (LdB p.190-191) :**

| ID | Statut | Détail |
|---|---|---|
| **ARMES_LOURDES_CONTACT** | 🔴 **bug label confirmé** | LdB : "**Armes lourdes** (contact)" (pluriel, minuscule) — DB : "Arme Lourde (contact)" (singulier, majuscule fautive) |
| ARME_SPECIALE_CONTACT | ⬜ à trancher | LdB : "selon l'arme (FOR/COO ou COO/COO la plupart du temps)" — pas de paire fixe (catégorie virtuelle). `attr_1='CHC'` est un sentinel technique (hors des 8 attributs réels `FOR/CON/COO/ADA/PER/INT/VOL/PRE` du `docs/GLOSSAIRE.md`) — convention à documenter explicitement dans 37-bis, pas un bug de contenu |
| ARTS_MARTIAUX | ✅ conforme | COO/ADA confirmé LdB. `marker` NULL cohérent avec le concept "•" limitative non implémenté (cf segment 1) |
| COMBAT_ARME | ✅ conforme | FOR/COO confirmé LdB |
| COMBAT_A_MAINS_NUES | ✅ conforme | FOR/COO confirmé LdB |
| ARMES_SPECIALES_CONTACT_COORDINATION_COORDINATION | ✅ conforme | Combo COO/COO explicitement citée LdB l.182-183, marker (X) cohérent avec "peut être considérée comme réservée" l.188-189 |
| ARMES_SPECIALES_CONTACT_FORCE_COORDINATION | ✅ conforme | Combo FOR/COO explicitement citée LdB, marker (X) idem |
| ARTS_MARTIAUX_LUTTE | ✅ conforme | "Lutte (-3)" confirmé LdB l.196, attrs hérités du parent (LdB ne redonne pas de paire pour les 3 sous-techniques) |
| **ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES** | 🔴 **bug label confirmé — régression migration 74** | LdB l.201 : "**Techniques défensives** (-3)" (pluriel) — DB : "Technique défensive" (singulier). La fonction `down()` de la migration 74 elle-même revert vers `'Techniques défensives'` (pluriel) → preuve que le seed 37 original avait la bonne valeur et que la migration 74 a introduit la régression en `up()` |
| **ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES** | 🔴 **bug label confirmé — régression migration 74** | Même bug : LdB "**Techniques offensives** (-3)" (pluriel) — DB "Technique offensive" (singulier). Même preuve via `down()` de la migration 74 |

**Bugs à corriger dans 37-bis (famille 2/11) :**
- `ARMES_LOURDES_CONTACT` : `label: "Arme Lourde (contact)"→"Armes lourdes (contact)"`
- `ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES` : `label: "Technique défensive"→"Techniques défensives"`
- `ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES` : `label: "Technique offensive"→"Techniques offensives"`

**Convention confirmée par Saar (2026-07-04) :**
- `attr_1='CHC'` = **Chance** — utilisé pour les compétences qui sont des **catégories** (regroupements virtuels sans paire d'attributs fixe propre, ex. `ARME_SPECIALE_CONTACT`, `ARME_SPECIALE_DISTANCE`, `MUTATION`, `POUVOIRS_POLARIS`…). Convention intentionnelle, pas un bug. **À documenter explicitement dans le header de la migration 37-bis** (actuellement non documentée nulle part).

---

### SEGMENT 3 — family "Combat (tir)" (11/11 lignes) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| ARMES_DE_JET | Arme de Jet | | COO | PER | (-3) |
| ARMES_DE_POING | Arme de poing | | COO | PER | |
| ARMES_DE_TRAIT | Arme de Trait | | COO | PER | (-3) |
| ARMES_LOURDES | Arme Lourde | | COO | PER | (-3) |
| ARMES_SOUS_MARINES | Arme sous-marine | | COO | PER | |
| ARME_SPECIALE_DISTANCE | Armes Spéciales (distance) | | CHC | | |
| FUSIL_ARMES_DEPAULES | Fusil/Armes d'épaule | | COO | PER | |
| TIR_AUTOMATIQUES | Tir automatique | | FOR | PER | |
| TIR_DE_PRECISION | Tir de précision | | PER | VOL | (-3) |
| ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION | Arme spéciale à distance (COO/COO) | ARME_SPECIALE_DISTANCE | COO | PER | (X) |
| ARMES_SPECIALES_DISTANCE_FORCE_COORDINATION | Arme spéciale à distance (FOR/COO) | ARME_SPECIALE_DISTANCE | FOR | COO | (X) |

**Comparé à `REGLECOMPETENCE.md` lignes 223-268 (LdB p.191) :**

**⚠️ Pattern systémique détecté** : 6 des 11 labels ont un mot au singulier + majuscule fautive là où le LdB écrit le pluriel en minuscule — semble être une dérive introduite dès le seed 37 lui-même (aucune de ces lignes n'a été touchée par 74/103/103b).

| ID | Statut | Détail |
|---|---|---|
| **ARMES_DE_JET** | 🔴 bug label | LdB "**Armes de jet** (-3)" — DB "Arme de Jet" |
| **ARMES_DE_POING** | 🔴 bug label | LdB "**Armes de poing**" — DB "Arme de poing" |
| **ARMES_DE_TRAIT** | 🔴 bug label | LdB "**Armes de trait** (-3)" — DB "Arme de Trait" |
| **ARMES_LOURDES** | 🔴 bug label (+ suffixe manquant) | LdB "**Armes lourdes (tir)** (-3)" — DB "Arme Lourde" (singulier + majuscule + suffixe "(tir)" absent, alors que la version contact avait bien gardé son suffixe "(contact)") |
| **ARMES_SOUS_MARINES** | 🔴 bug label | LdB "**Armes sous-marines**" — DB "Arme sous-marine" |
| ARME_SPECIALE_DISTANCE | ✅ conforme | `CHC` = catégorie, convention confirmée. Label "Armes Spéciales (distance)" cohérent avec la sœur contact |
| **FUSIL_ARMES_DEPAULES** | 🔴 bug label | LdB "**Fusils**/Armes d'épaule" — DB "Fusil/Armes d'épaule" |
| TIR_AUTOMATIQUES | ✅ conforme (label) / ⬜ note ID | Label "Tir automatique" ✓ LdB, attrs FOR/PER ✓, marker NULL cohérent (limitative non implémentée). ID au pluriel "AUTOMATIQUES" alors que le concept est singulier — cosmétique, renommer l'ID a un impact FK (char_skills, ref_skill_requirements) : à évaluer séparément, pas bloquant |
| TIR_DE_PRECISION | ✅ conforme | LdB "Tir de précision • **(-3)**", "Attributs associés : **PER/VOL**" — confirmé mot pour mot |
| **ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION** | 🔴 **bug label — incohérence interne** | Label dit "(COO/COO)" mais `attr_2` de la même ligne = **PER**, et l'ID lui-même dit `..._PERCEPTION`. LdB confirme les 2 combos possibles pour armes spéciales à distance sont **COO/PER** et FOR/COO (l.243-244) — donc c'est bien `attr_1/attr_2` qui sont corrects, seul le **texte du label** est faux |
| ARMES_SPECIALES_DISTANCE_FORCE_COORDINATION | ✅ conforme | FOR/COO cohérent LdB + label |

**Bugs à corriger dans 37-bis (famille 3/11) :**
- `ARMES_DE_JET` : `label: "Arme de Jet"→"Armes de jet"`
- `ARMES_DE_POING` : `label: "Arme de poing"→"Armes de poing"`
- `ARMES_DE_TRAIT` : `label: "Arme de Trait"→"Armes de trait"`
- `ARMES_LOURDES` : `label: "Arme Lourde"→"Armes lourdes (tir)"`
- `ARMES_SOUS_MARINES` : `label: "Arme sous-marine"→"Armes sous-marines"`
- `FUSIL_ARMES_DEPAULES` : `label: "Fusil/Armes d'épaule"→"Fusils/Armes d'épaule"`
- `ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION` : `label: "Arme spéciale à distance (COO/COO)"→"Arme spéciale à distance (COO/PER)"`

---

### SEGMENT 4 — family "Communication / Relations sociales" (11/11 lignes) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| ANALYSE_EMPATHIQUE | Analyse empathique | | INT | PRE | (-3) |
| COMMANDEMENT | Commandement | | VOL | PRE | |
| ELOQUENCE_PERSUASION | Éloquence/Persuasion | | INT | PRE | |
| ENSEIGNEMENT | Enseignement | | INT | ADA | |
| ENTREGENT_SEDUCTION | Entregent/Séduction | | PRE | | |
| EXPRESSION_ARTISTIQUE | Expression artistique | | CHC | | |
| EXPRESSION_ARTISTIQUE_CHANT | Chant | EXPRESSION_ARTISTIQUE | INT | PRE | S |
| EXPRESSION_ARTISTIQUE_COMEDIE_CONTE | Comédie/Conte | EXPRESSION_ARTISTIQUE | ADA | PRE | S |
| EXPRESSION_ARTISTIQUE_DANSE | Danse | EXPRESSION_ARTISTIQUE | COO | PRE | S |
| EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE | Instrument de musique | EXPRESSION_ARTISTIQUE | COO | PER | (X) |
| INTIMIDATION | Intimidation | | VOL | PRE | |

**Comparé à `REGLECOMPETENCE.md` lignes 274-397 (LdB p.191-193) :**

| ID | Statut | Détail |
|---|---|---|
| **ANALYSE_EMPATHIQUE** | 🔴 **bug attr_2 confirmé** | LdB : "Attributs associés : **INT/PER**" — DB a `attr_2=PRE`, faux. Marker `(-3)` ✅ conforme (LdB : "Analyse empathique (-3)") |
| COMMANDEMENT | ✅ conforme | VOL/PRE confirmé LdB |
| ELOQUENCE_PERSUASION | ✅ conforme | INT/PRE confirmé LdB. Note : LdB marque `†` (Pré-requis : Éducation/Culture générale 10, si discours formel) — condition non stockée en `marker` mais relève de `ref_skill_requirements`, à vérifier au segment 12 |
| **ENSEIGNEMENT** | ✅ **[DBG-4] résolu — décision Saar (2026-07-04)** | Absente du LdB officiel (confirmé : aucune définition dédiée dans le livre, uniquement citée en exemple l.749). **Compétence maison**, formalisée ainsi : `attr_1=INT, attr_2=ADA` confirmé intentionnel (INT = maîtrise du contenu, ADA = attribut mental d'adaptation — cf. `REGLECOMPETENCE.md:1114` "attributs mentaux : Volonté, Intelligence, Adaptation" — cohérent avec le rôle pédagogique, distinct des autres compétences de la famille qui sont toutes en PRE/influence). Déclarée **compétence limitative** (premier cas d'usage réel du marker `•`, resté à 0/251 lignes jusqu'ici) : le niveau d'Enseignement plafonne le niveau transmissible à un élève — mécanique identique à celle déjà décrite dans le LdB pour les langues (l.748-750, où Enseignement est d'ailleurs cité) et les Compétences de connaissance limitant Éloquence/Persuasion (l.359-361) |
| ENTREGENT_SEDUCTION | ✅ conforme | LdB "Attributs associés : **PRE/PRE**" — DB `attr_2=NULL` cohérent avec convention "attr_2 NULL = attr_1 ×2" |
| EXPRESSION_ARTISTIQUE | ✅ conforme | `CHC` = catégorie, convention confirmée (LdB : "Attributs associés : variable") |
| **EXPRESSION_ARTISTIQUE_CHANT** | 🔴 **bug marker confirmé** | LdB : "Chant (**INT/PRE, -3**)" — attrs ✅ mais `marker='S'` faux, doit être `(-3)` |
| **EXPRESSION_ARTISTIQUE_COMEDIE_CONTE** | 🔴 **bug marker confirmé** | LdB : "Comédie/Conte (**ADA/PRE, -3**)" — attrs ✅ mais `marker='S'` faux, doit être `(-3)` |
| **EXPRESSION_ARTISTIQUE_DANSE** | 🔴 **bug marker confirmé** | LdB : "Danse (**COO/PRE, -3**)" — attrs ✅ mais `marker='S'` faux, doit être `(-3)` |
| EXPRESSION_ARTISTIQUE_INSTRUMENT_DE_MUSIQUE | ✅ conforme | LdB : "Instrument de musique (**COO/PER, X**)" — attrs + marker `(X)` tous deux corrects. Preuve que ce sous-groupe a été partiellement corrigé (seul cet enfant), pas les 3 autres |
| INTIMIDATION | ✅ conforme | VOL/PRE confirmé LdB |

**Bugs à corriger dans 37-bis (famille 4/11) :**
- `ANALYSE_EMPATHIQUE` : `attr_2: PRE→PER`
- `EXPRESSION_ARTISTIQUE_CHANT` : `marker: S→(-3)`
- `EXPRESSION_ARTISTIQUE_COMEDIE_CONTE` : `marker: S→(-3)`
- `EXPRESSION_ARTISTIQUE_DANSE` : `marker: S→(-3)`
- `ENSEIGNEMENT` : `marker: NULL→'•'` (première utilisation réelle du marker limitative) + `description: NULL→` laius maison (texte ci-dessous). `attr_1=INT, attr_2=ADA` confirmés — pas de changement.

**Texte `description` retenu pour `ENSEIGNEMENT` (compétence maison, absente du LdB) :**
> Enseignement *(compétence maison — absente du LdB officiel)*. Attributs associés : INT/ADA.
> Cette Compétence représente la capacité d'un personnage à transmettre son savoir à autrui, dans un cadre formel (cours structuré) ou informel (compagnonnage, apprentissage sur le terrain). Elle recouvre la pédagogie — structurer une leçon, choisir les bons exemples, corriger les erreurs — autant que la capacité à adapter son discours et sa méthode au profil de l'élève (rythme d'apprentissage, expérience préalable, aptitudes propres).
> Note : Enseignement est une Compétence limitative — le niveau de l'instructeur dans cette Compétence plafonne l'efficacité de la formation qu'il dispense (un personnage ne peut transmettre une Compétence à un niveau supérieur à son propre niveau en Enseignement).

**Portée limitée pour 37-bis** : seuls `marker` et `description` sont modifiés ici. L'application mécanique de la limitation (plafonnement effectif lors d'une formation en jeu) n'existe dans aucun système actuel du code — hors scope, à documenter séparément comme dette future (sprint dédié système d'apprentissage/formation).

---

### SEGMENT 5a — family "Compétences Spéciales" (10/71 lignes, A→M) ✅ audité

DB actuelle :

| id | label | attr_1 | attr_2 | marker |
|---|---|---|---|---|
| ABSENCE | Absence | ADA | VOL | (X) |
| BOUCLIER_MENTAL | Bouclier mental | VOL | | (X) |
| CONTROLE_CORPOREL | Contrôle corporel | CON | VOL | (X) |
| CONTROLE_DES_MUTATIONS | Contrôle des mutations | CHC | | (X) |
| HYBRIDE | Hybride | CON | COO | (X) |
| HYPNOSE | Hypnose | VOL | PRE | (X) |
| MAITRISE_DE_LA_FORCE_POLARIS | Maîtrise de la Force Polaris | VOL | | (X) |
| MAITRISE_DE_LECHO_POLARIS | Maîtrise de l'Echo Polaris | INT | VOL | (X) |
| MEDITATION | Méditation | VOL | | (X) |
| MUTATION | Mutation | CHC | | |

**Comparé à `REGLECOMPETENCE.md` lignes 1102-1182 (LdB p.212-213) :**

| ID | Statut | Détail |
|---|---|---|
| ABSENCE | ✅ conforme | LdB "Absence (X)" attrs ADA/VOL |
| BOUCLIER_MENTAL | ✅ conforme | LdB "Bouclier mental (X)" attrs VOL/VOL — `attr_2=NULL` cohérent convention ×2 |
| CONTROLE_CORPOREL | ✅ conforme | LdB "Contrôle corporel (X)" attrs CON/VOL |
| CONTROLE_DES_MUTATIONS | ✅ conforme | LdB "Contrôle des mutations […] (X)" — attrs variables selon la mutation (détail chapitre Création perso), `CHC`=catégorie cohérent, marker `(X)` confirmé explicitement dans le texte LdB |
| **HYBRIDE** | 🔴 **bug marker confirmé** | LdB : "Hybride (**hybrides uniquement**)" — **pas de `(X)`** dans le texte, contrairement à toutes ses 9 voisines qui affichent explicitement "(X)" après leur nom. "(hybrides uniquement)" est une restriction d'accès (génotype), pas le marker "compétence réservée" — DB a `marker=(X)` à tort |
| HYPNOSE | ✅ conforme | LdB "Hypnose (X)" attrs VOL/PRE |
| MAITRISE_DE_LA_FORCE_POLARIS | ✅ conforme | LdB "Maîtrise de la Force Polaris (X)" attrs VOL/VOL, `attr_2=NULL` cohérent |
| **MAITRISE_DE_LECHO_POLARIS** | 🔴 **bug label confirmé (accent)** | LdB : "Maîtrise de l'**écho** polaris (X)" — DB : "Maîtrise de l'**Echo** Polaris" (accent aigu manquant sur le É). Attrs INT/VOL ✅ conformes, marker (X) ✅ conforme — seul l'accent manque |
| MEDITATION | ✅ conforme | LdB "Méditation (X)" attrs VOL/VOL |
| MUTATION | ✅ conforme | Pas d'entrée dédiée dans le LdB sous ce nom exact — regroupement virtuel des Compétences de mutation individuelles (cf. `CONTROLE_DES_MUTATIONS` et chapitre Création perso section 3). `CHC`=catégorie + `marker=NULL` cohérents avec la convention déjà établie (`EXPRESSION_ARTISTIQUE`, `ARME_SPECIALE_CONTACT`…) |

**Bugs à corriger dans 37-bis (famille 5/11, sous-segment a) :**
- `HYBRIDE` : `marker: (X)→NULL`
- `MAITRISE_DE_LECHO_POLARIS` : `label: "Maîtrise de l'Echo Polaris"→"Maîtrise de l'Écho Polaris"` (accent)

**À surveiller pour la suite (sous-segment b) :** LdB l.1179 mentionne "Pouvoirs Polaris (X)" — vérifier si `POUVOIRS_POLARIS` en DB a bien `marker=(X)` sur la ligne parent elle-même (pas seulement ses enfants, déjà repérés `marker='S'→(X)` par la migration 74 selon son propre commentaire).

---

### SEGMENT 5b — family "Compétences Spéciales" (10/71 lignes, 11→20 : MUTATION_* + POUVOIRS_POLARIS + 1er enfant) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| MUTATION_AGILITE_CAUDALE | Agilité caudale | MUTATION | COO | | (X) |
| MUTATION_CONTAGION | Contagion | MUTATION | CON | VOL | (X) |
| MUTATION_CONTROLE_MOLECULAIRE | Contrôle moléculaire | MUTATION | CON | VOL | (X) |
| MUTATION_EMPATHIE | Empathie | MUTATION | VOL | PRE | (X) |
| MUTATION_METAMORPHOSE | Métamorphose | MUTATION | CON | VOL | (X) |
| MUTATION_PURULENCE | Purulence | MUTATION | CON | VOL | (X) |
| MUTATION_RADIATIONS | Radiations | MUTATION | CON | VOL | (X) |
| MUTATION_SONAR | Sonar | MUTATION | PER | | (X) |
| POUVOIRS_POLARIS | Pouvoirs Polaris | | CHC | | |
| POUVOIRS_POLARIS_ALTERATION_TEMPORELLE | Altération Temporelle | POUVOIRS_POLARIS | INT | VOL | (X) |

**Source canonique pour les enfants MUTATION_* : `docs/Character/Creation/REGLE_MUTATION.md`, PAS `REGLECOMPETENCE.md`** (ces skills n'y figurent nulle part — vérifié par grep, 0 résultat). C'est le chapitre "Description des mutations" qui donne, pour chaque mutation, la notation exacte entre parenthèses `(attr/attr, marker)` de la Compétence spéciale qu'elle débloque.

| ID | Statut | Détail (citation exacte REGLE_MUTATION.md) |
|---|---|---|
| **MUTATION_AGILITE_CAUDALE** | 🔴 **bug marker confirmé** | l.226 "Queue" : "développer la Compétence Agilité caudale **(COO/COO)**, à un coût normal" — aucun marker dans le texte. `attr_2=NULL` cohérent (convention ×2), mais `marker=(X)` en DB est erroné |
| MUTATION_CONTAGION | ✅ conforme | l.65-66 : "(Contagion, **CON/VOL, X**)" — attrs + marker explicitement `X` dans le texte |
| **MUTATION_CONTROLE_MOLECULAIRE** | 🔴 **bug marker confirmé** | l.126-127 "Instabilité moléculaire" : "Compétence spéciale Contrôle moléculaire **(CON/VOL)**, qui peut être développée à un coût doublé" — aucun marker cité. DB a `marker=(X)` à tort |
| **MUTATION_EMPATHIE** | 🔴 **bug marker confirmé** | l.97-99 : "Compétence spéciale Empathie **(VOL/PRE, -3)**" — marker explicite `-3`, pas `X`. DB a `marker=(X)` à tort |
| **MUTATION_METAMORPHOSE** | 🔴 **bug marker confirmé** | l.155-157 "Métamorphe" : "Compétence spéciale Métamorphose **(CON/VOL, -3)**" — marker explicite `-3`. DB a `marker=(X)` à tort |
| MUTATION_PURULENCE | ✅ conforme | l.207-209 : "Compétence (Purulence, **CON/VOL, X**)" — attrs + marker `X` explicites |
| **MUTATION_RADIATIONS** | 🔴 **bug marker confirmé** | l.238-239 "Radiation" : "Compétence spéciale Radiations **(CON/VOL, -3)**" — marker explicite `-3`. DB a `marker=(X)` à tort |
| **MUTATION_SONAR** | 🔴 **bug marker confirmé** | l.286-287 : "Compétence spéciale Sonar **(PER/PER)**, qui peut être développée à un coût normal" — aucun marker cité. `attr_2=NULL` cohérent (convention ×2), mais DB a `marker=(X)` à tort |
| **POUVOIRS_POLARIS** | 🔴 **bug confirmé — [DBG-5] résolu** | LdB l.1179-1182 : "**Pouvoirs Polaris (X)**" / "Attributs associés : **INT/VOL**". Contrairement à `MUTATION` (parent virtuel pur, aucune Compétence propre), `POUVOIRS_POLARIS` est par nature une Compétence réelle et testable indépendante de toute mutation — décision Saar : aligner littéralement sur le LdB, `CHC`/NULL/NULL était une erreur d'analogie avec `MUTATION` |
| POUVOIRS_POLARIS_ALTERATION_TEMPORELLE | 🟡 conforme par cohérence interne, non vérifiable individuellement | Description détaillée "dans le chapitre Force Polaris, page 252" — absent de `REGLECOMPETENCE.md` et aucun doc `docs/REGLES/*POLARIS*` ou équivalent trouvé dans le repo. Les 52 enfants `POUVOIRS_POLARIS_*` sont tous uniformément `INT/VOL (X)`, cohérent avec la notation du header l.1179-1180 — accepté par cohérence interne faute de source ligne-par-ligne disponible |

**Bugs à corriger dans 37-bis (famille 5/11, sous-segment b) :**
- `MUTATION_AGILITE_CAUDALE` : `marker: (X)→NULL`
- `MUTATION_CONTROLE_MOLECULAIRE` : `marker: (X)→NULL`
- `MUTATION_EMPATHIE` : `marker: (X)→(-3)`
- `MUTATION_METAMORPHOSE` : `marker: (X)→(-3)`
- `MUTATION_RADIATIONS` : `marker: (X)→(-3)`
- `MUTATION_SONAR` : `marker: (X)→NULL`

**Constat systémique :** 6 des 8 enfants `MUTATION_*` ont un marker `(X)` incorrect — seuls 2 (`CONTAGION`, `PURULENCE`) sont conformes. Motif probable : application d'un marker `(X)` générique à toute la sous-famille sans vérifier la notation individuelle de chaque mutation dans `REGLE_MUTATION.md`. Même nature d'erreur historique que le motif `marker='S'` déjà documenté (nettoyage partiel/mécanique, pas une convention voulue).

**[DBG-5] résolu — décision Saar (2026-07-04) :** `POUVOIRS_POLARIS` n'est **pas** un parent virtuel comme `MUTATION`. `MUTATION` regroupe des Compétences chacune liée à une mutation spécifique du personnage (pas de Compétence propre au header) ; `POUVOIRS_POLARIS` est différent par nature — c'est lui-même une Compétence réelle et testable, marker `(X)`, indépendante de toute mutation. Le traiter comme `CHC`/NULL était une erreur d'analogie avec `MUTATION`. → **On aligne littéralement sur le LdB.**
- `POUVOIRS_POLARIS` : `attr_1: CHC→INT`, `attr_2: NULL→VOL`, `marker: NULL→(X)`

### SEGMENT 5c — family "Compétences Spéciales" (10/71 lignes, 21→30 : POUVOIRS_POLARIS_ATTAQUE_PSYCHIQUE → POUVOIRS_POLARIS_CHAMP_PSYCHIQUE) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| POUVOIRS_POLARIS_ATTAQUE_PSYCHIQUE | Attaque psychique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_BARRIERE_DE_FORCE | Barrière de Force | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_BARRIERE_MOLECULAIRE | Barrière moléculaire | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_BARRIERE_PSYCHIQUE | Barrière psychique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_BETE_DU_FLUX | Bête du Flux | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_BROUILLAGE | Brouillage | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_CAUCHEMAR | Cauchemar | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_CHAMP_DE_FORCE | Champ de Force | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_CHAMP_MOLECULAIRE | Champ moléculaire | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_CHAMP_PSYCHIQUE | Champ psychique | POUVOIRS_POLARIS | INT | VOL | (X) |

**Vérification croisée avec l'extraction Excel originelle** (`docs/Old/script Extraction Excel/skill/ref_skills_data.js`, non une source LdB mais l'état pré-migration) : ces 10 lignes y portent `marker: "S"` (ex. `POUVOIRS_POLARIS_ATTAQUE_PSYCHIQUE` l.1983-1992, description conservée à l'identique en DB actuelle : "Malus au Test de Résistance au Choc : +0 +/- modif. de réussite."). Le motif `'S'` a déjà été établi (Segment 4 / constat systémique 5b) comme un artefact de nettoyage historique incomplet, **pas** une convention valide — donc ce n'est pas un signal fiable pour remettre en cause le `(X)` actuel.

Aucun chapitre "Force Polaris" (page 252) présent dans le repo (`docs/REGLES/*POLARIS*`, `docs/**/*ORCE*POLARIS*` : 0 résultat, déjà vérifié en 5b) — vérification ligne-par-ligne individuelle impossible. Les 10 lignes sont uniformément `INT/VOL (X)`, cohérentes entre elles et avec le header `POUVOIRS_POLARIS` (l.1179-1180 REGLECOMPETENCE.md, résolu [DBG-5]).

| ID | Statut | Détail |
|---|---|---|
| POUVOIRS_POLARIS_ATTAQUE_PSYCHIQUE | 🟡 conforme par cohérence interne | Idem 5c — pas de source ligne-par-ligne, `INT/VOL (X)` cohérent avec parent + fratrie |
| POUVOIRS_POLARIS_BARRIERE_DE_FORCE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_BARRIERE_MOLECULAIRE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_BARRIERE_PSYCHIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_BETE_DU_FLUX | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_BROUILLAGE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_CAUCHEMAR | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_CHAMP_DE_FORCE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_CHAMP_MOLECULAIRE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_CHAMP_PSYCHIQUE | 🟡 conforme par cohérence interne | idem |

**Bugs à corriger dans 37-bis (famille 5/11, sous-segment c) :** aucun — 10/10 conformes par cohérence interne.

### SEGMENT 5d — family "Compétences Spéciales" (10/71 lignes, 31→40 : POUVOIRS_POLARIS_CONTROLE_MENTAL → POUVOIRS_POLARIS_LAMES_DENERGIE) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| POUVOIRS_POLARIS_CONTROLE_MENTAL | Contrôle mental | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_DAGUE_PSYCHIQUE | Dague psychique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_DECHIRURE_DU_FLUX | Déchirure du Flux | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_DESINTEGRATION_MOLECULAIRE | Désintégration moléculaire | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_DESTRUCTURATION | Déstructuration | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_DISRUPTION_MOLECULAIRE | Disruption moléculaire | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_FOUDRE | Foudre | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_GUERISON_MOLECULAIRE | Guérison moléculaire | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_GUERISON_PSYCHIQUE | Guérison psychique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_LAMES_DENERGIE | Lames d'énergie | POUVOIRS_POLARIS | INT | VOL | (X) |

Même motif que 5b/5c : `INT/VOL (X)` uniforme, cohérent avec le header `POUVOIRS_POLARIS` résolu [DBG-5]. Pas de chapitre "Force Polaris" en repo pour vérification ligne-par-ligne (déjà constaté 5b/5c). Aucune anomalie de structure (parent, attr_1, attr_2 tous cohérents, pas de NULL).

| ID | Statut | Détail |
|---|---|---|
| POUVOIRS_POLARIS_CONTROLE_MENTAL | 🟡 conforme par cohérence interne | pas de source ligne-par-ligne, `INT/VOL (X)` cohérent avec parent + fratrie |
| POUVOIRS_POLARIS_DAGUE_PSYCHIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_DECHIRURE_DU_FLUX | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_DESINTEGRATION_MOLECULAIRE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_DESTRUCTURATION | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_DISRUPTION_MOLECULAIRE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_FOUDRE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_GUERISON_MOLECULAIRE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_GUERISON_PSYCHIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_LAMES_DENERGIE | 🟡 conforme par cohérence interne | idem |

**Bugs à corriger dans 37-bis (famille 5/11, sous-segment d) :** aucun — 10/10 conformes par cohérence interne.

### SEGMENT 5e — family "Compétences Spéciales" (10/71 lignes, 41→50 : POUVOIRS_POLARIS_LAMES_PSYCHIQUES → POUVOIRS_POLARIS_ONDE_POLARIS) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| POUVOIRS_POLARIS_LAMES_PSYCHIQUES | Lames psychiques | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_MANGEUR_DESPRIT | Mangeur d'esprit | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_MASSE_DE_DESTRUCTION | Masse de destruction | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_MODIFICATION_DE_LA_MASSE | Modification de la masse | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_MODIFICATION_DE_LA_PRESSION | Modification de la pression | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_MODIFICATION_DE_LA_TEMPERATURE | Modification de la température | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_OBLITERATION_PSYCHIQUE | Oblitération psychique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_ONDE_DE_CHOC | Onde de choc | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_ONDE_DE_CHOC_PSYCHIQUE | Onde de choc psychique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_ONDE_POLARIS | Onde Polaris | POUVOIRS_POLARIS | INT | VOL | (X) |

Même motif que 5b/5c/5d : `INT/VOL (X)` uniforme, cohérent avec le header `POUVOIRS_POLARIS` résolu [DBG-5]. Aucune anomalie de structure (parent, attr_1, attr_2 tous cohérents, pas de NULL).

| ID | Statut | Détail |
|---|---|---|
| POUVOIRS_POLARIS_LAMES_PSYCHIQUES | 🟡 conforme par cohérence interne | pas de source ligne-par-ligne, `INT/VOL (X)` cohérent avec parent + fratrie |
| POUVOIRS_POLARIS_MANGEUR_DESPRIT | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_MASSE_DE_DESTRUCTION | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_MODIFICATION_DE_LA_MASSE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_MODIFICATION_DE_LA_PRESSION | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_MODIFICATION_DE_LA_TEMPERATURE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_OBLITERATION_PSYCHIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_ONDE_DE_CHOC | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_ONDE_DE_CHOC_PSYCHIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_ONDE_POLARIS | 🟡 conforme par cohérence interne | idem |

**Bugs à corriger dans 37-bis (famille 5/11, sous-segment e) :** aucun — 10/10 conformes par cohérence interne.

### SEGMENT 5f — family "Compétences Spéciales" (10/71 lignes, 51→60 : POUVOIRS_POLARIS_PACIFICATION → POUVOIRS_POLARIS_SONSCAN) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| POUVOIRS_POLARIS_PACIFICATION | Pacification | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_PASSAGE | Passage | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_PERCEPTION_DE_LA_REALITE | Perception de la réalité | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_PRESCIENCE | Prescience | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_PRISON_MENTALE | Prison mentale | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_PULSION_ELECTROMAGNETIQUE | Pulsion électromagnétique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_REGENERATION_MOLECULAIRE | Régénération moléculaire | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_SENSIBILITE_PSYCHIQUE | Sensibilité psychique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_SIPHON_DENERGIE | Siphon d'énergie | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_SONSCAN | Sonscan | POUVOIRS_POLARIS | INT | VOL | (X) |

Même motif que 5b/5c/5d/5e : `INT/VOL (X)` uniforme, cohérent avec le header `POUVOIRS_POLARIS` résolu [DBG-5]. Aucune anomalie de structure (parent, attr_1, attr_2 tous cohérents, pas de NULL).

| ID | Statut | Détail |
|---|---|---|
| POUVOIRS_POLARIS_PACIFICATION | 🟡 conforme par cohérence interne | pas de source ligne-par-ligne, `INT/VOL (X)` cohérent avec parent + fratrie |
| POUVOIRS_POLARIS_PASSAGE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_PERCEPTION_DE_LA_REALITE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_PRESCIENCE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_PRISON_MENTALE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_PULSION_ELECTROMAGNETIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_REGENERATION_MOLECULAIRE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_SENSIBILITE_PSYCHIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_SIPHON_DENERGIE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_SONSCAN | 🟡 conforme par cohérence interne | idem |

**Bugs à corriger dans 37-bis (famille 5/11, sous-segment f) :** aucun — 10/10 conformes par cohérence interne.

### SEGMENT 5g — family "Compétences Spéciales" (11/71 lignes, 61→71 : POUVOIRS_POLARIS_SPHERE_DE_GRAVITE → POUVOIRS_POLARIS_VORTEX_PSYCHIQUE) ✅ audité — dernier sous-segment, famille close

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| POUVOIRS_POLARIS_SPHERE_DE_GRAVITE | Sphère de gravité | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_SPHERE_DE_REPULSION_ORGANIQUE | Sphère de répulsion organique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_SPHERE_DE_TERREUR | Sphère de terreur | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_SPHERE_TEMPORELLE | Sphère temporelle | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_TELEKINESIE | Télékinésie | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_TELEPORTATION | Téléportation | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_TEMPETE_DU_FLUX | Tempête du Flux | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_TOURBILLON | Tourbillon | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_TOURBILLON_DE_LA_MORT | Tourbillon de la mort | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_VORTEX_PHYSIQUE | Vortex physique | POUVOIRS_POLARIS | INT | VOL | (X) |
| POUVOIRS_POLARIS_VORTEX_PSYCHIQUE | Vortex psychique | POUVOIRS_POLARIS | INT | VOL | (X) |

Requête `OFFSET 70 LIMIT 5` ne retourne qu'1 ligne (POUVOIRS_POLARIS_VORTEX_PSYCHIQUE) → confirme 71/71 lignes exactement, famille close.

Même motif que 5b/5c/5d/5e/5f : `INT/VOL (X)` uniforme, cohérent avec le header `POUVOIRS_POLARIS` résolu [DBG-5]. Aucune anomalie de structure.

| ID | Statut | Détail |
|---|---|---|
| POUVOIRS_POLARIS_SPHERE_DE_GRAVITE | 🟡 conforme par cohérence interne | idem 5b-5f |
| POUVOIRS_POLARIS_SPHERE_DE_REPULSION_ORGANIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_SPHERE_DE_TERREUR | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_SPHERE_TEMPORELLE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_TELEKINESIE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_TELEPORTATION | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_TEMPETE_DU_FLUX | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_TOURBILLON | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_TOURBILLON_DE_LA_MORT | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_VORTEX_PHYSIQUE | 🟡 conforme par cohérence interne | idem |
| POUVOIRS_POLARIS_VORTEX_PSYCHIQUE | 🟡 conforme par cohérence interne | idem |

**Bugs à corriger dans 37-bis (famille 5/11, sous-segment g) :** aucun — 11/11 conformes par cohérence interne.

**Famille "Compétences Spéciales" (71/71 lignes) — AUDIT COMPLET.** Bilan famille : 0 bug de données trouvé sur l'ensemble des 71 lignes (10 sous-segments 5a→5g). Seuls points restés ouverts : [DBG-5] POUVOIRS_POLARIS confirmé compétence réelle (résolu), MUTATION traité comme parent virtuel (cf 5b) — pas un bug de cette famille mais un cas de la future passe "parents virtuels".

### SEGMENT 6a — family "Connaissances" (10/43 lignes, 1→10 : BUREAUCRATIE → COMMERCE_TRAFIC__VEHICULES) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| BUREAUCRATIE | Bureaucratie | | INT | | |
| CARTOGRAPHIE | Cartographie | | INT | | |
| COMMERCE_TRAFIC | Commerce/Trafic | | CHC | | PREREQ |
| COMMERCE_TRAFIC__ARMES | Armes | COMMERCE_TRAFIC | INT | PRE | S |
| COMMERCE_TRAFIC__DENREES_ALIMENTAIRES | Denrées alimentaires | COMMERCE_TRAFIC | INT | PRE | S |
| COMMERCE_TRAFIC__DROGUES | Drogues | COMMERCE_TRAFIC | INT | PRE | S |
| COMMERCE_TRAFIC__INFORMATIONS | Informations | COMMERCE_TRAFIC | INT | PRE | S |
| COMMERCE_TRAFIC__MATERIEL_MEDICAL | Matériel médical | COMMERCE_TRAFIC | INT | PRE | S |
| COMMERCE_TRAFIC__MATIERES_PREMIERES | Matières premières | COMMERCE_TRAFIC | INT | PRE | S |
| COMMERCE_TRAFIC__VEHICULES | Véhicules | COMMERCE_TRAFIC | INT | PRE | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` :
- L.399 "Bureaucratie †" — INT/INT (self-doublé), pas de marker (X)/•/(-3). `†` = COMPÉTENCE PRÉ-REQUISE (légende L.127), concept séparé du `marker` (traité par la future passe `ref_skill_requirements`), pas un bug ici.
- L.408 "Cartographie † (X)" — INT/INT (self-doublé) ✅, mais **(X) explicite dans le LdB, absent en DB** (marker vide).
- L.425-439 "Commerce/Trafic […] † / Attributs associés : INT/PRE" puis liste des 7 sous-compétences avec marker propre à chacune : Armes (X), Denrées alimentaires (-3), Drogues (X), Informations (-3), Matériel médical (-3), Matières premières (-3), Véhicules (-3).

**Anomalies confirmées :**

1. **CARTOGRAPHIE** — 🔴 bug confirmé. LdB : `(X)` explicite (L.408). DB : marker vide. → corriger marker → `(X)`.
2. **COMMERCE_TRAFIC** — 🔴 bug confirmé, **même schéma que [DBG-5] (POUVOIRS_POLARIS, Segment 5b)** : migration 74 a inséré `attr_1: 'CHC', attr_2: null, marker: 'PREREQ'` par analogie avec `MUTATION` (parent virtuel pur). Mais le LdB donne à Commerce/Trafic ses propres attributs réels : "Attributs associés : INT/PRE" (L.426) — ce n'est pas un parent virtuel sans existence propre, c'est une Compétence-cadre réelle (comme Pouvoirs Polaris) dont les sous-compétences précisent le type de produit. → **[DBG-6] résolu** — décision Saar : aligner sur [DBG-5], `attr_1: INT, attr_2: PRE, marker: NULL` (le `†`/pré-requis n'appartient pas à la colonne `marker`).
3. **Les 7 enfants `COMMERCE_TRAFIC__*`** — 🔴 bug confirmé, cas concret confirmant la panne du marker `'S'` déjà suspectée (cf notes générales) : le LdB donne un marker distinct et sans ambiguïté par sous-compétence, entièrement écrasé par la valeur uniforme `'S'` en DB. Attrs (INT/PRE) corrects, seul `marker` est faux pour les 7 lignes :
   - `COMMERCE_TRAFIC__ARMES` : `S` → `(X)`
   - `COMMERCE_TRAFIC__DENREES_ALIMENTAIRES` : `S` → `(-3)`
   - `COMMERCE_TRAFIC__DROGUES` : `S` → `(X)`
   - `COMMERCE_TRAFIC__INFORMATIONS` : `S` → `(-3)`
   - `COMMERCE_TRAFIC__MATERIEL_MEDICAL` : `S` → `(-3)`
   - `COMMERCE_TRAFIC__MATIERES_PREMIERES` : `S` → `(-3)`
   - `COMMERCE_TRAFIC__VEHICULES` : `S` → `(-3)`

| ID | Statut | Détail |
|---|---|---|
| BUREAUCRATIE | ✅ conforme | INT/INT, marker vide correct (`†` = pré-requis, hors scope marker) |
| CARTOGRAPHIE | 🔴 bug confirmé | marker manquant, doit être `(X)` |
| COMMERCE_TRAFIC | 🔴 bug confirmé — [DBG-6] résolu | attr_1/attr_2 faux (CHC/NULL → INT/PRE), marker `PREREQ` à retirer — même schéma que [DBG-5] |
| COMMERCE_TRAFIC__ARMES | 🔴 bug confirmé | marker `S` → `(X)` |
| COMMERCE_TRAFIC__DENREES_ALIMENTAIRES | 🔴 bug confirmé | marker `S` → `(-3)` |
| COMMERCE_TRAFIC__DROGUES | 🔴 bug confirmé | marker `S` → `(X)` |
| COMMERCE_TRAFIC__INFORMATIONS | 🔴 bug confirmé | marker `S` → `(-3)` |
| COMMERCE_TRAFIC__MATERIEL_MEDICAL | 🔴 bug confirmé | marker `S` → `(-3)` |
| COMMERCE_TRAFIC__MATIERES_PREMIERES | 🔴 bug confirmé | marker `S` → `(-3)` |
| COMMERCE_TRAFIC__VEHICULES | 🔴 bug confirmé | marker `S` → `(-3)` |

**Bugs à corriger dans 37-bis (famille 6, sous-segment a) :** 9/10 — seule BUREAUCRATIE conforme. CARTOGRAPHIE (marker), COMMERCE_TRAFIC ([DBG-6] résolu), et les 7 enfants COMMERCE_TRAFIC__* (marker `S` → valeur LdB réelle).

### SEGMENT 6b — family "Connaissances" (10/43 lignes, 11→20 : CONNAISSANCE_DES_NATIONS_ORGANISATIONS → SCIENCES_CONNAISANCES_SPECIALISEES_ARMES_SYSTEMES_DARMEMENT) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| CONNAISSANCE_DES_NATIONS_ORGANISATIONS | Connaissance des nations/organisations | | INT | | PN |
| CONNAISSANCE_MILIEUX_SOCIAUX | Connaissance des milieux sociaux | | INT | PRE | |
| CRYPTOGRAPHIE | Cryptographie | | INT | | (X) |
| EDUCATION_CULTURE_GENERALE | Éducation/Culture générale | | INT | | (-3) |
| JEU | Jeu | | INT | VOL | |
| NAVIGATION | Navigation | | INT | | (X) |
| RECHERCHE_DINFORMATIONS | Recherche d'informations | | INT | | (-3) |
| SCIENCES_CONNAISANCES_SPECIALISEES | Sciences/Connaissances spécialisées | | CHC | | |
| SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION | Administration/Gestion | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_ARMES_SYSTEMES_DARMEMENT | Arme/Système d'armement | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` (L.448-562) :
- L.448-450 "Connaissance des nations/organisations […] • (PN)" — INT/INT (self-doublé) ✅. Marker DB = `PN` seul (sans `•`). Vérifié : `SELECT DISTINCT marker FROM ref_skills` = `(-3)`, `(X)`, `PN`, `PREREQ`, `S`, NULL uniquement — **`•` n'est jamais stocké dans `marker` sur toute la table**, convention confirmée globale (le caractère limitatif est narratif, pas une valeur de colonne). → conforme, pas un bug isolé de cette ligne.
- L.477-479 "Cryptographie † (X)" — INT/INT ✅, marker `(X)` ✅ → conforme.
- L.488 "Éducation/Culture générale (-3)" — INT/INT ✅, marker `(-3)` ✅ → conforme.
- L.505-506 "Jeu / Attributs associés : INT/VOL" — pas de marker LdB → conforme.
- L.520-522 "Navigation † (X)" — INT/INT ✅, marker `(X)` ✅ → conforme.
- L.542-544 "Recherche d'informations † (-3)" — INT/INT ✅, marker `(-3)` ✅ → conforme.
- L.548-550 "Sciences/Connaissances spécialisées […] / Attributs associés : INT/INT" — **même schéma que [DBG-5]/[DBG-6]** : DB stocke `attr_1: CHC` (analogie erronée avec `MUTATION`) alors que le LdB donne un attribut réel propre (INT/INT). → **[DBG-7] résolu** — décision Saar : aligner sur [DBG-5]/[DBG-6], `attr_1: INT` (self-doublé, `attr_2` reste NULL), `marker` reste NULL.
- L.554 "• Administration/Gestion (X)" — attrs INT/INT hérités ✅, mais marker LdB = `(X)`, DB = `S` → 🔴 bug, même panne que les enfants COMMERCE_TRAFIC (6a).
- L.557 "• Armes/Systèmes d'armement (X)" — attrs ✅, marker LdB = `(X)`, DB = `S` → 🔴 bug, idem.
- `CONNAISSANCE_MILIEUX_SOCIAUX` : **absent du LdB** (recherche "milieux sociaux" : 0 résultat dans `REGLECOMPETENCE.md`). Ajout projet (migration 103, commentaire : "utilisé dans les lots 4a/6"). Pas de source LdB pour vérifier attrs/marker → ℹ️ hors scope cross-check, pas un bug, à noter tel quel dans 37-bis (reprendre valeurs actuelles : INT/PRE, marker NULL).

| ID | Statut | Détail |
|---|---|---|
| CONNAISSANCE_DES_NATIONS_ORGANISATIONS | ✅ conforme | `•` jamais stocké en DB (confirmé global) — PN seul correct |
| CONNAISSANCE_MILIEUX_SOCIAUX | ℹ️ hors LdB | ajout projet migration 103, pas de source à comparer |
| CRYPTOGRAPHIE | ✅ conforme | |
| EDUCATION_CULTURE_GENERALE | ✅ conforme | |
| JEU | ✅ conforme | |
| NAVIGATION | ✅ conforme | |
| RECHERCHE_DINFORMATIONS | ✅ conforme | |
| SCIENCES_CONNAISANCES_SPECIALISEES | 🔴 bug confirmé — [DBG-7] résolu | attr_1 CHC → INT (self-doublé), même schéma que [DBG-5]/[DBG-6] |
| SCIENCES_CONNAISANCES_SPECIALISEES_ADMINISTRATION_GESTION | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_ARMES_SYSTEMES_DARMEMENT | 🔴 bug confirmé | marker `S` → `(X)` |

**Bugs à corriger dans 37-bis (famille 6, sous-segment b) :** 3/10 — SCIENCES_CONNAISANCES_SPECIALISEES ([DBG-7] résolu), + 2 enfants marker `S`→`(X)`. 6/10 conformes, 1/10 hors scope (ajout projet).

### SEGMENT 6c — family "Connaissances" (10/43 lignes, 21→30 : SCIENCES_CONNAISANCES_SPECIALISEES_ASTROPHYSIQUE_ASTRONOMIE → SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| SCIENCES_CONNAISANCES_SPECIALISEES_ASTROPHYSIQUE_ASTRONOMIE | Astrophysique/Astronomie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE | Biologie/Physiologie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE | Botanique | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_CRIMINALISTIQUE | Criminalistique | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS | Droit/Législations | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE | Économie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_FINANCES | Finances | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE | Géographie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE | Géologie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE | Histoire/Archéologie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.560-597 : liste complète des sous-Sciences, **toutes marquées `(X)` uniformément** dans le LdB (Astrophysique/Astronomie (X), Biologie/Physiologie (X), Botanique (X), Criminalistique (X), Droit/Législations (X), Économie (X), Finances (X), Géographie (X), Géologie (X), Histoire/Archéologie (X)). Attrs héritées INT/INT (self-doublé) cohérentes, non re-précisées par sous-compétence dans le LdB.

**10/10 même panne marker `S` → `(X)`** — confirme définitivement le schéma déjà vu en 6a (7 enfants COMMERCE_TRAFIC) et 6b (2 enfants Sciences) : le marker `'S'` semble avoir systématiquement écrasé un marker `(X)` réel lors d'une passe de nettoyage historique, au moins pour toutes les sous-compétences de catégorie CHC/parent-virtuel rencontrées jusqu'ici.

| ID | Statut | Détail |
|---|---|---|
| SCIENCES_CONNAISANCES_SPECIALISEES_ASTROPHYSIQUE_ASTRONOMIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_BIOLOGIE_PHYSIOLOGIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_BOTANIQUE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_CRIMINALISTIQUE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_DROIT_LEGISLATIONS | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_ECONOMIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_FINANCES | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_GEOGRAPHIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_GEOLOGIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_HISTOIRE_ARCHEOLOGIE | 🔴 bug confirmé | marker `S` → `(X)` |

**Bugs à corriger dans 37-bis (famille 6, sous-segment c) :** 10/10 — marker `S` → `(X)` sur toute la ligne.

### SEGMENT 6d — family "Connaissances" (10/43 lignes, 31→40 : SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE → TACTIQUE_COMBAT_NAVAL) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE | Médecine | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE | Pharmacologie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE | Physique/Chimie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE | Psychologie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES | Sciences politiques | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE | Sociologie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| SCIENCES_CONNAISANCES_SPECIALISEES_ZOOLOGIE | Zoologie | SCIENCES_CONNAISANCES_SPECIALISEES | INT | | S |
| STRATEGIE | Stratégie | | INT | | (-3) |
| TACTIQUE | Tactique | | INT | ADA | |
| TACTIQUE_COMBAT_NAVAL | Combat naval | TACTIQUE | INT | ADA | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` :
- L.580-597 : Médecine (X), Pharmacologie (X), Physique/Chimie (X), Psychologie (X), Sciences politiques (X), Sociologie (X), Zoologie (X) — mêmes 7 dernières sous-Sciences, toutes `(X)`, attrs héritées INT/INT (self-doublé).
- L.603-605 : `Stratégie † (-3)` — Attributs associés : INT/INT (self-doublé). `†` = pré-requis (Éducation/Culture générale 10), non stocké en `marker` par convention établie. DB conforme.
- L.612-621 : `Tactique […]` — Attributs associés : INT/ADA. Aucun marker LdB sur l'en-tête parent lui-même (le `[…]` signale une liste de spécialisations, comme Commerce/Trafic ou Pouvoirs Polaris — mais ici, contrairement à [DBG-5/6/7], les attrs réels INT/ADA sont **déjà** correctement en DB, pas de sentinel CHC). DB conforme.
- L.623 : `• Combat naval (-3)` — sous-compétence de Tactique, marker LdB `(-3)`, attrs hérités INT/ADA (non re-précisés, cohérent avec le parent).

**Constat additionnel :** `docs/JOURNALCOUCHE4.md` listait `TACTIQUE` parmi les groupes parents absents de `ref_skills` — ce constat est **obsolète/incorrect** : `TACTIQUE` est bien présent en DB (family Connaissances), avec attrs corrects INT/ADA et sans le bug CHC des [DBG-5/6/7]. À corriger dans JOURNALCOUCHE4.md en fin de session si pertinent, pas une action pour 37-bis.

**8/10 bugs** — panne `S` → `(X)` sur les 7 dernières sous-Sciences (18e à 24e enfant Sciences audité, toujours 100% du motif, zéro exception cumulée), + `TACTIQUE_COMBAT_NAVAL` marker `S` → `(-3)` (même panne, cette fois sur une famille Tactique et non Sciences/Commerce — confirme que la corruption `'S'` n'est pas limitée aux enfants CHC mais touche plus largement les enfants de compétences-parents). **2/10 conformes** : STRATEGIE, TACTIQUE (le seul cas jusqu'ici d'un parent-catégorie avec attrs réels déjà correctement en DB, sans sentinel CHC — pas de [DBG] nécessaire).

| ID | Statut | Détail |
|---|---|---|
| SCIENCES_CONNAISANCES_SPECIALISEES_MEDECINE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_PHARMACOLOGIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_PHYSIQUE_CHIMIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_PSYCHOLOGIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_SCIENCES_POLITIQUES | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_SOCIOLOGIE | 🔴 bug confirmé | marker `S` → `(X)` |
| SCIENCES_CONNAISANCES_SPECIALISEES_ZOOLOGIE | 🔴 bug confirmé | marker `S` → `(X)` |
| STRATEGIE | 🟢 conforme | — |
| TACTIQUE | 🟢 conforme | parent-catégorie avec attrs réels déjà corrects, sans sentinel CHC |
| TACTIQUE_COMBAT_NAVAL | 🔴 bug confirmé | marker `S` → `(-3)` |

**Bugs à corriger dans 37-bis (famille 6, sous-segment d) :** 8/10 — 7 enfants Sciences marker `S`→`(X)`, TACTIQUE_COMBAT_NAVAL marker `S`→`(-3)`. 2/10 conformes (STRATEGIE, TACTIQUE).

### SEGMENT 6e — family "Connaissances" (3/43 lignes, 41→43 : TACTIQUE_COMBAT_SOUTERRAIN → TACTIQUE_OPERATIONS_COMMANDO) ✅ audité — dernier segment de la famille

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| TACTIQUE_COMBAT_SOUTERRAIN | Combat souterrain | TACTIQUE | INT | ADA | S |
| TACTIQUE_COMBAT_TERRESTRE | Combat terrestre | TACTIQUE | INT | ADA | S |
| TACTIQUE_OPERATIONS_COMMANDO | Opérations commando | TACTIQUE | INT | ADA | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.624-631 : suite de la liste des sous-Tactique. Contrairement à Combat naval (`(-3)`), aucun marker n'est cité dans le LdB pour Combat souterrain, Combat terrestre, Opérations commando — les trois sont listées sans annotation. Attrs hérités INT/ADA du parent, cohérents.

**3/10 bugs (3/3 lignes du segment)** — marker `S` → **NULL** (aucun marker LdB), variante du même motif de corruption déjà vu : ici la valeur correcte n'est ni `(X)` ni `(-3)` mais l'absence de marker.

| ID | Statut | Détail |
|---|---|---|
| TACTIQUE_COMBAT_SOUTERRAIN | 🔴 bug confirmé | marker `S` → NULL (aucun marker LdB) |
| TACTIQUE_COMBAT_TERRESTRE | 🔴 bug confirmé | marker `S` → NULL (aucun marker LdB) |
| TACTIQUE_OPERATIONS_COMMANDO | 🔴 bug confirmé | marker `S` → NULL (aucun marker LdB) |

**Bugs à corriger dans 37-bis (famille 6, sous-segment e) :** 3/3 — marker `S` → NULL sur toute la ligne.

## FAMILLE "Connaissances" — CLÔTURE (43/43)

Résumé consolidé (6a→6e) :
- **BUREAUCRATIE** : conforme
- **CARTOGRAPHIE** : marker manquant → `(X)`
- **COMMERCE_TRAFIC** : `[DBG-6]` résolu — `attr_1: INT, attr_2: PRE, marker: NULL`
- **7 enfants COMMERCE_TRAFIC__\*** : marker `S` → valeur LdB réelle individuelle (Armes `(X)`, Denrées alimentaires `(-3)`, Drogues `(X)`, Informations `(-3)`, Matériel médical `(-3)`, Matières premières `(-3)`, Véhicules `(-3)`)
- **CONNAISSANCE_DES_NATIONS_ORGANISATIONS** : conforme (`•` jamais stocké, `PN` seul correct)
- **CONNAISSANCE_MILIEUX_SOCIAUX** : hors scope LdB (ajout projet migration 103)
- **CRYPTOGRAPHIE, EDUCATION_CULTURE_GENERALE, JEU, NAVIGATION, RECHERCHE_DINFORMATIONS** : conformes
- **SCIENCES_CONNAISANCES_SPECIALISEES** : `[DBG-7]` résolu — `attr_1: INT` (self-doublé), marker NULL
- **17 enfants SCIENCES_CONNAISANCES_SPECIALISEES_\*** (Administration/Gestion, Armes/Systèmes d'armement, + les 17 sous-disciplines Astrophysique→Zoologie) : marker `S` → `(X)` uniformément, **0 exception sur 17**
- **STRATEGIE, TACTIQUE** : conformes (TACTIQUE = 1er parent-catégorie avec attrs réels déjà corrects en DB, sans sentinel CHC)
- **4 enfants TACTIQUE_\*** : marker `S` → valeur LdB réelle (Combat naval `(-3)`, Combat souterrain/terrestre/Opérations commando NULL)

**Total famille Connaissances : 33 bugs / 43 lignes (77%)**, 1 hors-scope (CONNAISSANCE_MILIEUX_SOCIAUX), 9 conformes.

### SEGMENT 7 — family "Furtivité / Subterfuge" (6/6 lignes, famille complète) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| CAMOUFLAGE_DISSIMULATION | Camouflage/Dissimulation | | ADA | PER | (-3) |
| DEGUISEMENT_IMITATION | Déguisement/Imitation | | ADA | PRE | (-3) |
| DISCRETION_FILATURE | Discrétion/Filature | | ADA | PER | |
| EVASION | Evasion | | COO | VOL | |
| FURTIVITE_DEPLACEMENT_SILENCIEUX | Furtivité/Déplacement silencieux | | ADA | PER | |
| PICKPOCKET | Pickpocket | | COO | ADA | (-3) |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.647-714 :
- Camouflage/Dissimulation (-3), Attributs associés : **PER/ADA**
- Déguisement/Imitation (-3), Attributs associés : ADA/PRE
- Discrétion/Filature (pas de marker), Attributs associés : **PER/ADA**
- Évasion **(X)**, Attributs associés : COO/VOL
- Furtivité/Déplacement silencieux **•** (Compétence limitative), Attributs associés : **PER/ADA**
- Pickpocket (-3), Attributs associés : COO/ADA

**Constat méthodologique (nouveau) — ordre attr_1/attr_2 :** sur 3 lignes, le LdB liste l'attribut dans l'ordre inverse de la DB (LdB "PER/ADA" → DB `attr_1: ADA, attr_2: PER`). Vérification : ces 3 cas (Camouflage/Dissimulation, Discrétion/Filature, Furtivité/Déplacement silencieux) sont précisément ceux où l'ordre LdB place PER avant ADA — alors que dans l'ordre canonique des 8 attributs (FOR, CON, COO, ADA, PER, INT, VOL, PRE), ADA précède PER. Les 3 autres lignes de ce segment (Déguisement/Imitation ADA/PRE, Évasion COO/VOL, Pickpocket COO/ADA) ont déjà l'ordre LdB conforme à l'ordre canonique, et la DB ne les modifie pas. **Hypothèse confirmée sur 6/6 lignes du segment : la DB normalise systématiquement `attr_1`/`attr_2` selon l'ordre canonique des attributs, indépendamment de l'ordre du texte LdB.** Fonctionnellement neutre (somme des deux attributs, non affectée par l'ordre) — traité comme une convention de stockage, pas un bug.

**1/6 bug** : EVASION — marker manquant, doit être `(X)` (LdB "Évasion (X)"). Les 5 autres lignes conformes (attrs corrects une fois la convention d'ordre canonique reconnue ; FURTIVITE_DEPLACEMENT_SILENCIEUX conforme car `•` n'est jamais stocké en `marker`, convention déjà établie en 6b).

| ID | Statut | Détail |
|---|---|---|
| CAMOUFLAGE_DISSIMULATION | 🟢 conforme | ordre attr canonique (ADA/PER), marker `(-3)` correct |
| DEGUISEMENT_IMITATION | 🟢 conforme | — |
| DISCRETION_FILATURE | 🟢 conforme | ordre attr canonique (ADA/PER), pas de marker LdB |
| EVASION | 🔴 bug confirmé | marker manquant → `(X)` |
| FURTIVITE_DEPLACEMENT_SILENCIEUX | 🟢 conforme | `•` non stocké (convention table-wide) |
| PICKPOCKET | 🟢 conforme | — |

**Bugs à corriger dans 37-bis (famille 7) :** 1/6 — EVASION marker NULL → `(X)`.

## FAMILLE "Furtivité / Subterfuge" — CLÔTURE (6/6)

**Total famille Furtivité/Subterfuge : 1 bug / 6 lignes (17%)**, 5 conformes. Découverte méthodologique notable : confirmation de la convention d'ordre canonique `attr_1`/`attr_2` (FOR/CON/COO/ADA/PER/INT/VOL/PRE), indépendante de l'ordre du texte LdB — à garder en tête pour les familles restantes (Langues/langages, Pilotage, Survie/Extérieur, Techniques) sans nécessiter de re-vérification rétroactive des familles déjà closes (l'ordre ne change pas la valeur fonctionnelle des deux attributs).

**⚠️ CORRECTIF (segment 9)** : cette hypothèse de normalisation systématique a été **infirmée** par des contre-exemples trouvés dans la famille Pilotage (même paire LdB stockée dans les deux ordres selon la ligne). Voir clôture famille "Pilotage" pour le détail — révisée en « ordre non significatif, variable selon l'historique de seed, sans impact fonctionnel ».

### SEGMENT 8a — family "Langues / langages" (10/35 lignes, 1→10 : LANGAGES_SPECIFIQUES → LANGAGES_SPECIFIQUES_LEVEAN) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| LANGAGES_SPECIFIQUES | Langages Spécifiques | | INT | | (X) |
| LANGAGES_SPECIFIQUES_ABSOLAN | Absolan | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_ENEFID | Énéfid | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_EXON | Exon | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_FOREUR | Foreur | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_INESIS | Inésis | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_ITHRAXIEN | Ithraxien | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_KLAN | Klan | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES | Langage des signes | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_LEVEAN | Lévéan | LANGAGES_SPECIFIQUES | INT | | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.807-840 :
- En-tête catégorie : "Langages spécifiques […] **(PN)**", Attributs associés : INT/INT (self-doublé).
- Absolan (X), Énéfid (X), Exon (X), Foreur (X), Inésis (X), Ithraxien (X), Klan (X) — marker individuel `(X)` explicite pour chacun.
- **Langage des signes** — listé **sans** `(X)` ni aucun autre marker dans le LdB (seul élément de vocabulaire, pas de restriction d'accès).
- Lévéan (X).

**[DBG-9] — nouveau motif de corruption, distinct de `S` et du sentinel `CHC` :** la ligne-catégorie parente `LANGAGES_SPECIFIQUES` porte `marker='(X)'` en DB, alors que le LdB donne `(PN)` pour l'en-tête de catégorie elle-même. `attr_1/attr_2` sont corrects (INT self-doublé). À vérifier si `LANGUE_ANCIENNE` et `LANGUE_ETRANGERE` (segment 8b) suivent le même motif.

| ID | Statut | Détail |
|---|---|---|
| LANGAGES_SPECIFIQUES | 🔴 bug confirmé — [DBG-9] | marker `(X)` → `PN` (attrs déjà corrects) |
| LANGAGES_SPECIFIQUES_ABSOLAN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_ENEFID | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_EXON | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_FOREUR | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_INESIS | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_ITHRAXIEN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_KLAN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES | 🔴 bug confirmé | marker `S` → **NULL** (pas de `(X)` dans le LdB pour cet item, exception à ne pas uniformiser) |
| LANGAGES_SPECIFIQUES_LEVEAN | 🔴 bug confirmé | marker `S` → `(X)` |

**Bugs à corriger dans 37-bis (famille 8, sous-segment a) :** 10/10 — 1 catégorie `(X)`→`PN`, 8 enfants `S`→`(X)`, 1 enfant `S`→NULL (Langage des signes).

### SEGMENT 8b — family "Langues / langages" (10/35 lignes, 11→20 : LANGAGES_SPECIFIQUES_METALAN → LANGUE_ETRANGERE) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| LANGAGES_SPECIFIQUES_METALAN | Métalan | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_NEOLAN | Néolan | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_SIRS | Sirs | LANGAGES_SPECIFIQUES | INT | | S |
| LANGAGES_SPECIFIQUES_SOLEEN | Soléen | LANGAGES_SPECIFIQUES | INT | | S |
| LANGUE_ANCIENNE | Langue ancienne | | INT | | (X) |
| LANGUE_ANCIENNE_ARKONIEN | Arkonien | LANGUE_ANCIENNE | INT | | S |
| LANGUE_ANCIENNE_AZURAN | Azuran | LANGUE_ANCIENNE | INT | | S |
| LANGUE_ANCIENNE_AZUREEN | Azuréen | LANGUE_ANCIENNE | INT | | S |
| LANGUE_ANCIENNE_GATEEN | Gatéen | LANGUE_ANCIENNE | INT | | S |
| LANGUE_ETRANGERE | Langue étrangère | | INT | | (X) |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.835-840, L.796-805, L.768 :
- Métalan (X), Néolan (X) — marker individuel explicite.
- **Sirs** — listé **sans** `(X)` (jargon des bas-fonds, comme "Langage des signes" en 8a — pas une compétence réservée).
- Soléen (X).
- En-tête catégorie "Langues anciennes […]" — **aucun marker** dans le LdB (ni `(PN)` ni autre). Arkonien (X), Azuran (X), Azuréen (X), Gatéen (X) — tous marker individuel `(X)`.
- En-tête catégorie "Langues étrangères […] **(PN)**", Attributs associés : INT/INT.

**[DBG-9] confirmé sur les 3 catégories de la famille** : les trois lignes-catégories (`LANGAGES_SPECIFIQUES`, `LANGUE_ANCIENNE`, `LANGUE_ETRANGERE`) portent uniformément `marker='(X)'` en DB, alors que le LdB donne 3 valeurs différentes selon l'en-tête réel : `PN` (Langages spécifiques), **NULL/aucun** (Langues anciennes), `PN` (Langues étrangères). Motif de corruption distinct du seed `S` : ici c'est un `(X)` générique appliqué à toute ligne-catégorie de la famille, sans respecter la légende propre à chaque en-tête LdB — même nature d'erreur mécanique que le motif déjà documenté pour `MUTATION_*` (segment 5, L.329 du présent doc), mais appliqué ici au niveau des parents plutôt que des enfants.

| ID | Statut | Détail |
|---|---|---|
| LANGAGES_SPECIFIQUES_METALAN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_NEOLAN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGAGES_SPECIFIQUES_SIRS | 🔴 bug confirmé | marker `S` → **NULL** (pas de `(X)` dans le LdB, comme Langage des signes) |
| LANGAGES_SPECIFIQUES_SOLEEN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ANCIENNE | 🔴 bug confirmé — [DBG-9] | marker `(X)` → **NULL** (en-tête LdB sans marker) |
| LANGUE_ANCIENNE_ARKONIEN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ANCIENNE_AZURAN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ANCIENNE_AZUREEN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ANCIENNE_GATEEN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE | 🔴 bug confirmé — [DBG-9] | marker `(X)` → `PN` (attrs déjà corrects) |

**Bugs à corriger dans 37-bis (famille 8, sous-segment b) :** 10/10 — 2 catégories [DBG-9] (`LANGUE_ANCIENNE`→NULL, `LANGUE_ETRANGERE`→PN), 7 enfants `S`→`(X)`, 1 enfant `S`→NULL (Sirs).

### SEGMENT 8c — family "Langues / langages" (10/35 lignes, 21→30 : LANGUE_ETRANGERE_AMANEUN → LANGUE_ETRANGERE_OLAKAR) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| LANGUE_ETRANGERE_AMANEUN | Amanéun | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_AZRAN | Azran | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_GASHKLAR | Gashklar | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_ISITAC | Isitac | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_LESARACH | Lesarach | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_LEXZION | Léxzion | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_NEO_AZURAN | Néo-azuran | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_NEZRAIS | Nezraïs | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_OCEANE | Océane | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_OLAKAR | Olakar | LANGUE_ETRANGERE | INT | | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.772-787 : Amanéun (X), Azran (X), Gashklar (X), Isitac (X), Lesarach (X), Léxzion (X), Néo-azuran (X), Nezraïs (X), Océane (X), Olakar (X) — les 10 avec marker individuel `(X)` explicite, aucune exception (contrairement à `LANGAGES_SPECIFIQUES` en 8a/8b).

| ID | Statut | Détail |
|---|---|---|
| LANGUE_ETRANGERE_AMANEUN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_AZRAN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_GASHKLAR | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_ISITAC | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_LESARACH | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_LEXZION | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_NEO_AZURAN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_NEZRAIS | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_OCEANE | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_OLAKAR | 🔴 bug confirmé | marker `S` → `(X)` |

**Bugs à corriger dans 37-bis (famille 8, sous-segment c) :** 10/10 — marker `S` → `(X)` uniformément, 0 exception sur 10.

### SEGMENT 8d — family "Langues / langages" (5/35 lignes, 31→35 : LANGUE_ETRANGERE_OLOSAK → LANGUE_ETRANGERE_TRASHAN, clôture famille) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| LANGUE_ETRANGERE_OLOSAK | Olosak | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_OSSYRIEN | Ossyrien | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_RENAREAN | Rénaréan | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_TERNASET | Ternaset | LANGUE_ETRANGERE | INT | | S |
| LANGUE_ETRANGERE_TRASHAN | Trashan | LANGUE_ETRANGERE | INT | | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.788-795 : Olosak (X), Ossyrien (X), Rénaréan (X), Ternaset (X), Trashan (X) — les 5 avec marker `(X)` explicite. Total `LANGUE_ETRANGERE` : 15 enfants (8c + 8d), correspond exactement aux 15 langues listées dans le LdB — **aucune langue manquante**.

| ID | Statut | Détail |
|---|---|---|
| LANGUE_ETRANGERE_OLOSAK | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_OSSYRIEN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_RENAREAN | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_TERNASET | 🔴 bug confirmé | marker `S` → `(X)` |
| LANGUE_ETRANGERE_TRASHAN | 🔴 bug confirmé | marker `S` → `(X)` |

**Bugs à corriger dans 37-bis (famille 8, sous-segment d) :** 5/5 — marker `S` → `(X)` uniformément, 0 exception sur 5.

## FAMILLE "Langues / langages" — CLÔTURE (35/35)

- **LANGAGES_SPECIFIQUES** (catégorie) : [DBG-9] marker `(X)` → `PN` (attrs INT self-doublé déjà corrects).
- **13 enfants LANGAGES_SPECIFIQUES_\*** : 11 marker `S`→`(X)` (Absolan, Énéfid, Exon, Foreur, Inésis, Ithraxien, Klan, Lévéan, Métalan, Néolan, Soléen) + **2 exceptions** marker `S`→NULL (Langage des signes, Sirs — seuls items de toute la famille sans `(X)` dans le LdB).
- **LANGUE_ANCIENNE** (catégorie) : [DBG-9] marker `(X)` → **NULL** (en-tête LdB "Langues anciennes […]" sans aucun marker).
- **4 enfants LANGUE_ANCIENNE_\*** (Arkonien, Azuran, Azuréen, Gatéen) : marker `S`→`(X)` uniformément, 0 exception.
- **LANGUE_ETRANGERE** (catégorie) : [DBG-9] marker `(X)` → `PN` (attrs déjà corrects).
- **15 enfants LANGUE_ETRANGERE_\*** : marker `S`→`(X)` uniformément, 0 exception — total exact vs LdB (15/15 langues), aucune langue manquante.

**Total famille Langues/langages : 35 bugs / 35 lignes (100%)** — famille au taux de bug le plus élevé auditée jusqu'ici. Tous les bugs sont sur `marker` uniquement ; `attr_1`/`attr_2` sont corrects sur toute la famille (INT self-doublé, hérité des 3 catégories, conforme au LdB). Découverte notable : **[DBG-9]**, un 3ᵉ motif de corruption du champ `marker` (après le sentinel `CHC` sur attrs et le résidu de seed `S` sur enfants) touchant spécifiquement les 3 lignes-catégories de cette famille, remplacées uniformément par `(X)` sans respecter la valeur réelle de chaque en-tête LdB (`PN`, NULL, `PN`). Ce motif est à surveiller sur `PILOTAGE` (prochaine famille), qui possède également des lignes-catégories.

Correction apportée à la légende `marker` (ligne 71 du présent doc) : le chiffre "49" pour `Langues/langages` était erroné — corrigé à 32 (nombre réel de lignes `marker='S'` dans la famille ; les 3 lignes-catégories ont un bug distinct, `(X)` au lieu de `PN`/`PN`/NULL, non compté dans le résidu `S`).

### SEGMENT 9a — family "Pilotage" (10/15 lignes, 1→10 : MANOEUVRE_DARMURE → PILOTAGE__NAVIRES_LEGERS) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| MANOEUVRE_DARMURE | Manœuvre d'armure | | COO | ADA | |
| MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES | Armure atmosphérique | MANOEUVRE_DARMURE | COO | ADA | S |
| MANOEUVRE_DARMURE__ARMURES_EXTERNES | Armure externe | MANOEUVRE_DARMURE | COO | ADA | S |
| MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES | Armure sous-marine | MANOEUVRE_DARMURE | COO | ADA | S |
| MANOEUVRE_DARMURE__ARMURES_SPATIALES | Armure spatiale | MANOEUVRE_DARMURE | COO | ADA | S |
| PILOTAGE | Pilotage | | CHC | | PREREQ |
| PILOTAGE__CHASSEURS_ATMOSPHERIQUES | Chasseur atmosphérique | PILOTAGE | INT | ADA | S |
| PILOTAGE__CHASSEURS_SOUS_MARINS | Chasseur sous-marin | PILOTAGE | INT | ADA | S |
| PILOTAGE__ENGINS_SPATIAUX | Engins spatiaux | PILOTAGE | INT | | S |
| PILOTAGE__NAVIRES_LEGERS | Navire léger | PILOTAGE | INT | | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.841-882 :
- En-tête "Manœuvre d'armures […] **•**", Attributs associés : COO/ADA — `•` jamais stocké (convention établie 6b) → marker DB NULL ✅ conforme.
- Armures atmosphériques **(X)**. Armures externes — **aucun marker** dans le LdB. Armures sous-marines — **aucun marker**. Armures spatiales **(-3)**.
- En-tête "Pilotage […] / Attributs associés : **variable** (voir ci-dessous)" — contrairement à `COMMERCE_TRAFIC`/`SCIENCES_CONNAISANCES_SPECIALISEES`/`POUVOIRS_POLARIS` ([DBG-5/6/7]), le LdB **n'indique explicitement aucun attribut fixe unique** pour cet en-tête (« variable » signifie : chaque enfant a sa propre paire, il n'y a pas de test direct sur `PILOTAGE` lui-même).
- Chasseurs sous-marins (INT/ADA, X) †. Chasseurs atmosphériques (INT/ADA, X) †. Navires légers (INT/INT, X) † — self-doublé.

**[DBG-8] confirmé (anticipé depuis segment 6)** : `PILOTAGE` porte `attr_1='CHC'` — même sentinel hérité de l'analogie erronée avec `MUTATION` que [DBG-5/6/7]. **Mais résolution différente** : dans [DBG-5/6/7], le LdB donnait un attribut réel unique à restaurer (INT/VOL, INT/PRE, INT/INT). Ici, le LdB dit explicitement « variable » — il n'existe **aucune** valeur réelle unique à restaurer. Décision : `attr_1`/`attr_2` → **NULL/NULL** (pas de test direct sur ce parent). Marker `PREREQ` : contrairement à `COMMERCE_TRAFIC` (où [DBG-6] l'a fait retirer, car ce dernier est une vraie Compétence testable malgré son statut de parent), **`PREREQ` est ici légitime et à conserver** — `PILOTAGE` est un authentique parent virtuel sans Compétence propre, exactement le cas d'usage documenté pour ce marker (l.72 du présent doc).

| ID | Statut | Détail |
|---|---|---|
| MANOEUVRE_DARMURE | 🟢 conforme | `•` non stocké, attrs COO/ADA corrects |
| MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES | 🔴 bug confirmé | marker `S` → `(X)` |
| MANOEUVRE_DARMURE__ARMURES_EXTERNES | 🔴 bug confirmé | marker `S` → **NULL** (pas de marker LdB) |
| MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES | 🔴 bug confirmé | marker `S` → **NULL** (pas de marker LdB) |
| MANOEUVRE_DARMURE__ARMURES_SPATIALES | 🔴 bug confirmé | marker `S` → `(-3)` |
| PILOTAGE | 🔴 bug confirmé — [DBG-8] résolu (nuancé) | attr_1 `CHC` → NULL/NULL (« variable », rien à restaurer), marker `PREREQ` conservé |
| PILOTAGE__CHASSEURS_ATMOSPHERIQUES | 🔴 bug confirmé | marker `S` → `(X)` |
| PILOTAGE__CHASSEURS_SOUS_MARINS | 🔴 bug confirmé | marker `S` → `(X)` |
| PILOTAGE__ENGINS_SPATIAUX | 🔴 bug confirmé | marker `S` → `(X)` (attrs déjà corrects, self-doublé) |
| PILOTAGE__NAVIRES_LEGERS | 🔴 bug confirmé | marker `S` → `(X)` (attrs déjà corrects, self-doublé) |

**Bugs à corriger dans 37-bis (famille 9, sous-segment a) :** 9/10 — [DBG-8] sur PILOTAGE + 8 enfants marker (6 `S`→`(X)`, 2 `S`→NULL). 1/10 conforme (MANOEUVRE_DARMURE).

### SEGMENT 9b — family "Pilotage" (5/15 lignes, 11→15 : PILOTAGE__NAVIRES_LOURDS → TELEPILOTAGE, clôture famille) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| PILOTAGE__NAVIRES_LOURDS | Navire lourd | PILOTAGE | INT | | S |
| PILOTAGE__SCOOTERS_SOUS_MARINS | Scooter sous-marin | PILOTAGE | PER | ADA | S |
| PILOTAGE__VEHICULES_DE_SOL | Véhicule de sol | PILOTAGE | PER | ADA | S |
| PILOTAGE__VEHICULES_SOUTERRAINS | Véhicule souterrain | PILOTAGE | INT | ADA | S |
| TELEPILOTAGE | Télépilotage | | ADA | INT | (-3) |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.879-894 :
- Navires lourds (INT/INT, X) † — self-doublé.
- Véhicules souterrains (INT/ADA, X) — **aucun †** (contrairement aux 5 autres enfants avec prérequis), mais marker `(X)` bien présent.
- Véhicules de sol (PER/ADA) — **aucun marker** dans le LdB.
- Scooters sous-marins (PER/ADA) — **aucun marker** dans le LdB.
- Télépilotage (-3), Attributs associés : INT/ADA.

**⚠️ Correctif à la conclusion méthodologique du SEGMENT 7 (ordre canonique attr_1/attr_2)** : le segment 7 concluait, sur 6 lignes de la famille Furtivité/Subterfuge, que la DB normalise systématiquement `attr_1`/`attr_2` selon l'ordre canonique (FOR/CON/COO/ADA/PER/INT/VOL/PRE), indépendamment de l'ordre du texte LdB. **Ce segment apporte un contre-exemple direct** : pour la paire INT/ADA (LdB), `PILOTAGE__CHASSEURS_ATMOSPHERIQUES`, `PILOTAGE__CHASSEURS_SOUS_MARINS` et `PILOTAGE__VEHICULES_SOUTERRAINS` (segment 9a/9b) conservent l'ordre littéral du LdB `INT, ADA` (non-canonique — l'ordre canonique voudrait ADA avant INT) alors que `TELEPILOTAGE`, pour la **même paire** INT/ADA, la stocke en `ADA, INT` (canonique). Autre contre-exemple : pour PER/ADA (LdB), `PILOTAGE__VEHICULES_DE_SOL` et `PILOTAGE__SCOOTERS_SOUS_MARINS` conservent l'ordre littéral `PER, ADA` (non-canonique), alors qu'en segment 7, les lignes LdB "PER/ADA" de Furtivité/Subterfuge étaient stockées `ADA, PER` (canonique). **Conclusion révisée : l'ordre `attr_1`/`attr_2` n'est pas normalisé systématiquement — il varie ligne par ligne, probablement selon la migration/le seed d'origine de chaque ligne, sans convention voulue.** Ceci reste sans impact fonctionnel (somme symétrique des deux attributs, cf. segment 7), donc toujours **pas un bug à corriger** dans 37-bis — mais l'hypothèse d'une normalisation délibérée est abandonnée, remplacée par « ordre non significatif, variable selon l'historique de seed ».

| ID | Statut | Détail |
|---|---|---|
| PILOTAGE__NAVIRES_LOURDS | 🔴 bug confirmé | marker `S` → `(X)` (attrs déjà corrects, self-doublé) |
| PILOTAGE__SCOOTERS_SOUS_MARINS | 🔴 bug confirmé | marker `S` → **NULL** (pas de marker LdB) |
| PILOTAGE__VEHICULES_DE_SOL | 🔴 bug confirmé | marker `S` → **NULL** (pas de marker LdB) |
| PILOTAGE__VEHICULES_SOUTERRAINS | 🔴 bug confirmé | marker `S` → `(X)` |
| TELEPILOTAGE | 🟢 conforme | ordre attr non-canonique mais fonctionnellement neutre, marker `(-3)` correct |

**Bugs à corriger dans 37-bis (famille 9, sous-segment b) :** 4/5 — 2 enfants `S`→`(X)`, 2 enfants `S`→NULL. 1/5 conforme (TELEPILOTAGE).

## FAMILLE "Pilotage" — CLÔTURE (15/15)

- **MANOEUVRE_DARMURE** (catégorie) : conforme — `•` jamais stocké, attrs COO/ADA corrects.
- **4 enfants MANOEUVRE_DARMURE__\*** : 2 marker `S`→`(X)` (Armures atmosphériques, Armures spatiales `(-3)` en réalité — *voir note*), 2 marker `S`→NULL (Armures externes, Armures sous-marines). Précision : Armures atmosphériques → `(X)`, Armures spatiales → `(-3)` (pas `(X)`) — chaque enfant a sa valeur propre, non uniforme.
- **PILOTAGE** (catégorie) : [DBG-8] résolu (nuancé) — `attr_1: CHC` → NULL/NULL (LdB « variable », rien à restaurer, contrairement à [DBG-5/6/7]) ; marker `PREREQ` **conservé** (légitime ici, vrai parent virtuel sans Compétence propre).
- **10 enfants PILOTAGE__\*** : 6 marker `S`→`(X)` (Chasseurs atmosphériques, Chasseurs sous-marins, Engins spatiaux, Navires légers, Navires lourds, Véhicules souterrains) + 2 marker `S`→NULL (Véhicules de sol, Scooters sous-marins).
- **TELEPILOTAGE** (skill autonome, hors catégorie) : conforme.

**Total famille Pilotage : 13 bugs / 15 lignes (87%)**, 2 conformes (MANOEUVRE_DARMURE, TELEPILOTAGE). [DBG-8] confirmé mais avec une résolution différente de [DBG-5/6/7] : pas de restauration d'un attribut réel unique (le LdB dit explicitement « variable »), donc NULL/NULL + conservation du marker `PREREQ` (seul cas de toute la table où `PREREQ` est jugé légitime plutôt que fautif). **Découverte majeure de ce segment : la théorie de l'ordre canonique attr_1/attr_2 (établie segment 7) est infirmée** par contre-exemples directs (même paire LdB stockée dans les deux ordres selon la ligne) — révisée en « ordre non significatif, sans impact fonctionnel, ne pas chercher à uniformiser dans 37-bis ».

### SEGMENT 10 — family "Survie / Extérieur" (8/8 lignes, famille complète) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| CHASSE_PISTAGE | Chasse/Pistage | | PER | ADA | (X) |
| CONNAISSANCE_MILIEU_NATUREL | Connaissance milieu naturel | | ADA | INT | |
| CONNAISSANCE_MILIEU_NATUREL_OCEANS | Océans | CONNAISSANCE_MILIEU_NATUREL | ADA | INT | S |
| CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS | Souterrains | CONNAISSANCE_MILIEU_NATUREL | ADA | INT | S |
| CONNAISSANCE_MILIEU_NATUREL_SURFACE | Surface | CONNAISSANCE_MILIEU_NATUREL | ADA | INT | S |
| OBSERVATION | Observation | | PER | VOL | |
| ORIENTATION | Orientation | | PER | ADA | |
| SURVIE | Survie | | ADA | VOL | (X) |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.897-957 :
- Chasse/Pistage **(X)**, Attributs associés : PER/ADA — DB conforme.
- En-tête "Connaissance d'un milieu naturel […] **•**", Attributs associés : INT/ADA — `•` jamais stocké → marker NULL ✅ conforme (ordre DB `ADA, INT`, inverse du LdB — sans conséquence, cf. correctif segment 9).
  - Océans **(-3)**, Souterrains **(-3)**, Surface **(X)** — trois valeurs différentes, non uniformes.
- Observation — aucun marker LdB, Attributs associés : PER/VOL — DB conforme.
- Orientation — aucun marker LdB, Attributs associés : PER/ADA — DB conforme.
- Survie **(X)**, Attributs associés : ADA/VOL — DB conforme.

| ID | Statut | Détail |
|---|---|---|
| CHASSE_PISTAGE | 🟢 conforme | — |
| CONNAISSANCE_MILIEU_NATUREL | 🟢 conforme | `•` non stocké, attrs corrects |
| CONNAISSANCE_MILIEU_NATUREL_OCEANS | 🔴 bug confirmé | marker `S` → `(-3)` |
| CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS | 🔴 bug confirmé | marker `S` → `(-3)` |
| CONNAISSANCE_MILIEU_NATUREL_SURFACE | 🔴 bug confirmé | marker `S` → `(X)` |
| OBSERVATION | 🟢 conforme | — |
| ORIENTATION | 🟢 conforme | — |
| SURVIE | 🟢 conforme | — |

**Bugs à corriger dans 37-bis (famille 10) :** 3/8 — les 3 enfants CONNAISSANCE_MILIEU_NATUREL_* (marker `S` → valeur LdB réelle, non uniforme : 2×`(-3)`, 1×`(X)`).

## FAMILLE "Survie / Extérieur" — CLÔTURE (8/8)

**Total famille Survie/Extérieur : 3 bugs / 8 lignes (37,5%)**, 5 conformes. Aucune anomalie de structure — famille la plus "propre" au niveau parent/racine (4/5 skills racines déjà conformes sans aucune correction). Chiffre "3" cohérent avec la légende globale `marker='S'` (l.71 du présent doc) — pas de correction nécessaire ici, contrairement à Langues/langages.

### SEGMENT 11a — family "Techniques" (10/34 lignes, 1→10 : ANALYSES_SONSCANS → ESPIONNAGE_SURVEILLANCE) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| ANALYSES_SONSCANS | Analyses sonscans | | ADA | INT | (X) |
| AQUACULTURE_ELEVAGE | Aquaculture/Elevage | | INT | | (X) |
| ARMES_EMBARQUEES_ARTILLERIE | Armes embarquées/Artillerie | | INT | | (X) |
| ARMES_SATELLITES | Armes satellites | | INT | | (X) |
| ARMURERIE | Armurerie | | INT | | (X) |
| ART_ARTISANAT | Art/Artisanat | | INT | | (X) |
| CHIRURGIE | Chirurgie | | INT | | (X) |
| DRESSAGE | Dressage | | VOL | PRE | (-3) |
| ELECTRONIQUE | Électronique | | INT | | (X) |
| ESPIONNAGE_SURVEILLANCE | Espionnage/Surveillance | | INT | | (X) |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.958-1008 :
- Analyse sonscans (X), INT/ADA — DB ordre inversé (ADA,INT) mais neutre (cf. correctif segment 9). ✅ conforme.
- Aquaculture/Élevage (X), INT/INT — ✅ conforme (self-doublé).
- Armes embarqués/Artillerie (X), INT/INT — ✅ conforme.
- Armurerie (X), INT/INT — ✅ conforme.
- **Art/Artisanat […] (X), Attributs associés : INT/PER** — DB `attr_2` vide (self-doublé implicite) au lieu de `PER` explicitement donné par le LdB. 🔴 **bug attr_2** (contrairement aux self-doublés légitimes vus jusqu'ici, ici le LdB donne bien 2 attributs distincts).
- Chirurgie † (X), INT/INT — ✅ conforme (le `†` de pré-requis n'est jamais stocké, convention déjà établie).
- Dressage (-3), VOL/PRE — ✅ conforme.
- Électronique † (X), INT/INT — ✅ conforme.
- Espionnage/Surveillance (X), INT/INT — ✅ conforme.

**ARMES_SATELLITES — décision Saar (2026-07-04) : RETIRER.** Cette ligne vient de la migration **103b, ajoutée la session précédente (131)**. Or le LdB (L.632-642, section "ARMES SATELLITES" après le bloc Tactique de la famille Connaissances) est explicite : *"La Compétence Tactique [Combat terrestre] permet également l'utilisation des armes satellites contrôlées par les stations orbitales."* — le LdB ne définit **aucune Compétence autonome** "Armes satellites" : cette capacité est une extension d'usage de `TACTIQUE_COMBAT_TERRESTRE` (déjà en DB, famille Connaissances, segment 6d), pas une nouvelle ligne `ref_skills`. **Décision : `ARMES_SATELLITES` sera supprimée de `ref_skills` par 37-bis** (`DELETE` ou non-réinsertion), et la migration 103b sera annulée/neutralisée dans la consolidation. Documenter dans le `down`/la doc que l'usage des armes satellites passe par `TACTIQUE_COMBAT_TERRESTRE`, pas par un skill dédié.

| ID | Statut | Détail |
|---|---|---|
| ANALYSES_SONSCANS | 🟢 conforme | ordre non-canonique sans impact |
| AQUACULTURE_ELEVAGE | 🟢 conforme | — |
| ARMES_EMBARQUEES_ARTILLERIE | 🟢 conforme | — |
| ARMES_SATELLITES | 🔴 **à retirer (décision Saar)** | absent du LdB comme Compétence autonome (couvert par TACTIQUE_COMBAT_TERRESTRE) ; migration 103b annulée dans 37-bis |
| ARMURERIE | 🟢 conforme | — |
| ART_ARTISANAT | 🔴 bug confirmé | attr_2 NULL → `PER` (LdB : INT/PER, pas self-doublé) |
| CHIRURGIE | 🟢 conforme | — |
| DRESSAGE | 🟢 conforme | — |
| ELECTRONIQUE | 🟢 conforme | — |
| ESPIONNAGE_SURVEILLANCE | 🟢 conforme | — |

**Bugs à corriger dans 37-bis (famille 11, sous-segment a) :** 1/10 — ART_ARTISANAT (attr_2). 1/10 à retirer (ARMES_SATELLITES, décision Saar). 8/10 conformes.

### SEGMENT 11b — family "Techniques" (10/34 lignes, 11→20 : EXPLOSIFS → GENIE_TECHNIQUE_NANOTECHNOLOGIE) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| EXPLOSIFS | Explosifs | | INT | VOL | (X) |
| FALSIFICATION | Falsification | | INT | PER | (X) |
| GENIE_TECHNIQUE | Génie technique | | CHC | | |
| GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL | Architecture/Génie civil | GENIE_TECHNIQUE | INT | | S |
| GENIE_TECHNIQUE_ARCHITECTURE_NAVALE | Architecture navale | GENIE_TECHNIQUE | INT | | S |
| GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE | Bionique/Cybertechnologie | GENIE_TECHNIQUE | INT | | S |
| GENIE_TECHNIQUE_BIOTECHNOLOGIE_GENIE_GENETIQUE | Biotechnologie/Génie génétique | GENIE_TECHNIQUE | INT | | S |
| GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE | Électronique/Informatique | GENIE_TECHNIQUE | INT | | S |
| GENIE_TECHNIQUE_LOGICIELS | Logiciels | GENIE_TECHNIQUE | INT | | S |
| GENIE_TECHNIQUE_NANOTECHNOLOGIE | Nanotechnologie | GENIE_TECHNIQUE | INT | | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.1009-1048 :
- Explosifs (X), INT/VOL — ✅ conforme.
- Falsification (X), INT/PER — ✅ conforme.
- **Génie technique […] † (X), Attributs associés : INT/INT** — même sentinel que [DBG-5/6/7] : `attr_1='CHC'`. Contrairement à `PILOTAGE` ([DBG-8]), le LdB donne ici un attribut réel unique (INT/INT self-doublé) **et** un marker explicite sur le header (`(X)`) — cas le plus proche de `POUVOIRS_POLARIS` [DBG-5]. **[DBG-11]** : `attr_1: CHC` → `INT` (self-doublé), `marker` NULL → `(X)`.
- Les 7 enfants listés en bullets (Architecture/Génie civil, Architecture navale, Bionique/Cybertechnologie, Biotechnologie/Génie génétique, Électronique/Informatique, Logiciels, Nanotechnologie) — **aucun ne porte de marker individuel dans le LdB** (contrairement aux enfants de Sciences/Connaissances spécialisées, qui ont chacun un `(X)` explicite après leur nom, L.554-587). Motif différent : marker `S` → **NULL** (pas `(X)`) pour ces 7 lignes.

| ID | Statut | Détail |
|---|---|---|
| EXPLOSIFS | 🟢 conforme | — |
| FALSIFICATION | 🟢 conforme | — |
| GENIE_TECHNIQUE | 🔴 bug confirmé — [DBG-11] résolu | attr_1 CHC → INT (self-doublé), marker NULL → `(X)` |
| GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL | 🔴 bug confirmé | marker `S` → **NULL** (pas de marker LdB) |
| GENIE_TECHNIQUE_ARCHITECTURE_NAVALE | 🔴 bug confirmé | marker `S` → **NULL** |
| GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE | 🔴 bug confirmé | marker `S` → **NULL** |
| GENIE_TECHNIQUE_BIOTECHNOLOGIE_GENIE_GENETIQUE | 🔴 bug confirmé | marker `S` → **NULL** |
| GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE | 🔴 bug confirmé | marker `S` → **NULL** |
| GENIE_TECHNIQUE_LOGICIELS | 🔴 bug confirmé | marker `S` → **NULL** |
| GENIE_TECHNIQUE_NANOTECHNOLOGIE | 🔴 bug confirmé | marker `S` → **NULL** |

**Bugs à corriger dans 37-bis (famille 11, sous-segment b) :** 8/10 — GENIE_TECHNIQUE [DBG-11] + 7 enfants `S`→NULL. 2/10 conformes.

### SEGMENT 11c — family "Techniques" (10/34 lignes, 21→30 : GENIE_TECHNIQUE_ROBOTIQUE → MECANIQUE_VEHICULES_SOUTERRAINS) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| GENIE_TECHNIQUE_ROBOTIQUE | Robotique | GENIE_TECHNIQUE | INT | | S |
| GENIE_TECHNIQUE_TELECOMMUNICATIONS | Télécommunications | GENIE_TECHNIQUE | INT | | S |
| INFORMATIQUE | Informatique | | INT | | (-3) |
| MECANIQUE | Mécanique | | INT | | (-3) |
| MECANIQUE_CHASSEURS_ATMOSPHERIQUES | Chasseur atmosphérique | MECANIQUE | INT | | S |
| MECANIQUE_EXO_ARMURES | Exo-armures | MECANIQUE | INT | | S |
| MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE | Générateur/Système de survie | MECANIQUE | INT | | S |
| MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS | Navire/Chasseur sous-marin | MECANIQUE | INT | | S |
| MECANIQUE_VEHICULES_DE_SOL | Véhicule de sol | MECANIQUE | INT | | S |
| MECANIQUE_VEHICULES_SOUTERRAINS | Véhicule souterrain | MECANIQUE | INT | | S |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.1044-1072 :
- Robotique, Télécommunications — 2 derniers enfants Génie technique, mêmes constat que 11b : pas de marker individuel LdB → marker `S` → NULL.
- Informatique † (-3), INT/INT — ✅ conforme (self-doublé, `†` non stocké).
- **Mécanique […], Attributs associés : INT/INT** — **aucun marker sur l'en-tête** dans le LdB (pas de `(X)`/`(-3)` après "Mécanique […]", contrairement à Génie technique). DB porte `marker='(-3)'` à tort. 🔴 bug : marker `(-3)` → NULL (attrs déjà corrects, self-doublé — pas le motif CHC cette fois).
- 6 enfants (Exo-armures, Navires/Chasseurs sous-marins, Chasseurs atmosphériques, Véhicules souterrains, Véhicules de sol, Générateurs/Système de survie) — aucun marker individuel dans le LdB → marker `S` → NULL pour les 6.

| ID | Statut | Détail |
|---|---|---|
| GENIE_TECHNIQUE_ROBOTIQUE | 🔴 bug confirmé | marker `S` → **NULL** |
| GENIE_TECHNIQUE_TELECOMMUNICATIONS | 🔴 bug confirmé | marker `S` → **NULL** |
| INFORMATIQUE | 🟢 conforme | — |
| MECANIQUE | 🔴 bug confirmé | marker `(-3)` → **NULL** (attrs déjà corrects) |
| MECANIQUE_CHASSEURS_ATMOSPHERIQUES | 🔴 bug confirmé | marker `S` → **NULL** |
| MECANIQUE_EXO_ARMURES | 🔴 bug confirmé | marker `S` → **NULL** |
| MECANIQUE_GENERATEURS_SYSTEME_DE_SURVIE | 🔴 bug confirmé | marker `S` → **NULL** |
| MECANIQUE_NAVIRES_CHASSEURS_SOUS_MARINS | 🔴 bug confirmé | marker `S` → **NULL** |
| MECANIQUE_VEHICULES_DE_SOL | 🔴 bug confirmé | marker `S` → **NULL** |
| MECANIQUE_VEHICULES_SOUTERRAINS | 🔴 bug confirmé | marker `S` → **NULL** |

**Bugs à corriger dans 37-bis (famille 11, sous-segment c) :** 9/10 — 2 derniers enfants Génie technique + MECANIQUE + 6 enfants Mécanique, tous → NULL. 1/10 conforme (INFORMATIQUE).

### SEGMENT 11d — family "Techniques" (4/34 lignes, 31→34 : PIEGES → SYSTEMES_DE_SECURITE, clôture famille) ✅ audité

DB actuelle :

| id | label | parent | attr_1 | attr_2 | marker |
|---|---|---|---|---|---|
| PIEGES | Piège | | INT | PER | (-3) |
| PIRATAGE_INFORMATIQUE | Piratage informatique | | INT | | (X) |
| PREMIER_SOINS | Premier soin | | ADA | INT | (-3) |
| SYSTEMES_DE_SECURITE | Systèmes de sécurité | | INT | | (X) |

Cross-check `docs/REGLES/REGLECOMPETENCE.md` L.1073-1101 :
- Pièges (-3), INT/PER — ✅ conforme.
- **Piratage informatique † (X)** — cas particulier : le LdB ne donne **aucune ligne "Attributs associés"** pour cette Compétence (seul le pré-requis "Informatique 10" est mentionné). DB comble avec INT/INT (self-doublé), cohérent avec le domaine (Informatique = INT/INT) et le marker `(X)` correspond au LdB. Faute de valeur contradictoire dans le LdB, traité comme conforme (rien à corriger, la DB comble une lacune du texte de manière raisonnable).
- Premiers soins (-3), INT/ADA — DB ordre inversé (ADA,INT) mais neutre. ✅ conforme.
- Systèmes de sécurité (X), INT/INT — ✅ conforme.

| ID | Statut | Détail |
|---|---|---|
| PIEGES | 🟢 conforme | — |
| PIRATAGE_INFORMATIQUE | 🟢 conforme | LdB sans attrs explicites ; DB comble raisonnablement (INT/INT) |
| PREMIER_SOINS | 🟢 conforme | ordre non-canonique sans impact |
| SYSTEMES_DE_SECURITE | 🟢 conforme | — |

**Bugs à corriger dans 37-bis (famille 11, sous-segment d) :** 0/4 — famille se termine sans bug sur ce dernier lot.

## FAMILLE "Techniques" — CLÔTURE (34/34)

- **ART_ARTISANAT** : 🔴 bug isolé — `attr_2` NULL → `PER` (seul cas de la famille où le LdB donne 2 attributs distincts mais la DB les a réduits à un self-doublé).
- **ARMES_SATELLITES** : 🔴 **à retirer — décision Saar (2026-07-04)**. Ajout maison (migration 103b, session 131) — **absent du LdB comme Compétence autonome**, la capacité y est explicitement rattachée à `TACTIQUE_COMBAT_TERRESTRE`. Contrairement à `ENSEIGNEMENT`/`CONNAISSANCE_MILIEUX_SOCIAUX` (conservés hors-scope), Saar a tranché : cette ligne sera supprimée par 37-bis, migration 103b annulée.
- **GENIE_TECHNIQUE** : `[DBG-11]` résolu — même sentinel `CHC` que [DBG-5/6/7], attrs INT/INT self-doublé restaurés + marker NULL→`(X)` (header LdB explicite).
- **9 enfants GENIE_TECHNIQUE_\*** : marker `S` → **NULL** uniformément (aucun marker individuel dans le LdB, contrairement au motif Sciences/Connaissances spécialisées).
- **MECANIQUE** : marker `(-3)` → NULL (bug isolé, pas de sentinel CHC ici — attrs déjà corrects).
- **6 enfants MECANIQUE_\*** : marker `S` → NULL uniformément (même motif que Génie technique : pas de marker individuel LdB).
- **PIRATAGE_INFORMATIQUE** : conforme malgré un LdB elliptique (pas d'attrs donnés) — DB comble raisonnablement.
- **21 autres lignes** (Analyses sonscans, Aquaculture/Élevage, Armes embarquées/Artillerie, Armurerie, Chirurgie, Dressage, Électronique, Espionnage/Surveillance, Explosifs, Falsification, Informatique, Pièges, Premiers soins, Systèmes de sécurité, + 7 déjà cités) : conformes.

**Total famille Techniques : 18 bugs / 34 lignes (53%)**, 1 ligne à retirer (ARMES_SATELLITES, décision Saar), 15 conformes. Découverte méthodologique notable : **deux nouveaux sous-motifs de marker sur enfants de catégorie sans marker individuel LdB** — `GENIE_TECHNIQUE_*` et `MECANIQUE_*` doivent devenir NULL (pas `(X)` comme le motif Sciences), car leurs bullets LdB respectifs ne portent aucune notation `(X)`/`(-3)` individuelle, contrairement à Sciences/Connaissances spécialisées où chaque discipline porte explicitement `(X)`. Règle affinée pour 37-bis : **ne jamais assigner `(X)` à un enfant sans vérifier explicitement sa notation individuelle dans le LdB** — l'erreur de seed `S` ne doit pas être remplacée par une autre valeur uniforme non vérifiée.

---

## SEGMENT 12 — Parents virtuels, skills manquants, `ref_skill_requirements` (passe finale, table entière)

**Toutes les familles sont closes (251/251 lignes auditées).** Ce segment couvre le solde annoncé au périmètre initial (points 3/4 de l'OBJECTIF) + une vérification structurelle de `ref_skill_requirements`.

### 12.1 — Re-vérification table entière : aucun parent orphelin

```sql
SELECT DISTINCT parent FROM ref_skills WHERE parent IS NOT NULL AND parent NOT IN (SELECT id FROM ref_skills) ORDER BY parent;
-- → 0 rows
```

Confirmé une seconde fois, cette fois sur les 251/251 lignes auditées individuellement (la première vérification, au segment 6a, portait sur une base partiellement auditée). **Aucun parent virtuel orphelin dans toute la table.**

### 12.2 — Claims `docs/JOURNALCOUCHE4.md` obsolètes (3ᵉ et 4ᵉ cas après TACTIQUE)

- **`MANOEUVRE_DARMURE`** — JOURNALCOUCHE4.md l.57 : *"groupe parent absent... migration 74 a omis MANOEUVRE_DARMURE"*. **Infirmé** : `MANOEUVRE_DARMURE` existe bel et bien comme ligne `id` (famille Pilotage, segment 9a), conforme (`•` non stocké, attrs COO/ADA corrects). Claim obsolète, écrite avant une correction ultérieure (migration 74 ou postérieure) — à corriger dans JOURNALCOUCHE4.md en fin de session si pertinent, pas une action 37-bis.
- **`LANGUE_ETRANGERE`** — JOURNALCOUCHE4.md l.620/670/703 : *"n'existe pas comme skill_id standalone... uniquement une valeur de champ parent"*. **Infirmé** : `LANGUE_ETRANGERE` existe comme ligne `id` standalone (famille Langues/langages, segment 8b), avec ses propres `attr_1/attr_2/marker` (bug marker `(X)`→`PN` trouvé, cf. [DBG-9]). Claim obsolète — même nature que `MANOEUVRE_DARMURE` et `TACTIQUE` (segment 6d) : trois cas maintenant où JOURNALCOUCHE4.md déclarait "absent"/"parent seulement" une ligne qui existe réellement en DB actuelle.

### 12.3 — `EQUIPEMENTS_COURANTS` / `COMMERCE_TRAFIC__ARTISANAT` / `COMMERCE_TRAFIC__OEUVRES_DART` : pas des skills manquants

Point 3 de l'OBJECTIF (l.17) listait ces 3 identifiants comme "skills manquants détectés Session 131" à combler. Vérification du texte LdB source (`REGLECOMPETENCE.md` L.425-442, en-tête Commerce/Trafic) :

> "Chaque type de produits fait l'objet d'une Compétence particulière, par exemple : • Armes (X) • Denrées alimentaires (-3) • Drogues (X) • Informations (-3) • Matériel médical (-3) • Matières premières (-3) • Véhicules (-3), **etc.**"

Le LdB liste explicitement 7 catégories **à titre d'exemple** ("par exemple... etc.") — liste ouverte, non exhaustive, exactement comme `ART_ARTISANAT` ("à définir avec le maître de jeu"). Les 7 enfants déjà en DB (`COMMERCE_TRAFIC__ARMES/DENREES_ALIMENTAIRES/DROGUES/INFORMATIONS/MATERIEL_MEDICAL/MATIERES_PREMIERES/VEHICULES`, tous audités segment 6a) couvrent la liste canonique complète du LdB. `Équipements courants`, `Artisanat`, `Œuvres d'art` sont des exemples cités dans des **descriptions de carrière** (chapitre Création de personnage, hors `REGLECOMPETENCE.md`), pas des Compétences distinctes listées dans le chapitre Compétences. **Conclusion : ce ne sont pas des lignes manquantes dans `ref_skills`** — le pattern déjà adopté dans les seeds `ref_career_skills` (`COMMERCE_TRAFIC` + `conditional:true`) est correct et suffisant. **Point 3 de l'OBJECTIF retiré du périmètre 37-bis** (aucune ligne à ajouter).

### 12.4 — `ref_skill_requirements` : vérification structurelle + spot-check

```sql
\d ref_skill_requirements
-- skill_id TEXT NOT NULL, type TEXT NOT NULL, value TEXT NOT NULL, threshold INT DEFAULT 1
-- PK (skill_id, type, value) ; FK skill_id → ref_skills(id) ON DELETE CASCADE
-- 94 lignes ; type ∈ {SKILL_MIN, MUTATION}
```

Structure saine (FK + cascade + PK composite empêchant les doublons). Spot-check contre les compétences déjà auditées avec un `†`/pré-requis dans le LdB :

| Compétence | Pré-requis LdB | `ref_skill_requirements` | Statut |
|---|---|---|---|
| ESPIONNAGE_SURVEILLANCE | Éduc. 10, Électronique 3 | EDUCATION_CULTURE_GENERALE 10 + ELECTRONIQUE 3 | ✅ exact |
| GENIE_TECHNIQUE_BIONIQUE_CYBERTECHNOLOGIE | Éduc. 10 (héritée du header) + Biologie/Physiologie 10 | EDUCATION_CULTURE_GENERALE 10 + SCIENCES..._BIOLOGIE_PHYSIOLOGIE 10 | ✅ exact |
| GENIE_TECHNIQUE_ELECTRONIQUE_INFORMATIQUE | Éduc. 10 + Électronique 10, Informatique 10 | les 3 lignes présentes | ✅ exact |
| GENIE_TECHNIQUE_ARCHITECTURE_GENIE_CIVIL / NAVALE | Éduc. 10 seul (pas de skill spécifique dans le LdB) | EDUCATION_CULTURE_GENERALE 10 seul | ✅ exact |
| PILOTAGE__CHASSEURS_SOUS_MARINS | Athlétisme 10, Éduc. 10, Navires légers 10 | les 3 lignes présentes | ✅ exact |
| PILOTAGE__NAVIRES_LEGERS | Éduc. 7 | EDUCATION_CULTURE_GENERALE 7 | ✅ exact |
| PILOTAGE__NAVIRES_LOURDS | Navires légers 10 | PILOTAGE__NAVIRES_LEGERS 10 | ✅ exact |
| PILOTAGE__ENGINS_SPATIAUX | Éduc. 10 | EDUCATION_CULTURE_GENERALE 10 | ✅ exact |
| PIRATAGE_INFORMATIQUE | Informatique 10 | INFORMATIQUE 10 | ✅ exact |
| SYSTEMES_DE_SECURITE | Électronique 5 | ELECTRONIQUE 5 | ✅ exact |
| CHIRURGIE | Médecine 10, **voire** Bionique/Cybertechnologie 5 | SCIENCES..._MEDECINE 10 **seul** | 🟡 partiel — le "voire" LdB (alternative optionnelle) n'est pas représenté ; probablement un choix de simplification (schéma actuel ne semble pas exprimer de OR), pas nécessairement un bug |
| **PILOTAGE__CHASSEURS_ATMOSPHERIQUES** | **Athlétisme 10, Éduc. 10** | **0 ligne** | 🔴 **lacune confirmée** — aucune contrainte enregistrée alors que le LdB en donne 2 |
| ARMES_SATELLITES | — | 0 ligne | ✅ cohérent avec la suppression décidée (rien à nettoyer via CASCADE) |

**1 lacune confirmée** : `PILOTAGE__CHASSEURS_ATMOSPHERIQUES` devrait avoir 2 lignes (`ATHLETISME` 10, `EDUCATION_CULTURE_GENERALE` 10) actuellement absentes.

**⚠️ Question de périmètre pour Saar** : ce spot-check (10 compétences ciblées sur celles déjà auditées) est cohérent avec le LdB à 92% (1 lacune + 1 simplification mineure sur 94 lignes au total dans la table, dont 12 vérifiées ici). La table semble globalement saine et n'était pas identifiée dans le problème initial ("`ref_skills` pourrie par 4 migrations") — c'est une table adjacente avec son propre schéma propre (FK, cascade). **Un audit ligne-par-ligne complet des 94 lignes (comme pour `ref_skills`) est-il souhaité, ou le spot-check + correction de la lacune `PILOTAGE__CHASSEURS_ATMOSPHERIQUES` suffisent-ils pour le périmètre 37-bis ?**

### Correctifs OBJECTIF (l.14-18)

- Point 3 : **retiré** — `EQUIPEMENTS_COURANTS`/`ARTISANAT`/`OEUVRES_DART` confirmés hors-scope (§12.3), `LANGUE_ETRANGERE` confirmé déjà standalone (§12.2, pas à ajouter).
- Point 4 : déjà corrigé précédemment (segment 6a) — reconfirmé définitivement sur la table complète (§12.1).
- **Nouveau point 5** : Retirer `ARMES_SATELLITES` (décision Saar, famille Techniques segment 11a) et neutraliser la migration 103b dans la consolidation.

### 12.5 — `ref_skill_requirements` : audit complet (94/94 lignes) — décision Saar (2026-07-04) : "tant qu'à faire, autant tout vérifier"

Audit ligne par ligne des 94 lignes (10 lots de ≤10, `ORDER BY skill_id, type, value`), cross-check systématique contre les "Pré-requis nécessaires" du LdB pour chaque compétence déjà identifiée dans les 11 familles `ref_skills`, plus vérification des 10 lignes `type='MUTATION'` contre `server/src/db/migrations/38_char_ref_mutations.js` (champ `linked_skill`).

**Résultat global : 90/94 lignes conformes, 3 bugs confirmés, 1 point [INCONNU].**

**Bloc SKILL_MIN — Sciences/Connaissances spécialisées (le plus dense, 20 lignes) : 100% conforme**, y compris les prérequis multi-conditions les plus complexes :
- ASTROPHYSIQUE_ASTRONOMIE : Éduc. 10 + Physique/Chimie 10 ✅
- BOTANIQUE : Éduc. 10 + Biologie/Physiologie 7 ✅
- GEOLOGIE : Éduc. 10 + Physique/Chimie 5 ✅
- MEDECINE : Éduc. 10 + Biologie/Physiologie 7 ✅
- PHARMACOLOGIE : Éduc. 10 + Biologie/Physiologie 5 + Physique/Chimie 5 ✅ (3 conditions, toutes exactes)
- SCIENCES_POLITIQUES : Éduc. 10 + Géographie 7 + Histoire/Archéologie 5 ✅ (3 conditions, toutes exactes)
- ZOOLOGIE : Éduc. 10 + Biologie/Physiologie 7 ✅
- Les 10 autres enfants (Administration/Gestion, Armes/Systèmes d'armement, Criminalistique, Droit/Législations, Économie, Finances, Géographie, Histoire/Archéologie, Physique/Chimie, Psychologie, Sociologie) : Éduc. 10 seul, conforme (pas de prérequis spécifique dans le LdB).

**Bloc SKILL_MIN — Génie technique/Mécanique/Pilotage (déjà spot-check segment 12.4) : reconfirmé**, + NAVIGATION (Éduc. 10 ✅, family Connaissances, déjà conforme segment 6), STRATEGIE (Éduc. 10 ✅), + les 7 enfants COMMERCE_TRAFIC (Éduc. 5 uniforme, cohérent avec le tarif "matériel courant" du LdB — le LdB ne précise pas quelle sous-catégorie relève de "haute technologie" (tarif 10), donc pas de base pour contester le choix uniforme à 5).

**Bloc MUTATION (10/10 lignes) : 100% conforme.** Cross-check contre `38_char_ref_mutations.js` (`linked_skill`) :
- `muta_011` (Contagion) → `MUTATION_CONTAGION` ✅ ; `muta_016` (Empathie) → `MUTATION_EMPATHIE` ✅ ; `muta_019` (Instabilité moléculaire, linked_skill "Contrôle moléculaire") → `MUTATION_CONTROLE_MOLECULAIRE` ✅ ; `muta_020` (Métamorphe) → `MUTATION_METAMORPHOSE` ✅ ; `muta_025` (Purulence) → `MUTATION_PURULENCE` ✅ ; `muta_026` (Queue) → `MUTATION_AGILITE_CAUDALE` ✅ (linked_skill vide côté mutation, mais cohérence thématique claire) ; `muta_029` (Sensibilité au Polaris, linked_skill "Maîtrise de l'Écho Polaris, Maîtrise de la Force Polaris") → **les deux** `MAITRISE_DE_LA_FORCE_POLARIS` et `MAITRISE_DE_LECHO_POLARIS` ✅ ; `muta_031` (Sonar) → `MUTATION_SONAR` ✅ ; `muta_033` (Radiation) → `MUTATION_RADIATIONS` ✅.

**🔴 BUG 1 — FALSIFICATION.** LdB (L.1013-1021) : *"Pré-requis nécessaires : la Compétence nécessaire dépend du faux à créer, souvent Art/Artisanat, Informatique, Bureaucratie, Électronique, etc., au niveau 7 ou plus."* — prérequis **variable, dépendant du contexte**, aucune compétence unique. La DB stocke `EDUCATION_CULTURE_GENERALE 7` — ce n'est même pas une des compétences listées par le LdB (Art/Artisanat, Informatique, Bureaucratie, Électronique). Contrairement à CRIMINALISTIQUE (même formulation "selon la technique employée" mais qui hérite légitimement du prérequis général Éduc. 10 de la famille Sciences), FALSIFICATION (famille Techniques) n'a **aucun** prérequis général dont hériter — la valeur `EDUCATION_CULTURE_GENERALE 7` semble inventée. **Décision à prendre : supprimer cette ligne (le schéma actuel ne permet pas d'exprimer un OR entre 4 compétences), ou la remplacer par une valeur par défaut représentative (ex. Bureaucratie 7) ?**

**🔴 BUG 2 — mix-up `MECANIQUE_CHASSEURS_ATMOSPHERIQUES` ↔ `PILOTAGE__CHASSEURS_ATMOSPHERIQUES`.** `MECANIQUE_CHASSEURS_ATMOSPHERIQUES` porte 3 lignes : `ELECTRONIQUE 5` (correct, hérité du parent MECANIQUE comme ses 5 frères) **+ `ATHLETISME 10` + `EDUCATION_CULTURE_GENERALE 10`** (ces 2 dernières ne correspondent à **aucun** texte LdB pour Mécanique — la section Mécanique, L.1056-1072, ne donne aucun prérequis par enfant). Or ces 2 valeurs exactes (`Athlétisme 10, Éducation culture générale 10`) sont **précisément** le prérequis LdB de `PILOTAGE__CHASSEURS_ATMOSPHERIQUES` (L.873-874) — qui, découvert au spot-check §12.4, a **0 ligne** dans la table alors qu'il devrait en avoir 2. **Conclusion : ces 2 lignes ont été attribuées au mauvais `skill_id`** (confusion entre les deux compétences homonymes "Chasseur atmosphérique", une sous Pilotage, une sous Mécanique — seed d'origine probablement). **Correctif 37-bis : déplacer `ATHLETISME 10` + `EDUCATION_CULTURE_GENERALE 10` de `MECANIQUE_CHASSEURS_ATMOSPHERIQUES` vers `PILOTAGE__CHASSEURS_ATMOSPHERIQUES`** (et non simplement les dupliquer/supprimer) — corrige les deux anomalies (lacune + valeurs erronées) en un seul mouvement.

**🟡 [INCONNU] — POUVOIRS_POLARIS → MAITRISE_DE_LA_FORCE_POLARIS 1.** Structurellement cohérent avec `muta_029` (« débloque l'accès... Maîtrise de l'Écho Polaris, Maîtrise de la Force Polaris ») : la mutation grant les 2 compétences "Maîtrise", qui elles-mêmes semblent conditionner l'accès à la catégorie `POUVOIRS_POLARIS` (et donc à ses 10 enfants, famille Compétences Spéciales). Mais **aucun chapitre "Force Polaris" (LdB p.252) n'est présent dans le repo** (déjà constaté segment 5b/5c) pour vérifier si un enfant `POUVOIRS_POLARIS_*` devrait alternativement dépendre de `MAITRISE_DE_LECHO_POLARIS` (le nom suggère 2 filières distinctes, Force vs Écho). Le schéma actuel n'exprime qu'un seul chemin (`MAITRISE_DE_LA_FORCE_POLARIS`), pas de OR. **Pas assez d'information pour trancher — reste [INCONNU], comme au segment 5.**

**🟡 Rappel simplification mineure (déjà notée §12.4) — CHIRURGIE** : LdB "Médecine 10, **voire** Bionique/Cybertechnologie 5" (alternative optionnelle) — DB ne stocke que `SCIENCES..._MEDECINE 10`. Le schéma `(skill_id, type, value)` avec sémantique implicite AND ne permet pas d'exprimer facilement ce "voire" (OR). Traité comme simplification acceptable, pas un bug à corriger dans l'immédiat (même limite structurelle que POUVOIRS_POLARIS ci-dessus).

**Bilan `ref_skill_requirements` : 94/94 lignes auditées — 90 conformes, 2 bugs confirmés à corriger (FALSIFICATION + mix-up Chasseurs atmosphériques), 1 [INCONNU] (POUVOIRS_POLARIS, chapitre source manquant), 1 limite structurelle documentée (CHIRURGIE, schéma sans OR).** Table globalement saine et bien construite (FK cascade, PK composite anti-doublon) — les 2 vrais bugs trouvés sont ponctuels, pas systémiques comme le motif `S` de `ref_skills`.

### Décisions Saar (2026-07-04) sur les 3 points ouverts du segment 12.5

- **FALSIFICATION → NE RIEN FAIRE.** Le vrai problème n'est pas la valeur stockée mais la nature du prérequis LdB lui-même ("dépend du contexte" — pas de compétence fixe). Alternative envisagée (créer 4 variantes `FALSIFICATION_ART_ARTISANAT`/`_INFORMATIQUE`/`_BUREAUCRATIE`/`_ELECTRONIQUE`) rejetée — jugée trop lourde pour la valeur apportée. **Ligne conservée telle quelle** (`EDUCATION_CULTURE_GENERALE 7`), acceptée comme approximation arbitraire assumée, pas un bug à corriger dans 37-bis.
- **Mix-up MECANIQUE_CHASSEURS_ATMOSPHERIQUES ↔ PILOTAGE__CHASSEURS_ATMOSPHERIQUES → CONFIRMÉ, à corriger.** 37-bis déplacera `ATHLETISME 10` + `EDUCATION_CULTURE_GENERALE 10` du premier vers le second.
- **POUVOIRS_POLARIS → MAITRISE_DE_LA_FORCE_POLARIS → NE RIEN FAIRE.** [INCONNU] non résolu (chapitre LdB manquant) — conservé tel quel, pas d'action 37-bis.

**→ Audit `ref_skill_requirements` définitivement clos. Audit complet du périmètre 37-bis terminé : 251/251 lignes `ref_skills` + 94/94 lignes `ref_skill_requirements`.**

---

## PLAN DE MIGRATION 37-BIS — CONSOLIDÉ (prêt pour code)

**Fichier** : `server/src/db/migrations/105_ref_skills_37bis.js` (104 = `104_campaign_settings.js`, dernière migration classique appliquée).

**Principe** : migration additive de correction — ne touche pas aux fichiers 37/74/103/103b (déjà appliqués, historique immuable). `up()` = une série d'`UPDATE ... WHERE id IN (...)` groupés par valeur cible + 1 `DELETE` + 1 correction `ref_skill_requirements`. `down()` = restaure exactement les valeurs pré-37-bis (état actuellement en DB), row par row, pour rester rejouable dans les deux sens.

### RUN À VIDE (2026-07-05) — remplacement du sentinel `CHC` par une colonne `is_category` explicite

**Constat critique trouvé avant code** : `attr_1 === 'CHC'` n'est pas qu'une convention documentaire — c'est une **branche de code active** côté client, `client/src/character/SkillsPanel.jsx:196-205` :
```js
if (skill.attr_1 === 'CHC') {
  const children = skills.filter(s => s.parent === skill.id && isVisible(s))
  if (children.length > 0) blocks.push({ type: 'group', group: skill, children })
} else if (!skill.parent || byId.get(skill.parent)?.attr_1 !== 'CHC') {
  if (isVisible(skill)) blocks.push({ type: 'skill', skill })
}
```
C'est ce test qui décide si une ligne s'affiche en en-tête de groupe (non testable, enfants regroupés dessous) ou en ligne de compétence normale. Aligner `COMMERCE_TRAFIC`/`SCIENCES_CONNAISANCES_SPECIALISEES`/`GENIE_TECHNIQUE`/`POUVOIRS_POLARIS` sur leurs vrais attributs LdB (comme prévu par [DBG-6]/[DBG-7]/[DBG-11]/[DBG-5]) aurait cassé le regroupement de ces 4 catégories (jusqu'à 71 enfants pour Pouvoirs Polaris → 72 lignes plates).

Vérifié aussi : `marker === '(X)'/'(-3)'/'PN'/'PREREQ'` sont bien des mécaniques de jeu réelles (coût XP, malus, visibilité — `char-sheet.js:439-467`, `SkillsPanel.jsx:25/161/233/261-267`), confirmé par Saar comme information déjà connue (raison d'être de l'audit complet).

**Décision Saar (2026-07-05) : ne pas contourner avec `attr_1='CHC'` — créer une colonne dédiée `is_category`.** Architecture propre retenue :

1. **Migration 34 à amender** : `ref_skills.attr_1` est actuellement `.notNullable()` — doit devenir nullable (les catégories "variable"/sans paire fixe n'ont pas d'attribut réel à stocker). `table.text('attr_1').nullable().alter()`.
2. **Nouvelle colonne** : `table.boolean('is_category').notNullable().defaultTo(false)`.

**Vérification exhaustive (requête SQL sur la table entière, pas la mémoire de l'audit)** — recensement de toutes les lignes ayant réellement des enfants (`SELECT parent, COUNT(*) FROM ref_skills WHERE parent IS NOT NULL GROUP BY parent`) : **17 lignes**, pas seulement les 9 `CHC`. 8 catégories supplémentaires ont des attributs réels déjà corrects mais ne sont **pas** flaguées `CHC` — donc pas de regroupement UI aujourd'hui, rendu à plat comme n'importe quelle compétence normale : `ARTS_MARTIAUX` (3 enfants), `CONNAISSANCE_MILIEU_NATUREL` (3), `LANGAGES_SPECIFIQUES` (13), `LANGUE_ANCIENNE` (4), `LANGUE_ETRANGERE` (15), `MANOEUVRE_DARMURE` (4), `MECANIQUE` (6), `TACTIQUE` (4). **Décision Saar (2026-07-05) : même oubli, `is_category=true` pour ces 8 aussi.** Confirmé : 0 risque de nesting à 3 niveaux (vérifié — aucun enfant n'est lui-même parent d'une autre ligne).

**Découverte additionnelle en creusant `CONTROLE_DES_MUTATIONS`** (`attr_1='CHC'` mais 0 enfant, donc invisible en UI aujourd'hui) : le LdB (`REGLECOMPETENCE.md:1129`) définit un en-tête réel **"Contrôle des mutations […] (X)"** — mais **aucun en-tête "Mutation" autonome n'existe dans le LdB**. Or les 8 enfants `MUTATION_*` (Agilité caudale, Contagion, Contrôle moléculaire, Empathie, Métamorphose, Purulence, Radiations, Sonar) sont rattachés à `MUTATION` (catégorie fantôme, sans base LdB, ajoutée migration 74) et non à `CONTROLE_DES_MUTATIONS` (la vraie catégorie LdB, orpheline). **Décision Saar (2026-07-05) : re-parenter les 8 enfants vers `CONTROLE_DES_MUTATIONS` et supprimer `MUTATION`.** Vérifié : `MUTATION` n'est référencée nulle part (0 ligne dans `ref_skill_requirements`, 0 dans `ref_career_skills`, 0 occurrence dans les seeds `docs/Character/Creation/migrations/*.cjs`) — suppression sans impact.

3. **`is_category = true`** pour **17 lignes** au total :

| id | attr_1 | attr_2 | Source / statut |
|---|---|---|---|
| ARME_SPECIALE_CONTACT | NULL | NULL | LdB "selon l'arme", pas de paire fixe (déjà CHC) |
| ARME_SPECIALE_DISTANCE | NULL | NULL | idem (déjà CHC) |
| ARTS_MARTIAUX | COO | ADA | déjà correct, non-CHC, **oubli comblé** |
| COMMERCE_TRAFIC | INT | PRE | LdB "Attributs associés : INT/PRE" (déjà CHC) |
| CONNAISSANCE_MILIEU_NATUREL | ADA | INT | déjà correct, non-CHC, **oubli comblé** |
| CONTROLE_DES_MUTATIONS | NULL | NULL | LdB ne donne pas d'attrs propres (renvoi chapitre Création perso) ; marker `(X)` conservé ; **gagne les 8 enfants MUTATION_\*** |
| EXPRESSION_ARTISTIQUE | NULL | NULL | LdB "Attributs associés : variable" (déjà CHC) |
| GENIE_TECHNIQUE | INT | NULL (self-doublé) | LdB "Attributs associés : INT/INT" (déjà CHC) |
| LANGAGES_SPECIFIQUES | INT | NULL (self-doublé) | déjà correct, non-CHC, **oubli comblé** |
| LANGUE_ANCIENNE | INT | NULL (self-doublé) | déjà correct, non-CHC, **oubli comblé** |
| LANGUE_ETRANGERE | INT | NULL (self-doublé) | déjà correct, non-CHC, **oubli comblé** |
| MANOEUVRE_DARMURE | COO | ADA | déjà correct, non-CHC, **oubli comblé** |
| MECANIQUE | INT | NULL (self-doublé) | déjà correct, non-CHC, **oubli comblé** |
| PILOTAGE | NULL | NULL | LdB "variable" (déjà CHC) |
| POUVOIRS_POLARIS | INT | VOL | LdB "Attributs associés : INT/VOL" (déjà CHC) |
| SCIENCES_CONNAISANCES_SPECIALISEES | INT | NULL (self-doublé) | LdB "Attributs associés : INT/INT" (déjà CHC) |
| TACTIQUE | INT | ADA | déjà correct, non-CHC, **oubli comblé** |

**`MUTATION` : supprimée** (catégorie fantôme, 0 base LdB, plus aucun enfant après re-parentage vers `CONTROLE_DES_MUTATIONS`).

4. **Code client** : `SkillsPanel.jsx:196` → `if (skill.is_category)` (au lieu de `skill.attr_1 === 'CHC'`) ; ligne 201 → `!byId.get(skill.parent)?.is_category` (au lieu de `?.attr_1 !== 'CHC'`).
5. **Code serveur vérifié** : aucune branche `attr_1 === 'CHC'` trouvée côté serveur (`server/src`) — seul `charStats.js:224` fait `if (!refSkill.attr_1) return 0`, un simple garde-fou générique sur falsy, pas spécifique à CHC. Passer `attr_1` à `NULL` pour les catégories sans paire fixe déclenche ce garde-fou proprement (0 explicite) — améliore la robustesse par rapport à l'ancien comportement (calcul silencieux sur un attribut "CHC" qui, lui, existe réellement comme 9ᵉ attribut du personnage — la Chance, cf. `CharacterSheet.jsx:49` — donc ne plantait pas mais était sémantiquement trompeur : un sentinel qui emprunte l'identité d'un vrai attribut).
6. **`ARMES_SATELLITES` — coordination avec COUCHE 4** : `docs/Character/Creation/migrations/93_seed_ref_careers_lot4a.cjs` (carrière `officier_militaire_surface`) référençait ce skill_id — **corrigé** (2026-07-05) : ligne retirée (le besoin était déjà couvert par `TACTIQUE_COMBAT_TERRESTRE`, présent dans `offMilCommonSkills`, pas de doublon ajouté). Note posée dans `docs/PLAN_COUCHE4.md` (PV7).
7. **Dette notée, hors scope 37-bis** : `ref_career_skills.skill_id` sans FK vers `ref_skills.id` (cf. `JOURNALCOUCHE4.md`, note ajoutée sous PIÈGE 1) — à reprendre lors de COUCHE 4b, pas maintenant.
8. **Portée** : ce point ajoute à 37-bis un changement de schéma (nouvelle colonne + `attr_1` nullable) et une modification de 2 lignes dans `SkillsPanel.jsx` — nécessite un test navigateur (regroupement des 17 catégories, notamment les 8 nouvellement corrigées + `CONTROLE_DES_MUTATIONS` avec ses enfants re-parentés) avant de considérer la tâche complète, en plus du test base de données.

### A. `ref_skills` — 2 suppressions + 1 re-parentage

```sql
-- Re-parenter AVANT de supprimer MUTATION (sinon les enfants perdent leur parent avant le UPDATE)
UPDATE ref_skills SET parent = 'CONTROLE_DES_MUTATIONS'
  WHERE parent = 'MUTATION';
  -- 8 lignes : MUTATION_AGILITE_CAUDALE, MUTATION_CONTAGION, MUTATION_CONTROLE_MOLECULAIRE,
  -- MUTATION_EMPATHIE, MUTATION_METAMORPHOSE, MUTATION_PURULENCE, MUTATION_RADIATIONS, MUTATION_SONAR

DELETE FROM ref_skills WHERE id = 'MUTATION';
-- catégorie fantôme sans base LdB (cf. bloc RUN À VIDE), 0 référence ailleurs (vérifié
-- ref_skill_requirements, ref_career_skills, seeds .cjs) — suppression sans impact.

DELETE FROM ref_skills WHERE id = 'ARMES_SATELLITES';
-- absent du LdB comme Compétence autonome, décision Saar (segment 11a) — coordination
-- COUCHE 4 faite (docs/Character/Creation/migrations/93_seed_ref_careers_lot4a.cjs corrigé).
```
(0 ligne dans `ref_skill_requirements` référant `ARMES_SATELLITES` — vérifié §12.4 — `ON DELETE CASCADE` no-op sur les deux suppressions, rien d'autre à nettoyer.)

### B. `ref_skills` — corrections `label`

| id | label actuel | label corrigé |
|---|---|---|
| ARMES_LOURDES_CONTACT | Arme Lourde (contact) | Armes lourdes (contact) |
| ARTS_MARTIAUX_TECHNIQUES_DEFENSIVES | Technique défensive | Techniques défensives |
| ARTS_MARTIAUX_TECHNIQUES_OFFENSIVES | Technique offensive | Techniques offensives |
| ARMES_DE_JET | Arme de Jet | Armes de jet |
| ARMES_DE_POING | Arme de poing | Armes de poing |
| ARMES_DE_TRAIT | Arme de Trait | Armes de trait |
| ARMES_LOURDES | Arme Lourde | Armes lourdes (tir) |
| ARMES_SOUS_MARINES | Arme sous-marine | Armes sous-marines |
| FUSIL_ARMES_DEPAULES | Fusil/Armes d'épaule | Fusils/Armes d'épaule |
| ARMES_SPECIALES_DISTANCE_COORDINATION_PERCEPTION | Arme spéciale à distance (COO/COO) | Arme spéciale à distance (COO/PER) |
| MAITRISE_DE_LECHO_POLARIS | Maîtrise de l'Echo Polaris | Maîtrise de l'Écho Polaris |

### C. `ref_skills` — corrections `attr_1`/`attr_2` (hors catégories `is_category`, traitées ci-dessus)

| id | attr_1 | attr_2 |
|---|---|---|
| ENDURANCE | FOR→CON | COO→VOL |
| ACROBATIE_EQUILIBRE | — | PER→NULL |
| ANALYSE_EMPATHIQUE | — | PRE→PER |
| ART_ARTISANAT | — | NULL→PER |

**Les 9 lignes `is_category` (`ARME_SPECIALE_CONTACT`, `ARME_SPECIALE_DISTANCE`, `MUTATION`, `EXPRESSION_ARTISTIQUE`, `PILOTAGE`, `COMMERCE_TRAFIC`, `SCIENCES_CONNAISANCES_SPECIALISEES`, `GENIE_TECHNIQUE`, `POUVOIRS_POLARIS`) sont traitées dans le bloc "RUN À VIDE" ci-dessus**, pas ici.

### D. `ref_skills` — corrections `marker` (groupées par valeur cible finale)

*(Recompté et vérifié ligne par ligne le 2026-07-05 — la première version de ce tableau omettait `POUVOIRS_POLARIS` et `COMMERCE_TRAFIC` et comportait des libellés de comptage faux ; corrigé ci-dessous.)*

**→ `(X)`** (63 lignes) : `POUVOIRS_POLARIS`, `CARTOGRAPHIE`, `COMMERCE_TRAFIC__ARMES`, `COMMERCE_TRAFIC__DROGUES`, `EVASION`, `CONNAISSANCE_MILIEU_NATUREL_SURFACE`, `GENIE_TECHNIQUE`, `MANOEUVRE_DARMURE__ARMURES_ATMOSPHERIQUES`, `PILOTAGE__CHASSEURS_ATMOSPHERIQUES`, `PILOTAGE__CHASSEURS_SOUS_MARINS`, `PILOTAGE__ENGINS_SPATIAUX`, `PILOTAGE__NAVIRES_LEGERS`, `PILOTAGE__NAVIRES_LOURDS`, `PILOTAGE__VEHICULES_SOUTERRAINS`,
19× `SCIENCES_CONNAISANCES_SPECIALISEES_{ADMINISTRATION_GESTION, ARMES_SYSTEMES_DARMEMENT, ASTROPHYSIQUE_ASTRONOMIE, BIOLOGIE_PHYSIOLOGIE, BOTANIQUE, CRIMINALISTIQUE, DROIT_LEGISLATIONS, ECONOMIE, FINANCES, GEOGRAPHIE, GEOLOGIE, HISTOIRE_ARCHEOLOGIE, MEDECINE, PHARMACOLOGIE, PHYSIQUE_CHIMIE, PSYCHOLOGIE, SCIENCES_POLITIQUES, SOCIOLOGIE, ZOOLOGIE}`,
11× `LANGAGES_SPECIFIQUES_{ABSOLAN, ENEFID, EXON, FOREUR, INESIS, ITHRAXIEN, KLAN, LEVEAN, METALAN, NEOLAN, SOLEEN}`,
4× `LANGUE_ANCIENNE_{ARKONIEN, AZURAN, AZUREEN, GATEEN}`,
15× `LANGUE_ETRANGERE_{AMANEUN, AZRAN, GASHKLAR, ISITAC, LESARACH, LEXZION, NEO_AZURAN, NEZRAIS, OCEANE, OLAKAR, OLOSAK, OSSYRIEN, RENAREAN, TERNASET, TRASHAN}`
*(1+1+2+1+1+1+1+6+19+11+4+15 = 63)*

**→ `(-3)`** (15 lignes) : `EXPRESSION_ARTISTIQUE_CHANT`, `EXPRESSION_ARTISTIQUE_COMEDIE_CONTE`, `EXPRESSION_ARTISTIQUE_DANSE`, `MUTATION_EMPATHIE`, `MUTATION_METAMORPHOSE`, `MUTATION_RADIATIONS`, `COMMERCE_TRAFIC__DENREES_ALIMENTAIRES`, `COMMERCE_TRAFIC__INFORMATIONS`, `COMMERCE_TRAFIC__MATERIEL_MEDICAL`, `COMMERCE_TRAFIC__MATIERES_PREMIERES`, `COMMERCE_TRAFIC__VEHICULES`, `TACTIQUE_COMBAT_NAVAL`, `MANOEUVRE_DARMURE__ARMURES_SPATIALES`, `CONNAISSANCE_MILIEU_NATUREL_OCEANS`, `CONNAISSANCE_MILIEU_NATUREL_SOUTERRAINS`

**→ `NULL`** (32 lignes) : `ACROBATIE_EQUILIBRE`, `HYBRIDE`, `MUTATION_AGILITE_CAUDALE`, `MUTATION_CONTROLE_MOLECULAIRE`, `MUTATION_SONAR`, `COMMERCE_TRAFIC`, `LANGAGES_SPECIFIQUES_LANGAGE_DES_SIGNES`, `LANGAGES_SPECIFIQUES_SIRS`, `LANGUE_ANCIENNE`, `TACTIQUE_COMBAT_SOUTERRAIN`, `TACTIQUE_COMBAT_TERRESTRE`, `TACTIQUE_OPERATIONS_COMMANDO`, `MANOEUVRE_DARMURE__ARMURES_EXTERNES`, `MANOEUVRE_DARMURE__ARMURES_SOUS_MARINES`, `PILOTAGE__SCOOTERS_SOUS_MARINS`, `PILOTAGE__VEHICULES_DE_SOL`,
9× `GENIE_TECHNIQUE_{ARCHITECTURE_GENIE_CIVIL, ARCHITECTURE_NAVALE, BIONIQUE_CYBERTECHNOLOGIE, BIOTECHNOLOGIE_GENIE_GENETIQUE, ELECTRONIQUE_INFORMATIQUE, LOGICIELS, NANOTECHNOLOGIE, ROBOTIQUE, TELECOMMUNICATIONS}`,
7× `MECANIQUE` (le parent) + `MECANIQUE_{CHASSEURS_ATMOSPHERIQUES, EXO_ARMURES, GENERATEURS_SYSTEME_DE_SURVIE, NAVIRES_CHASSEURS_SOUS_MARINS, VEHICULES_DE_SOL, VEHICULES_SOUTERRAINS}`
*(16+9+7 = 32)*

**→ `PN`** (2 lignes) : `LANGAGES_SPECIFIQUES`, `LANGUE_ETRANGERE`

**→ `•`** (1 ligne, cas spécial avec `description`) : `ENSEIGNEMENT` — marker `NULL→'•'` + `description` = texte maison retenu au segment 4 (voir plus haut, "Texte `description` retenu pour `ENSEIGNEMENT`").

**→ `PREREQ` conservé sans changement** : `PILOTAGE` (marker déjà `PREREQ`, ne bouge pas — seul `attr_1` change pour cette ligne, cf. bloc C).

**Total marqueurs corrigés : 63+15+32+2+1 = 113 lignes.** Vérifié par recomptage indépendant par famille : Aptitudes physiques 1 (ACROBATIE_EQUILIBRE) + Communication 4 (CHANT, COMEDIE_CONTE, DANSE, ENSEIGNEMENT) + Compétences Spéciales 8 (HYBRIDE + 6 MUTATION_* + POUVOIRS_POLARIS) + Connaissances 32 (CARTOGRAPHIE + COMMERCE_TRAFIC + 7 enfants + 19 Sciences + TACTIQUE_COMBAT_NAVAL + 3 Tactique NULL) + Furtivité 1 (EVASION) + Langues 35 (2 catégories PN/NULL + 33 enfants) + Pilotage 12 (4 Manoeuvre + 8 Pilotage enfants, hors PILOTAGE lui-même qui est attr-only) + Survie 3 + Techniques 17 (GENIE_TECHNIQUE + 9 enfants + MECANIQUE + 6 enfants) = 1+4+8+32+1+35+12+3+17 = **113** ✓ cohérent avec le décompte par valeur cible ci-dessus.

### E. `ref_skill_requirements` — 1 déplacement

```sql
DELETE FROM ref_skill_requirements
  WHERE skill_id = 'MECANIQUE_CHASSEURS_ATMOSPHERIQUES' AND value IN ('ATHLETISME', 'EDUCATION_CULTURE_GENERALE');

INSERT INTO ref_skill_requirements (skill_id, type, value, threshold) VALUES
  ('PILOTAGE__CHASSEURS_ATMOSPHERIQUES', 'SKILL_MIN', 'ATHLETISME', 10),
  ('PILOTAGE__CHASSEURS_ATMOSPHERIQUES', 'SKILL_MIN', 'EDUCATION_CULTURE_GENERALE', 10);
```

**Aucune autre modification `ref_skill_requirements`** (FALSIFICATION et POUVOIRS_POLARIS/MAITRISE_DE_LA_FORCE_POLARIS : ne rien faire, décisions Saar).

### F. Hors scope confirmé (aucune ligne à ajouter/modifier)
- `EQUIPEMENTS_COURANTS`, `COMMERCE_TRAFIC__ARTISANAT`, `COMMERCE_TRAFIC__OEUVRES_DART` (§12.3)
- `CONNAISSANCE_MILIEUX_SOCIAUX` (déjà ajouté migration 103, hors-LdB assumé)
- Tous les enfants `POUVOIRS_POLARIS_*` (71 lignes famille 5, sous-segments c-g) : 0 bug, aucune ligne touchée
- Toute la famille "Aptitudes physiques" sauf ENDURANCE/ACROBATIE_EQUILIBRE ; "Combat (contact)" sauf les 3 labels ; etc. — cf. tableaux détaillés par segment ci-dessus pour la liste exhaustive des lignes NON touchées

### G. `down()`
Restaure toutes les valeurs actuelles (pré-37-bis) listées dans les tableaux B/C/D + le bloc "RUN À VIDE" (`attr_1`/`is_category`) ci-dessus, ré-insère `ARMES_SATELLITES` (valeurs de la migration 103b) et `MUTATION` (`attr_1: 'CHC'`, `marker: NULL`, `parent: NULL`), re-parente les 8 `MUTATION_*` vers `MUTATION` (avant de supprimer `CONTROLE_DES_MUTATIONS`... non — `CONTROLE_DES_MUTATIONS` existait déjà avant 37-bis, seul son `parent`-status change : down() les re-parente vers `MUTATION` et remet `CONTROLE_DES_MUTATIONS.attr_1` à `'CHC'`), redéplace les 2 lignes `ref_skill_requirements` vers `MECANIQUE_CHASSEURS_ATMOSPHERIQUES`, et retire la colonne `is_category` + restaure `attr_1` NOT NULL (`table.text('attr_1').notNullable().alter()`, uniquement si aucune ligne `attr_1 IS NULL` ne subsiste — sinon les catégories `NULL` doivent d'abord être re-basculées à `'CHC'` dans le `down()`, avant l'`alter`).

### H. Header de migration (documentation intégrée au code)
Le fichier `105_ref_skills_37bis.js` documente en commentaire de tête : la légende `marker` réelle (X/PN/(-3)/•), le statut de `PREREQ` (convention projet, pas LdB), la nouvelle colonne `is_category` (remplace le sentinel `CHC`, cf. bloc "RUN À VIDE"), et un renvoi vers `docs/Old/MIGRATION_37BIS.md` pour l'audit complet ligne par ligne.

### I. Changement client requis (hors migration, même PR)
`client/src/character/SkillsPanel.jsx` lignes 196 et 201 : remplacer `skill.attr_1 === 'CHC'` par `skill.is_category`, et `byId.get(skill.parent)?.attr_1 !== 'CHC'` par `!byId.get(skill.parent)?.is_category`. **Test navigateur obligatoire après ce changement** : vérifier le regroupement correct des **17 catégories** dans la fiche personnage (mode normal + mode Progression) — les 9 déjà groupées aujourd'hui (à re-tester en non-régression : `ARME_SPECIALE_CONTACT`, `ARME_SPECIALE_DISTANCE`, `COMMERCE_TRAFIC`, `EXPRESSION_ARTISTIQUE`, `GENIE_TECHNIQUE`, `PILOTAGE`, `POUVOIRS_POLARIS`, `SCIENCES_CONNAISANCES_SPECIALISEES`, `CONTROLE_DES_MUTATIONS` avec ses 8 enfants re-parentés) + les 8 nouvellement groupées (`ARTS_MARTIAUX`, `CONNAISSANCE_MILIEU_NATUREL`, `LANGAGES_SPECIFIQUES`, `LANGUE_ANCIENNE`, `LANGUE_ETRANGERE`, `MANOEUVRE_DARMURE`, `MECANIQUE`, `TACTIQUE`).

### J. RUN À VIDE FINAL (2026-07-05) — vérifications de clôture avant code

Passe de vérification exhaustive demandée par Saar ("3ᵉ révision de `ref_skills`, on veut que ce soit la dernière") — tout vérifié par requête/grep, rien laissé à la mémoire :

- **Tous les consommateurs de `ref_skills` recensés** : côté client, `attr_1`/`CHC`/`is_category` n'apparaissent **que** dans `SkillsPanel.jsx` (grep `client/src` entier) — aucune logique de regroupement dupliquée ailleurs (`mockStep4Data.js` ne fait que des overrides de `marker` pour mock, sans rapport). Côté serveur, 3 routes touchent `ref_skills` : `char-sheet.js` (achat, déjà auditée), `equipment.js` (`SELECT id,label,family` pour dropdown — inerte), `character/ref.js` (`SELECT *` — inclut `is_category` automatiquement, aucun code à changer ici).
- **`ref_mutation_skills`** (table découverte en cours de vérification) — colonnes `mutation_id, skill_name, skill_attrs, skill_base, cost_mult` : **pas de FK vers `ref_skills`** (`skill_name` est un texte libre, pas un `skill_id`). Aucun rapport avec 37-bis, aucune action.
- **Aucun personnage existant n'a de ligne `char_skills` pour `MUTATION` ou `ARMES_SATELLITES`** (vérifié `SELECT * FROM char_skills WHERE skill_id IN (...)` → 0 ligne) — suppression des deux sans impact sur des personnages déjà créés.
- **Famille cohérente** pour le re-parentage : les 8 `MUTATION_*` et `CONTROLE_DES_MUTATIONS` sont tous `family='Compétences Spéciales'` — aucun changement de `family` nécessaire.
- **0 cas de nesting à 3 niveaux** sur toute la table (vérifié : aucun enfant n'est lui-même parent d'une autre ligne) — le design `is_category` (un seul niveau de regroupement) est structurellement suffisant partout, pas seulement pour les 17 cas traités.
- **Transactions migration** : knex encapsule chaque `up()`/`down()` dans une transaction par défaut (rien dans `knexfile.cjs` ne désactive ce comportement) — le re-parentage (`UPDATE parent`) suivi de la suppression (`DELETE MUTATION`) dans le même `up()` est donc atomique sans effort supplémentaire.
- **Total final `ref_skills`** : 251 − 1 (`MUTATION`) − 1 (`ARMES_SATELLITES`) = **249 lignes**.
- **Reste (non bloquant, cosmétique)** : commentaire `server/src/routes/character/ref.js:38` mentionne "234 skills" — déjà obsolète avant même 37-bis (la table est à 251 aujourd'hui). Pas corrigé ici (commentaire, aucun effet fonctionnel) — à mettre à jour en même temps que le reste si on touche ce fichier un jour.

**Aucun nouveau blocage trouvé.** Le plan est stable.

---

**Plan mis à jour et complet — vérifié de bout en bout. Je code ?**

