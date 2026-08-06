# PLAN — Catastrophe automatique en combat

> Statut : cadrage rédigé avec Saar le 2026-08-06, 3 décisions de périmètre actées (§1). **Analyse à
> charge menée le 2026-08-06 (§8)** — 3 trous trouvés et corrigés directement dans l'architecture (§4) :
> garde combat actif manquante sur un des 6 sites (`socketEntity.js` Poussée/Traction, pas scopé
> combat), file d'attente MJ mal spécifiée (risque de Catastrophes simultanées qui s'écrasent),
> persistance de l'état "en attente de validation" tranchée (nouvelle table, pas de l'éphémère client
> seul). **Lot 2 détaillé (§9)** après remise en question du découpage initial par Saar — 8 des 10
> entrées de la table sont mécanisables (pas 4), les 2 restantes (#7/#8) ont une limite RAW réelle, pas
> un renvoi au flou. Dernier point ouvert vérifié le 2026-08-06 : `measureBattlemapTokenDistance`
> (`worldSpatialQueryService.js`) confirme #3 (Mauvaise cible) mécanisable sans nouvelle math spatiale.
> **2ᵉ passe d'analyse à charge (2026-08-06, §8)** : 4ᵉ trou trouvé — `MACRO_ROLL` calculait
> `catastropheRisk` sans jamais l'émettre au client (`socketDice.js:203-235`), invisible au mécanisme
> indépendamment de la garde combat actif. Décision Saar : `MACRO_ROLL` devient un **7ᵉ site**, sous la
> même garde combat actif. Forme de l'override MJ fixée (numéro d'entrée 1-10 alternatif, pas de
> saisie libre) ; table confirmée applicable identiquement attaquant/défenseur.
> **3ᵉ passe (2026-08-06, ciblée Lot 1)** : vrai handler `COMBAT_END` localisé
> (`socketCombatState.js:173-252`, pas la ligne citée par erreur précédemment) — donne la définition
> exacte de "combat actif" (existence de la ligne `combat_state`, pas une valeur de `phase`) et le
> point d'accroche précis de la purge (`:248-250`). Schéma `pending_catastrophes` complété (`id`, FK,
> `applied_entry` distinct du jet original, `resolved_by`), idempotence de `CATASTROPHE_RESOLVE`
> (`WHERE resolved_at IS NULL`) et garde GM-only ajoutées. `catastropheEffectTable.js` corrigé pour
> suivre le patron clé/i18n de `MR_TABLE` (jamais de FR en dur côté serveur).
> **Lot 1 ✅ codé (2026-08-06)** : `shared/catastropheEffectTable.js`, migration `234_pending_catastrophes.js`
> (appliquée en base, testée up/down), `server/src/lib/catastropheService.js`
> (`maybeTriggerCatastrophe`/`resolvePendingCatastrophe` idempotent/`purgePendingCatastrophes`),
> branché sur les 7 sites (6 `socketCombatHelpers.js`/`socketEntity.js` + `MACRO_ROLL` corrigé pour
> émettre enfin `catastropheRisk`), `socketCatastrophe.js` (validation MJ), resync SESSION_JOIN,
> purge `COMBAT_END` (`socketCombatState.js:248-250`), `CatastropheReviewQueue.jsx` (file MJ, montée
> dans `SessionPage.jsx`). 7 tests Node passent en conditions réelles (PostgreSQL).
> **Bug trouvé et corrigé en relisant le code après coup** : `override` (choix MJ) n'était jamais
> validé côté serveur — une valeur hors 1-10 committait la résolution puis plantait sur
> `findCatastropheEntry(undefined)`, laissant la ligne résolue avec un `applied_entry` invalide,
> irrécupérable. Corrigé (`AppError` avant toute écriture) + test de régression, 8/8 tests verts.
> **✅ Chantier clos ici, décision Saar (2026-08-06) : les Lots 2/3 ne seront pas codés.** Les 10
> entrées de la table restent **définitivement narratives** — le jet 1D10 et la persistance sont
> automatiques, le MJ confirme/override puis applique lui-même la conséquence à la main, pour toujours,
> pas une étape en attendant un futur Lot. Écart assumé par rapport à la décision 2 du §1
> ("automatisation complète visée") — décision explicite et documentée, pas un abandon silencieux.
> `docs/SYSTEME/COMBAT.md` §"Résolution des Tests" mis à jour en conséquence. §9 (détail Lot 2) et §6
> (découpage en lots) restent dans ce document comme trace de la conception envisagée, **non
> exécutée** — à lire comme un historique, pas une TODO.
> Source RAW : `docs/REGLES/REGLESYSCOMBAT.md:714-743` (table 1D10 "CATASTROPHES EN COMBAT",
> p.219-220) ; `shared/polarisTestResolution.js` (`catastropheRisk`, autorité déjà existante du flag,
> issue de `docs/Old/PLAN_TEST_CRITIQUE.md`). Autorité supérieure à ce plan — en cas de contradiction,
> RAW gagne (`RegleDocumentaire.md` Règle 12).
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — archivé dans `docs/Old/` à la clôture,
> contenu durable transféré vers `docs/SYSTEME/COMBAT.md` §"Résolution des Tests" (fait, même commit).

