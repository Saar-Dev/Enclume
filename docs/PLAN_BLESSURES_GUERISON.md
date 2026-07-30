# PLAN — Blessures : Guérison et Infection

> Statut : cadrage v2 (2026-07-29, après analyse à charge de la v1 — voir §6), **3 propositions du
> §8 tranchées avec Saar le 2026-07-30**, puis **analyse à charge combinée avec
> `PLAN_FATIGUE_DOMMAGES.md` le même jour** — 2 corrections techniques appliquées (ancrage
> `occurred_at_game_minutes`, append atomique du journal d'annulation Lot 2) et le point ouvert trouvé
> (Moyenne/Grave sans reschedule après un Échec sans Infection) tranché avec Saar le même jour (§8,
> reschedule conditionné à `soinsContinues`) — **prêt à être codé intégralement**, dans les limites de
> la dépendance au Lot 2 ci-dessous. Le résolveur de Test générique, prérequis,
> est déjà clos séparément (§2). **Dépend du Lot 2 de
> `PLAN_FATIGUE_DOMMAGES.md`** (échéancier générique, table `game_echeances`) — toujours v1 discutée,
> pas encore codé : ce plan ne peut pas être codé en entier avant que le Lot 2 le soit.
> **✅ Partie indépendante codée et testée (2026-07-30)** : migration
> `server/src/db/migrations/219_character_wounds_occurred_at.js` (colonne
> `occurred_at_game_minutes`, ancrée sur `game_time_resolved_minutes`) et
> `resolveWoundImprovement`/`previousSeverity` (`server/src/lib/woundUtils.js`).
> **✅ Lot 2 (`PLAN_FATIGUE_DOMMAGES.md`) clos le 2026-07-30** — ce plan n'est plus bloqué.
> **✅ Handlers `wound_healing_check`/`wound_infection_check` codés et testés (2026-07-30)** —
> `server/src/lib/woundEvolutionService.js`, enregistrés dans `shared/echeanceTypeRegistry.js` via
> `server/src/lib/echeanceHandlerRegistrations.js`. Tables RAW (durées de guérison, modificateurs
> d'Infection) dans `shared/woundConstants.js` (`WOUND_HEALING`/`WOUND_INFECTION`). Étendu au passage :
> `resolveWoundInsertion` retourne désormais `deletedWounds` (+ `buildWoundInsertionUndoEntries`) pour
> construire des `undoEntries` Lot 2 corrects même sur une promotion en cascade ;
> `applyWound`/`char-sheet.js` (route `POST /:characterId/wounds`) branchés sur la création initiale
> d'échéance, la seconde dédupliquée sur `applyWound` au passage (réutilisation au lieu d'une 2ᵉ copie
> de la logique d'insertion). **127/127 tests verts en conditions réelles**
> (`node --env-file=../.env --test <fichiers>`, suite serveur complète, aucune régression).
> **✅ Routes REST/WS + écran de revue MJ + panneau joueur codés (2026-07-30)** — §6.1 : 7 routes
> `campaigns.js`, handler socket `WOUND_INFECTION_ROLL` (`socketDice.js`), `BlessuresReviewPanel.jsx`/
> `PendingRollsPanel.jsx` (nouveaux, montés dans `Sidebar.jsx` aux côtés de `GameTimeWidget.jsx`),
> `GameTimeWidget.jsx` migré sur `request-advance`. Aucun état partagé "ouvrir la modale" nécessaire —
> les deux panneaux sont toujours montés et réagissent directement aux événements serveur (trouvaille
> de l'implémentation, simplifie le plan §6.1 initial). **Testé** : suite serveur 127/127, `eslint`
> propre et `vite build` propre sur les 4 fichiers client touchés/créés (un bug réel de règle des
> Hooks trouvé et corrigé par ce lint, pas juste une formalité). **Non testé** : navigateur — comme
> toujours, à faire par Saar (pas d'accès navigateur côté agent).
> **✅ Analyse à charge du chantier complet (2026-07-30)** — relecture de bout en bout (moteur, handlers,
> routes, socket, client) après la clôture ci-dessus, 3 bugs réels trouvés et corrigés :
> (1) `PendingRollsPanel.jsx`/`socketDice.js` : le catch de `WOUND_INFECTION_ROLL` n'émettait aucun
> `socket.emit('error', ...)`, donc l'état local `rolling` restait bloqué indéfiniment après tout échec
> serveur (ex. double clic concurrent sur la garde 409 de `resolveEcheanceNow`) ;
> (2) `campaigns.js` (route `confirm-advance`) : un 409 issu de `confirmPendingAdvance` (cas
> `newlyDue`) ne diffusait rien — un `wound_infection_check` fraîchement engendré par un Échec/
> Catastrophe de Guérison restait invisible côté MJ tant que personne ne retentait une confirmation ;
> corrigé en diffusant `CAMPAIGN_ADVANCE_PENDING` avant de relancer l'erreur ;
> (3) cause racine du (2) : `getPendingReviewForGm` (`woundReviewService.js`) ne filtrait que sur
> `status IN ('pending_mj_review','awaiting_player_roll')`, jamais sur les échéances encore `active`
> mais déjà dues (`next_due_minutes <= game_time_resolved_minutes`) — une naissance d'échéance par
> handler (`buildInfectionSpawn`) reste `active` jusqu'à la prochaine découverte par
> `confirmPendingAdvance`. Corrigé par une union de requête ; `game_time_resolved_minutes` reste
> interne, jamais renvoyé par `enrichWoundEcheances` (invariant de non-fuite Lot 1 toujours respecté).
> (4) `PendingRollsPanel.jsx` : `rollAll()` appelait `setRolling(echeanceId)` en boucle sur un état à
> valeur unique — seul le bouton de la *dernière* ligne de la boucle finissait désactivé après un clic
> "Tout lancer", les autres jets étaient bien en vol côté serveur mais leur bouton restait cliquable.
> Corrigé en remplaçant `rolling` (valeur unique) par `rollingIds` (Set, une entrée par échéance en
> vol). Note secondaire vérifiée non-bloquante : les doubles-clics concurrents sur `infection-mode`
> (mode `auto`) et `healing-choice` sont déjà protégés — toute la séquence lecture-payload +
> `resolveEcheanceNow` est enveloppée dans un seul `db.transaction()`, le verrou de ligne Postgres pris
> par l'`UPDATE` du payload sérialise les tentatives concurrentes, la perdante échoue proprement en 409
> avec rollback complet (aucune donnée corrompue, aucun jet fantôme persisté).
> **Testé** : nouveau test dédié à la branche "active déjà due" + suite serveur complète rejouée —
> 128/128 verts (`node --env-file=../.env --test` sur tous les `server/src/**/*.test.mjs`) ; `eslint`
> et `vite build` propres sur `PendingRollsPanel.jsx` après le correctif (4). **Non testé** :
> navigateur, comme toujours.
> Document temporaire (`docs/RegleDocumentaire.md`
> Règle 10) — à archiver dans `docs/Old/` une fois le chantier clos, contenu durable transféré vers
> `docs/SYSTEME/BLESSURES.md`.
> Source : `docs/REGLES/REGLEBLESSURES.md` (extrait Livre de Base Polaris, p.236-240, sections
> « Stabilisation nécessaire », « Soins et guérison », « Aggravation des blessures et Infection »,
> « Suractivité »).

---

## 1. Périmètre et relation avec les autres plans

Ce chantier ne fait **pas** partie des 9 sous-thèmes de `docs/PLAN_FATIGUE_DOMMAGES.md`
(`docs/REGLES/FATIGUE&DOMMAGES.md`) — c'est un chapitre RAW séparé (`REGLEBLESSURES.md`), avec sa
propre table déjà existante (`character_wounds`, migration 49) et son propre système déjà
partiellement codé (seuils de gravité, promotion, malus). `PLAN_FATIGUE_DOMMAGES.md` §1 supposait ce
système comme une fondation externe déjà là — ce n'est vrai que pour les dégâts ponctuels (coup reçu
au combat), pas pour son évolution dans le temps (guérison/infection), qui reste entièrement à
construire.

**Décision de séquencement (Saar, 2026-07-29)** : ce chantier devient le **premier vrai
consommateur** du Lot 2 de `PLAN_FATIGUE_DOMMAGES.md` (moteur générique d'échéances de jeu),
**avant** Maladies/Poisons (Lot 7 initial). Ordre retenu :

1. **Résolveur de Test générique** — ✅ clos (`server/src/lib/polarisTestService.js`,
   `resolvePolarisTest(threshold)`, extrait de `MACRO_ROLL`/`socketDice.js`, 6 tests verts).
2. **Blessures — Guérison et Infection** (ce plan).
3. Reprise des lots de `PLAN_FATIGUE_DOMMAGES.md` (Maladies, Drogues, Irradiations, Froid,
   Faim/soif, Fatigue), dans un ordre à revoir une fois ce chantier clos.

Le Lot 2 (échéancier générique — table `game_echeances`, registre + dispatch, balayage inspiré du
module Foundry VTT `about-time`) reste défini une seule fois dans `PLAN_FATIGUE_DOMMAGES.md` §8,
partagé entre les deux plans — ce document n'en redéfinit pas l'architecture, seulement son premier
contenu réel.

---

## 2. Fondations déjà en place (à ne pas reconstruire)

| Élément | Rôle | Fichier |
|---|---|---|
| `character_wounds` | Une ligne = une case de blessure cochée (pas un compteur). Colonnes : `id`, `char_sheet_id`, `location`, `severity`, `is_stabilized`, `created_at`/`updated_at` (temps réel, pas temps de jeu). | `server/src/db/migrations/49_character_wounds.js` |
| `WOUND_LOCATIONS`/`WOUND_SEVERITIES`/`WOUND_MAX_COUNTS`/`WOUND_PENALTIES` | Localisations (6), gravités (5 — suffisant, "Membre détruit" n'est pas une gravité distincte, voir §3.2), capacité de case par localisation/gravité, malus par gravité. | `shared/woundConstants.js` |
| `resolveWoundInsertion(trx, char_sheet_id, location, severity)` | Ajoute une case ; si la ligne déborde, supprime les cases de la gravité pleine et promeut en cascade vers la gravité supérieure. **Réutilisable tel quel** pour la conséquence "case supplémentaire" de l'Infection. | `server/src/lib/woundUtils.js` |
| `nextSeverity(severity)` | Direction de promotion (vers le haut uniquement — **aucune fonction inverse n'existe**, nécessaire pour la Guérison). | `server/src/lib/woundUtils.js` |
| `getWorstWoundSeverity(db, charSheetId)` | Malus non cumulatif — seule la pire blessure compte (RAW confirmé, `REGLEBLESSURES.md:225-244`). | `server/src/lib/woundUtils.js` |
| `is_stabilized` | Flag déjà branché (route `char-sheet.js`, UI `LocationPanel.jsx`) — **mais purement manuel**, aucune conséquence automatique (le compte à rebours minute par minute du RAW sans stabilisation n'est pas codé). | `server/src/routes/character/char-sheet.js`, `client/src/character/LocationPanel.jsx` |
| `resolvePolarisTest(threshold)` | Résolveur de Test générique — 1=critique, 20=Catastrophe, sinon roll≤seuil. Point d'entrée unique pour tous les Tests de ce plan (Médecine, Premiers soins, Constitution). | `server/src/lib/polarisTestService.js` |
| `calcSkillTotal(attrs, charSkillRow, refSkill, genotypeRow, mutationEffectsRow)` | Calcule le total d'une Compétence (Médecine, Premiers soins) à partir des Attributs/mastery/mutations — réutilisable pour construire le seuil d'un Test. | `server/src/lib/charStats.js` |
| Lot 2 — échéancier générique | `shared/echeanceTypeRegistry.js` + `server/src/lib/echeanceService.js` (`sweepDueEcheances`), table `game_echeances`, appelé depuis l'intérieur de la transaction d'`adjustGameTime`. **Statut : v1 discutée, pas encore codée** — ce plan en écrit le premier `condition_type` réel. | `docs/PLAN_FATIGUE_DOMMAGES.md` §8 |
| `shared/gameTime.js` | `MINUTES_PER_DAY`, `projectGameTime` — pour convertir les durées RAW (jours/semaines) en minutes de jeu. | `shared/gameTime.js` |

---

## 3. Les mécaniques RAW — quatre échéances distinctes, un seul mécanisme générique

Confirmé avec Saar (2026-07-29) : structurellement, c'est **un seul mécanisme** — "à échéance, un
Test, le résultat fait monter ou descendre la gravité" — paramétré différemment selon la phase. Le
moteur du Lot 2 n'a besoin d'aucune spécificité pour ça ; seul le `payload` par échéance varie.

### 3.1 Stabilisation (minutes — hors périmètre de ce lot, voir §7)

Uniquement pour les Blessures critiques **avec risque d'hémorragie** (pas toutes — "la stabilisation
n'est nécessaire que sur les Blessures critiques présentant un risque d'hémorragie", `:205-206`),
mortelles et Membres détruits. Test de Premiers soins immédiat, malus : Critique +0, Mortelle
Bras/Jambe -3, Mortelle Corps -5, Mortelle Tête -7, Membre détruit -3.

Sans stabilisation (ou Test raté) :
- **Critique** : (2 × Constitution) minutes sans complication, puis Test de Constitution répété
  toutes les (5 + modificateur de réussite) minutes ; échec → transformation en Blessure **mortelle**.
- **Mortelle/Membre détruit** : survit (Constitution) minutes, puis mort. Aucun Test — un simple
  compte à rebours.

### 3.2 Guérison (jours/semaines — cœur de ce lot)

**Correction 2026-07-29** : une première version de ce plan simplifiait Mortelle en un embranchement
binaire instantané (mort ou membre détruit dès l'apparition de la blessure). Relecture complète et
littérale du texte (`:359-401`, pas seulement les fragments déjà cités) montre que ce n'est **pas**
ce que dit le RAW — décision Saar (2026-07-29, principe maintenant inscrit dans `CLAUDE.md` §1.9) :
**on colle au texte autant que possible**, la simplification est abandonnée.

Ce que le RAW dit réellement (:365-366) : *"au bout de [durée], une Blessure mortelle a la
possibilité de se transformer en Blessure critique."* — **Mortelle suit le même cycle que les
autres gravités nécessitant des soins**, pas un embranchement instantané. Le personnage reste à
terre, incapable d'agir, parfois comateux (mécanique Choc/Coma, `:264-303`, distincte — voir
`docs/EN_COURS.md` chantier CHOC1) — mais **jamais mort du simple fait d'atteindre Mortelle**. La
mort ne reste possible que par deux voies déjà identifiées ailleurs dans ce plan : l'absence de
stabilisation (§3.1, minutes, hors périmètre) et le pire résultat de l'Infection non soignée (§3.3).

Table de durée (`REGLEBLESSURES.md:413-433`) :

| Gravité | Durée | Guérison naturelle ? | Soins nécessaires | Difficulté | Soins constants ? |
|---|---|---|---|---|---|
| Légère | 1 jour | Oui | Aucun | — | Non |
| Moyenne | 3 jours | Oui | Médecine ou Premiers soins | +5 | Non |
| Grave | 1 semaine | Oui | Médecine ou Premiers soins | +3 | Non |
| Critique | 3 semaines | **Non** | Médecine | +0 | **Oui** (Test chaque semaine) |
| Mortelle | 5 semaines | **Non** | Chirurgie + Médecine | Bras/Jambe -3, Corps -5, Tête -7 | **Oui** |
| Membre détruit | 3 semaines | **Non** | Chirurgie + Médecine | -3 | **Oui** |

**Correction 2026-07-30 — pas une incohérence du livre, une erreur de transcription trouvée en
comparant contre le PDF réel (`Polaris 3ème édition.pdf`, p.237, fourni par Saar)** : une version
antérieure de ce plan pensait avoir trouvé une coquille du Livre de Base (l'exemple narratif
`:365-366` donnant "Mortelle→Critique, 3 semaines" contre 5 semaines au tableau pour Mortelle). En
réalité, le vrai texte du LdB dit *"au bout de 3 semaines, une Blessure **critique** a la possibilité
de se transformer en Blessure **grave**"* — cohérent avec le tableau (3 semaines = durée de
Critique), aucune incohérence dans le livre. C'est `REGLEBLESSURES.md` qui avait interverti les
gravités lors de sa transcription — corrigé dans ce fichier. Sans conséquence sur les décisions déjà
prises : le tableau faisait déjà foi, la correction ne change aucune mécanique codée.

**Emplacement en code (proposition Saar, 2026-07-29)** : ce tableau et celui d'Infection (§3.3) sont
des tables RAW brutes, même nature que `AN_TABLE` déjà présente dans `shared/polarisUtils.js`. Mais
`polarisUtils.js` est le domaine "calculs d'Attributs", générique à tout personnage — le domaine
"Blessures" a déjà son propre fichier partagé (`shared/woundConstants.js`,
`WOUND_PENALTIES`/`WOUND_MAX_COUNTS`/`WOUND_SEVERITIES`). Les deux tables de ce plan rejoignent
`woundConstants.js`, pas `polarisUtils.js` — responsabilité unique par domaine, pas par "table RAW"
en général.

**Correction 2026-07-29 (analyse à charge, contamination de texte trouvée)** : la résolution
ci-dessous citait "Test de Constitution par période d'évolution (ou par jour une fois stable)" —
cette formulation appartient au chapitre **Maladies et Poisons** (`FATIGUE&DOMMAGES.md`), pas à
Blessures. Le vrai texte Blessures (`:391-392`) dit : *"certaines blessures exigent des Soins
constants, ce qui signifie que le Test de Médecine doit être effectué **chaque semaine**."*

**Deux formes de `wound_healing_check` selon la colonne "Soins constants" du tableau ci-dessus, pas
une seule** :
- **Moyenne/Grave (soins constants = Non)** : une échéance **unique**, ponctuelle
  (`interval_minutes = null`, `occurrences_remaining = null`), qui se déclenche à la fin de la
  courte durée (3 jours / 1 semaine).
- **Critique/Mortelle (soins constants = Oui)** : une échéance **récurrente hebdomadaire**
  (`interval_minutes` = 1 semaine, `occurrences_remaining` = durée totale ÷ 7 — 3 pour Critique, 5
  pour Mortelle). La gravité ne diminue **qu'au dernier** de ces Tests hebdomadaires (celui où
  `occurrences_remaining` atteint 0, coïncidant avec la fin de la durée totale) — pas à chaque
  semaine. Correspond exactement au patron déjà prévu par le moteur générique du Lot 2, rien de
  nouveau à construire côté échéancier lui-même.

Pour chaque Test (unique ou hebdomadaire) : **Réussite** → si fin de la période de guérison
atteinte, la gravité **diminue d'un niveau** (Mortelle→Critique) ; sinon, la guérison continue
normalement, rien ne change avant le prochain Test. **Échec** → un (et un seul) Test de Constitution
contre l'Infection **pour cette semaine précisément** — **confirmé (Saar, 2026-07-30)** : le texte
RAW (`:396-398`) est en fait littéral, pas une simple analogie comme le disait une version antérieure
de ce paragraphe — *"Un échec force le blessé à effectuer **un (et un seul) Test de Constitution**
pour la période en cours, pour lutter contre les effets de l'Infection"* nomme explicitement le même
Test que l'Infection normale §3.3 : vrai jet, choix auto/joueurs. **Catastrophe** → bascule sur le
rythme 2 jours de l'Infection (§3.3) **pour le reste de cette semaine précisément**, pas pour toute
la durée de guérison restante — **confirmé (Saar, 2026-07-30)**, lecture retenue face à l'ambiguïté
réelle du texte RAW (`:398-401`, "la période de guérison en cours") : cohérence de vocabulaire avec
la phrase Échec adjacente ("la période en cours"), plutôt que la lecture alternative où "période de
guérison" reprendrait le sens de durée totale utilisé plus haut dans le même paragraphe (`:363-367`).

**Décision Saar (2026-07-29) sur QUI effectue ce Test — inchangée par cette correction, corrigée sur
sa forme (analyse à charge du 2026-07-29)** : aucun jet serveur, aucune vérification de
Compétence/matériel/soignant assigné. Le MJ tranche à sa discrétion (il peut demander un jet à un PJ
ou un PNJ de son choix, off-système). **Pas une case binaire** — une case "soigné oui/non" ne peut
pas représenter les 3 issues RAW ci-dessus (contradiction trouvée à la relecture). Le MJ choisit
explicitement parmi **3 options** dans l'UI de revue (§6) : **Amélioration** / **Échec (Test contre
l'Infection)** / **Catastrophe (bascule complète sur l'Infection)** — la fenêtre lui montre le
contexte RAW (soins reçus, médecin, matériel) comme information pour se décider, jamais pour
calculer le résultat à sa place. `resolvePolarisTest`/`calcSkillTotal` **ne sont pas utilisés pour
la Guérison** — conservés pour l'Infection (§3.3) et pour de futurs Tests ailleurs dans le projet,
pas du travail perdu.

**Membre détruit — différé (Saar, 2026-07-29), pas dans ce lot.** Plutôt que de trancher sa
modélisation en base maintenant (voir l'analyse §8, aucune option évidente), c'est ajouté à
`docs/ROADMAP.md` comme future **Option de campagne**. **En v1, une blessure Mortelle sur Bras/Jambe
suit exactement le même traitement qu'une Mortelle sur Tête/Corps** (ligne "Membre détruit" du
tableau ci-dessus non implémentée) — comportement volontairement simplifié, pas un oubli.

Légère guérit **seule, sans Test, sans MJ** — résolution 100% automatique/silencieuse, seul cas de
ce plan qui ne demande jamais d'interaction.

**Conséquence sur le schéma (rouvre le point qu'on croyait résolu)** : "Membre détruit" est
confirmé comme une gravité RAW **distincte** de Mortelle (tableau Choc `:291-303` : deux lignes
séparées même sur Bras/Jambes, durées et malus différents), pas une simple "Mortelle sur un membre"
comme supposé dans la version précédente de ce plan. Mais elle est aussi **restreinte aux
localisations Bras/Jambes uniquement** — `WOUND_SEVERITIES` (`shared/woundConstants.js`) est un
tableau linéaire à 5 valeurs sans notion de restriction par localisation ; y ajouter une 6ᵉ valeur
"membre_detruit" pose la question de ce que ça veut dire pour Tête/Corps (jamais valide ?) et de sa
position dans l'échelle de promotion (`nextSeverity`/future `resolveWoundImprovement`) qui n'est pas
un simple "entre Critique et Mortelle" (les deux durées se chevauchent, 3 semaines vs 5). **Point
ouvert, pas résolu ici** — voir §8.

### 3.3 Infection (rythme fixe 2 jours, indépendant de §3.2)

`REGLEBLESSURES.md:435-488`. À partir de Moyenne (Légère non concernée). Tous les 2 jours, pour
chaque Localisation avec une blessure non soignée susceptible de s'infecter : Test de Constitution
avec malus **cumulatif croissant** à chaque passage sans soin (0 / -2 / -4 / -6...).

| Gravité | Modificateur | Réussite | Échec |
|---|---|---|---|
| Moyenne | +5 | Pas d'infection | Case supplémentaire (Moyenne) |
| Grave | +0, -2 cumulatif/case en plus | Pas d'infection, mais malus futur | Case supplémentaire (Grave) |
| Critique | -5, -2 cumulatif/case en plus | **S'infecte quand même** — case supplémentaire | Case supplémentaire + malus cumulatif |
| Mortelle/Membre détruit | -10, -2 cumulatif/case en plus | **S'infecte quand même** — survit (Constitution) heures puis meurt (septicémie ; amputation possible si Bras/Jambe) | Survit (Constitution/2) heures |

"Case supplémentaire" = exactement l'opération de `resolveWoundInsertion` — réutilisable telle quelle.

**Mortelle/Membre détruit — le "survit X heures puis meurt" n'est pas une 3ᵉ échéance à construire**
— **confirmé (Saar, 2026-07-30)**, cohérent avec §7 "détecte et signale, jamais n'applique" et avec
les deux précédents déjà tranchés ailleurs dans le projet pour une échelle heures/minutes (§3.1
Stabilisation, Lot 6 Noyade de `PLAN_FATIGUE_DOMMAGES.md`, "reste un minuteur narratif tenu par le
MJ"). Plutôt que de programmer un compte à rebours en
heures (une échelle de temps de plus, distincte des jours/semaines de Guérison et des 2 jours fixes
d'Infection), le handler **calcule et affiche** le délai (Constitution ou Constitution/2 heures)
dans le récapitulatif MJ (§6) comme information — la mort elle-même reste narrative, gérée par le
MJ hors du système, comme déjà décidé pour toute conséquence de mort dans ce plan.

**Décision Saar (2026-07-29) sur QUI lance ce Test — différent de la Guérison** : contrairement au
§3.2, l'Infection **garde un vrai jet** — les joueurs aiment lancer les dés qui les concernent.
Au moment de l'échéance, le MJ voit **le nombre de jets nécessaires (X)** et choisit, par échéance
ou par lot :
- **Lancer automatiquement** — le serveur appelle `resolvePolarisTest(threshold)` directement
  (seuil = modificateur de gravité + malus cumulatif §3.3, aucune Compétence requise, c'est un Test
  de Constitution pur) et applique la conséquence tout de suite.
- **Demander aux joueurs concernés** — l'échéance passe `awaiting_player_roll` (§6), le(s)
  joueur(s) reçoivent un jet à faire dans un tableau récapitulatif, **un par un ou tous d'un coup**
  (leur choix), via le mécanisme de jet déjà existant (`DICE_ROLL`/`MACRO_ROLL`, `socketDice.js`).

**Correction 2026-07-29 (analyse à charge)** : contrairement à une version précédente de ce
paragraphe, **l'avance de l'horloge de campagne attend désormais ce résultat** — voir §6, le
compteur `game_time_minutes` ne bouge qu'à la confirmation finale du MJ, jamais avant que toutes les
échéances du lot (y compris celles en attente d'un jet joueur) soient résolues.

### 3.4 Suractivité — hors périmètre, jugement MJ pur

Aucun Test, aucun timer — le MJ juge si l'activité du personnage justifie une case supplémentaire
sur sa pire blessure. Pas un candidat à l'automatisation ; à laisser en outil manuel MJ (bouton
"aggraver manuellement"), hors de l'échéancier.

---

## 4. Modèle de données

- **`character_wounds.occurred_at_game_minutes`** (nouvelle colonne, `integer`, `notNullable`,
  capturée depuis **`campaigns.game_time_resolved_minutes`** au moment de l'insertion — **corrigé
  2026-07-30**, analyse à charge combinée des deux plans, voir ci-dessous) — `created_at` existant
  est en temps réel, inutile pour calculer une échéance en temps de jeu. Migration impaire (Claude),
  prochain numéro à vérifier au moment de coder (219 libre au 2026-07-30, 217 pris par l'horloge de
  campagne).

  **Pourquoi `resolved` et pas `game_time_minutes` (le compteur affiché)** : une version antérieure de
  cette puce ancrait la blessure sur le compteur **affiché**, alors que Lot 2 compare systématiquement
  `next_due_minutes` contre le compteur **résolu** (§8 de `PLAN_FATIGUE_DOMMAGES.md`, seule autorité
  de balayage — `CLAUDE.md` §1.4, une propriété possède une autorité unique). Les deux compteurs ne
  divergent que dans un cas précis mais entièrement supporté par Lot 1 : un MJ recule l'horloge
  (fonctionnalité explicite, Lot 1 point 8), puis un personnage est blessé (combat, indépendant de
  l'horloge). Si l'ancrage se fait sur l'affiché (redescendu), `occurred_at_game_minutes + durée`
  peut tomber **sous** le repère `resolved` déjà atteint par une avance antérieure — l'échéance de
  Guérison/Infection de cette blessure toute neuve se déclencherait dès la prochaine avance, même
  minime, sans qu'aucune minute de jeu ne se soit réellement écoulée depuis le coup reçu. Ancrer sur
  `resolved` élimine la classe de bug à la racine, sans perte : cette colonne ne sert qu'au calcul
  mécanique, jamais à l'affichage (`created_at`, en temps réel, reste la seule trace narrative de
  quand la blessure a eu lieu pour un MJ qui consulterait l'historique).
- **`game_echeances`** (Lot 2, table partagée) — chaque échéance de Guérison/Infection porte dans
  son `payload` (jsonb, opaque au moteur) au minimum `{ woundId }`. Une même blessure peut avoir
  **deux lignes `game_echeances` simultanées** (une `wound_healing_check`, une `wound_infection_check`)
  — cohérent avec le moteur générique conçu pour porter plusieurs échéances indépendantes par
  personnage. **Précision 2026-07-30** (question posée par Saar, tranchée après relecture RAW
  combinée de `:396-401` et `:405-407`) : la `wound_infection_check` n'est **jamais** créée
  indépendamment dès la naissance de la blessure — uniquement en conséquence d'un Échec/Catastrophe
  du `wound_healing_check` (§5). Le cas RAW "blessure jamais traitée du tout" (`:405-407`,
  *"toutes les blessures non soignées... risquent de s'aggraver par l'infection"*) n'est pas un 3ᵉ
  déclencheur mécanique séparé : le `wound_healing_check` se déclenche toujours (échéance
  programmée), le MJ y répond forcément Amélioration/Échec/Catastrophe même si narrativement
  personne n'a soigné le blessé — "jamais traitée" se traduit par une réponse Échec ou Catastrophe à
  cette échéance-là, pas par un mécanisme parallèle à construire. Confirmé Saar : aucun cas connu où
  l'Infection devrait s'appliquer avant que le premier `wound_healing_check` de la blessure ait eu
  l'occasion de se résoudre.
- **Fonction manquante à écrire** : inverse de `resolveWoundInsertion` — retire une case à la
  gravité courante, insère une case à la gravité inférieure (ou supprime purement si Légère). Nom
  proposé : `resolveWoundImprovement(trx, woundId)`.
- **Conversion durée RAW → minutes** : réutilise `MINUTES_PER_DAY` (`shared/gameTime.js`) — jour=1,
  semaine=7 jours, aucune nouvelle constante nécessaire.
- **Tables RAW** (durée de guérison §3.2, modificateurs d'Infection §3.3) : `shared/woundConstants.js`,
  pas `shared/polarisUtils.js` — voir §3.2.

### 4.1 Avance d'horloge en attente (composition avec le Lot 1)

Mécanisme générique déménagé dans le Lot 2 (`PLAN_FATIGUE_DOMMAGES.md` §8 — `campaigns.
pending_advance_delta_minutes`, `game_echeances.status` +=
`pending_mj_review`/`awaiting_player_roll`, fonctions `requestGameTimeAdvance`/`resolveEcheanceNow`/
`confirmPendingAdvance`/`cancelPendingAdvance`) — pas redéfini ici, source unique là-bas. Ce qui
reste spécifique à ce plan : **qui reçoit la demande de jet** pour `wound_infection_check`, dérivé
de la chaîne déjà existante `character_wounds.char_sheet_id → char_sheet.character_id →
characters.user_id` — aucune nouvelle relation à stocker, juste une jointure au moment de notifier
le joueur concerné.

---

## 5. Registre et handlers (Lot 2)

Deux entrées dans `shared/echeanceTypeRegistry.js` :
- `wound_healing_check` — **jamais de jet côté serveur pour son propre résultat** (§3.2, décision
  Saar). Le handler lit une réponse déjà fournie par le MJ dans le `payload` —
  `mjChoice: 'amelioration' | 'echec' | 'catastrophe'` (3 issues, pas un booléen — corrige la
  contradiction trouvée à l'analyse à charge, voir §3.2) :
  - `amelioration` → `resolveWoundImprovement`, uniquement si l'échéance est à sa dernière occurrence
    (`occurrences_remaining` atteint 0 — voir la forme unique/récurrente §3.2), sinon ne fait rien
    (la guérison continue, prochaine occurrence dans 1 semaine).
  - `echec` → déclenche **un seul** `wound_infection_check` ponctuel pour cette semaine précisément
    (§3.2, confirmé 2026-07-30 : celui-là **garde le vrai jet**, comme un Infection normal). **Pour
    une échéance à `occurrences_remaining` nul (Moyenne/Grave) uniquement** — décision Saar
    2026-07-30, détail §8 : reschedule conditionné à `payload.soinsContinues` (saisi par le MJ dans
    l'écran de revue) — `true` → `reschedule: { intervalMinutes: durée de la gravité,
    occurrencesRemaining: 1 }` (nouvelle tentative programmée) ; `false`/absent → `reschedule: null`
    (échéance terminée). Ne s'applique pas à Critique/Mortelle, déjà récurrentes indépendamment de ce
    choix.
  - `catastrophe` → crée une échéance `wound_infection_check` récurrente au rythme de 2 jours,
    bornée à la fin de la semaine en cours (§3.2, confirmé 2026-07-30).
  Création initiale (fonction séparée, appelée quand une blessure Moyenne+ apparaît) : one-shot ou
  récurrente selon la colonne "Soins constants" de la table §3.2.
- `wound_infection_check` — Test de Constitution, résolution du §3.3, **deux chemins** :
  auto (`resolvePolarisTest` appelé directement) ou différé (échéance basculée
  `awaiting_player_roll`, résolue à la réception du résultat du joueur). Dans les deux cas : case
  supplémentaire (`resolveWoundInsertion`), malus cumulatif tenu à jour (nouveau compteur sur
  l'échéance, ex. `payload.periodesSansSoin`), et pour Mortelle/Membre détruit — calcul du délai de
  survie (Constitution ou Constitution/2 heures) affiché au MJ, jamais appliqué automatiquement
  (§3.3).

Nouveau service `server/src/lib/woundEvolutionService.js` implémentant les deux handlers, appelant
`resolvePolarisTest` (Infection, chemin auto uniquement), `resolveWoundInsertion`,
`resolveWoundImprovement`.

Les deux handlers sont déclarés `interactive: true` dans le registre (Lot 2) — jamais résolus par le
balayage automatique `sweepDueEcheances`, toujours via `resolveEcheanceNow` (Lot 2,
`PLAN_FATIGUE_DOMMAGES.md` §8), appelée dès qu'une réponse MJ/joueur est connue — voir §6.

---

## 6. Flux MJ et joueurs (UI)

**v3 (2026-07-29)** : les fonctions d'orchestration (`requestGameTimeAdvance`/`confirmPendingAdvance`/
`cancelPendingAdvance`/`resolveEcheanceNow`) et le mécanisme d'avance en attente **ont déménagé dans
le Lot 2** (`PLAN_FATIGUE_DOMMAGES.md` §8) — génériques, pas propres aux blessures, un futur
consommateur interactif (ex. diagnostic de Maladies) en aura besoin aussi. Détail complet là-bas ;
ici, seul ce qui est spécifique à ce plan :
- **Chaque réponse MJ (3 issues de Guérison) ou résultat de jet joueur (Infection) appelle
  `resolveEcheanceNow` immédiatement**, dès qu'elle est connue — l'effet (case cochée, amélioration)
  s'applique tout de suite, **pas à la confirmation finale groupée**. Seul le compteur
  `game_time_minutes` attend que tout le lot soit résolu (correction 2026-07-29, l'application
  n'était pas placée au bon moment dans une version antérieure de ce paragraphe).
- `wound_healing_check`/`wound_infection_check` sont déclarées `interactive: true` dans
  `shared/echeanceTypeRegistry.js` (Lot 2) — jamais résolues par le balayage automatique.

**Écran de revue MJ** — se déclenche uniquement quand `requestGameTimeAdvance` trouve au moins une
échéance due. Remplace le seuil générique "5+ occurrences" du Lot 2 (`PLAN_FATIGUE_DOMMAGES.md` §8)
par une règle propre à ce qui menace une vie :
- **Guérison** (§3.2) : une ligne par échéance due, choix à 3 issues (Amélioration/Échec/Catastrophe).
  Légère ne apparaît jamais ici (résolution silencieuse, jamais mise en `pending_mj_review`). Pour une
  ligne Moyenne/Grave (`occurrences_remaining` nul) où le MJ choisit Échec — décision Saar 2026-07-30,
  détail §8 : case supplémentaire *"le personnage continue-t-il d'être soigné ?"* pour décider si une
  nouvelle tentative de Guérison se reprogramme. N'apparaît pas pour Critique/Mortelle (déjà
  récurrentes) ni pour Amélioration/Catastrophe.
- **Infection** (§3.3) : une ligne par échéance due, affichant **le nombre de jets nécessaires (X)**
  et un choix "Lancer automatiquement" / "Demander aux joueurs".
- **Toute échéance dont la conséquence peut tuer un PJ ou un PNJ** (Mortelle non traité, Infection
  au seuil Mortelle) — **toujours affichée**, quel que soit le nombre total d'échéances dues.
- **Affichage MJ : regroupé** (décidé Saar) — toutes les lignes dues dans un seul écran, validées
  ensemble (pas de pop-up séquentiel un par un).

**Panneau joueur "Jets en attente"** — nouvelle surface UI (n'existe pas aujourd'hui), remplie
quand le MJ choisit "Demander aux joueurs" pour une Infection (statut `awaiting_player_roll`).
Tableau récapitulatif des jets à faire, **un par un ou tous d'un coup** (choix du joueur, décidé
Saar) — réutilise le mécanisme de jet déjà en place (`DICE_ROLL`/`MACRO_ROLL`, `socketDice.js`)
plutôt qu'un nouveau protocole de jet.

### 6.1 Implémentation — état réel vérifié avant de coder (2026-07-30, corrigé après analyse à charge)

`client/src/components/GameTimeWidget.jsx` (Lot 1) appelle aujourd'hui directement l'ancienne route
`POST /:id/game-time/adjust` (`adjustGameTime`) — jamais `requestGameTimeAdvance`. Conséquence
concrète non documentée avant cette relecture : avancer le temps via l'UI actuelle **ignore
silencieusement** toute échéance interactive due (`sweepDueEcheances` ne traite que
`interactive=false` ; rien n'appelle `previewDueEcheances`) — les échéances restent `active` pour
toujours, jamais remontées au MJ. C'est le premier fil à tirer.

**Analyse à charge du 2026-07-30 — 4 trous trouvés dans la v1 de cette section, corrigés ci-dessous** :
(1) aucun événement n'informait un client qu'une blessure venait d'évoluer via Guérison/Infection
(vérifié : `woundEvolutionService.js` appelle `resolveWoundImprovement`/`resolveWoundInsertion`
**directement**, jamais via `applyWound` qui est la seule source de `WOUND_ADDED` — l'affirmation
inverse d'une version antérieure de ce paragraphe était fausse, jamais vérifiée) ; (2) l'écran de
revue MJ n'avait accès qu'à des lignes `game_echeances` brutes (`payload: { woundId }` opaque par
design Lot 2), rien d'affichable (qui, quelle blessure, quelle gravité) ; (3) un MJ ou un joueur qui
se reconnecte après l'ouverture d'une revue ne la découvre jamais (les événements ne sont émis qu'au
moment où l'état change, pas rejoués à la connexion) ; (4) le risque d'atomicité déjà trouvé et
corrigé deux fois aujourd'hui (`confirmPendingAdvance`, l'append du journal d'annulation) n'était pas
rappelé assez explicitement à l'endroit où il va se reproduire (fusion de `payload` avant
`resolveEcheanceNow`).

**Routes** (`server/src/routes/campaigns.js`, `requireAuth` déjà en place sur le routeur ; **invariant
explicite** : chaque route `:echeanceId` vérifie `game_echeances.campaign_id === :id` avant tout appel
de service — un GM d'une campagne ne doit jamais pouvoir agir sur l'échéance d'une autre) :
- `GET /:id/game-echeances/pending-review` (`requireRole('gm')`) — lecture seule, **enrichit**
  `previewDueEcheances`/l'état `pending_mj_review`/`awaiting_player_roll` par une jointure
  `game_echeances → character_wounds → characters` (nom, Localisation, gravité, nombre de cases sur
  la ligne) : le Lot 2 générique reste agnostique du métier (son contrat ne change pas), l'enrichissement
  est une responsabilité du domaine Blessures, faite ici. Appelée au montage de `BlessuresReviewPanel`
  **et** à la reconnexion (corrige le trou 3) — pas seulement poussée par événement.
- `GET /:id/game-echeances/my-pending-rolls` (`requireAuth`, tout membre) — même enrichissement,
  filtré aux échéances `awaiting_player_roll` dont le personnage appartient à l'appelant (ou tout si
  GM). Appelée au montage de `PendingRollsPanel` — corrige le trou 3 côté joueur.
- `POST /:id/game-time/request-advance` (`requireRole('gm')`) — remplace l'usage actuel de
  `/game-time/adjust` par le widget. Body `{ minutes }` identique à l'existant. Réponse :
  `{ pending: false, displayedAfter, ... }` (chemin rapide, comportement inchangé pour le widget) ou
  `{ pending: true }` (revue nécessaire — le détail vient de `pending-review` ci-dessus, pas dupliqué
  dans cette réponse).
- `POST /:id/game-time/confirm-advance` / `POST /:id/game-time/cancel-advance` (`requireRole('gm')`,
  sans body) — appellent directement `confirmPendingAdvance`/`cancelPendingAdvance`.
- `POST /:id/game-echeances/:echeanceId/healing-choice` (`requireRole('gm')`) — body
  `{ mjChoice, soinsContinues? }`. **Fusion atomique obligatoire** (corrige le trou 4) :
  `UPDATE game_echeances SET payload = payload || ?::jsonb WHERE id=?` dans la transaction qui
  précède `resolveEcheanceNow`, jamais un lire-en-JS-puis-écrire — même patron que
  `pending_advance_undo_log` (`echeanceService.js`) et le merge `settings` (`campaigns.js`).
- `POST /:id/game-echeances/:echeanceId/infection-mode` (`requireRole('gm')`) — body
  `{ mode: 'auto' | 'player' }`. `auto` : calcule le seuil (`computeWoundInfectionThreshold`), appelle
  `resolvePolarisTest`, fusionne le résultat dans `payload.rollResult` (même règle d'atomicité),
  `resolveEcheanceNow` immédiatement. `player` : bascule l'échéance `awaiting_player_roll`, ne résout
  rien.

**Après `resolveEcheanceNow` (les 3 chemins : `healing-choice`, `infection-mode: auto`,
`WOUND_INFECTION_ROLL` ci-dessous) — corrige le trou 1, révisé après vérification supplémentaire** :
`WOUND_UPDATED` **existe déjà** (`shared/events.js:64`, `{ characterId, wound, worst_wound_severity }`,
émis aujourd'hui par la stabilisation manuelle) — pas un nouvel événement à créer, une simple
réutilisation. Mieux : son consommateur client (`useCharacterSocket.js:22-28`) est **déjà entièrement
générique** — il ignore `wound`, ne lit que `characterId`/`worst_wound_severity`, et refetch
systématiquement `/char-sheet/:characterId/wounds`. Conséquence concrète : **zéro nouveau code client
nécessaire pour que les fiches personnage se resynchronisent** après une résolution — juste émettre
cet événement déjà câblé depuis les 3 chemins serveur. Corrige au passage une erreur de la version
précédente de ce paragraphe, qui proposait de créer un `WOUND_UPDATED` en pensant l'événement
inexistant (jamais vérifié contre `shared/events.js` à ce moment-là).

**Jet joueur — socket, pas REST** (`.claude/rules/dice.md` : le serveur reste autoritaire sur tout
jet, protocole `shared/events.js`/Socket.IO, jamais une route REST séparée pour "lancer un dé") :
nouvel événement `WOUND_INFECTION_ROLL` (client→serveur, `{ echeanceId }`) dans `socketDice.js`.
**Précision (corrige la sous-estimation initiale)** : ce n'est pas un handler "à côté de `MACRO_ROLL`"
— `MACRO_ROLL`/`DICE_ROLL` sont purement d'affichage (vérifié `socketDice.js:21-60`, aucune mutation
de `character_wounds`), alors que ce handler doit lancer le dé **et** muter l'état (`resolveEcheanceNow`)
**et** notifier — plus proche en forme d'un handler de combat (`confirmMeleeDefense`) que de
`MACRO_ROLL`. Vérifie que l'appelant est bien le propriétaire du personnage concerné ou le MJ (garde
`isOwner = character.user_id === req.user.id`, même principe que `router.param('characterId')` de
`char-sheet.js`, adapté au contexte socket — `user`/`isGm` déjà disponibles dans
`registerDiceHandlers(io, socket, { campaignId, user, isGm })`).

**Nouveaux événements** (`shared/events.js`, patron `domaine:action` déjà en usage — seuls 3 sont
réellement nouveaux, `WOUND_UPDATED` existe déjà et se réutilise tel quel, voir ci-dessus) :
- `CAMPAIGN_ADVANCE_PENDING` (serveur → room) — signal léger qu'une revue vient de s'ouvrir (pas le
  détail, voir `pending-review` ci-dessus) ; les clients déjà connectés l'utilisent pour ouvrir
  `BlessuresReviewPanel`, un client qui se (re)connecte plus tard s'appuie sur `pending-review` au
  montage, pas sur cet événement (corrige le trou 3).
- `GAME_ECHEANCE_RESOLVED` (serveur → room, `{ echeanceId }`) — l'écran de revue MJ et le panneau
  joueur retirent la ligne en direct. Ne transporte jamais l'état de blessure (couvert séparément par
  `WOUND_UPDATED`, réutilisé — deux préoccupations distinctes, pas mélangées dans un seul événement).
- `CAMPAIGN_ADVANCE_RESOLVED` / `CAMPAIGN_ADVANCE_CANCELLED` (serveur → room) — transportent la liste
  des `characterId` touchés par le lot, pour qu'une fiche personnage ouverte revérifie son état même
  si elle a raté un `WOUND_UPDATED` individuel (filet de sécurité, pas la source principale de mise à
  jour).

**Composants client** (nouveaux) :
- `client/src/components/BlessuresReviewPanel.jsx` — écran de revue MJ groupé (§6), charge son
  contenu via `GET pending-review` au montage **et** à la réception de `CAMPAIGN_ADVANCE_PENDING`,
  mis à jour en direct par `GAME_ECHEANCE_RESOLVED`, boutons Confirmer/Annuler en pied d'écran.
  **"Contexte RAW" (§3.2, tranché Saar 2026-07-30)** : pas de donnée à modéliser — 3 champs éphémères
  purement client (jamais envoyés au serveur, jamais stockés, remis à zéro à chaque ligne), affichés
  à côté des 3 boutons Amélioration/Échec/Catastrophe pour aider le MJ à se décider, jamais à calculer
  à sa place (cohérent avec la décision déjà actée) : **Soin** (oui/non), **Médecin** (oui/non — si
  oui, sélecteur du personnage qui l'incarne, purement informatif/narratif), **Matériel** (oui/non).
  Pas de nouveau champ `payload`, aucun changement côté routes/services déjà planifiés ci-dessus.
  Un patron d'état partagé UI (store dédié ou extension `useCampaignStore`, voir plus bas) reste
  nécessaire pour ouvrir ce panneau depuis `GameTimeWidget.jsx` — aucun patron de modale globale
  n'existe encore dans le projet (vérifié, `.claude/rules/react.md` : "les stores contiennent l'état
  partagé" justifie cette direction plutôt que d'en inventer une autre).
- `client/src/components/PendingRollsPanel.jsx` — panneau joueur "Jets en attente", charge via
  `GET my-pending-rolls` au montage, un par un ou tous d'un coup, émet `WOUND_INFECTION_ROLL`.
- `GameTimeWidget.jsx` modifié : `adjust()` appelle `request-advance` au lieu de `adjust` ; sur
  `pending:true`, ouvre `BlessuresReviewPanel` au lieu de considérer l'action terminée.

**Points à confirmer avant/pendant le codage, pas bloquants pour démarrer par les routes** :
1. Granularité exacte de `CAMPAIGN_ADVANCE_RESOLVED`/`CANCELLED` (liste de `characterId` suffit-elle
   comme filet de sécurité, ou faut-il aussi la liste des `woundId`) — à trancher en codant le client.
2. Emplacement exact de `BlessuresReviewPanel`/`PendingRollsPanel` dans l'UI (modale, panneau latéral
   fixe, onglet dédié) — décision d'ergonomie, pas d'architecture.

---

## 7. Hors périmètre explicite

- **Stabilisation minute-scale (§3.1)** — cadence trop rapide pour l'échéancier de campagne (le MJ
  avance le temps par grands sauts narratifs, pas minute par minute). Mécanisme séparé à concevoir
  plus tard (probablement adossé aux Tours de combat ou à un minuteur de scène dédié), pas ce lot.
- **Suractivité (§3.4)** — outil manuel MJ, jamais automatisé.
- **Simplification PNJ mineurs** (RAW `:207-224`, optionnelle) — non traitée, le MJ peut déjà
  l'appliquer manuellement en ignorant le détail des cases.
- **Conséquence mécanique de "mort"** (via le pire résultat de l'Infection, §3.3) — narrative
  uniquement, aucun statut de personnage à construire dans ce lot. L'échéancier détecte et signale
  au MJ (§6), jamais n'applique.

---

## 8. Points ouverts pour la cuisson avec Saar

Qui tente le Test, matériel médical, seuil d'aperçu, modélisation de "Membre détruit", affichage MJ
séquentiel/groupé, flux d'avance en attente (v2) : **résolus**, voir §3.2/§3.3/§4.1/§6, décisions du
2026-07-29. "Membre détruit" est différé en Option de campagne future (`docs/ROADMAP.md`), pas
modélisé dans ce lot.

**Trois propositions — tranchées avec Saar le 2026-07-30**, aucune n'a changé la conception déjà
écrite ailleurs dans ce plan (§3.2/§3.3/§5 mis à jour en conséquence) :

1. (§3.3) Le délai de survie en heures (Mortelle/Membre détruit non soigné) traité comme information
   affichée plutôt que comme une 3ᵉ échéance programmée. **Confirmé** — cohérent avec le traitement
   déjà établi de la Stabilisation (§3.1) et de la Noyade (`PLAN_FATIGUE_DOMMAGES.md` Lot 6).
2. (§3.2) Un Échec sur la Guérison déclenche un Test d'Infection **avec un vrai jet** (auto/joueurs,
   comme l'Infection normale). **Confirmé** — relecture RAW (`:396-398`) : ce n'était pas une simple
   analogie, le texte nomme littéralement *"un (et un seul) Test de Constitution"*, le même acte que
   l'Infection §3.3.
3. (§3.2) Une Catastrophe bascule sur le rythme de l'Infection pour **la semaine en cours seulement**,
   pas pour le reste de toute la durée de guérison. **Confirmé** (lecture A) — le texte RAW ("la
   période de guérison en cours") reste réellement ambigu entre deux lectures possibles (voir détail
   §3.2), Saar tranche pour la portée la plus locale, cohérente avec le vocabulaire de la phrase Échec
   adjacente.

**Corrections techniques appliquées (analyse à charge combinée des deux plans, 2026-07-30, avant tout
code)** — pas des décisions produit, donc appliquées directement :
- Ancrage de `character_wounds.occurred_at_game_minutes` déplacé du compteur affiché
  (`campaigns.game_time_minutes`) vers le compteur résolu (`campaigns.game_time_resolved_minutes`) —
  détail et scénario de bug évité en §4.
- `pending_advance_undo_log` (Lot 2) : l'append d'`undoEntries` par `resolveEcheanceNow` doit passer
  par une expression SQL atomique (`||` jsonb), jamais un lire-puis-écrire JS — détail en
  `PLAN_FATIGUE_DOMMAGES.md` §8.

**Point tranché (Saar, 2026-07-30)** : pour Moyenne/Grave (échéance de Guérison **unique**, non
récurrente), un Échec **suivi d'un Test d'Infection réussi** (donc la blessure n'empire pas non plus)
ne doit pas laisser la blessure bloquée à cette gravité indéfiniment — **une nouvelle échéance de
Guérison se reprogramme automatiquement si le personnage continue d'être soigné.** Concrètement, ne
demande aucun mécanisme nouveau côté moteur générique (Lot 2), seulement une donnée supplémentaire
dans le choix MJ pour ce cas précis :
- Dans l'écran de revue (§6), quand le MJ choisit `echec` pour un `wound_healing_check` **à
  `occurrences_remaining` nul** (le cas Moyenne/Grave, une seule occurrence par construction — ne
  concerne pas Critique/Mortelle, déjà récurrentes chaque semaine indépendamment de ce choix), une
  case à cocher supplémentaire lui est présentée : *"le personnage continue-t-il d'être soigné ?"*
  (`soinsContinues: boolean`, faux par défaut).
- `soinsContinues: true` → le handler retourne `reschedule: { intervalMinutes: <durée de la gravité,
  même table §3.2>, occurrencesRemaining: 1 }` — réutilise tel quel le mécanisme de reschedule déjà
  prévu pour Critique/Mortelle (un compteur d'occurrences qui redescend à 0), pas une 3ᵉ forme
  d'échéance : une seule nouvelle tentative est programmée, à la même durée que l'originale. Si cette
  nouvelle tentative échoue à son tour (Infection toujours évitée), le MJ retrouve le même choix —
  la boucle ne peut se poursuivre que tant que le MJ répond `soinsContinues: true`, jamais
  automatiquement.
- `soinsContinues: false` (ou case non cochée) → `reschedule: null`, l'échéance se termine
  normalement (`completed`) — cohérent avec la discrétion MJ déjà actée pour toute la Guérison (§3.2).
  Redéclencher des soins plus tard sur une blessure ainsi arrêtée reste une action MJ manuelle, hors
  périmètre de ce lot (pas de bouton dédié prévu ici).
- Une Catastrophe n'est jamais concernée par cette case : RAW la définit comme *"une absence totale
  de soins"* — `soinsContinues` y serait par construction toujours faux, la question ne se pose pas.

**Idée nouvelle notée par Saar (2026-07-30), pas encore un plan** : afficher les règles (tooltips ?)
directement dans l'interface — au-delà du périmètre de ce chantier, rejoint le chantier déjà listé
`docs/ROADMAP.md` "Ergonomie et pédagogie des règles (explication proactive des bonus/malus)", pas un
nouveau chantier séparé.

---

## 9. Validation prévue (une fois codé)

- Tests Node ciblés sur `resolveWoundImprovement` (symétrique de `resolveWoundInsertion` déjà
  testé implicitement en production) et sur les deux handlers (`wound_healing_check`/
  `wound_infection_check`), cas limites : Légère qui guérit seule sans Test, Catastrophe qui bascule
  la Guérison vers l'Infection, cumul du malus d'Infection sur plusieurs passages.
- Tests Node ciblés sur les 3 fonctions d'orchestration (§6) : `requestGameTimeAdvance` sans
  échéance due → commit immédiat identique à `adjustGameTime` seul ; avec échéance due → pas de
  commit, lot en `pending_mj_review` ; refus si un lot est déjà en attente. `confirmPendingAdvance`
  → commit correct quand tout est répondu ; refus + réouverture de la revue si une nouvelle échéance
  apparaît entre la proposition et la confirmation (scénario clé de l'analyse à charge).
  `cancelPendingAdvance` → tout repasse `active`, aucun effet appliqué même après un jet déjà lancé.
- Scénario réel : blessure Critique posée à un instant de jeu connu, avance de temps couvrant
  plusieurs échéances (guérison + infection croisées), vérifié contre un calcul à la main avant
  test navigateur par Saar.
- `docs/VOCABULARY.md` — nouvelle entrée "Guérison"/"Infection" une fois codé, avec le partage
  Stabilisation (déjà existante, distincte) / Guérison-Infection (ce plan) explicité pour éviter la
  confusion déjà relevée en cadrant ce plan.