---

## 1. Décisions actées (cadrage avec Saar, 2026-08-06)

1. **Portée : combat uniquement.** Hors combat, la Catastrophe reste narrative/MJ — le RAW n'y donne
   aucune table de conséquences, seulement "décision MJ" générique. Hors périmètre de ce chantier,
   pas à automatiser.
2. **Automatisation complète visée, mais toujours filtrée par une validation MJ préalable.** Le
   moteur jette et propose un résultat ; le MJ peut le confirmer tel quel ou reprendre la main
   (override) avant qu'il ne s'applique réellement. **Jamais un effet qui s'applique sans passage
   MJ** — même en "automatisation complète".
3. **v1 = uniquement la table générique 1D10** (`REGLESYSCOMBAT.md:714-743`), appliquée à tout Test
   de combat en Catastrophe. Les overrides RAW spécifiques par type de Test (Adaptation, Commandement,
   Arts martiaux, chaque pouvoir Polaris...) sont **explicitement différés à une suite** — ne pas les
   construire dans ce chantier, ne pas les bloquer non plus.

---

## 2. RAW — la table (citation intégrale, `REGLESYSCOMBAT.md:714-743`, p.219-220)

> *"Obtenir une Catastrophe en combat n'est jamais une bonne nouvelle. Voici quelques exemples de
> conséquences possibles, **en plus de l'échec de l'action**, pour pimenter un peu la situation
> (lancez 1D10 et n'hésitez pas à adapter selon la situation) :"*

| 1D10 | Nom | Effet |
|---|---|---|
| 1 | Maladresse | Le personnage perd toutes ses actions pendant le Tour suivant. |
| 2 | Arme inutilisable | Tombe au sol (armes blanches), s'enraye (armes à feu), ou se casse (mauvaise qualité, cordes d'arc/arbalète) — peut aussi faire perdre le bouclier. |
| 3 | Mauvaise cible | Touche une autre cible que celle visée (la plus proche, allié ou ennemi). |
| 4 | Oups ! | Le personnage s'inflige lui-même des dommages (armes blanches). |
| 5 | Position désavantageuse | Tous les adversaires ont +5 pour le toucher. |
| 6 | Confusion | Malus de -5 à toutes les actions pendant 2 Tours de combat. |
| 7 | Boum ! | Surcharge, explosion d'une batterie/munition (endommage peut-être l'arme). |
| 8 | Panne d'un système | (non détaillé davantage par le RAW à cet endroit). |
| 9 | Mon œil ! | Ne voit plus rien pendant 1 Tour. |
| 10 | Déséquilibre | Trébuche ou tombe. |

**Note RAW importante** : la Catastrophe s'ajoute à l'échec normal du Test, elle ne le remplace pas —
l'action a échoué ET cette conséquence supplémentaire s'applique.

---

## 3. État réel du code (analyse à charge, 2026-08-06)

- **`catastropheRisk` est déjà calculé et déjà propagé jusqu'au client à 6 points d'appel combat** :
  `socketCombatHelpers.js:640` (défense CaC), `:1512` (attaque CaC), `:1817` (défense, 2ᵉ site),
  `:2255` (attaque drone), `:2703` (assaut/Tir), `socketEntity.js:358` (Test générique d'entité).
  **Aucune nouvelle plomberie de détection nécessaire** — le flag existe déjà partout où il faut, il
  ne manque qu'un consommateur mécanique branché après.
- **7ᵉ site trouvé (2ᵉ passe d'analyse à charge, 2026-08-06) : `MACRO_ROLL` calcule `catastropheRisk`
  mais ne l'émet jamais.** `resolvePolarisTest` (`polarisTestService.js:18-30`) le retourne bien
  (`...outcome`, hérité de `resolveTestOutcome`), mais le handler `MACRO_ROLL`
  (`socketDice.js:203-235`) ne déstructure que `isSuccess`/`isCriticalSuccess`/`isCriticalFail` — la
  valeur est calculée puis silencieusement perdue. **Décision Saar (2026-08-06)** : `MACRO_ROLL` doit
  aussi émettre `catastropheRisk`, **si et seulement si un combat est en cours** pour la campagne —
  même garde que le point d'accroche général (§4), pas une émission inconditionnelle. Tout Test de
  Compétence/Attribut résolu par macro pendant un combat (Lutte, Manœuvre d'armure, etc.) devient donc
  un site valide au même titre que les 6 autres.
- **Un seul consommateur mécanique existe aujourd'hui**, hors combat : `fatigueService.js:132-136` —
  sur un Test de Fatigue en `catastropheRisk`, applique le statut `inconscient` plutôt que `evanoui`.
  Précédent isolé (contexte Fatigue, pas la table générique combat) mais confirme que le flag est
  fiable et déjà exploité mécaniquement au moins une fois dans le projet.
- **`docs/SYSTEME/COMBAT.md:68-70` affirme aujourd'hui "jamais automatique"** — à corriger dans le
  même commit que la clôture de ce chantier (une seule autorité documentaire, jamais deux versions
  contradictoires).
- **Réutilisations déjà identifiées pour certaines entrées de la table** (à confirmer/détailler lot
  par lot, pas figé ici) :
  - **#9 "Mon œil" (aveuglé 1 Tour)** → `status_code 'blinded'` déjà réservé
    (`VALID_STATUS_CODES`, `socketToken.js:159`), jamais câblé mécaniquement — même situation que
    `asphyxia`/`hypothermia` avant leurs lots respectifs dans `PLAN_FATIGUE_DOMMAGES.md`.
  - **#10 "Déséquilibre" (tombe)** → mécanisme "à genou"/`character_states` tout juste codé
    (`KNEELING_POSITION` Lot 2, `shared/combatStatePositionCost.js`) — réutilisable tel quel, pas à
    réinventer.
  - **#6 "Confusion" (-5, 2 Tours)** → patron `token_statuses.expires_at_turn` (même famille que les
    Lots 3/5/6 de `PLAN_FATIGUE_DOMMAGES.md`) ou `activeMalusRegistry.js` (Lot 4 Fatigue) selon la
    forme retenue en détaillant le lot.
  - **#4 "Oups" (auto-dommage, armes blanches)** → pipeline `resolveTargetHit` existant, cible = le
    personnage lui-même.
  - **Les autres (#1 Maladresse, #2 Arme inutilisable, #3 Mauvaise cible, #5 Position désavantageuse,
    #7 Boum, #8 Panne d'un système)** n'ont pas de mécanisme direct identifié à ce stade — à concevoir
    lot par lot. Plusieurs sont volontairement vagues dans le RAW lui-même ("adaptez selon la
    situation") → candidates naturelles à la validation/override MJ de la décision 2 plutôt qu'une
    automatisation rigide forcée.
  - **#8 "Panne d'un système"** n'a de sens que pour un personnage qui possède des "systèmes"
    (exo-armure, drone) — sans objet pour un PJ/PNJ humain. Recoupe `PLAN_EXOARMURE.md` (chantier
    d'un autre agent, en cours) sans en dépendre : ce lot ne doit pas coupler son avancement à
    Exo-Armure, juste documenter que cette entrée reste sans effet mécanique tant qu'aucun personnage
    à "systèmes" n'existe en jeu.

---

## 4. Architecture retenue (corrigée après analyse à charge du 2026-08-06, §8 — prête à coder)

- **`shared/catastropheEffectTable.js`** (nouveau, donnée pure) — transcription RAW des 10 entrées,
  même patron que `MR_TABLE`/`EXO_CATEGORY_ORDER` : table déclarative indexée 1-10, aucune logique
  dedans. **Patron i18n identique à `getMrDegreeKey`** (`polarisTestResolution.js:51-54`, vérifié :
  *"le serveur... ne consomme jamais cette clé"*) : chaque entrée porte `{ index, key, mechanized }`
  (ex. `key: 'maladresse'`), **jamais de texte français en dur**. Le libellé/l'effet FR vivent dans
  `combat.json` (`combat.catastrophe.<key>`), résolus côté client uniquement — la table §2 de ce
  document est une citation RAW pour la lecture humaine, pas le contenu réel du fichier `shared/`.
- **`server/src/lib/catastropheService.js`** (nouveau) — `rollCatastropheEffect()` (1D10 +
  lookup table) ; `applyCatastropheEffect(entry, context)` pour les entrées mécanisables (délègue aux
  mécanismes déjà réutilisés, §3) ; retourne un descripteur neutre pour les entrées narratives/vagues
  qui n'ont encore aucune mécanisation (le MJ les traite alors comme du texte, pas un no-op silencieux
  déguisé en automatisation).
- **Garde combat actif obligatoire** (corrige §8 point 1) : sur les 7 sites `catastropheRisk` (§3),
  le déclenchement automatique ne se fait **que si un combat est en cours pour la campagne**.
  **Définition exacte vérifiée (3ᵉ passe, 2026-08-06)** : le vrai handler `COMBAT_END`
  (`socketCombatState.js:173-252`, pas la ligne citée précédemment par erreur) **supprime
  entièrement** la ligne `combat_state` (`:250`) — donc "combat actif" = *une ligne `combat_state`
  existe pour cette `campaign_id`*, pas une valeur de `phase` précise à tester. `socketEntity.js:358`
  (Poussée/Traction) n'est **pas** intrinsèquement scopé combat — vérifié, aucun garde combat autour
  de ce handler — il peut se déclencher pendant l'exploration. `MACRO_ROLL` (`socketDice.js`) non
  plus : c'est le point d'entrée générique de tout Test joueur, combat ou pas. Sans cette vérification
  explicite sur les deux, ils violeraient la décision 1 (hors combat = narratif, hors scope). Le point
  d'accroche doit donc être : `if (await db('combat_state').where({campaign_id}).first()) { ... }`,
  jamais un simple branchement sur les sites en soi — et c'est cette même garde qui conditionne
  l'émission de `catastropheRisk` par `MACRO_ROLL` (point précédent), pas une émission inconditionnelle
  suivie d'un filtre après coup.
- **Purge à `COMBAT_END` — point d'accroche exact** : `socketCombatState.js:248-250`, dans la même
  séquence que `combat_pending`/`combat_roster`/`combat_state` (`DELETE FROM pending_catastrophes
  WHERE campaign_id = ?`, juste avant ou après ces trois lignes). Le même handler nettoie déjà
  explicitement `stunned`/`unconscious` (`:192-211`, liste fermée) — **note pour Lot 2** : les futurs
  codes `clumsy`/`exposed` (§9.2/§9.3) devront être ajoutés à cette même liste quand ils existeront,
  sinon ils survivraient artificiellement à la fin du combat (risque faible vu leur courte durée, mais
  à ne pas oublier).
- **Forme de l'override MJ fixée** : `CATASTROPHE_RESOLVE` transporte `{ pendingId, override }` où
  `override` est **un numéro d'entrée 1-10 alternatif** (nullable — absent = le MJ confirme l'entrée
  tirée telle quelle), jamais une saisie libre. Le MJ reste dans le même catalogue fermé que le jet
  automatique — pas une deuxième mécanique de résolution à côté de la table.
- **Table appliquée identiquement à l'attaquant et au défenseur** — confirmé cohérent avec le texte
  RAW (§2), qui parle de "le personnage" de façon générique, jamais "l'attaquant" spécifiquement. Une
  Catastrophe sur un jet de défense roule sur la même table qu'une Catastrophe à l'attaque, aucune
  distinction de rôle à coder.
- **File d'attente MJ, persistée côté serveur — pas un slot, pas de l'éphémère client seul** (corrige
  §8 points 2 et 3) :
  - **Nouvelle table `pending_catastrophes`** — nécessaire car un même token peut générer plusieurs
    Catastrophes avant validation (jusqu'à 3 Attaques/Tour RAW, chacune peut catastropher ; attaquant
    et défenseur peuvent aussi catastropher au même échange). Un slot unique ou une colonne nullable
    sur `combat_roster` ne suffiraient pas dès qu'un deuxième jet arrive avant que le premier soit
    validé. **Schéma complet (corrigé, 3ᵉ passe 2026-08-06)** :
    - `id` (PK, `uuid`/`increments`, patron du projet)
    - `campaign_id` → `campaigns.id` `ON DELETE CASCADE`
    - `token_id` → `tokens.id` `ON DELETE CASCADE`
    - `table_entry` (1-10, **immuable** — le résultat du jet 1D10 tel quel, jamais réécrit)
    - `applied_entry` (1-10, nullable) — ce qui est **réellement appliqué** après validation MJ ;
      égal à `table_entry` si le MJ confirme tel quel, différent s'il override (§4, entrée alternative
      1-10). Distinction nécessaire pour ne pas perdre la trace "jeté 3, appliqué 7".
    - `context jsonb` — forme minimale requise : `{ site, actorTokenId, targetTokenId }` (`site` =
      origine parmi les 7 sites §3, `targetTokenId` nullable si sans objet, ex. Poussée/Traction).
    - `rolled_at` (timestamp, défaut `now()`)
    - `resolved_at` (timestamp, nullable — `NULL` = en attente de validation MJ)
    - `resolved_by` (→ `users.id`, nullable, `ON DELETE SET NULL`) — traçabilité MJ minimale, même
      patron que `token_statuses.applied_by`.
  - **Idempotence de `CATASTROPHE_RESOLVE`** : la résolution doit être un
    `UPDATE pending_catastrophes SET resolved_at = now(), applied_entry = ? WHERE id = ? AND
    resolved_at IS NULL RETURNING *` — si aucune ligne n'est retournée (déjà résolue par un autre
    onglet/co-MJ), rejeter silencieusement côté serveur plutôt que d'appliquer l'effet une seconde
    fois. Même classe de garde que les corrections de concurrence de `PLAN_FATIGUE_DOMMAGES.md`
    Lots 1/2.
  - **Permission `CATASTROPHE_RESOLVE` — GM uniquement**, pas encore explicite avant cette passe :
    même garde `isGm`/`requireRole('gm')` que les autres actions MJ-only du projet (ex.
    `PUT /:characterId/exo`, patron `EXOARMURE`). Un joueur ne peut jamais confirmer/override sa
    propre Catastrophe.
  - **Distinction assumée avec `EnvironmentalResultQueue.jsx`** (Lot 5 Froid, patron initialement
    envisagé pour la file MJ) : ce composant est **display-only, purement client, `useState([])`
    éphémère** — il notifie un dégât déjà appliqué, rien ne dépend de sa survie à un rafraîchissement.
    Ici, la mutation réelle (effet de la Catastrophe) est **suspendue à la validation MJ elle-même** —
    perdre l'entrée en mémoire côté client sans persistance serveur ferait disparaître silencieusement
    une Catastrophe jamais résolue, jamais rejouée. D'où la persistance serveur : le patron d'UI file
    (tableau, jamais un slot qui écrase) est repris de `EnvironmentalResultQueue.jsx`, mais la source
    de vérité est la table `pending_catastrophes`, rechargée au montage/reconnexion, pas un état
    React local.
  - **Purge à `COMBAT_END`** : toute ligne `pending_catastrophes` non résolue à la fin du combat est
    supprimée (cohérent avec `combat_roster`, qui ne survit pas non plus à `COMBAT_END`) — pas de
    Catastrophe combat qui traîne dans un combat suivant, contrairement aux statuts environnementaux
    du Lot 3 (mécanisme différent, décision différente, assumée).
  - Nouveau composant client `CatastropheReviewQueue.jsx` (MJ uniquement) — charge les lignes
    `pending_catastrophes` actives au montage + écoute un nouvel événement WS
    (`CATASTROPHE_PENDING`), affiche la file réelle (jamais un seul élément), boutons
    Confirmer/Override par entrée.
- **Jamais d'application directe sans passage MJ** (décision 2) — le jet 1D10 est automatique et
  persisté immédiatement ; l'application de la conséquence n'a lieu qu'après confirmation/override MJ
  via de nouveaux événements dédiés (pas `COMBAT_DAMAGE_CONFIRM`, rôle différent — celui-ci déclenche
  un calcul PJ→serveur, alors qu'ici le résultat est déjà connu, seule la validation MJ→serveur reste
  à faire). Trois événements nouveaux (`shared/events.js`, patron `combat:*` déjà en place) :
  - `CATASTROPHE_PENDING` (`combat:catastrophe_pending`) — serveur → room (filtré MJ côté client,
    même patron que les autres events GM-only) : nouvelle entrée à valider, insérée dans la file.
  - `CATASTROPHE_RESOLVE` (`combat:catastrophe_resolve`) — MJ → serveur : `{ pendingId, override }`
    (`override` nullable — MJ confirme l'entrée tirée si absent, ou fournit son propre choix
    d'entrée/effet si présent).
  - `CATASTROPHE_APPLIED` (`combat:catastrophe_applied`) — serveur → room : effet réellement appliqué,
    une fois la validation MJ reçue — c'est cet event, pas `CATASTROPHE_PENDING`, que consomment les
    éventuels futurs affichages joueur.
- **Test de Choc explicitement hors mécanisme** (corrige §8 note mineure) : `resolveTestOutcome` ne
  couvre jamais le Test de Choc (exclusion déjà actée dans `docs/Old/PLAN_TEST_CRITIQUE.md`, mécanique
  à 2 seuils graduée, structurellement différente) — aucune Catastrophe automatique n'en découle,
  cohérence confirmée, rien à construire pour ce cas.

---

## 5. Hors périmètre de ce chantier

- Catastrophe hors combat (décision 1) — reste narrative/MJ pur, non touché.
- Overrides RAW par type de Test (Adaptation, Commandement, Arts martiaux) et par pouvoir Polaris
  (décision 3) — suite éventuelle, pas ce chantier.
- Toute mécanique dont le seul consommateur potentiel n'existe pas encore ailleurs dans le projet
  (ex. #8 "Panne d'un système" pour une exo-armure) — ne pas coupler ce chantier à l'avancement de
  `PLAN_EXOARMURE.md`, mené par un autre agent.

---

## 6. Découpage en lots (proposition initiale, à affiner en détaillant chaque lot)

- **Lot 1 — Moteur + validation MJ** : `shared/catastropheEffectTable.js`, jet 1D10 automatique
  branché sur les **7 sites** `catastropheRisk` (§3, dont le fix `socketDice.js:234-235` pour que
  `MACRO_ROLL` émette enfin la valeur, sous garde combat actif) **sous garde combat actif** (§4),
  table `pending_catastrophes` + purge à `COMBAT_END`, `CatastropheReviewQueue.jsx` (file MJ, pas un
  slot). Les entrées encore sans mécanisation (§3) restent du texte affiché au MJ, pas des effets
  appliqués — pas de stub silencieux.
- **Lot 2 — Mécanisation des 8 entrées mécanisables** (élargi après discussion Saar 2026-08-06, §9) :
  #4/#6/#9/#10 en réutilisation directe, #1/#2/#3/#5 en conception nouvelle mais entièrement
  mécanique — détail complet §9. Aucune de ces 8 entrées ne reste "texte MJ" une fois ce lot clos.
- **Lot 3 — #7 (Boum) et #8 (Panne d'un système)** : les 2 seules entrées où le RAW lui-même est
  structurellement limité (§9.5) — règle ferme choisie pour #7, no-op documenté pour #8 tant
  qu'aucun personnage à "systèmes" n'existe (dépend de `PLAN_EXOARMURE.md`, sans y être couplé).

---

## 7. Validation prévue

- Test Node ciblé sur `catastropheService` : jet 1D10 (distribution/bornes), lookup table, entrées
  mécanisables appliquent bien l'effet attendu (réutilisation confirmée, pas dupliquée).
- Vérification manuelle : Catastrophe déclenchée sur chacun des 6 sites combat existants, fenêtre de
  validation MJ (confirmer / override), non-application tant que le MJ n'a pas validé.
- Mise à jour de `docs/SYSTEME/COMBAT.md` (§"Résolution des Tests") à la clôture — retirer "jamais
  automatique", documenter le nouveau comportement.
- Nouveau concept Enclume (table de Catastrophe, validation MJ) à ajouter dans `docs/VOCABULARY.md`
  une fois codé (`CLAUDE.md` §2).

---

## 8. Analyse à charge (2026-08-06) — menée avant tout code, 3 trous trouvés et corrigés

1. **Garde combat actif manquante.** Le §3/§4 initial listait "6 sites `catastropheRisk`" comme s'ils
   étaient tous scopés combat. Vérifié contre le code réel : `socketEntity.js:358`
   (`ENTITY_ACTION_RESOLVE`) est le Test de **Poussée/Traction**, sans aucun garde `combat_state`
   autour du handler — exploitable pendant l'exploration, pas seulement en combat. Câblé tel quel,
   ce site aurait déclenché la table de Catastrophe combat hors combat, en violation directe de la
   décision 1. **Corrigé** : garde combat actif explicite ajoutée au point d'accroche (§4).
2. **File d'attente MJ mal spécifiée.** `catastropheRisk` apparaît côté attaque **et** côté défense
   CaC (`socketCombatHelpers.js:1512` et `:640`/`:1817`) — un seul échange peut produire deux jets de
   Catastrophe à valider presque simultanément. Une fenêtre à slot unique aurait fait écraser le
   premier jet par le second avant validation — même classe de bug déjà trouvée et corrigée pour
   l'affichage hors-combat du Lot 5 Froid (`EnvironmentalResultQueue.jsx`, "jamais un slot qui
   écrase"). **Corrigé** : file d'attente réelle (tableau), pas un slot (§4).
3. **Persistance de l'état "en attente" non tranchée.** Le patron initialement envisagé
   (`EnvironmentalResultQueue.jsx`) est **display-only, purement client, éphémère** — approprié
   là-bas car il ne fait que notifier un dégât déjà appliqué. Ici, l'effet de la Catastrophe est
   **suspendu à la validation MJ** : une perte d'état côté client (reconnexion, rafraîchissement)
   ferait disparaître silencieusement une Catastrophe jamais résolue. **Corrigé** : nouvelle table
   `pending_catastrophes`, source de vérité serveur, purgée à `COMBAT_END` (§4).

Note mineure confirmée sans correction nécessaire : le Test de Choc ne peut structurellement pas
produire de `catastropheRisk` (exclu de `resolveTestOutcome` depuis `docs/Old/PLAN_TEST_CRITIQUE.md`)
— rien à construire pour ce cas, ajouté en §4 pour lever toute ambiguïté future.

**2ᵉ passe (2026-08-06, même jour)** — un 4ᵉ trou trouvé après relecture de `socketDice.js`/
`polarisTestService.js`, pas couverts par la 1ʳᵉ passe :

4. **`MACRO_ROLL` calcule `catastropheRisk` sans jamais l'émettre.** `resolvePolarisTest` le retourne
   (`polarisTestService.js:18-30`), mais `socketDice.js:203-235` ne le déstructure pas dans le payload
   `MACRO_ROLL`. Tout Test de Compétence résolu par macro pendant un combat (Lutte, Manœuvre d'armure,
   etc.) était donc invisible au mécanisme, indépendamment de la garde combat actif du point 1 — le
   problème était en amont, la valeur n'atteignait jamais le client. **Décision Saar** : `MACRO_ROLL`
   devient un 7ᵉ site, sous la même garde combat actif (§3/§4).

Deux clarifications supplémentaires actées la même passe (§4) : forme de l'override MJ fixée à un
numéro d'entrée 1-10 alternatif (pas de saisie libre), et confirmation que la table s'applique
identiquement à l'attaquant et au défenseur (texte RAW générique, "le personnage").

---

## 9. Lot 2 — détail (2026-08-06, avant code)

> Cadrage demandé par Saar après remise en question du découpage initial ("pourquoi seulement 4/10
> mécanisées ?") — vérification entrée par entrée contre le code réel plutôt qu'une réponse de
> principe. Conclusion : **8 des 10 entrées sont mécanisables sans rien laisser de flou**, seules #7 et
> #8 ont une limite RAW réelle (§9.5). Décision actée avec Saar : garder le jet 1D10 complet à chaque
> Catastrophe (RAW intact, pas de dé restreint aux seules entrées déjà codées) — la fenêtre de
> validation MJ (§4) couvre déjà le cas d'une entrée pas encore mécanisée, aucun mécanisme temporaire à
> construire puis démonter au fil des lots.

### 9.1 Réutilisation directe, confirmée (aucune conception nécessaire)

- **#4 Oups** (auto-dommage, armes blanches) → `resolveTargetHit`, cible = l'attaquant lui-même.
- **#6 Confusion** (-5, 2 Tours) → `token_statuses.expires_at_turn` / `activeMalusRegistry.js`.
- **#9 Mon œil** (aveuglé 1 Tour) → `status_code 'blinded'`, déjà réservé.
- **#10 Déséquilibre** (tombe) → mécanisme "à genou"/`character_states` (`KNEELING_POSITION` Lot 2).

### 9.2 #1 Maladresse — perd toutes ses actions pendant le Tour suivant

**Vérifié** : le garde d'annonce d'action (`socketCombatAnnouncement.js:157-161`, commentaire
*"Stun guard — is_stunned lit depuis token_statuses (source unique post-Sprint 14-0)"*) bloque déjà la
déclaration d'action d'un token dont `token_statuses` porte `status_code: 'stunned'`. C'est exactement
l'effet RAW de "Maladresse".

**Décision à coder** : ne pas réutiliser `stunned` tel quel (le badge/label narratif "Étourdi" ne
correspond pas à "Maladresse" — confondrait la Catastrophe avec le système de Choc, deux origines
différentes). **Nouveau `status_code` dédié** (ex. `clumsy`), ajouté à la liste vérifiée par le même
garde (`socketCombatAnnouncement.js:157-161`, `whereIn` étendu), `expires_at_turn = currentTurn + 1`.
Aucune nouvelle logique de blocage — seulement une entrée de plus dans une liste déjà vérifiée.

### 9.3 #5 Position désavantageuse — tous les adversaires ont +5 pour toucher

**Vérifié** : `isTargetDefenseless()` (`socketCombatHelpers.js:1205-1209`, mécanisme DEF5) lit déjà
`token_statuses` (`unconscious`/`blinded`/`stunned`) pour donner à l'attaquant un Test simple +5
**sans opposition du tout**. Structure directement transposable — **mais pas le même effet RAW** :
DEF5 supprime la défense entièrement, "Position désavantageuse" ne fait qu'ajouter +5 au Test
d'opposition normal, le défenseur se défend toujours. **Ne pas ajouter ce nouveau code à la liste de
`isTargetDefenseless`** (fusionnerait deux effets RAW distincts sous une seule autorité, contraire à
`CLAUDE.md` §1.4).

**Décision à coder** : nouveau `status_code` dédié (ex. `exposed`), lu comme un bonus **additif** de
+5 côté attaquant dans le calcul du Test d'opposition (même point du pipeline qui applique déjà
`sansDefenseBonus`/DEF5 dans le breakdown, `socketCombatHelpers.js:1493`/`:2675` — un bonus sibling,
pas une fusion), sans supprimer le jet de défense du défenseur.

### 9.4 #2 Arme inutilisable — tombe / s'enraye / se casse selon le type d'arme

**Vérifié** : `ref_equipment.category` existe (`text`, migration 48) et porte déjà des valeurs
métier (`"Bouclier"`, `"Accessoires pour armes"`, confirmé par grep sur les migrations de seed) — la
distinction armes blanches/armes à feu/mauvaise qualité est donc lisible depuis une donnée déjà en
base, pas à ajouter. **Aucun état "hors service" par instance n'existe aujourd'hui** (vérifié, aucune
colonne `jammed`/`broken` trouvée sur `char_inventory`/`char_inventory_slots`) — à construire :
probablement un champ sur l'emplacement d'inventaire équipé (même table que `RELOAD-INHAND`/
`ASSAULT-CATEGORY`, `docs/BUGIDENTIFIE.md`, déjà le point de vérité pour "quelle arme est en main").
**Point à trancher en détaillant le sous-lot** : réparable (Action complexe 3 Tours, RAW le prévoit
pour l'enrayage) ou définitif pour cette instance — le RAW distingue déjà les 3 cas, le code doit
les distinguer aussi, pas un seul état binaire "cassée".

### 9.5 #3 Mauvaise cible — touche une autre cible que celle visée

**Vérifié (2026-08-06)** : `measureBattlemapTokenDistance({ sourceTokenId, targetTokenId })`
(`server/src/services/worldSpatialQueryService.js:25`) est la mesure **autoritaire** de distance
entre deux tokens (reconciliation ascenseurs, garde cross-battlemap, validation `position_space`) —
aucun calcul de distance maison à écrire, conforme à `.claude/rules/world.md` (jamais de spatial
recalculé hors du service monde). Aucun "plus proche" tout fait n'existe, mais se construit par une
boucle sur les tokens actifs de `combat_roster` (hors l'attaquant et la cible initialement visée) qui
appelle cette fonction par candidat et garde le minimum — pas de nouvelle math spatiale.

Reste propre à ce sous-lot (pas un blocage, juste à trancher en codant) : redirection du pipeline de
résolution d'attaque vers la nouvelle cible (le sous-lot le plus invasif des 4, il touche la
résolution elle-même, pas seulement l'application d'un statut après coup) — et le cas où aucun autre
token n'est présent sur la battlemap (retombe sur "Oups", #4, faute de cible de repli, RAW compatible :
un décor désert n'a personne d'autre à toucher).

### 9.6 #7 et #8 — limite RAW réelle, pas un renvoi au flou

- **#7 Boum** : RAW dit *"endommage **peut-être** l'arme au passage"* — règle ferme retenue : réutilise
  #4 (auto-dommage) systématiquement + jette pour l'état de l'arme via le mécanisme #2 (§9.4) une fois
  celui-ci codé. Dépend donc de 9.4, pas indépendant.
- **#8 Panne d'un système** : sans objet pour un PJ/PNJ humain (pas de "système" au sens RAW) — no-op
  documenté explicitement dans `catastropheEffectTable.js` (jamais un stub silencieux), mécanisable le
  jour où un personnage à systèmes existe (`PLAN_EXOARMURE.md`, sans dépendance directe ni couplage
  d'avancement).
