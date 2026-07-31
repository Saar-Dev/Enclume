# PLAN — Intégration FATIGUE&DOMMAGES.md

> Statut : Lot 0 (cadrage) tranché avec Saar 2026-07-23. **Lot 1 (Horloge de campagne) ✅ clos
> 2026-07-29** — codé, testé (fonctionnel, confirmé par Saar en navigateur), voir §7 et
> `docs/EN_COURS.md`. Analyse à charge du Lot 1 déjà clos (2026-07-29, demandée par Saar avant
> d'attaquer le Lot 2) : deux dettes trouvées, `docs/BUGIDENTIFIE.md` (`HORLOGE-TEST1`,
> `HORLOGE-OVERFLOW1`), pas de code touché. **Lot 2 (moteur générique d'échéances) : cadrage v2
> corrigé 2026-07-29** après une seconde analyse à charge (cette fois sur la v2 elle-même, avant tout
> code) — deux trous structurels trouvés et corrigés dans le texte, voir §8 points 8/9.
> **2026-07-30 — analyse à charge combinée avec `PLAN_BLESSURES_GUERISON.md`** (premier consommateur
> réel du Lot 2) : un trou de concurrence supplémentaire trouvé et corrigé (§8 point 10, append
> atomique de `pending_advance_undo_log`), plus plusieurs citations de code corrigées (signature
> `adjustGameTime`, patron `tradeService.js`, plage `char-sheet.js`, portée du patron
> `weaponModRegistry.js`) — sans impact sur l'architecture retenue.
> **2026-07-30 — Lot 2 codé et testé** : migrations `221_game_echeances.js`/
> `223_campaigns_pending_advance.js`, `shared/echeanceTypeRegistry.js`,
> `server/src/lib/echeanceService.js` (`createEcheance`/`sweepDueEcheances`/`previewDueEcheances`/
> `resolveEcheanceNow`), `server/src/lib/gameTimeService.js` (`requestGameTimeAdvance`/
> `confirmPendingAdvance`/`cancelPendingAdvance` + garde sur `adjustGameTime`, balayage automatique
> intégré dans sa transaction). **92/92 tests verts en conditions réelles** (base locale). Deux vrais
> bugs trouvés en testant, corrigés avant tout commit — non prévus par le texte du plan :
> (1) `confirmPendingAdvance` levait son AppError de refus *à l'intérieur* du `db.transaction()`,
> provoquant un `ROLLBACK` qui effaçait le marquage `pending_mj_review` d'une échéance nouvellement
> due qu'on venait de committer juste avant — corrigé en faisant retourner un descripteur d'issue par
> la transaction (qui committe toujours) plutôt que de lever depuis l'intérieur ;
> (2) l'engine ne traçait dans `undoEntries` que les mutations du *handler*, jamais sa propre
> mutation de la ligne `game_echeances` elle-même (statut/reschedule) — `cancelPendingAdvance` ne
> pouvait donc pas restaurer une échéance déjà `completed` à son état d'origine (`next_due_minutes`/
> `occurrences_remaining` perdus, pas seulement le statut) ; corrigé en faisant tracer par l'engine sa
> propre mutation, même patron générique `{ table, rowId, previousValues }` que le handler.
> Reste : routes REST/WS + tests transport (increment 5, pas encore fait), et tout consommateur réel
> (Blessures §5/§6 de `PLAN_BLESSURES_GUERISON.md`). **✅ Consommé par `PLAN_BLESSURES_GUERISON.md`
> (handlers + routes/UI + analyse à charge, tout codé et testé le 2026-07-30)** — voir ce plan pour le
> détail. **2026-07-30 — Lot 3 (Dommages environnementaux de combat) : cadrage détaillé rédigé (§9)**
> après exploration du code réel (`resolveTargetHit`, `statusService`, `startResolutionPhase`) — 2 trous
> structurels trouvés (pas de réduction d'armure générique sur `resolveTargetHit`, `fetchCibleNA`
> dupliquée en fermeture privée) et 6 points ouverts à trancher avec Saar avant tout code. Document
> temporaire (`docs/RegleDocumentaire.md`
> Règle 10) — à archiver dans `docs/Old/` une fois le chantier entier clos, contenu durable transféré
> vers `docs/SYSTEME/*.md`. **Lot 3 ✅ clos 2026-07-30** (increments A-G, testé en navigateur par
> Saar, bug d'émission `COMBAT_ATTACK_RESULT` trouvé et corrigé) — voir §9 pour le détail complet,
> commit `a48e114`.
> **2026-07-30 — Lot 4 (Fatigue) : cadrage détaillé rédigé (§10)** après relecture RAW complète
> (Test de Fatigue réel, Compteur à 6 paliers × 3 cases retrouvé Annexe p.250) + exploration du code
> réel (aucun point d'agrégation unique des modificateurs de Test, `resolveShockTest` non réutilisable
> tel quel) + recherche externe (Active Effects Foundry VTT). Décisions Saar : Test de Fatigue
> interactif (vrai jet), pas de badge token, mécanique entièrement optionnelle par campagne
> (`fatigue_enabled`). **2ᵉ passe d'analyse critique (même session)**, demandée explicitement par Saar
> (« le rework n'est pas un paramètre, la qualité si ») : agrégation de malus revue en **registre
> déclaratif** (`activeMalusRegistry.js`, patron `echeanceTypeRegistry.js`/`environmentalHazardRegistry.js`,
> pas une fonction à paramètres fixes) ; verrouillage `char_sheet.forUpdate()` ajouté (trou de
> concurrence identifié, même classe que Lot 1/Lot 2) ; **trou pré-existant trouvé et tranché (a)** —
> le système générique de macros (`MACRO_ROLL`/`macro-preview`) n'applique aujourd'hui aucun malus de
> blessure/encombrement, corrigé dans ce lot plutôt que contourné. **3ᵉ passe d'analyse critique (même
> session)** : 4 trous de plus trouvés et corrigés — le Test de Fatigue oubliait le malus actif
> (blessure/encombrement) sur son propre seuil (RAW n'exempte que le malus de palier, pas les autres,
> `calcActiveMalus` gagne un filtre `exclude`) ; `applyStunWithDuration` ne pouvait pas produire le
> statut `evanoui` (binaire fermé, vérifié dans le code) ; aucune émission WS prévue pour le résultat
> du Test (même classe de bug que Lot 3 increment G, corrigée avant d'exister cette fois) ; gate
> `fatigue_enabled` pas explicite côté serveur. Section Validation + rappel VOCABULARY.md ajoutés
> (manquaient dans les passes précédentes). **2026-07-30 — fondations codées et testées** (migration
> 227, `shared/fatigueConstants.js` 6/6, `server/src/lib/activeMalusRegistry.js` 7/7). **4ᵉ passe
> d'analyse critique** avant de câbler les 7 sites : le site fiche de personnage n'a pas la même forme
> que les 3 sites combat (deux routes séparées sommées côté client, tooltip qui décompose déjà le
> malus par source) — `calcActiveMalus` (serveur) ne s'y applique pas, corrigé en calcul client via
> `getFatigueLevelMalus` (déjà dans `shared/`), pas de nouvelle route nécessaire (`fatigue_points`
> déjà exposé par `GET /char-sheet/:id` sans changement). **5ᵉ passe** : badge Choc hors combat —
> `current_turn` ne progresse jamais hors combat, expiration en Tours impossible dans ce cas (vérifié,
> pas déjà un bug ailleurs : Lot 3 n'auto-applique jamais ce badge). Tranché Saar : comportement voulu
> en/hors combat, badge sans expiration hors combat (retrait manuel MJ) plutôt qu'un bug à corriger.
> **7ᵉ passe** : les 2 routes REST vivaient dans `campaigns.js` (scope `campaignId`) alors que
> `CharacterSheet.jsx`, seule consommatrice, n'a jamais `campaignId` — déplacées vers `char-sheet.js`
> (`req.character.campaign_id` résolu serveur, patron déjà établi par cette route family) ; clés i18n
> corrigées vers `fr.json` (`CharacterSheet.jsx` pas migré vers `charSheet.json`, vérifié). **Lot 4 codé
> intégralement** (backend + UI + case à cocher campagne, trouvée manquante après coup). **✅ Lot 4 clos
> 2026-07-30 — confirmé fonctionnel en navigateur par Saar** (case à cocher, bloc Fatigue, Test avec
> évolution palier/case, malus tooltip, Repos, macro joueur reflétant le malus de blessure). 330 tests
> (270 pass/60 skip DB, 0 échec), ESLint/build client propres. Détail : `docs/ASBUILT.md` (section
> Fatigue), `docs/EN_COURS.md` item 109.
> **2026-07-31 — Lot 5 (Froid) : 4 passes de cadrage avant tout code** (§11) — trous trouvés :
> modèle de tranches corrigé (Froid extrême n'est pas une 5ᵉ option mais Glacial répété avec un
> diviseur, `extremeSteps`), double autorité évitée (badge `hypothermia` sans payload, tranche
> uniquement dans `game_echeances`), concurrence protégée (`char_sheet.forUpdate()`), réutilisations
> confirmées (`resolveCampaignToken`, `applyModStatus`/`clearModStatus`, garde token-sans-personnage
> déjà écrit pour la Chute). **Codé** : fix des 2 trous du moteur Lot 2 (`effects` jamais propagé,
> `resolveFatigueTest` non réutilisable dans un handler), `shared/coldExposureConstants.js` (9 tests),
> `coldExposureService.js` (nouveau), routes `cold-exposure` calquées sur le patron hazards Lot 3,
> sous-formulaire `TokenStatusPanel.jsx` sur le badge `hypothermia` (déjà réservé, jamais câblé).
> **3 bugs trouvés par Saar en testant, corrigés avant clôture** : (1) `resolveTargetHit`/`applyWound`
> émet son WS de façon synchrone — jamais appelable depuis le savepoint du balayage, corrigé en
> différant l'application réelle après le commit (`applyColdDamageHits`) ; (2) le Choc du dégât
> Glacial dépendait du Stun Dialog combat (fenêtre unique, jamais montée hors combat) — corrigé en
> résolution automatique, même patron que la Fatigue palier 5 ; (3) aucune file d'attente pour
> l'affichage hors combat — nouveau composant `EnvironmentalResultQueue.jsx`, toujours monté,
> vrai tableau, jamais un slot qui écrase (bénéficie aussi à Feu/Acide/Décompression). **✅ Lot 5 clos
> 2026-07-31 — confirmé fonctionnel en navigateur par Saar** (déclaration/tranches, dégâts Glacial
> escaladés sur plusieurs personnages, file d'attente vérifiée). Écart RAW explicite et documenté
> (§11) : le rattrapage d'un grand saut de temps s'étale sur plusieurs avances plutôt qu'en une seule
> fois — confirmé souhaité par Saar après explication, pas un raccourci silencieux. Détail complet :
> §11, `docs/EN_COURS.md` item 110.
> Source : `docs/REGLES/FATIGUE&DOMMAGES.md` (extrait Livre de Base Polaris, p.242-251).

---

## 1. Ce que couvre réellement le fichier source

Le fichier n'est pas un système unique : c'est le chapitre annexe complet « États de santé » du
Livre de Base, 9 sous-thèmes indépendants (mécaniques et jauges séparées) :

1. Acide, Chutes, Décompression, Hyperventilation
2. **Dommages étourdissants et assommants (Choc)** — ⚠️ hors périmètre, voir §2
3. Faim et soif
4. Feu
5. Froid (+ Blessures dues au feu/gel, optionnel)
6. Noyade/Asphyxie
7. Maladies et poisons (jauge 0-30, contamination, évolution, traitement)
8. Drogues (jauge d'intoxication + Narco-dommages + Accoutumance + Manque)
9. Irradiations (jauge 0-30 + accumulation permanente)
10. Fatigue (règle avancée) — états, compteur à cases, tests MJ-discrétionnaires

---

## 2. Hors périmètre explicite

**Choc/Assommant (item 2 ci-dessus) : déjà un chantier actif séparé.** `docs/EN_COURS.md` porte
actuellement le verrou `🔒 En cours (Claude) : Palier 1 CHOC1` (codé, en attente du test navigateur
de Saar). Ce plan ne le retouche pas et ne le reséquence pas — une fois CHOC1 clos, sa doc durable
ira dans `docs/SYSTEME/COMBAT.md`, pas ici.

---

## 3. Fondations déjà en place (réutilisables, pas à reconstruire)

- **Moteur de blessures physiques** (`docs/REGLES/REGLEBLESSURES.md`, `damageService.js`,
  `resolveTargetHit`) : seuils 5/10/15/20/25/30, localisation, réduction d'armure (RD). Les sources
  de dégâts physiques ponctuelles (Acide, Chute, Décompression) s'y branchent nativement.
- **Attributs de résistance secondaires déjà calculés et branchés mutations/avantages** :
  `resistance_dommages`, `resistance_drogues`, `resistance_poison`, `resistance_maladie`,
  `resistance_radiation`. **Correction 2026-07-30** (citation vérifiée contre le code réel) : les
  fonctions (`calcResistanceNaturelle`, `getMutationModForResistance`/`getAdvantageModForResistance`)
  vivent dans `shared/polarisUtils.js` (`:72`, `:89`, `:176`), pas dans `char-sheet.js`/`charStats.js`
  comme le laissait supposer une version antérieure de cette puce — `char-sheet.js` les importe
  seulement. Leur seul point d'appel réel aujourd'hui est `char-sheet.js:1304-1308`, à l'intérieur de
  la route étroite `POST /:characterId/macro-preview` (aperçu de macro joueur), pas la plage
  `1245-1289` citée précédemment (qui ne couvre que le tableau de labels `secondary`). Nuance pour la
  suite : ces résistances ne sont donc **pas** déjà exposées comme un champ général de la fiche —
  Lot 7+ (Maladies/Poisons) devra importer ces fonctions depuis `shared/polarisUtils.js` dans un
  nouveau contexte de service, pas réutiliser un calcul déjà branché ailleurs sur la fiche. Rien à
  ajouter côté **schéma** de fiche personnage pour ces attributs (ils se calculent à la volée depuis
  des données déjà présentes) — seul le moteur de jauge qui les consomme reste à construire.
- **Souffle** (`calcSouffle`, déjà utilisé en combat sous-marin) : ressource prête pour
  Noyade/Asphyxie.
- **Badges de statut au-dessus du token** : `token_statuses` (migration 68/79), `statusService.js`,
  `TokenStatusPanel.jsx`, affichage `Canvas3D.jsx` — système déjà vivant pour Étourdi/Inconscient.
  La Fatigue doit s'y greffer (nouveau `status_code`) plutôt que créer un second système d'icônes.
  Limite actuelle : expiration en **Tours de combat**, alors que Fatigue/Maladie/Poison/Drogue/
  Irradiation sont des états **de personnage**, persistants hors combat, en **temps de jeu**
  (heures/jours) — d'où le besoin d'une horloge de campagne (Lot 1) et d'une jauge propre au
  personnage (Lot 2), `token_statuses` ne portant que l'affichage/le badge, jamais la jauge elle-même.

---

## 4. Décisions tranchées (Lot 0, 2026-07-23)

1. **Malus de Fatigue : le chapitre Fatigue (p.243) fait autorité**, pas les valeurs citées en
   passant dans Maladies/Irradiations. Barème retenu : Légèrement fatigué -3, Fatigué -5, Très
   fatigué -7, Épuisé -10, À bout de force -10 (+ Test de Résistance au Choc à chaque action
   fatigante à ce dernier palier).
2. **Fatigue : déclenchement narratif/manuel, effets automatiques.** Ni test de fatigue automatique
   sur une cadence fixe, ni progression automatique — c'est le MJ (ou un effet d'un autre sous-thème :
   Froid, Maladie, Poison, Irradiation) qui pose ou fait avancer le niveau. Une fois le niveau posé,
   le malus et le badge (voir §3) s'appliquent automatiquement, sans ressaisie.
3. **Horloge de campagne : retenue, avec balayage automatique complet** (revirement par rapport au
   Lot 0 initial qui envisageait de laisser Faim/soif de côté). Le MJ avance le temps de jeu par
   incréments explicites (+1h/+6h/+1 jour/+1 semaine...) via une action dédiée — jamais un minuteur
   réel. Chaque avance déclenche un balayage automatique de toutes les affections actives de tous
   les personnages de la campagne dont l'échéance est atteinte (jets d'évolution compris), avec un
   résumé des changements présenté au MJ. Cette horloge devient une fondation transversale : elle
   sert Feu/Froid (durée d'exposition), Maladies/Poisons (évolution périodique), Drogues
   (durée/Manque), Irradiations (exposition prolongée), Fatigue (temps de repos/récupération) et
   Faim/soif (effets hebdo/mensuels, réintégrée au périmètre grâce à cette décision).
4. **Priorité relative : aucune préférence de Saar.** L'ordre proposé au §5 reste la référence par
   défaut, ajustable en cours de route.

---

## 5. Lots proposés (séquentiels — un seul actif à la fois, §5/§6 `CLAUDE.md`)

| Lot | Contenu | Taille | Dépend de | Notes |
|---|---|---|---|---|
| 0 | Cadrage — clos | — | — | décisions ci-dessus |
| 1 | **Horloge de campagne** (fondation) — détail §7 | M | Lot 0 | ✅ clos 2026-07-29, testé par Saar |
| 2 | **Moteur générique d'échéances de jeu** (fondation) — détail §8 | L | Lot 1 | structurant, planifié |
| 3 | Dommages environnementaux de combat : Chute (ponctuel) + Acide/Décompression/Feu (récurrents/Tour) — détail §9 | M | Lot 0 | indépendant de l'horloge, réutilise le moteur de blessures + le tick `onTurnStart` existant |
| 4 | **Fatigue** (fondation d'effet, avancée exprès) — détail §10 | M | Lot 0 | fournit le point d'entrée partagé consommé par 5/7/8/9/10 — construit avant ses émetteurs pour éviter tout stub temporaire |
| 5 | Froid — détail §11 | M | Lot 1, 2, 4 | seul danger environnemental à échelle "heures de jeu réel", pas Tour de combat |
| 6 | Noyade/Asphyxie — détail §12 | S | Lot 0 | consomme Souffle + `statusService`, indépendant de l'horloge |
| 7 | Maladies et Poisons (1er consommateur du Lot 2) — détail §13 | L | Lot 2, 4 | contamination/diagnostic/traitement + catalogue d'exemples RAW |
| 8 | Drogues (2e consommateur) — détail §14 | L | Lot 2, 4, bénéficie de Lot 7 | ajoute Narco-dommages, Accoutumance, Manque |
| 9 | Irradiations (3e consommateur) — détail §15 | M | Lot 2, 4 | ajoute pertes de Constitution temporaires/permanentes + accumulation permanente |
| 10 | Faim et soif — détail §16 | M | Lot 2, 4, bénéficie du mécanisme de perte d'attribut posé en Lot 9 | débloqué par l'horloge |

Fatigue (Lot 4) est délibérément avancé dans la séquence : Froid/Maladies/Drogues/Irradiations/
Faim-soif *émettent* tous vers elle («le personnage devient Légèrement fatigué»). La construire
après eux forcerait soit un stub temporaire (interdit, `CLAUDE.md` §13), soit un recâblage a
posteriori de 4 lots — la construire juste après les fondations (1-2) et le lot de dégâts de combat
(3) évite les deux.

---

## 6. Hors scope de ce plan

- Choc/Assommant (§2).
- Toute UI joueur avant que Lot 1 (horloge) et Lot 2 (moteur de jauge) soient livrés et validés.

---

## 7. Lot 1 — Horloge de campagne (détail)

> Cadrage affiné avec Saar le 2026-07-23, après recherche externe puis **analyse à charge complète**
> le même jour (retour explicite de Saar : un seul lot à la fois, en profondeur). **Aucun code écrit.**

### Analyse à charge (2026-07-23) — constats et corrections

1. **Course concurrente non protégée** : `campaign_members.role` est un texte libre sans contrainte
   empêchant plusieurs `'gm'` sur une même campagne (seule contrainte : `unique(campaign_id,
   user_id)`, vérifié dans `20260329_03_campaign_members.js`) — le co-MJ est possible, donc deux
   avances concurrentes (deux MJ, ou un double-clic réseau) sont un risque réel, pas théorique.
   **Correction** : verrouiller la ligne `campaigns` (`.forUpdate()`) dans la transaction
   d'`advanceGameTime`, même patron déjà établi dans `tradeService.js` (marchand, `char_sheet`,
   `trade_offers` verrouillés avant mutation).
2. **Incohérence d'unité** entre la première proposition (corps `{minutes}`) et une version
   intermédiaire passée en quarts d'heure — jamais recorrigée jusqu'au bout (Saar l'a relevé
   2026-07-23 : le stockage était resté en quarts d'heure alors que la décision "pas de quart
   d'heure" ne visait que la saisie UI). **Correction définitive** : une seule unité partout —
   stockage, contrat d'API et UI en **minutes**, aucune conversion nulle part dans le système.
3. **Nom de colonne non conforme à la convention du projet** — le nom initial abrégeait l'unité
   (`game_time_qh`), alors que les colonnes du projet sont toujours en toutes lettres
   (`expires_at_turn`, `shock_reduced_by_armor`...). **Devenu sans objet** : l'unité est passée en
   minutes (point 2), `game_time_minutes` est déjà en toutes lettres, rien à renommer une seconde
   fois.
4. **Validation de bornes manquante** sur `calendar_start_day` (doit être dans `[1,
   calendar_days_per_year]`). **Correction** : ajouter cette validation dans le même bloc que les
   validations `action_timer_sec`/`encumbrance_multiplier` déjà présentes (`campaigns.js:224-229`).
5. **Granularité** : devenu sans objet une fois l'unité fixée à la minute (point 2 corrigé) — la
   minute est strictement plus fine que toute règle mécanique du fichier source (le seuil le plus
   fin trouvé à la relecture est "toutes les 30 minutes", palier Glacial), donc aucune justification
   de granularité "suffisante" n'est plus nécessaire : la minute couvre tout par construction.
   Conséquence à noter pour plus tard (pas traitée ici, hors périmètre de ce lot) : la raison
   initialement donnée pour exclure le compte à rebours de mort de Noyade ("5 à 7 minutes", trop fin
   pour un quart d'heure) n'est plus valable avec une minute exacte — à reconsidérer quand le Lot
   Noyade/Asphyxie sera repris en profondeur, pas une décision à prendre maintenant.
6. **Invariant de payload réseau** : tout event/réponse portant le temps transporte le compteur brut
   `game_time_minutes`, jamais une date déjà décodée (année/jour/heure) — un client avec un
   cache de config calendrier momentanément périmé afficherait sinon une date différente du serveur.
7. **Reconfiguration du calendrier en cours de campagne — vérifiée sans danger** : toute
   planification future (Lot 2) travaille en minutes écoulées, jamais en date calendaire
   absolue ; changer `calendar_start_year/day`/`calendar_days_per_year` à mi-campagne ne désynchronise
   donc aucune échéance déjà posée, seulement l'affichage. Invariant à ne jamais violer dans les lots
   futurs (aucune date calendaire absolue stockée en dur nulle part).
8. **Le MJ doit pouvoir déplacer l'horloge dans les deux sens** (décision Saar 2026-07-23) — pas
   seulement avancer. Un recul est **purement un changement d'affichage/narratif, strictement sans
   effet mécanique** : « le moteur ne gère le temps que dans un sens ». Conséquence directe pour un
   futur rejeu en avant après un recul (ex. Jour 10 → recul Jour 5 → ravance Jour 12) : le territoire
   Jour 5→10 avait déjà été mécaniquement résolu une première fois avant le recul et **ne doit
   jamais être résolu une seconde fois**, même si l'affichage donne l'impression de le retraverser.
   Une seule valeur (compteur affiché) ne peut pas encoder cette distinction — **deux compteurs sont
   nécessaires**, voir Architecture retenue ci-dessous. Confirmé par Saar : les mécaniques scope
   Tour-de-combat (Feu, Lot 3) ne sont de toute façon jamais concernées par l'horloge de campagne,
   dans aucun des deux sens — cohérent avec la séparation déjà actée (point analyse §7 "deux
   compteurs indépendants" Tour de combat / horloge).

### Questions produit — tranchées

- **Correction d'une avance erronée** : tranché différemment de ma recommandation initiale — le MJ
  doit pouvoir déplacer l'horloge librement dans les deux sens (pas de restriction "avance
  uniquement"), mais un recul reste sans aucun effet mécanique (point 8 ci-dessus).
- **Unité de saisie libre côté UI** : confirmé — minutes/heures/jours. Aucune conversion nécessaire
  entre UI et serveur : les deux partagent la même unité (minutes, signées, positif ou négatif).

### Architecture retenue

Patron aligné sur les VTT matures (Foundry VTT `game.time`/`GameTime.advance()` +
module Simple Calendar — seule autorité : un compteur brut écoulé depuis un temps zéro de
campagne ; le jour/l'année/l'heure affichés sont **calculés à la lecture**, jamais stockés en
parallèle, pour éviter toute désynchronisation. Sources : [Time and Calendar — Foundry VTT
Community Wiki](https://foundryvtt.wiki/en/development/api/time), [GameTime API — Foundry VTT v13
docs](https://foundryvtt.com/api/classes/foundry.helpers.GameTime.html), [Simple Calendar —
Foundry VTT](https://foundryvtt.com/packages/foundryvtt-simple-calendar), [updateWorldTime hook —
Foundry VTT docs](https://foundryvtt.com/api/functions/hookEvents.updateWorldTime.html).

**Décision Saar 2026-07-23, révisée 2026-07-29** : aucun nom de mois — reconfirmé le 2026-07-29 par
relecture intégrale de `REGLEPOLARIS.md`, `FATIGUE&DOMMAGES.md`, `VOCABULARY.md` et `FOUNDATION.md` :
zéro occurrence d'un nom de mois ou d'une date absolue dans tout le corpus transcrit, seulement des
durées relatives (jour/semaine/mois/année) — rien à respecter puisqu'aucune matière n'existe. En
revanche, calendrier à **trois champs numériques** retenu (revirement sur le "Jour N de l'Année Y"
initial, jugé trop dépouillé à l'usage) : **Jour/Mois/Année**, mais avec une structure entièrement
arbitraire au jeu, pas calquée sur un calendrier réel — **12 mois fixes de 31 jours chacun** (donc
année de jeu = 372 jours), aucune longueur de mois variable, aucun bissextile, aucune règle
d'ajustement. Année plafonnée à **1-9999** (4 chiffres), valeur hors borne rejetée (pas de
troncature silencieuse — patron `AppError` déjà en usage pour les bornes de `SETTINGS_SCHEMA`).
Granularité de l'horloge = minute (pas de secondes) — unité unique de bout en bout (point 2 de
l'analyse à charge).

- **Deux compteurs, pas un seul** (raison : point 8 de l'analyse à charge) :
  - `campaigns.game_time_minutes` — le compteur **affiché/narratif**, librement déplaçable par
    le MJ dans les deux sens (delta signé, positif ou négatif), peut descendre sous 0 (une date
    antérieure au départ de campagne configuré est une valeur valide, pas une erreur).
  - `campaigns.game_time_resolved_minutes` — le repère **mécanique**, jamais affiché au MJ,
    strictement non-décroissant (`GREATEST(ancien, nouveau_affiché)` à chaque ajustement). C'est
    l'unique valeur qui compte pour le futur balayage du Lot 2 : l'intervalle réellement à balayer
    est `(resolved_avant, resolved_après]`, jamais calculé sur le compteur affiché.
  - **Type SQL `integer`, pas `bigint`** (correction 2026-07-29, vérifiée à 100 % dans le package
    `pg-types` réellement installé, `server/node_modules/pg-types/lib/textParsers.js:109-117`) :
    `bigint`/OID 20 est désérialisé par `parseBigInteger`, qui retourne une **chaîne**, jamais un
    nombre — contrairement à `integer`/OID 23 qui passe par `parseInt()`. Le projet ne surcharge ce
    comportement nulle part (aucun `setTypeParser`), donc tout calcul direct sur une valeur lue en
    base (`"120" + 30 = "12030"`, pas `150`) serait un bug silencieux. Plutôt qu'imposer un cast
    explicite à chaque consommateur présent et futur du compteur, `integer` (max signé
    2 147 483 647, soit ±4084 ans de temps de jeu en minutes) supprime la classe de bug à la racine
    — aucune campagne n'approche cette borne, la marge est massive.
  - **Invariant de non-fuite** : `game_time_resolved_minutes` ne doit jamais apparaître dans une
    réponse HTTP/WS destinée au client. `GET /campaigns/:id` (`campaigns.js:168-183`) fait
    aujourd'hui `db('campaigns').where(...).first()` sans `.select()` puis `res.json({ campaign,
    members })` — sans action explicite, l'ajout de la colonne la ferait fuiter automatiquement
    vers le client dès ce lot, avant même que Lot 2 existe. À corriger dans le même commit que la
    migration : lister explicitement les colonnes de `campaigns` renvoyées par cette route (ou
    `delete campaign.game_time_resolved_minutes` avant `res.json`), pas seulement sur la nouvelle
    route `POST /:id/game-time/adjust`.
  - Un recul (`newDisplayed < ancien affiché`) laisse `resolved` inchangé → intervalle à balayer
    vide → « aucun effet mécanique », conforme à la décision Saar.
  - Une avance qui reste sous le repère `resolved` déjà atteint (ex. recul à Jour 5 puis ravance à
    Jour 8, alors que `resolved` est déjà à Jour 10) laisse `resolved` inchangé → intervalle vide →
    **aucune double résolution**, même si l'affichage retraverse un territoire déjà vécu.
  - Une avance qui dépasse le repère `resolved` (ravance à Jour 12 depuis l'exemple ci-dessus) ne
    balaie que le territoire réellement neuf, `(10, 12]` — jamais `(5, 12]`.
- **Config de calendrier** (rarement modifiée, posée une fois par le MJ, dans Options de campagne —
  **onglet exact non tranché**, à choisir en codant l'UI) : nouvelles clés dans `SETTINGS_SCHEMA`
  (`campaignSettingsService.js`, mécanisme déjà en place, pas de nouveau fichier de config) :
  `calendar_start_year` (number, borne **1-9999**, rejeté hors borne), `calendar_start_month`
  (number, borne **1-12**), `calendar_start_day` (number, borne **1-31**, jour du **mois**, pas de
  l'année — révisé 2026-07-29). `calendar_days_per_year` **retiré** : 31 jours/mois et 12 mois/année
  deviennent des constantes du jeu (`shared/gameTime.js`), plus un réglage MJ — ces trois bornes
  redeviennent indépendantes les unes des autres (aucune ne dépend de la valeur d'une autre clé),
  donc s'intègrent telles quelles dans la boucle de validation synchrone mono-clé déjà en place
  (même patron que `encumbrance_multiplier`) : **le problème de validation croisée sur merge JSONB
  partiel identifié le 2026-07-29 disparaît avec le réglage qui le causait**, pas de fix à écrire
  pour un problème qui n'existe plus. Passe par la route `PUT /campaigns/:id` existante
  (`requireRole('gm')`), aucune nouvelle route de config nécessaire. Projette uniquement le compteur
  **affiché** — `resolved` n'est jamais montré, n'a pas besoin d'une date lisible.
- **Projection pure** (jamais stockée) : à partir de `game_time_minutes` (affiché) + la config
  ci-dessus, calcule `{ year, month, day, hour, minute }` — fonction pure côté `shared/` (réutilisable
  client + serveur, comme `polarisUtils.js`), pas de duplication de la logique de calcul. Convertit le
  point de départ (`calendar_start_year/month/day`) en un index de jour linéaire, additionne les
  jours écoulés, puis redécompose en `year`/`month`/`day` via division/reste par les constantes
  372 (jours/année) et 31 (jours/mois). Attention d'implémentation à noter maintenant :
  `year`/`month`/`day` doivent rester corrects pour un compteur négatif (modulo JS natif `%` ne se
  comporte pas comme un modulo mathématique sur les négatifs — à gérer explicitement avec une
  division/reste toujours positifs, sinon bug garanti dès qu'un MJ recule avant le jour de départ).
- **Mutateur unique** : `adjustGameTime(campaignId, deltaMinutes)` — entier **signé non
  nul** (positif = avance, négatif = recul), renommé depuis `advanceGameTime` (l'ancien nom supposait
  un sens unique, plus vrai depuis le point 8). **Correction 2026-07-30** (analyse à charge combinée
  des deux plans, contre le code réellement codé) : signature corrigée — pas de paramètre `db`, la
  fonction l'importe en module (`server/src/lib/gameTimeService.js:1,10`) ; une version antérieure de
  cette puce affirmait à tort `adjustGameTime(db, campaignId, deltaMinutes)`. Même correction : le
  patron "lire sous verrou puis écrire" n'est **pas** illustré par `tradeService.js` (ce fichier
  mute ses soldes exclusivement via `.increment()`/`.decrement()`, jamais un recalcul JS suivi d'une
  écriture de valeur concrète) — le seul exemple réel de ce patron dans le projet est cette fonction
  elle-même. Verrouille la ligne `campaigns` (`.forUpdate()`, analyse à charge point 1) avant de lire
  les deux compteurs courants, puis calcule `newDisplayed`/`newResolved` en application et écrit les
  deux valeurs concrètes — à distinguer de l'expression SQL brute utilisée pour le merge JSONB de
  `settings` (`campaigns.js`, patron différent, réutilisé pour l'append atomique du Lot 2, voir §8).
  Retourne `{ displayedBefore, displayedAfter, resolvedBefore, resolvedAfter }`
  — c'est `resolvedBefore`/`resolvedAfter` que le futur Lot 2 consomme, jamais `displayed*`.
- **Diffusion** : un seul événement WS après la mutation, `CAMPAIGN_GAME_TIME_ADJUSTED` — transporte
  uniquement le compteur **affiché** (pour l'UI). Correction 2026-07-29 : une version antérieure de
  cette puce prévoyait de diffuser aussi le compteur résolu "pour cohérence/debug", ce qui
  contredisait directement l'invariant de non-fuite (Architecture retenue, "Deux comptes") — le
  broadcast WS part vers toute la room (joueurs compris, pas seulement le MJ), donc c'était une fuite
  plus large que celle déjà corrigée sur `GET /:id`. `resolved` ne quitte jamais le serveur. Pas de
  mini-ticks serveur. Côté serveur, le futur balayage du Lot 2 n'est **pas** un abonnement à cet
  event (un event WS ne boucle pas vers le serveur lui-même) mais un appel de fonction direct, dans
  la même transaction que `adjustGameTime`, orchestré par la route — voir §8.
- **Animation "l'horloge prend vie"** (référence Fallout/Skyrim donnée par Saar) : **purement
  cosmétique côté client** — le serveur calcule le résultat final en une fois (autoritaire, contrat
  déjà en place ailleurs dans le combat), le client anime une transition visuelle de l'ancienne à la
  nouvelle valeur affichée. Aucune complexité réseau supplémentaire, aucun tick serveur.

### Fichiers concernés (toujours aucun code écrit à ce stade)

| Fichier | Rôle |
|---|---|
| `server/src/db/migrations/217_campaigns_game_time.js` | ajoute `campaigns.game_time_minutes` (**integer**, `notNullable`, `defaultTo(0)`) **et** `campaigns.game_time_resolved_minutes` (**integer**, `notNullable`, `defaultTo(0)`) — rétrocompatible (corrigé 2026-07-29 : `bigint`→`integer`, voir Architecture retenue) ; 217 = prochain numéro impair libre (215 = `characters_token_style.js`, vérifié dans `server/src/db/migrations/`) |
| `server/src/lib/campaignSettingsService.js` | ajoute `calendar_start_year`/`calendar_start_month`/`calendar_start_day` à `SETTINGS_SCHEMA` (révisé 2026-07-29 : plus de `calendar_days_per_year`, remplacé par les constantes 31j/12mois de `shared/gameTime.js`) |
| `server/src/routes/campaigns.js` (route `PUT /:id` existante) | ajoute 3 bornes indépendantes au bloc de validation par clé déjà présent : `calendar_start_year` ∈ [1, 9999], `calendar_start_month` ∈ [1, 12], `calendar_start_day` ∈ [1, 31] (révisé 2026-07-29 : plus de borne croisée, voir Architecture retenue) |
| `server/src/routes/campaigns.js` (route `GET /:id` existante, L.168-183) | ajoutée 2026-07-29 : exclure `game_time_resolved_minutes` de la réponse (`.select()` explicite ou suppression avant `res.json`) — sans quoi la colonne fuite vers le client dès ce lot (invariant de non-fuite, Architecture retenue) |
| `shared/gameTime.js` (nouveau) | constantes `JOURS_PAR_MOIS = 31`/`MOIS_PAR_ANNEE = 12` + fonction pure de projection compteur affiché → `{year, month, day, hour, minute}`, gère explicitement les valeurs négatives (voir note modulo ci-dessus), testée isolément, partagée client/serveur |
| `server/src/lib/gameTimeService.js` (nouveau) | `adjustGameTime(db, campaignId, deltaMinutes)` — verrou `.forUpdate()`, calcule et écrit les deux compteurs |
| `server/src/routes/campaigns.js` | nouvelle route `POST /:id/game-time/adjust`, `requireAuth, requireRole('gm')` (patron identique à `PUT /:id`), corps `{ minutes: <entier signé non nul> }` exclusivement (point 2) |
| `shared/events.js` | nouvelle constante `CAMPAIGN_GAME_TIME_ADJUSTED` |
| `client/src/components/GameTimeWidget.jsx` (nouveau) | UI GM, sidebar session au-dessus de la rangée Édition/Calque/Outils (Saar, 2026-07-29). Révisé 2026-07-29 (retour Saar : bloc initial trop haut) : 5 boutons compacts Année/Mois/Jour/Heure/Minute affichant la valeur courante, chacun ouvre un menu de durées relatives dans les deux sens dimensionné à son unité (An ±1, Mois ±1, Jour ±1/±7, Heure ±1/±6, Minute ±15/±30) plutôt qu'une liste de préréglages à plat — plus saisie libre minutes/heures/jours (tranché) repliée derrière un bouton "Autre" pour ne pas occuper de place en permanence |

### i18n (`.claude/rules/i18n.md`, vérifié avant d'écrire cette section)

- Aucun texte visible codé en dur dans le composant UI GM (labels des préréglages, saisie libre,
  confirmations) — `useTranslation()`/`t('clé')` obligatoire, clé ajoutée au namespace **avant**
  utilisation dans le JSX (jamais l'inverse).
- Correction 2026-07-29, en codant l'UI GM (onglet "Règle du jeu", `SectionGameRules.jsx`) :
  hypothèse initiale fausse — `combat.json`/`charSheet.json`/`builder.json` existent bel et bien
  (vérifié par `Glob`), et les 6 onglets d'Options de campagne (dice/rules/tokens/players/sheet/
  danger), pourtant un ensemble dense, vivent tous sous `settings.*` dans `fr.json`, pas dans un
  namespace dédié. Les 3 nouvelles clés calendrier suivent donc le même patron que
  `encumbranceMultiplierLabel`/`Hint` (`settings.calendarStart*`), pas de `campaignClock.json` créé
  pour ce sous-formulaire — un futur widget d'avance d'horloge séparé (hors Options de campagne)
  pourra rouvrir la question s'il devient dense à son tour.
- Erreurs REST (`AppError` sur la nouvelle route) : suit le patron déjà en usage dans
  `campaigns.js` (message simple, pas de `system:true`/`i18nKey` — ce dernier patron est réservé aux
  notifications système WS, vérifié dans `socketCombatHelpers.js:2630-2631`, pas aux erreurs de
  validation REST). Aucun nouveau patron à inventer.
- Anglais gelé (`supportedLngs: ['fr']`) — pas d'obligation de remplir `en.json` pour ce lot.

### Hors périmètre de ce lot

- Aucun balayage/évolution automatique déclenché par un ajustement (Lot 2) — Lot 1 calcule et
  expose `resolvedBefore`/`resolvedAfter`, mais ne balaie rien lui-même.
- Aucun mois, aucune saison, aucun jour de semaine nommé.
- Aucun lien automatique avec le compteur de Tours de combat. **Tranché (Saar, 2026-07-23) :
  deux compteurs strictement indépendants**, jamais l'un dérivé de l'autre — confirmé une seconde
  fois (point 8) : les mécaniques scope Tour de combat (Feu, Lot 3) ne sont jamais affectées par un
  ajustement de l'horloge de campagne, dans aucun des deux sens.
- `game_time_resolved_minutes` n'est jamais affiché au MJ — bookmark interne uniquement.
- Aucun affichage joueur avant validation du Lot 1 par Saar.

### Validation prévue

- Test Node ciblé sur `computeCalendarDate` (cas limites : franchissement d'année — ex. départ jour
  360/`days_per_year` 365, avance de 10 jours → doit basculer en année+1 jour 5 —, compteur négatif
  avec modulo correct, `days_per_year` non standard).
- Test Node ciblé sur `adjustGameTime`, les 4 cas du point 8 explicitement :
  1. avance simple au-delà du repère résolu → `resolved` avance d'autant, intervalle non vide ;
  2. recul pur → `resolved` inchangé, intervalle vide ;
  3. avance qui reste sous le repère déjà résolu (après un recul) → `resolved` inchangé, intervalle
     vide, aucune double résolution ;
  4. avance qui dépasse le repère déjà résolu (après un recul) → intervalle égal au territoire
     réellement neuf seulement, jamais au territoire déjà résolu avant le recul.
  Plus : delta = 0 rejeté, deux ajustements concurrents sur la même campagne ne s'écrasent pas (test
  explicite du verrou `.forUpdate()`, point 1).
- Vérification manuelle du round-trip REST + broadcast Socket.IO.
- `node --test shared/*.test.mjs` pour non-régression.
- Nouveau concept Enclume ("Horloge de campagne"/temps de jeu) à ajouter dans `docs/VOCABULARY.md`
  une fois codé (`CLAUDE.md` §2).

---

## 8. Lot 2 — Moteur générique d'échéances de jeu

> **v2 (2026-07-29) — réécrit après analyse à charge de la v1 à la lumière de son premier
> consommateur réel** (`docs/PLAN_BLESSURES_GUERISON.md`). La v1 avait été conçue pour une
> résolution **entièrement automatique** (un jet, une conséquence, fini) — Blessures a depuis
> révélé un **3ᵉ patron non anticipé**, la résolution **interactive/différée** (attend une réponse
> MJ ou un jet joueur, potentiellement plusieurs jours réels plus tard, et peut faire naître de
> nouvelles échéances en cours de route). La v1 ne le supportait pas et se contredisait déjà
> elle-même (la section "Composition avec le Lot 1" décrivait encore un balayage synchrone en une
> seule transaction, pendant qu'une note ajoutée en tête mentionnait une avance "en attente" sans
> que le corps du texte soit corrigé en conséquence). Cette v2 réconcilie les deux.

### Analyse à charge (2026-07-29, v1 puis v2)

1. **Point de composition corrigé (v1).** Le texte précédent disait "orchestré par la route
   `POST /:id/game-time/advance`". Faux contre le code réel du Lot 1 : `adjustGameTime`
   (`server/src/lib/gameTimeService.js:15`) ouvre et commit sa propre transaction avant de
   retourner — le balayage automatique (patron ci-dessous) doit être appelé **depuis l'intérieur**
   de cette transaction, pas depuis la route après coup.
2. **Idempotence du balayage automatique, à la lumière d'`about-time`.** `about-time`
   (Trahloc/about-time, module Foundry VTT actif, code lu sur GitHub, `ElapsedTime.ts`,
   `pseudoClockUpdate`) n'a pas de champ "dernier seuil appliqué" séparé : sa boucle
   `while (due) { pop; exécuter; recalculer next; re-insérer }` avance et persiste le prochain
   déclenchement à **chaque itération** — l'idempotence est structurelle. Repris pour le patron
   automatique ci-dessous.
3. **Garde-fou anti-boucle infinie**, trouvé dans le même code source : `if (nextTime <= qe._time)`
   → erreur, reschedule rejeté — sans ça, un `interval_minutes` mal configuré boucle indéfiniment.
4. **Portée de l'idempotence clarifiée.** L'idempotence du *déclenchement* est structurellement
   garantie par le point 2 pour le patron automatique — **hors du périmètre de responsabilité des
   consommateurs**. Le franchissement de *seuil d'effet* sur une jauge 0-30 reste une responsabilité
   du consommateur (Lot 7), problème séparé.
5. **[v2] Un handler qui plante ne doit jamais faire perdre tout un balayage déjà en cours** — trouvé
   en écrivant Blessures : le texte v1 affirmait l'idempotence "par persistance à chaque itération",
   mais toute la boucle tourne dans **une seule transaction** — si l'itération 5 plante, la
   transaction entière rollback, y compris les itérations 1 à 4 "déjà persistées". Jamais corrigé
   dans le texte v1 malgré en avoir discuté. Corrigé ci-dessous (isolation par savepoint).
6. **[v2] Le patron "un jet, une conséquence, fini" ne couvre pas la résolution interactive/différée
   dont Blessures a besoin.** Un handler doit pouvoir (a) répondre "pas encore résolu, en attente
   d'une réponse externe" sans faire avancer son échéance, (b) faire naître de nouvelles échéances
   (Guérison→Infection), (c) changer temporairement son propre rythme. Rien de tout ça n'existait
   dans la v1. Corrigé ci-dessous (deux patrons de résolution, pas un seul).
7. **[v2] Application des effets vs. avance du compteur d'horloge — deux moments différents,
   confondus dans la première rédaction du flux Blessures.** Un effet de blessure (case cochée,
   amélioration) doit s'appliquer **dès que la réponse est connue** (MJ répond, ou joueur lance son
   dé), pas attendre la confirmation finale groupée — seul **le compteur `game_time_minutes`**
   attend que tout le lot soit résolu. Ça réduit aussi le risque du point 5 : la confirmation finale
   ne fait plus qu'avancer le compteur, elle n'appelle plus aucun handler.
8. **[Correction 2026-07-29, même session — analyse à charge de la v2 elle-même] Ni `sweepDueEcheances`
   ni `previewDueEcheances` ne distinguaient `interactive` en SQL.** Le texte v2 initial décrivait les
   deux fonctions avec la même requête (`status='active' AND next_due_minutes<=?`), sans filtre sur
   `interactive` — et `game_echeances` n'avait pas de colonne pour ça. Tel quel, `sweepDueEcheances`
   (censée n'agir QUE sur le patron automatique) aurait fetché et résolu aussi les échéances
   interactives dues, contredisant frontalement "jamais résolues par le balayage lui-même" ; et
   `previewDueEcheances` (censée ne détecter QUE les interactives pour décider d'ouvrir une revue MJ)
   aurait déclenché une revue pour de simples échéances automatiques, cassant le "chemin rapide".
   Corrigé ci-dessous : colonne `interactive` dénormalisée sur `game_echeances` (même justification
   que `campaign_id`, déjà dénormalisé sur cette table pour la même raison — filtre direct de
   balayage), copiée depuis le registre au moment de la création de chaque échéance.
9. **[Correction 2026-07-29, même session] Le contrat du handler ne disait jamais qui capture
   `previousValues` pour `pending_advance_undo_log`, ni comment.** Le handler ne recevait ni ne
   retournait aucune information sur les lignes qu'il s'apprête à toucher — `resolveEcheanceNow` ne
   pouvait donc rien snapshoter avant l'appel. Le format `{ table, rowId, previousValues }` couvrait
   implicitement un UPDATE (restaurer d'anciennes valeurs) mais pas le cas cité en exemple lui-même
   (`resolveWoundInsertion`, qui supprime plusieurs lignes et en insère une seule — un mélange
   insert/delete que le format ne savait pas représenter). Corrigé ci-dessous : le handler retourne
   désormais `undoEntries` explicitement, avec une convention à 3 cas qui couvre insert/update/delete.
10. **[Correction 2026-07-30, analyse à charge combinée des deux plans, avant tout code]** L'append de
    `undoEntries` à `campaigns.pending_advance_undo_log` par `resolveEcheanceNow` n'avait pas de
    garantie de concurrence explicite — le même risque que le point 1 (deux mutations concurrentes sur
    `campaigns` sans protection), pas retraité pour ce nouveau champ. Corrigé ci-dessous : append par
    expression SQL atomique (`||` jsonb), pas par lire-puis-écrire en JS.

### Architecture retenue (v2)

**Deux patrons de résolution coexistants**, déclarés par l'entrée de registre elle-même
(`interactive: true|false`) :

- **Automatique** (`interactive: false`, patron d'origine — Maladies/Irradiations à venir) : reste
  résolu en un seul passage, dans la transaction d'`adjustGameTime`, via `sweepDueEcheances`.
- **Interactif/différé** (`interactive: true`, Blessures — Guérison/Infection) : jamais résolu dans
  le balayage lui-même ; passe par le mécanisme d'avance en attente (ci-dessous), une échéance à la
  fois, dès que sa réponse est connue.

**Registre + dispatch générique**, inspiré de `weaponModRegistry.js`/`weaponModService.js` (Moding
Groupe 4 Phase 1) — **précision 2026-07-30** (analyse à charge) : "repris à l'identique" ne vaut que
pour la moitié **registre/lookup** (tableau `{key, ...}`, `.find()` par clé qui renvoie `undefined`,
jamais un throw). La moitié **dispatch** de `weaponModService.js` (`RESOLVERS` routées par nom de
hook, agrégation de plusieurs mods actifs simultanément avec priorité/tri) ne s'applique pas ici —
Lot 2 n'a besoin que d'**un seul handler par échéance**, invoqué directement par `condition_type`,
sans notion d'agrégation ni de priorité entre entrées. Ne pas copier cette moitié du patron en
codant, le besoin réel est plus simple que le modèle cité :
- `shared/echeanceTypeRegistry.js` — tableau `{ key, interactive, handler }`, vide en Lot 2, peuplé
  par ses consommateurs (`wound_healing_check`/`wound_infection_check` en premier, `interactive:
  true` tous les deux). Lookup par clé qui renvoie `undefined` si inconnue, **jamais un throw**.
- **[Correction point 8]** Toute fonction qui crée une échéance (création initiale ou `spawn` d'un
  handler) lit `interactive` depuis ce registre par `condition_type` et la copie sur la ligne
  `game_echeances` — source unique toujours le registre, la colonne n'est qu'une dénormalisation pour
  que le SQL de balayage puisse filtrer sans recharger le registre par ligne.
- Contrat du `handler(trx, echeance, context)` : retourne soit
  `{ resolved: true, effects, reschedule, spawn: [], undoEntries: [] }` (reschedule =
  `{ intervalMinutes, occurrencesRemaining }` ou `null` = terminé ; spawn = nouvelles échéances à
  créer dans le même `trx`, chacune avec son `interactive` résolu depuis le registre comme ci-dessus)
  soit `{ resolved: false }` (attend une réponse externe — uniquement valide pour une entrée
  `interactive: true`).
- **[Correction point 9] `undoEntries`** — tableau de `{ table, rowId, previousValues }` que le
  handler lui-même construit, en lisant l'état de chaque ligne **avant** de la muter (il connaît déjà
  `trx` et le contenu de `payload`, ex. `woundId`) :
  - `previousValues` = objet complet de la ligne **avant** modification → à l'annulation, l'engine
    fait un `UPDATE` de restauration (ou un `INSERT` si la ligne a été supprimée par le handler).
  - `previousValues: null` → la ligne n'existait pas avant l'appel (le handler l'a insérée) →
    à l'annulation, l'engine fait un `DELETE` de cette ligne.
  Un seul appel de handler peut retourner plusieurs entrées (ex. `resolveWoundInsertion` qui
  supprime des cases pleines et en insère une promue : une entrée par ligne supprimée
  (`previousValues` = son contenu) + une entrée pour la ligne insérée (`previousValues: null`)).
  Le moteur (`resolveEcheanceNow`) ne connaît aucune règle métier — il persiste tel quel ce que le
  handler lui donne, `payload`/`table`/`rowId` restent opaques à l'engine.

**`server/src/lib/echeanceService.js`** :
- `sweepDueEcheances(trx, campaignId, resolvedAfter)` — **patron automatique uniquement**
  (`interactive: false`). Boucle inspirée `pseudoClockUpdate` :
  1. `SELECT ... WHERE campaign_id=? AND status='active' AND interactive=false AND
     next_due_minutes<=? FOR UPDATE` — **[Correction point 8]** le filtre `interactive=false` est
     explicite dans la requête, pas déduit après coup : une échéance interactive due n'est jamais
     fetchée par cette fonction.
  2. Pour chaque ligne due : **[v2] appel du handler isolé dans un savepoint**
     (`await trx.transaction(async (sp) => { ... })` — knex crée un SAVEPOINT quand `.transaction()`
     est appelé sur un `trx` déjà ouvert ; **revérifié 2026-07-29** contre le code source knex
     réellement installé, `server/node_modules/knex/lib/execution/transaction.js:208-210`
     — `this.client.transacting ? this.savepoint(connection) : this.begin(connection)` confirme le
     comportement, knex 3.3.0). Si le handler plante, rollback **seulement** de ce savepoint,
     l'échéance passe `status='error'`, le balayage continue pour le reste — corrige le point 5.
  3. Garde-fou anti-boucle infinie (point 3) : `status='error'` si le rescheduling ne fait pas
     avancer `next_due_minutes`.
  4. `reschedule: null` ou `occurrences_remaining` épuisé → `status='completed'`.
- `previewDueEcheances(campaignId, resolvedAfter)` — **[v2] lecture seule**, aucune écriture.
  **[Correction point 8]** Requête différente de l'étape 1 ci-dessus, pas la même : `SELECT ...
  WHERE campaign_id=? AND status='active' AND interactive=true AND next_due_minutes<=?` (sans
  `FOR UPDATE`, lecture seule) — seules les échéances **interactives** dues intéressent cette
  fonction, une échéance automatique due ne doit jamais faire ouvrir une revue MJ. Utilisée par
  `requestGameTimeAdvance` (ci-dessous) pour savoir si une revue est nécessaire.
- `resolveEcheanceNow(trx, echeanceId)` — **[v2] résolution immédiate d'une échéance interactive
  unique**, dès que sa réponse est connue (MJ répond dans l'écran de revue, joueur lance son dé).
  Appelle le handler (dans un savepoint, même protection que le point 2 ci-dessus), applique les
  effets, gère `reschedule`/`spawn`. **[Correction point 9]** Récupère aussi `undoEntries` dans le
  retour du handler et les ajoute (append, pas remplacement) à `campaigns.pending_advance_undo_log`
  dans la même transaction que l'application des effets — avant de committer le savepoint.
  **[Correction point 10, 2026-07-30]** Cet append **doit** passer par une expression SQL atomique en
  une seule instruction (`UPDATE campaigns SET pending_advance_undo_log = pending_advance_undo_log
  || ?::jsonb WHERE id = ?`, même patron déjà en usage dans le projet pour le merge JSONB de
  `settings`, `campaigns.js`), **jamais** un lire-en-JS-puis-écrire séparé — plusieurs joueurs peuvent
  répondre à des échéances `awaiting_player_roll` distinctes à quelques millisecondes d'écart (ex.
  après une bataille avec plusieurs PJ blessés), et deux lectures concurrentes du tableau suivies
  d'écritures séparées perdraient silencieusement l'une des deux entrées d'annulation (lost update).
  L'opérateur `||` sur deux tableaux jsonb les concatène (confirmé, doc Postgres), et une seule
  instruction `UPDATE` est atomique au niveau ligne — pas besoin d'un `.forUpdate()` supplémentaire
  tant que l'append reste dans cette forme. Repasse l'échéance `active` ou `completed`. **N'avance
  jamais le compteur d'horloge** — corrige le point 7, c'est la seule chose que la confirmation finale
  doit encore faire.

**Composition avec le Lot 1 — trois fonctions d'orchestration** (`server/src/lib/gameTimeService.js`,
aux côtés d'`adjustGameTime` qui reste inchangé sauf un garde ajouté en tête) :
1. **`requestGameTimeAdvance(campaignId, deltaMinutes)`** — verrouille `campaigns`
   (`.forUpdate()`), refuse si une avance est déjà en attente (`pending_advance_delta_minutes` non
   null — un seul saut à la fois). Appelle `previewDueEcheances`.
   - Aucune échéance `interactive` due → appelle `adjustGameTime` directement (qui balaie les
     échéances automatiques normalement) dans le même verrou. **Chemin rapide inchangé** — le
     widget Lot 1 ne voit pas la différence dans le cas courant.
   - Au moins une échéance `interactive` due → pose `pending_advance_delta_minutes`, marque ces
     échéances `pending_mj_review` (ou `awaiting_player_roll` si le choix "demander aux joueurs"
     est déjà fait par défaut pour ce `condition_type` — sinon la revue MJ décide), retourne la
     liste.
2. **Chaque réponse MJ/joueur appelle `resolveEcheanceNow`** directement, dès qu'elle arrive — pas
   groupé, pas différé à la confirmation. **[Correction point 9]** `resolveEcheanceNow` récupère les
   `undoEntries` retournées par le handler (voir contrat ci-dessus, capturées par le handler
   lui-même avant sa propre mutation) et les ajoute à `campaigns.pending_advance_undo_log` — décidé
   Saar 2026-07-29 : une annulation doit défaire les effets déjà appliqués, pas seulement l'avance du
   compteur.
3. **`confirmPendingAdvance(campaignId)`** — revérifie `previewDueEcheances` à cet instant précis ;
   toute échéance nouvelle depuis la proposition rejoint le lot en `pending_mj_review`, confirmation
   refusée. Si tout le lot est `active`/`completed` (plus rien en `pending_mj_review`/
   `awaiting_player_roll`) → appelle `adjustGameTime` (qui balaie au passage les échéances
   automatiques normales), vide `pending_advance_delta_minutes` **et `pending_advance_undo_log`**
   (plus besoin, tout est committé). **N'appelle plus aucun handler interactif** — ils sont déjà
   résolus, corrige le point 5/7 : le risque de plantage à ce stade est réduit à la seule avance du
   compteur, déjà protégée par la transaction du Lot 1.
4. **`cancelPendingAdvance(campaignId)`** — **rejoue `pending_advance_undo_log` en sens inverse**
   (ordre chronologique inversé, dernière entrée d'abord), repasse les échéances du lot à `active`,
   vide `pending_advance_delta_minutes` et le journal. **[Correction point 9]** Algorithme de rejeu
   générique à 3 cas, uniquement basé sur `{ table, rowId, previousValues }` — l'engine n'a besoin
   d'aucune connaissance métier pour l'appliquer :
   - `previousValues` non nul, la ligne existe encore → `UPDATE` vers `previousValues` (annule une
     modification).
   - `previousValues` nul, la ligne existe → `DELETE` (annule une insertion faite par le handler).
   - `previousValues` non nul, la ligne n'existe plus → `INSERT` de `previousValues` (annule une
     suppression faite par le handler, ex. une case de blessure retirée par
     `resolveWoundInsertion`).
   **Corrige la nuance laissée ouverte en v2** : un effet déjà appliqué (case de blessure cochée,
   amélioration) est maintenant défait lui aussi, pas seulement l'avance du compteur.

**Alternative écartée** : garder tout dans une seule transaction Postgres ouverte de la proposition
à la confirmation, et laisser un `ROLLBACK` tout défaire gratuitement. Rejetée — une transaction peut
rester ouverte plusieurs jours réels (le temps qu'un joueur réponde), et une transaction aussi
longue pose de vrais problèmes (verrous tenus tout ce temps, connexion bloquée, tout perdu si la
connexion tombe). D'où le journal explicite plutôt que le mécanisme transactionnel natif.

**Modèle de données** — colonnes structurelles reprises du plan initial, payload volontairement
opaque :
- `game_echeances` : `id` uuid pk, `campaign_id` uuid FK `campaigns` (dénormalisé, filtre direct de
  balayage), `character_id` uuid FK `characters`, `condition_type` text, **`interactive` boolean
  not null (Correction point 8, dénormalisé depuis `echeanceTypeRegistry` à la création — même
  justification que `campaign_id` ci-dessus : filtre direct de balayage, source de vérité toujours
  le registre)**, `payload` jsonb (opaque), `next_due_minutes` integer (comparé à
  `game_time_resolved_minutes`), `interval_minutes` integer nullable, `occurrences_remaining`
  integer nullable, `status` text
  (`active`/`completed`/`cancelled`/`error`/`pending_mj_review`/`awaiting_player_roll`),
  `created_at`/`updated_at`. Type `integer`, pas `bigint` (même raison que `campaigns.game_time_*`).
  **Convention pour tout futur consommateur (2026-07-30, généralisée après gut-check de Lot 7)** :
  `payload` ne contient que des **identifiants** (`{ woundId }`, `{ conditionId }`...), jamais une
  donnée métier dupliquée depuis la table domaine du consommateur, et la table domaine du
  consommateur ne duplique jamais en retour `next_due_minutes`/`interval_minutes`/
  `occurrences_remaining`/`status` — `game_echeances` reste la seule autorité de planification, la
  table domaine la seule autorité de l'état métier (niveau de jauge, gravité, seuil déjà appliqué...).
  Déjà respecté par Blessures (`payload: { woundId }`, état dans `character_wounds`) ; erreur trouvée
  et corrigée pour Maladies/Poisons (Lot 7, voir §13) avant que le code n'existe.
- `campaigns.pending_advance_delta_minutes` — integer nullable, verrou "un seul saut à la fois"
  (**Point D confirmé — Saar, 2026-07-29** : un seul saut de temps en attente par campagne gèle
  toute avance, même sans rapport avec l'échéance en cause, jusqu'à résolution ou
  `cancelPendingAdvance` ; compromis assumé plutôt qu'un oubli, alternative multi-avances
  concurrentes jugée disproportionnée).
- **`campaigns.pending_advance_undo_log`** (nouvelle colonne, `jsonb` nullable, tableau qui
  s'accumule) — chaque entrée : `{ table, rowId, previousValues }`, produite par le handler lui-même
  (voir `undoEntries` dans le contrat du handler ci-dessus, Correction point 9) — jamais déduite par
  l'engine. `previousValues` = contenu complet de la ligne avant mutation (pas un delta — nécessaire
  car `resolveWoundInsertion`/`resolveWoundImprovement` peuvent supprimer plusieurs lignes et en
  insérer une seule) ; `previousValues: null` = la ligne n'existait pas avant (insertion à annuler
  par un `DELETE`). Vidé à chaque commit ou annulation — ne survit jamais à une seule avance en
  attente, borné dans le temps par construction (un seul saut possible à la fois).

### Hors périmètre

- Aucune maladie/poison/drogue/irradiation/froid réel branché — le patron automatique est livré
  avec un test isolé (un `condition_type` factice, retiré après), avant Lot 7.
- Le franchissement de seuil d'effet sur une jauge 0-30 — responsabilité de Lot 7.
- Aucune UI générique pour le patron automatique — Lot 7+ branchera un affichage si besoin. L'UI du
  patron interactif est spécifiée dans `docs/PLAN_BLESSURES_GUERISON.md` §6 (premier consommateur).

### Points ouverts pour la cuisson avec Saar

1. ~~Nom de la table~~ — **tranché en codant (2026-07-30)** : `game_echeances`, aucune objection,
   migration `221_game_echeances.js`.
2. ~~`character_id` obligatoire ou nullable~~ — **tranché en codant (2026-07-30)** : `NOT NULL`
   (YAGNI), aucun cas connu qui aurait demandé le contraire.
3. ~~`cancelPendingAdvance` sur une échéance déjà résolue~~ — **résolu (Saar, 2026-07-29)** :
   l'effet doit être défait, pas seulement l'avance du compteur. Journal d'annulation
   (`pending_advance_undo_log`) ajouté ci-dessus pour ça.
4. ~~Filtre `interactive` absent des requêtes SQL de `sweepDueEcheances`/`previewDueEcheances`~~ —
   **résolu (2026-07-29, analyse à charge de la v2)** : colonne `interactive` dénormalisée sur
   `game_echeances`, voir point 8 de l'analyse à charge et Modèle de données ci-dessus.
5. ~~Contrat du handler ne spécifiant pas la collecte de `previousValues`~~ — **résolu
   (2026-07-29, analyse à charge de la v2)** : `undoEntries` ajouté au retour du handler, convention
   à 3 cas (insert/update/delete), voir point 9 de l'analyse à charge ci-dessus.
6. ~~Verrou "un seul saut de temps en attente par campagne" — restrictif ?~~ — **confirmé (Saar,
   2026-07-29)** : accepté tel quel, voir note sur `campaigns.pending_advance_delta_minutes` dans le
   Modèle de données.

---

## 9. Lot 3 — Dommages environnementaux de combat (Chute, Acide, Décompression, Feu)

> **2026-07-30 — cadrage détaillé** (après le §9 initial trop court) : exploration du code réel
> (`resolveTargetHit`, `statusService`, `startResolutionPhase`, `polarisTestService`) avant d'écrire quoi
> que ce soit — RAW verbatim relue dans `docs/REGLES/FATIGUE&DOMMAGES.md` p.242-243. **6 points ouverts
> tranchés avec Saar avant tout code** (liste ci-dessous), 3 de plus (7-9) ajoutés et tranchés le
> 2026-07-30 lors de l'analyse critique de reprise (nettoyage `COMBAT_END`, gestion d'erreur
> `exposeToHazard`/`clearHazard`, ré-exposition différée à l'increment G).

**Dépend de** : Lot 0 uniquement — indépendant de l'horloge de campagne, ces effets s'expriment en
**Tours de combat**, pas en temps de jeu réel.

### Fondations réutilisées (vérifiées dans le code, pas supposées)

- `resolveTargetHit(io, db, campaignId, {...})` (`server/src/lib/damageService.js:271-447`) —
  résolution complète localisation/armure/RD/sévérité/blessure/shock à partir d'un `degautsBruts` déjà
  tiré par le caller. Localisation 1D20 native (`LOC_TABLE`) sauf `forcedSlotCode` fourni — un appel =
  une seule localisation.
- `calcResistanceArmure` (`server/src/lib/charStats.js:309`) — appelée en interne par
  `resolveTargetHit`, **aucun paramètre exposé aujourd'hui pour réduire l'armure de moitié** (besoin
  RAW de la Chute). Le seul mécanisme de réduction existant (`ammoFx`/`mechanic.armorMulFactor`,
  `damageService.js:360-366`) est spécifique au DSL munitions, pas un paramètre générique appelable
  hors contexte d'arme.
- `resolvePolarisTest(threshold)` (`server/src/lib/polarisTestService.js:12-24`) — Test générique 1D20
  vs seuil, gère déjà la relance sur échec critique, retourne `{roll, mr, isSuccess, isCriticalSuccess,
  isCriticalFail, ...}`. Le Test d'Acrobatie/Équilibre de la Chute passe par lui tel quel — seuil =
  compétence − (hauteur × 2).
- `applyModStatus`/`clearModStatus` (`server/src/lib/statusService.js:160-178`) — écriture générique
  `token_statuses` malgré leur nom "Mod", réutilisables tels quels : `expiresAtTurn: null` = jusqu'à
  retrait manuel, exactement ce qu'il faut pour `acid_exposure`/`decompression`/`on_fire`.
- Tick de début de Tour : `startResolutionPhase` (`server/src/socket/socketCombatHelpers.js:154-208`),
  boucle `combatMods`/`resolveModHooks('onTurnStart', ...)` (lignes 181-190) — **spécifique aux mods
  d'armes équipés** (`char_inventory_mods`/`WEAPON_MOD_REGISTRY`, `shared/weaponModRegistry.js`), pas un
  patron générique "tout effet récurrent par Tour". Acide/Feu ne sont pas des mods : Lot 3 ne peut pas
  s'enregistrer dans ce registre lui-même (domaines différents : équipement vs danger environnemental),
  mais en réutilise le **patron architectural** (registre déclaratif + dispatcher générique, jamais un
  `if/else` par type) via un second registre dédié — voir §9 "Plan d'exécution" increment F, révisé
  après recherche sur l'architecture "Rule Elements" de PF2e/Foundry VTT qui suit exactement ce même
  principe.

### Deux trous structurels trouvés en explorant (pas prévus par le cadrage initial)

1. **Pas de paramètre de réduction d'armure générique sur `resolveTargetHit`** — nécessite une
   extension ciblée de sa signature (ex. `armorReductionFactor = 1`, appliqué au même endroit que
   `mechanic.armorMulFactor`, comportement des appelants existants strictement inchangé puisqu'ils ne
   le passeraient jamais).
2. **Calcul des Attributs NA (For/Con/Vol) d'une cible avec génotype+mutations** (nécessaire pour
   appeler `resolveTargetHit` hors du flux d'attaque normal, ex. une Chute ou un tick Feu déclenchés
   par le MJ hors tour d'un adversaire) n'existe **que sous forme de fermeture locale non exportée**
   `fetchCibleNA` (`socketCombatHelpers.js:2237`) — déjà dupliquée une fois en interne à ce fichier.
   Écrire une 3ᵉ copie ad hoc pour Lot 3 dupliquerait cette logique une fois de plus. Extraction
   proposée : exporter cette logique en fonction partagée (`charStats.js` ou `damageService.js`) avant
   de l'utiliser ici — sinon, si Saar préfère différer ce refactor, accepter une 2ᵉ copie assumée comme
   dette (à noter alors dans `docs/BUGIDENTIFIE.md`, pas silencieusement).

### Architecture retenue

**Chute** (ponctuelle, un seul événement) :
1. MJ saisit la hauteur (mètres) — pas de détection automatique via `WorldSnapshot` (hors périmètre,
   déjà noté au cadrage initial).
2. Table RAW hauteur→dés/localisations (RAW verbatim, `docs/REGLES/FATIGUE&DOMMAGES.md` lignes 14-25)
   extraite en constante partagée (ex. `shared/fallDamageConstants.js`), même patron que
   `WOUND_HEALING`/`WOUND_INFECTION` (`shared/woundConstants.js`) — jamais de littéraux dispersés dans
   le code serveur.
3. Terrain accidenté (case à cocher MJ, non persistée — même patron que le "contexte RAW" de Blessures
   §6.1) : +1D10 ajouté au total de dégâts bruts avant résolution.
4. Test d'Acrobatie/Équilibre optionnel (RAW : le joueur peut tenter de contrôler sa chute ; le MJ peut
   imposer un Test de Réaction préalable si la chute est soudaine — narratif, aucune détection
   automatique de "chute soudaine") : seuil = compétence Acrobatie/Équilibre − (hauteur × 2), via
   `resolvePolarisTest`. Réussite → dégâts réduits de 1D6 + `mr`, jamais négatif
   (`Math.max(0, degatsBruts - reduction)`). Au-delà de 5 m, RAW interdit toute réduction — case/bouton
   grisé côté UI.
5. Résolution : N localisations (1, 1D3, ou 1D3+3 selon hauteur) — chaque localisation = un appel
   séparé à `resolveTargetHit` (jamais de `forcedSlotCode`, localisation 1D20 native à chaque appel),
   avec `armorReductionFactor: 0.5` (point structurel 1 ci-dessus). Interprétation provisoire du même
   total de dégâts bruts appliqué à chaque localisation (voir point ouvert 1).

**Acide / Décompression / Feu** (récurrents, par Tour, jusqu'à neutralisation/sortie de zone) :
1. Déclenchement : action MJ explicite (ex. bouton "Exposer" sur un token) → pose `token_statuses`
   (`acid_exposure`/`decompression`/`on_fire`), `expires_at_turn: null`. Décompression est fixe RAW
   (1D10, ou 2D10 si plusieurs paliers manqués — choix MJ à la pose). Acide/Feu ont une intensité
   variable (petite flamme/moyenne/grand feu/brasier pour le Feu ; "dépend de la puissance", non
   chiffrée par la RAW, pour l'Acide) — voir point ouvert 2 pour où la stocker.
2. Nouvelle boucle dans `startResolutionPhase`, indépendante de celle des mods : pour chaque token
   portant un `status_code` environnemental actif, résout le dégât du Tour via `resolveTargetHit` —
   Décompression toujours localisée "corps" (simplification RAW explicite, `forcedLocation` de
   registre) ; Acide/petite flamme/feu moyen sur **« la Localisation exposée »** (RAW littéral p.243,
   variable par instance, PAS un tirage aléatoire — `data.forcedLocation` choisi par le MJ à
   l'exposition, voir point ouvert 10) ; Grand feu 1D3 localisations aléatoires (RAW littéral, même
   remarque multi-localisation que la Chute, point ouvert 1) ; Brasier sans Localisation précisée par la
   RAW, laissé à l'appréciation MJ via `data.locations` (même silence RAW que l'intensité de l'Acide,
   point ouvert 2).
3. Retrait : action MJ explicite (`clearModStatus` réutilisé tel quel) — sortir de la zone, éteindre le
   feu, neutraliser l'acide. Aucune détection automatique (le moteur monde ne sait pas aujourd'hui si un
   token "est dans" une zone Acide/Feu — hors périmètre, cohérent avec le cadrage initial).
4. Persistance de l'Acide après sortie de zone (RAW : "peut persister 1D6 Tour(s)") — voir point ouvert 3.
5. Réutilise directement le moteur de blessures + localisation existants — aucune nouvelle jauge, aucun
   horodatage de campagne (contrairement à Maladies/Poisons/Drogues/Irradiations, Lots 7-9, consommateurs
   du Lot 2).

### Points ouverts pour la cuisson avec Saar — tous tranchés (2026-07-30)

1. ~~Multi-localisation~~ — **tranché (Saar)** : même total de dégâts appliqué indépendamment à
   chaque localisation touchée (pas de reroll/répartition).
2. ~~Intensité variable (Acide, Feu)~~ — **tranché (Saar), après recherche pro (Foundry VTT/PF2e — le
   "Dommage persistant" PF2e est modélisé comme une condition qui porte sa propre formule/DC, pas un
   flag nu)** : ajout d'une colonne JSONB `data` sur `token_statuses` (nullable, additive — même
   patron que `char_inventory_mods.state`, réutilisable pour tout futur statut à charge de données).
   Migration `225_token_statuses_data.js` (prochain numéro impair Claude).
3. ~~Persistance de l'Acide~~ — **tranché (Saar)** : automatique, `expires_at_turn` calculé (1D6
   Tours) au moment de la sortie de zone — pas de retrait manuel MJ pour ce cas précis.
4. ~~Nom exact des `status_code`~~ — **résolu par le point 2** : un seul code par danger
   (`acid_exposure`/`decompression`/`on_fire`), l'intensité vit dans `data`, pas dans le code.
5. ~~Chute — qui déclenche le Test~~ — **tranché (Saar)** : MJ uniquement, cohérent avec l'écran de
   revue Blessures — aucune UI joueur à construire pour ce Test.
6. ~~Extraction de `fetchCibleNA`~~ — **tranché (Saar)** : « Architecture robuste, pérenne et
   adaptative. Si une fonction partagée est une bonne pratique, go » — extraite en fonction partagée
   avant utilisation, remplace aussi la fermeture privée existante dans `socketCombatHelpers.js` (une
   seule copie au lieu de deux). Directive générale de Saar à retenir au-delà de ce point précis : le
   temps de travail ou l'ampleur du rework n'est jamais un paramètre de décision sur ce projet, seule
   la qualité finale de l'architecture l'est — modifier du code existant pour coller à une architecture
   solide est toujours une option légitime, pas un dernier recours.
7. ~~Nettoyage `COMBAT_END` des statuts environnementaux~~ — **tranché (Saar, 2026-07-30)**, trou trouvé
   en analyse critique de reprise (increment C non encore codé à ce moment) : `socketCombatState.js:
   216-232` ne purge à `COMBAT_END` que les codes de `getAllModStatusCodes()`
   (`WEAPON_MOD_REGISTRY.statusCodes`, `weaponModRegistry.js`) — `ENVIRONMENTAL_HAZARD_REGISTRY` (F.1)
   en est délibérément séparé, donc **jamais balayé** à `COMBAT_END`. Décision : **assumé et voulu**,
   pas un bug à corriger. Les dangers environnementaux **survivent** à la fin d'un combat (icône/badge
   token persiste, cohérent avec « quelqu'un qui brûle continue de brûler hors initiative ») — mais
   **aucun effet ne se produit hors combat** : la seule boucle de résolution (`startResolutionPhase`,
   F.5) ne s'exécute que dans la FSM combat, il n'existe aucun autre mécanisme de "Tour" hors de ce
   contexte. Un token qui rentre dans un nouveau combat avec un badge encore actif retickera
   automatiquement (comportement voulu, pas un oubli). Retrait reste 100% manuel MJ (déjà noté en §9
   Architecture retenue point 3, sauf Acide en sortie de zone qui a son `expires_at_turn` calculé).
   Conséquence pour l'increment F.1 : `ENVIRONMENTAL_HAZARD_REGISTRY` **ne doit pas** être ajouté au
   balayage de `COMBAT_END` — ne pas "corriger" cette asymétrie plus tard sans revalider cette décision.
8. ~~`applyModStatus`/`clearModStatus` avalent les erreurs en silence~~ — **tranché (Saar, 2026-07-30)** :
   comportement actuel (`try/catch` → `console.error`, jamais de rethrow, `statusService.js:160-178`)
   acceptable pour les badges cosmétiques existants (mods d'armes), mais pas pour F.2/F.3
   (`exposeToHazard`/`clearHazard`) qui vont réellement déclencher des dégâts par Tour. **Implémentation
   précisée** (2ᵉ passe d'analyse critique) : ajout d'un flag optionnel `throwOnFailure = false` sur
   `applyModStatus`/`clearModStatus` (increment C), défaut inchangé pour l'unique appelant existant
   (boucle mods de `startResolutionPhase`, qui tourne dans le même `try` global que la transition de
   phase déjà committée — le faire lever par défaut aurait fait planter toute la résolution du Tour sur
   un simple échec d'écriture de badge de mod, régression non voulue). F.2/F.3 passeront
   `throwOnFailure: true` et attraperont pour lever une `AppError` (`server/src/lib/AppError.js`, pattern
   déjà utilisé par `echeanceService.js` et lu par le middleware central `errorHandler.js`) — cohérent
   avec le fait que G n'expose ces actions qu'en routes REST (aucun event socket dans ce lot).
9. Ré-exposition d'une cible déjà marquée (ex. re-cliquer "Exposer au feu" sur un token déjà `on_fire`)
   — **différé à l'increment G (UI), pas un blocage pour C-F**. Contexte donné par Saar : l'action MJ
   envisagée ne cible probablement pas le token/joueur directement mais une **source de danger** (zone
   de feu/acide posée sur la carte, popup de niveau d'intensité) — sauf cas où l'arme applique l'effet
   directement à une cible précise (ex. lance-flammes), qui ne rentre pas dans ce patron "zone". Les
   deux mécaniques (zone vs cible directe) coexisteront probablement. Écrasement des valeurs `data` en
   base reste autorisé techniquement (`onConflict().merge()`) ; la prévention du double-clic accidentel
   et le choix zone/cible sont un sujet d'ergonomie propre à G, à cadrer séparément avant ce lot-là.
10. ~~Localisation « exposée » du Feu/Acide vs localisation aléatoire de la Chute~~ — **tranché (Saar,
    2026-07-30)**, trouvé en relisant le RAW verbatim du Feu (p.243, non relu en détail avant cette
    passe) : petite flamme et feu moyen touchent **« la Localisation exposée »** (partie du corps
    réellement en contact — variable par instance, PAS un tirage 1D20), alors que Grand feu (2D10,
    **1D3** Localisation(s) — RAW littéral, confirme le design déjà prévu) et Chute restent aléatoires.
    Brasier (3D10/Tour) : RAW ne précise **aucune** Localisation pour ce palier — silence RAW, comme
    l'intensité de l'Acide déjà notée (point 2), laissé à l'appréciation MJ via `data.locations`.
    Décision (Saar, "architecture robuste/pérenne/adaptative, corriger l'ensemble au besoin") :
    réutiliser tel quel le vocabulaire de la **visée** déjà existant (COM9,
    `shared/armorConstants.js` : `LOCATION_TO_SLOT`/`SLOT_TO_WOUND_LOCATION`, clés `tete`/`corps`/
    `bras_gauche`/`bras_droit`/`jambe_gauche`/`jambe_droite`) plutôt qu'une nouvelle notion. Le champ
    `data.forcedLocation` (increment F, **même nom et même représentation** que
    `ENVIRONMENTAL_HAZARD_REGISTRY[].forcedLocation` — pas de 2ᵉ vocabulaire, une seule conversion en
    F.4 : `LOCATION_TO_SLOT[entry.forcedLocation ?? row.data?.forcedLocation ?? null]` → `forcedSlotCode`
    de `resolveTargetHit`, `null` = aléatoire natif) porte la localisation choisie par le MJ à
    l'exposition pour Acide/petite flamme/feu moyen. Validation à l'écriture (F.2, `exposeToHazard`) :
    `data.forcedLocation` doit être une clé connue de `LOCATION_TO_SLOT` (même source de vérité que la
    visée, pas de liste dupliquée), sinon `AppError` (`throwOnFailure`, point 8). UI (G, pas cadrée
    maintenant) : réutiliser le composant client de sélection de localisation de la visée plutôt que
    d'en construire un nouveau.

**Hors périmètre** :
- Détection automatique de hauteur de chute via `WorldSnapshot` — saisie manuelle MJ.
- Détection automatique de zone Acide/Feu/Décompression via le moteur monde — déclenchement et retrait
  100% MJ.
- "Dommages de Choc" (item 2 du chapitre RAW) — déjà hors périmètre du plan entier (§2), chantier CHOC1
  séparé.
- Vêtements prenant feu automatiquement sur certains coups d'arme incendiaire — la RAW le mentionne en
  passant, mais ce lot ne construit que le déclenchement/tick manuel MJ, pas un déclenchement
  automatique depuis une résolution d'attaque.
- Chute au-delà de 10D10 ("dommages massifs...") — RAW elle-même vague/inachevée sur ce cas (une seule
  phrase, pas de table). Traité comme narratif MJ pur, aucune formule mécanique construite au-delà.

### Plan d'exécution (incréments vérifiables) — 2026-07-30, analyse à charge faite avant rédaction

> Chaque increment ci-dessous a été vérifié contre le code réel (pas supposé) avant d'être écrit ici.
> Deux increments (A, B) déjà codés et testés à la date de rédaction — cf. `docs/EN_COURS.md`.

**A. ✅ Extraction `fetchCibleNA`** (`server/src/lib/damageService.js`) — fait, testé, voir plus haut §9
"point structurel 2". **Complété le 2026-07-30** : la 1ʳᵉ passe n'avait converti que
`resolveDroneAssaultAction` ; audit de reprise a trouvé une 2ᵉ copie réelle (identique, isolée) dans
`resolveAssaultAction` (`socketCombatHelpers.js`, ex-lignes 2719-2736) — convertie à son tour, une seule
copie désormais dans ce fichier. `resolveMeleeAction` (lignes 1522-1571) garde son propre calcul inline :
ce n'est **pas** un doublon paresseux — le calcul NA y est un sous-produit d'un `Promise.all` combiné qui
fetch aussi identity/wounds/inventaire/armes de contact pour la sélection de compétence défenseur ;
appeler `fetchCibleNA` à la place ajouterait 3 requêtes redondantes. Laissé tel quel, décision
consciente.

**B. ✅ `armorReductionFactor` sur `resolveTargetHit`** (`server/src/lib/damageService.js`) — fait,
testé (128/128), additif, comportement des appelants existants strictement inchangé.

**C. ✅ Migration 225 + `statusService.js`** — fait le 2026-07-30. Migration appliquée (batch 143, via
`db.migrate.latest()` au démarrage du serveur `dev` déjà actif — colonne `data` confirmée présente et
nullable sur `token_statuses`). `applyModStatus`/`clearModStatus` acceptent `data`/`throwOnFailure`,
comportement de l'appelant existant strictement inchangé (vérifié par défauts).
- `server/src/db/migrations/225_token_statuses_data.js` : `ALTER TABLE token_statuses ADD COLUMN data
  JSONB NULL` (additive, aucune donnée existante affectée — `token_statuses` n'a aujourd'hui que
  `id`/`token_id`/`status_code`/`applied_by`/`applied_at`/`expires_at_turn`, vérifié dans les
  migrations `68_token_statuses.js`/`79_token_statuses_expiry.js`).
- `applyModStatus(io, db, campaignId, tokenId, statusCode, { expiresAtTurn = null, data = null,
  throwOnFailure = false } = {})` / `clearModStatus(io, db, campaignId, tokenId, statusCode,
  { throwOnFailure = false } = {})` (`server/src/lib/statusService.js:160-178`) : `data` ajouté à
  l'objet inséré. `.onConflict([...]).merge()` (sans argument) fusionne déjà toutes les colonnes de
  l'insert, `data` y sera donc inclus automatiquement sans changement de la clause `merge()`
  elle-même. `throwOnFailure` (point ouvert 8) : si `true`, le `catch` lève une `AppError(500, ...)`
  au lieu de logger et avaler ; si `false` (défaut), comportement historique inchangé. Signature
  additive — **corrigé (2ᵉ passe d'analyse critique)** : `applyModStatus` n'a en réalité qu'**un seul**
  appelant existant aujourd'hui (`socketCombatHelpers.js:187`, boucle mods de `startResolutionPhase`,
  vérifié par recherche exhaustive dans `server/`), pas "une vingtaine" comme écrit dans une version
  antérieure de ce plan — il continue avec `data: null, throwOnFailure: false` implicites, comportement
  strictement inchangé.

**D. ✅ `shared/fallDamageConstants.js`** — fait et testé le 2026-07-30 (`fallDamageConstants.test.mjs`,
5/5, `node --test shared/fallDamageConstants.test.mjs`). Table RAW verbatim (`docs/REGLES/
FATIGUE&DOMMAGES.md` lignes 14-25) :
- Niveau du sol : 1D6, 1 loc. — **déclenché uniquement** si le personnage courait à Allure maximale
  OU a obtenu une Catastrophe à un Test d'Acrobatie/Équilibre (jamais une "hauteur 0" saisie par
  défaut — décision MJ narrative de déclencher ce cas précis, pas une valeur de hauteur).
- 1 m : 1D6, 1 loc. — 2 m : 1D10, 1 loc. — 3 m : 2D10, 1 loc. — 4 m : 3D10, 1D3 loc.
- Au-delà de 4 m : `fallDamageBeyondFourMeters(h)` → `(h-1)D10`, 1D3+3 loc. — simplification
  algébrique vérifiée équivalente à `3D10 + 1D10×(h-4)` (h=4 → 3d10 identique au palier 4m, h=5 → 4d10
  = 3d10+1d10), nécessaire car `parseDice` ne supporte qu'un seul type de dé par formule, pas un
  composé `3d10+1d10`. Plafonné narrativement à 10D10 (hors périmètre au-delà, voir ci-dessus) — aucune
  limite numérique imposée dans la constante elle-même, décision MJ pure.
- Terrain accidenté (gravas/ferraille) : +1D10, indépendant de la hauteur.
- Même patron d'extraction que `WOUND_HEALING`/`WOUND_INFECTION` (`shared/woundConstants.js`), tests
  colocalisés `*.test.mjs` inclus (comblant le manque de couverture noté en analyse critique de reprise
  sur ce Lot).

**E. ✅ Service résolution Chute** — fait le 2026-07-30, `server/src/lib/fallDamageService.js`
(`resolveFall`). Vérifié : `node --check` OK, chaque appel confronté au code réel (`calcSkillTotal`,
`resolvePolarisTest`, `resolveTargetHit`, pattern `ACROBATIE_EQUILIBRE`). Point non tranché
explicitement par Saar, décidé par défaut (documenté en commentaire dans le fichier) : hauteur
effective = 0 pour le malus du Test quand `groundTrigger` est vrai (RAW silencieuse sur ce cas précis).
Aucun test automatisé écrit — cohérent avec l'absence de tests sur `resolveTargetHit` lui-même
(fonction d'orchestration DB+socket, pas une fonction pure ; le projet ne teste ce type de fonction
qu'en conditions réelles via l'UI, jamais par fixture, contrairement aux services purs comme
`fallDamageConstants.js`/`polarisTestService.js`).

Détail original du design (ci-dessous, conservé pour traçabilité) :
1. `resolveFall(io, db, campaignId, { characterId, charSheetId, heightMeters, groundTrigger,
   terrainAccidente, attemptTest })` — `groundTrigger` (bool, cas "niveau du sol") et `heightMeters`
   sont mutuellement exclusifs côté UI (l'un ou l'autre, jamais les deux).
2. Dégâts bruts = formule(`shared/fallDamageConstants.js`) [+1D10 si `terrainAccidente`].
3. **Un seul fetch combiné** (pas `fetchCibleNA` ici — corrigé lors de l'analyse à charge : `fetchCibleNA`
   ne retourne que NA, alors que le Test d'Acrobatie/Équilibre a besoin des mêmes lignes brutes
   `attrs`/`archetype`/`mutationEffects`/`genotypeRow` que `calcSkillTotal` — un appel à `fetchCibleNA`
   PUIS un re-fetch séparé de ces mêmes lignes pour le Test dupliquerait 3 requêtes pour rien) :
   `attrs`/`archetype`/`mutationEffects` (`Promise.all`, patron `fetchCibleNA`) + `genotypeRow` (si
   `archetype.genotype_id`) → `for_na`/`con_na`/`vol_na` via `calcAttributeNA` directement (3 appels,
   même calcul que `fetchCibleNA` mais sans 2ᵉ fetch).
4. Si `attemptTest` et hauteur ≤ 5 m (RAW : "au-delà de 5 mètres, impossible de réduire") : à partir
   des mêmes `attrs`/`genotypeRow`/`mutationEffects` déjà en main, fetch seulement
   `ref_skills`/`char_skills` pour `ACROBATIE_EQUILIBRE` (patron exact : `socketCombatHelpers.js:
   1437-1442`) → `calcSkillTotal(...)` → seuil = total − hauteur×2 → `resolvePolarisTest(seuil)`.
   Réussite → dégâts bruts réduits de `1D6 + mr`, plancher 0 (`Math.max`).
5. N localisations (table D) → boucle de N appels `resolveTargetHit(io, db, campaignId, {
   degautsBruts, characterIdCible: characterId, cibleType: characters.type (fetché, 'pj' ou 'pnj' —
   jamais codé en dur : une Chute peut toucher un PNJ, pas seulement un joueur — **corrigé lors de
   l'analyse à charge de ce plan**, la première rédaction hardcodait `'pj'`), char_sheet_id_cible:
   charSheetId, for_na_cible, con_na_cible, vol_na_cible, armorReductionFactor: 0.5 })` — jamais de
   `forcedSlotCode` (localisation 1D20 native à chaque appel), même `degautsBruts` réutilisé aux N
   appels (point ouvert 1 tranché par Saar). **Hors périmètre** : cible `type: 'drone'` — `
   resolveTargetHit` retourne `null` pour un drone (comportement existant, ligne 305 de
   `damageService.js`), ce lot ne construit pas de chemin `resolveDroneIntegrityLoss` équivalent pour
   la Chute/les dangers environnementaux ; un drone exposé ne subit donc rien via ce lot.
6. Retourne le détail agrégé (jets, seuil/mr du Test, N localisations touchées, blessures créées) pour
   affichage MJ.

**F. ✅ Exposition/tick Acide-Décompression-Feu** — fait le 2026-07-30. `shared/environmentalHazardRegistry.js`
(testé 3/3), `server/src/lib/environmentalHazardService.js` (`exposeToHazard`/`clearHazard`/
`resolveEnvironmentalHazardTicks`), hook dans `startResolutionPhase` (`socketCombatHelpers.js`, juste
après la boucle des mods). Deux ajustements trouvés en auto-relecture (pas dans le design initial) :
- **`diceParser.js` factorisé** : `parseFormulaShape` (interne) extraite de `parseDice`, nouvel export
  pur `isValidDiceFormula(formula)` (jamais un jet, juste la validation syntaxique) — testé 4/4
  (`diceParser.test.mjs`, nouveau, comblant une lacune de couverture sur une fonction au cœur de tout
  le combat). Utilisé par `exposeToHazard` pour rejeter une formule/nombre de localisations MJ invalide
  **à l'écriture** plutôt que de laisser planter tout `startResolutionPhase` (donc toute la résolution
  du Tour pour la campagne entière) au premier Tick sur une formule mal saisie.
- **Garde `row.data?.formula` dans `resolveEnvironmentalHazardTicks`** : une ligne `token_statuses`
  malformée/legacy (hors flux `exposeToHazard`) est ignorée plutôt que de planter toute la boucle pour
  les autres tokens de la campagne.

**Renommage des codes (2026-07-30, increment G, en construisant l'UI)** : `on_fire`/`acid_exposure`
renommés en `burning`/`acid` (Décompression inchangée) dans `ENVIRONMENTAL_HAZARD_REGISTRY` et partout
où le code apparaît (`environmentalHazardService.js`, routes, tests). Motif : `TokenStatusPanel.jsx`/
`socketToken.js` avaient déjà `burning`/`acid`/`decompression` comme toggle cosmétique (catégorie
`dot`, aucune `data`, aucun effet mécanique) avec icônes `/assets/status/*.svg` et clés i18n `status.*`
existantes — `decompression` collisionnait exactement, `on_fire`/`acid_exposure` auraient dupliqué
assets/i18n pour le même concept sous un 2ᵉ nom. Ces 3 codes étaient un parking-lot cosmétique
(catégorie "dot" = "damage over time") anticipant précisément ce Lot — migrés vers le vrai mécanisme,
retirés de `socketToken.js:VALID_STATUS_CODES` (le toggle nu écraserait silencieusement `data` posée
par `exposeToHazard` via `.onConflict().merge()`). Passent désormais exclusivement par les routes
`expose`/`clear`.

> **Révision (2026-07-30, après recherche pro, suite à la demande explicite de Saar de ne jamais
> coder à partir de zéro sans avoir regardé comment les pros font)** : la 1ʳᵉ rédaction proposait un
> `HAZARD_CODES` figé + une boucle bespoke, jetable, non réutilisable par un futur lot. Recherche PF2e
> (Foundry VTT — système TTRPG open-source le plus abouti en la matière) : chaque condition/effet y
> est un **Rule Element**, un type déclaré dans un registre (`RuleElements.builtin`,
> `src/module/rules/index.ts`) qui sait résoudre son propre comportement — le moteur ne connaît qu'un
> seul point de dispatch générique, jamais un `switch/case` central par type d'effet. Ce patron existe
> **déjà dans Enclume** sous une forme quasi identique : `shared/weaponModRegistry.js`
> (`WEAPON_MOD_REGISTRY`) + `resolveModHooks` (`weaponModService.js:97-107`) pour les mods d'armes.
> Plutôt qu'un tableau figé + boucle jetable, Lot 3 réutilise ce **même patron** pour les dangers
> environnementaux — un vrai registre, extensible sans toucher au moteur de dispatch. Bénéfice
> concret et immédiat (pas juste esthétique) : Lot 5 (Froid, §11 ci-dessous) aura besoin d'une
> infrastructure de résolution récurrente très proche (dégâts croissants par exposition prolongée) —
> poser un registre maintenant plutôt qu'une boucle jetable évite un 2ᵉ rebuild à ce moment-là.

Nouveaux fichiers `shared/environmentalHazardRegistry.js` + `server/src/lib/environmentalHazardService.js`,
plus modif ciblée de `startResolutionPhase` (`server/src/socket/socketCombatHelpers.js:154-208`).
**Précision (3ᵉ passe d'analyse critique, 2026-07-30)** : le patron exact est celui
d'`echeanceTypeRegistry.js`/`findEcheanceRegistryEntry` (lookup simple, un seul handler par ligne),
**pas** l'agrégation/priorité de `weaponModRegistry.js`/`resolveModHooks` (plusieurs mods actifs
simultanément sur une même arme, résolus ensemble avec un ordre de priorité). Un token peut porter
plusieurs dangers environnementaux à la fois (feu + acide simultanément, RAW ne l'interdit pas) mais
chaque **ligne** `token_statuses` se résout indépendamment via un seul lookup — jamais d'agrégation
entre plusieurs dangers d'un même token. Même correction déjà faite une fois pour `echeanceTypeRegistry.js`
lui-même (Lot 2, §8, "la moitié dispatch de weaponModService.js ne s'applique pas ici") — le mécanisme
décrit ci-dessous (boucle par ligne, F.4) était déjà correct, seul le nom du patron cité prêtait à
confusion :

1. `shared/environmentalHazardRegistry.js` — `ENVIRONMENTAL_HAZARD_REGISTRY = [{ code:
   'acid_exposure', forcedLocation: null }, { code: 'decompression', forcedLocation: 'corps' },
   { code: 'on_fire', forcedLocation: null }]` + `findHazardRegistryEntry(code)`, même forme que
   `findEcheanceRegistryEntry` (`shared/echeanceTypeRegistry.js`, déjà ce patron pour le Lot 2). Seule
   la localisation forcée (RAW : Décompression toujours Corps) est déclarative ici — formule/nombre de
   localisations restent dans `token_statuses.data` (par instance, pas par type, puisqu'un Feu petit
   et un brasier partagent le même `code` mais pas la même intensité).
2. `exposeToHazard(io, db, campaignId, tokenId, hazardCode, { formula, locations = 1, forcedLocation =
   null })` → valide `findHazardRegistryEntry(hazardCode)` existe (sinon `AppError`, même garde que
   `createEcheance` pour un `condition_type` inconnu) → si `forcedLocation` fourni, valide que c'est
   une clé connue de `LOCATION_TO_SLOT` (`shared/armorConstants.js`, même vocabulaire que la visée
   COM9, point ouvert 10 — sinon `AppError`) → `statusService.applyModStatus(io, db, campaignId,
   tokenId, hazardCode, { expiresAtTurn: null, data: { formula, locations, forcedLocation },
   throwOnFailure: true })` (increment C, point ouvert 8). Décompression : `formula` fixe `'1d10'` ou
   `'2d10'` (case MJ "paliers manqués" à l'exposition), `forcedLocation` inutile ici (déjà géré
   statiquement par le registre, point ouvert 10). Grand Feu : `locations: '1d3'` (chaîne, formule à
   relancer chaque Tick — RAW ne précise pas si le nombre de localisations est fixé à l'ignition ou
   varie par Tour ; interprétation retenue : re-tirée chaque Tick, cohérente avec le "par Tour" de la
   formule de dégâts elle-même, qui elle est explicitement relancée à chaque fois), `forcedLocation`
   laissé `null` (aléatoire, RAW littéral "1D3 Localisation(s)"). Petite flamme/feu moyen/Acide :
   `forcedLocation` attendu (RAW : "la Localisation exposée"), pas forcé côté serveur — un MJ qui
   omet ce champ obtient un tirage aléatoire au lieu d'une localisation fixe, à corriger côté UI (G)
   plutôt que bloqué côté serveur (une omission MJ reste une décision de jeu valide, pas une erreur).
3. `clearHazard(io, db, campaignId, tokenId, hazardCode, { linger = false, currentTurn = null } =
   {})` :
   - `linger: false` (Feu éteint, Acide neutralisé, Décompression stoppée) → `statusService.
     clearModStatus(...)` immédiat, comme aujourd'hui.
   - `linger: true` (sortie de zone Acide uniquement, RAW : persiste "1D6 Tour(s)") → **ne supprime
     pas** la ligne, mais `UPDATE token_statuses SET expires_at_turn = currentTurn + roll(1d6) + 1
     WHERE token_id/status_code`. Le `+1` est nécessaire (pas juste `+roll`) : la purge universelle de
     fin de Tour (`socketCombatHelpers.js:1092-1114`, condition `expires_at_turn <= newTurn`) retire
     le statut **avant** la phase de résolution du Tour où `newTurn === expires_at_turn` — sans le
     `+1`, l'Acide ne tickerait que `roll-1` fois au lieu des `roll` Tours RAW. Vérifié en traçant
     l'ordre réel `startResolutionPhase` (tick) → ... → purge de fin de Tour (incrément `current_turn`)
     → `ANNOUNCEMENT` suivant.
4. `resolveEnvironmentalHazardTicks(io, db, campaignId, hazardRows)`
   (`environmentalHazardService.js`) — dispatch générique, patron `resolveModHooks`
   (`weaponModService.js:97-107`) : pour chaque ligne, `findHazardRegistryEntry(row.status_code)`
   (registre increment F.1, jamais un `if/else` par code) → `parseDice(row.data.formula)` pour
   `degautsBruts` du Tick → `parseDice(row.data.locations)` si c'est une chaîne de dés (ex. Grand Feu
   `'1d3'`), sinon le nombre fixe → `token_id` → `tokens.character_id` → `characters.type`/
   `char_sheet.id` (join, même patron que `resolveAssaultAction` ligne ~2230-2233) → **un seul fetch
   combiné** `attrs`/`archetype`/`mutationEffects`/`genotypeRow` → NA via `calcAttributeNA` (même
   correction qu'en E.3, pas de double-fetch via `fetchCibleNA`) → boucle de N appels
   `resolveTargetHit` avec le vrai `cibleType`, `forcedSlotCode` dérivé d'une précédence unique
   (point ouvert 10) : `const locKey = entry.forcedLocation ?? row.data?.forcedLocation ?? null` →
   `locKey ? LOCATION_TO_SLOT[locKey] : null` — registre (Décompression) prime sur l'instance
   (Acide/petite flamme/feu moyen si le MJ l'a renseigné à l'exposition), `null` = 1D20 natif (Grand
   feu/Brasier, ou Acide/Feu sans `forcedLocation` fourni). Mêmes remarques drone/pj/pnj qu'en E. Un
   token sans `character_id` ou de type `drone` est ignoré (mêmes limites qu'en E).
5. Appel depuis `startResolutionPhase`, juste après la boucle des mods existants (ligne ~190) :
   ```js
   const hazardRows = await db('combat_roster as roster')
     .join('token_statuses as ts', 'roster.token_id', 'ts.token_id')
     .where({ 'roster.campaign_id': campaignId, 'roster.status': 'active' })
     .whereIn('ts.status_code', ENVIRONMENTAL_HAZARD_REGISTRY.map(e => e.code))
     .select('roster.token_id', 'ts.status_code', 'ts.data')
   await resolveEnvironmentalHazardTicks(io, db, campaignId, hazardRows)
   ```
   (même patron de jointure que `getAllCombatMods`, `weaponModService.js:114-121`, scope par
   `combat_roster` puisque `token_statuses` n'a pas de `campaign_id` propre — **boucle indépendante de
   celle des mods**, les deux registres restent séparés : un danger environnemental n'est pas un mod
   d'arme, les fusionner en un seul registre aurait mélangé deux domaines sans rapport).

**G. Routes/socket/UI** (dernier increment, après validation de C-F) — cadré le 2026-07-30, passe
solo UX/UI (rôle expert interface gaming demandé par Saar), validé par Saar ("rien à redire, alignés").

**Découverte de cadrage (pas un défaut de F, une clarification de périmètre)** : `docs/
FUSION_PROJET_COUSIN.md` §2 déclare `server/src/services/worldEffectService.js` autorité des "effets
de terrain" — un système de zones AABB posées sur la carte (`world_effect_definitions`/
`world_effect_instances`, migration 154, built-ins `fire`/`gas`/`oil`/`flooded` déjà déclarés, outil MJ
de tracé déjà dans `Sidebar.jsx` ~1212-1377) existe déjà côté moteur monde, avec des hooks `turnStart`
**jamais consommés** (`grep turnStart server/src` → 0 résultat). Ce n'est **pas** un doublon du Lot 3 :
RAW distingue explicitement deux cas — exposition **personnelle/ciblée** (*"vêtements qui prennent feu
sur un personnage"*, *"aspergé de liquide inflammable"* — suit le personnage, indépendant de la
position) traitée par `token_statuses`/Lot 3 (F), vs exposition **de zone/ambiance** (*"atmosphère
corrosive"*) qui relève de `worldEffectService.js`. **G reste scopé au cas personnel/ciblé.** Le cas
zone (brancher les hooks `turnStart` déjà déclarés côté monde) est un chantier séparé, plus tard,
territoire Codex/dev-monde — pas improvisé ici. Confirme et formalise l'intuition de Saar ("zone vs
lance-flammes qui cible directement, coexisteront probablement", tour précédent).

**UI — aucun nouveau composant structurel, tout se greffe sur l'existant** :
- Point d'entrée MJ : `TokenRadialMenu.jsx` (clic droit sur un token, déjà utilisé pour "statuts") —
  nouvelle entrée "Chute", "statuts" enrichi pour les 3 codes danger.
- Poser/retirer un danger : `TokenStatusPanel.jsx` (bulle 3×5, déjà MJ/owner-gated) — étendu avec un
  sous-formulaire (formule/localisations) pour les 3 codes danger, pas un simple toggle comme les
  statuts existants.
- Localisation exposée (`data.forcedLocation`, point ouvert 10) : `AimedLocationPicker.jsx` (silhouette
  cliquable, déjà les 6 clés RAW `LOCATION_I18N_KEYS`) réutilisé tel quel, aucun nouveau composant.
- Badge sur le token : `TokenPresentation.jsx:TokenStatusBadges` — ajouter `acid_exposure`/
  `decompression`/`on_fire` à `STATUS_CATEGORY` + icônes SVG dédiées.
- Résultat de la Chute (jets, blessures) : nouvelle fenêtre courte, même famille visuelle que
  `CombatStunWindow.jsx`.

**Routes REST — ✅ fait le 2026-07-30** (`server/src/routes/campaigns.js`, GM uniquement
`requireAuth`+`requireRole('gm')`, même patron que `healing-choice`/`infection-mode` déjà dans ce
fichier). `resolveCampaignToken(campaignId, tokenId)` factorisée (jointure `tokens`→`battlemaps`→
`campaign_id`, `tokens` n'a pas de `campaign_id` propre) — vérifie qu'un token appartient bien à la
campagne avant toute mutation, réutilisée par les 3 routes plutôt que dupliquée :
- `POST /api/campaigns/:id/hazards/fall` (body : `{ tokenId, heightMeters?, groundTrigger?,
  terrainAccidente?, attemptTest? }`) → `fallDamageService.js:resolveFall`.
- `POST /api/campaigns/:id/tokens/:tokenId/hazards/:code/expose` (body : `{ formula, locations?,
  forcedLocation? }`) → `environmentalHazardService.js:exposeToHazard`.
- `POST /api/campaigns/:id/tokens/:tokenId/hazards/:code/clear` (body : `{ linger? }`) →
  `environmentalHazardService.js:clearHazard`.

UI client — fait en fichiers segmentés (Saar peut relire du JSX, contrairement au code serveur dense) :

- **✅ Exposition/retrait Acide/Feu/Décompression** — fait le 2026-07-30, `TokenStatusPanel.jsx` étendu
  (sous-formulaire au lieu du toggle nu pour ces 3 codes, MJ uniquement), `SessionPage.jsx` (prop
  `campaignId` ajoutée), `AimedLocationPicker.jsx` (prop `showMalus=false` ajoutée — réutilisé tel quel
  pour choisir `forcedLocation`, pas de malus de visée hors contexte d'attaque). Présets RAW extraits en
  constante partagée `shared/environmentalHazardPresets.js` (testé 2/2, même patron que
  `fallDamageConstants.js`), clés i18n `combat.json:hazardPanel.*` (nouvelles, `en.json` gelé donc non
  touché). `node --check`/tests/`eslint`/`npm run build` (client) tous passés.
- **✅ Chute** — fait le 2026-07-30, **écart assumé par rapport au cadrage initial** : pas une nouvelle
  entrée dans `TokenRadialMenu.jsx`. En lisant le composant, le nombre de secteurs (`N = 8`) est couplé
  à la géométrie SVG (angles, graduations) — passer à 9 change l'équilibre visuel du menu radial (dont
  la boussole de rotation centrale est déjà calée sur 8 directions, un souci esthétique différent mais
  qui aurait rendu l'ajout d'un 9ᵉ secteur visuellement bancal). Choix retenu : un bouton "Chute" dans
  `TokenStatusPanel.jsx` (déjà ouvert depuis le secteur "statuts" existant), formulaire dédié (hauteur/
  niveau du sol/terrain accidenté/tentative de réduction) + affichage du résultat agrégé (dégâts, Test,
  localisations touchées avec sévérité — réutilise `LOCATION_I18N_KEYS`/`charSheet:locationPanel.
  severityShort.*` déjà existants, aucune nouvelle table de libellés). Panneau plafonné à la hauteur du
  viewport avec défilement interne (jusqu'à 6 localisations possibles sur une grosse chute, la hauteur
  du panneau ne pouvait pas rester une estimation fixe). Clés i18n `combat.json:fallPanel.*`.
  `eslint`/`npm run build` (client) passés.

Increment G clos — Lot 3 entier (C à G) fonctionnellement complet.

**2026-07-30 — test navigateur Saar : fonctionnel OK.** Retour ergonomique : fenêtre `TokenStatusPanel`
et icônes de statuts trop petites. Ajusté : icônes grille 20→32px, libellés 8→10px, largeur panneau
320→340px, hauteurs estimées +~20 (300/450/400 selon le mode) — plafond viewport + scroll interne déjà
en place absorbe tout dépassement résiduel. `eslint`/`npm run build` (client) repassés, propres.

**2026-07-30 — bug réel trouvé au test navigateur : dégâts environnementaux invisibles dans le
"chat".** Cause racine (recherche dédiée) : `resolveTargetHit` ne fait jamais d'émission socket visible
en jeu — les attaques normales (`resolveAssaultAction`/`resolveMeleeAction`) émettent explicitement
`WS.COMBAT_ATTACK_RESULT` après coup (consommé par `CombatResultGM`/`CombatResultPlayer` via
`useCombatSocket.js`) ; `resolveEnvironmentalHazardTicks` (F.4) et `resolveFall` (E) ne le faisaient
jamais — la blessure était bien créée en base (`WOUND_ADDED`, jamais lu par l'overlay combat) mais rien
n'atteignait le panneau visible. Corrigé : les deux services émettent désormais `WS.COMBAT_ATTACK_RESULT`
par coup porté, réutilisant tel quel `CombatResultGM`/`CombatResultPlayer` (aucun nouveau composant) :
- `tireurId: null` (pas de jet d'attaque, dégât automatique) + nouveau champ `sourceCode`
  (`'burning'|'acid'|'decompression'|'fall'`) résolu en libellé **côté client**
  (`CombatOverlay.jsx:resolveAttaquantLabel`) — jamais de texte FR figé émis par le serveur (i18n.md).
  `burning`/`acid`/`decompression` réutilisent les clés `status.*` déjà existantes (mêmes codes que
  Lot 3 §9 increment G) ; `fall` → `combat.json:fallPanel.title`.
- `isPnj: true` réutilisé pour son effet pratique dans `useCombatSocket.js` (montré au MJ ET au joueur
  ciblé), pas pour son sens littéral "cible PNJ" — pas de nouveau champ pour éviter d'étendre le contrat
  d'événement pour un besoin déjà couvert.
- **Correctif connexe** : `CombatResultPlayer` affichait `roll`/`seuil` sans garde (`undefined` visible
  à l'écran) contrairement à `CombatResultGM` qui avait déjà `{roll !== undefined && (...)}`. Harmonisé
  — sans effet sur les attaques normales (elles fournissent toujours un `roll` réel), nécessaire pour
  que Chute/dangers (qui n'ont pas de jet d'attaque) s'affichent proprement.
- Pas d'émission `DICE_RESULT` (animation du jet de Test de Choc) pour ces dégâts — aurait demandé un
  `username`/`color` fictif pour l'auteur du jet, hors scope ; le résultat du Test de Choc reste visible
  dans le panneau via `shockResult` (bloc dédié), seule l'animation du dé lui-même est absente.

`node --check` (serveur), `eslint`/`npm run build` (client) tous propres après correctif.

---

## 10. Lot 4 — Fatigue

> **Cadrage détaillé 2026-07-30** (relecture RAW complète p.242-243 — le §10 initial avait sous-estimé
> la mécanique réelle — + exploration du code réel + recherche externe). Aucun code écrit à ce stade.

**Dépend de** : Lot 0. Avancé volontairement dans la séquence (voir §5) — fournit le point d'entrée
partagé que les Lots 5/7/8/9/10 appellent tous.

### RAW relu en détail — ce que le §10 initial avait manqué

Le texte décrit un vrai **Test de Fatigue** (jet réel, pas une simple valeur posée à la main par le
MJ), avec une table de résultat précise, **et** un **Compteur de Fatigue à 6 états × 3 cases**
(Annexe p.250, capture Saar 2026-07-30) — pas 5 états comme écrit initialement. Chaque case porte un
malus qui ne s'applique **pas** aux autres Tests du personnage (ceux-là utilisent le malus de palier,
barème §4.1) mais uniquement à la difficulté du **prochain** Test de Fatigue (ou Test de Choc au
dernier palier) :

| Palier | Normal | Légèrement fatigué (-3) | Fatigué (-5) | Très fatigué (-7) | Épuisé (-10) | À bout de force (-10) |
|---|---|---|---|---|---|---|
| Case 0 | +0 | +0 | +0 | +0 | +0 | Choc -5 |
| Case 1 | -5 | -5 | -5 | -5 | -5 | Choc -10 |
| Case 2 | -10 | -10 | -10 | -10 | -10 | Choc -15 |

Deux malus **indépendants**, jamais confondus : le malus de **palier** (colonne, barème §4.1,
0/-3/-5/-7/-10/-10) s'applique à tous les Tests du personnage sauf ses Tests de Fatigue eux-mêmes
(RAW explicite, ligne 976-979) ; le malus de **case** (tableau ci-dessus) s'applique uniquement au
prochain Test de Fatigue/Choc.

Résolution du Test de Fatigue (Test de CON, VOL, Endurance — compétence réelle CON/VOL,
`REGLECOMPETENCE.md:87-92` — ou moyenne CON/VOL au choix du MJ, + modificateur de difficulté
optionnel MJ) :
- **Échec, pas de risque de Catastrophe** (`!isSuccess && !catastropheRisk`) → palier +1, case posée
  sur **0** du nouveau palier.
- **Catastrophe** (`catastropheRisk`, marge d'échec ≤ -15) → palier +1, case posée sur **1** (pas 0)
  du nouveau palier.
- **Réussite, marge < 15** → case +1 dans le palier courant (plafonnée à 2, ne redescend jamais toute
  seule).
- **Réussite, marge ≥ 15** (« second souffle ») → case -1. **[HYPOTHÈSE, pas un fait RAW littéral]** :
  le texte dit seulement « réduisant ainsi le niveau de Fatigue général », sans préciser si ça peut
  franchir la borne basse du palier courant. Retenu par symétrie avec la réussite normale (qui, elle,
  RAW précise explicitement « ne change pas de niveau ») : plancher à la case 0 du **palier courant**,
  jamais de franchissement vers le palier inférieur par ce chemin — seule la Récupération (repos)
  fait baisser de palier. À confirmer avec Saar si une lecture différente est préférée, sinon retenu
  tel quel en codant.
- **Palier 5 (« À bout de force »)** : le Test de Fatigue est **remplacé** par un Test de Résistance
  au Choc (même source CON/VOL/Endurance/moyenne, même déclaration, malus de case = table Choc
  ci-dessus au lieu de la table Fatigue) — **tranché avec Saar 2026-07-30** : échec → **Évanoui**
  (1D6 minutes), Catastrophe → **Inconscient** (même formule de durée que le Choc de blessure
  existant, `statusService.js`/`_applyAutoStun`, 1D6×10 — "min→tours" — pas une durée inventée).
  Réussite → case +1 quand même (plafonnée à 2, palier ne peut pas dépasser 5).

**[6ᵉ passe d'analyse critique, même session] Correction — mauvais flag moteur utilisé pour
« Catastrophe ».** La rédaction précédente utilisait `isCriticalFail` (jet = 20, « Échec critique »,
`resolveTestOutcome`) comme proxy de « Catastrophe » — vérifié faux contre `shared/
polarisTestResolution.js` : ce sont deux concepts RAW distincts (p.204 « Catastrophes (optionnel) » ≠
« Échec critique », déjà géré en interne par `resolvePolarisTest` via son propre reroll avant que
`fatigueService.js` ne voie le résultat final). Le bon flag est `catastropheRisk` (marge d'échec
≤ -15). **Trouvaille supplémentaire en vérifiant** : le commentaire source de `resolveTestOutcome`
dit explicitement « jamais automatique, décision MJ » — et les 5 consommateurs actuels de
`catastropheRisk` (`socketCombatHelpers.js`) ne font que le transmettre dans `DICE_RESULT` pour
affichage, **aucun n'en tire une conséquence mécanique automatique** nulle part dans le projet
aujourd'hui. La Fatigue aurait été la première à le faire. **Tranché Saar 2026-07-30** : appliqué
automatiquement (pas de confirmation MJ intermédiaire) — le chapitre Fatigue ne prévoit aucune option
MJ pour ce cas précis, contrairement au flou volontaire du reste des règles de Fatigue.

**Récupération** (repos) — **confirmé Saar 2026-07-30** : action MJ manuelle « Repos complet » →
palier -1, case reposée sur **0** du palier inférieur (symétrique de la montée par échec, pas un
simple `points - 3`) ; pas de balayage automatique du Lot 2 (cohérent §4.2), l'horloge (Lot 1)
affichée en simple référence. Un « Repos partiel » (conditions dégradées) reste une action MJ libre
de déplacer la case de 1-2 sans changer de palier (RAW l'autorise explicitement, ligne 1015-1017) —
pas une fonction dédiée, juste une variante de paramètre de la même mutation.

**Pas de badge token** — tranché Saar 2026-07-30, revient sur l'option "miroir `token_statuses`" du
§10 initial. La Fatigue reste visible uniquement sur la fiche de personnage, aucune icône au-dessus
du token.

**Optionnel par campagne** — exigence Saar 2026-07-30 : toute la mécanique doit être désactivable,
`fatigue_enabled` (nouvelle clé `SETTINGS_SCHEMA`, `campaignSettingsService.js`, même patron que
`encumbrance_enabled`), **défaut `false`** (mécanique neuve, contrairement à l'encombrement qui
tournait déjà sans gate sur toutes les campagnes existantes — pas de raison de changer silencieusement
leur comportement dans un sens comme dans l'autre). Désactivée : aucun malus appliqué, aucune entrée
UI visible (bouton Test de Fatigue masqué, section fiche masquée).

### Trous structurels trouvés en explorant (pas prévus par le cadrage initial)

**1. Il n'existe aucun point d'agrégation unique des modificateurs de Test** — vérifié, pas supposé :
`calcWoundPenalty` (`charStats.js:273`) est appelé indépendamment à 5 endroits qui recalculent chacun
`woundPenalty - encumbrancePenalty` en dur (`socketCombatHelpers.js:1391,1593,2598`,
`socketEntity.js:253`, affichage `char-sheet.js:840`/`CharacterSheet.jsx:327`). Ajouter la Fatigue en
dupliquant un 6ᵉ appel identique à ces mêmes sites perpétue la dette plutôt que de la traiter, alors
que Froid/Maladies/Drogues/Irradiations (Lots 5/7/8/9) vont devoir se brancher au même endroit juste
après. **Recherche faite avant de trancher** (Saar, 2026-07-30 : "l'architecture avant le temps
passé") — patron Foundry VTT (Active Effects, [foundryvtt.com/article/active-effects](https://foundryvtt.com/article/active-effects/) ;
exhaustion D&D5e/PF2e, conditions à valeur numérique) : une source de vérité par état + **un seul
point d'agrégation** qui combine tous les modificateurs actifs avant tout jet, jamais recalculé
indépendamment par consommateur.

**Révision (2ᵉ passe d'analyse critique, 2026-07-30)** — une fonction unique à paramètres fixes
(`calcActiveMalus({ wounds, fatiguePoints, ... })`, version initialement écrite ici) rouvrirait cette
même fonction à chaque nouveau lot (5/7/8/9) pour lui ajouter un paramètre de plus — pas différent du
problème qu'elle est censée résoudre. Le projet a déjà tranché ce type de besoin trois fois
(`weaponModRegistry.js`, `echeanceTypeRegistry.js`, `environmentalHazardRegistry.js`) avec le même
principe : **registre déclaratif + dispatcher générique**, jamais un paramètre/switch central qui
grossit. Retenu ici à l'identique, à la différence près que chaque entrée calcule un **nombre** (pas
une mutation) :
- `server/src/lib/activeMalusRegistry.js` (nouveau) — `ACTIVE_MALUS_SOURCES = [{ key: 'wound',
  compute: ctx => calcWoundPenalty(ctx.wounds) }, { key: 'encumbrance', compute: ctx =>
  ctx.settings.encumbrance_enabled ? -calcEncumbrancePenalty(ctx.totalWeight, ctx.forNA,
  ctx.settings.encumbrance_multiplier) : 0 }, { key: 'fatigue', compute: ctx =>
  ctx.settings.fatigue_enabled ? getFatigueLevelMalus(ctx.fatiguePoints ?? 0) : 0 }]` +
  `calcActiveMalus(ctx) = ACTIVE_MALUS_SOURCES.reduce((sum, src) => sum + src.compute(ctx), 0)`.
- Lots 5/7/8/9 ajoutent chacun **une entrée** à ce tableau (même geste que Blessures peuplant
  `echeanceTypeRegistry.js` en Lot consommateur) — plus jamais besoin de retoucher les 5 sites
  consommateurs ni la signature de `calcActiveMalus` elle-même.
- `ctx` reste un objet simple assemblé par l'appelant à partir de ce qu'il a déjà en main (aucun
  changement de la couche de fetch existante à chacun des 5 sites — `char_sheet` y est déjà chargé en
  entier, `fatigue_points` y sera donc présent sans requête supplémentaire dès la migration posée).

**2. Risque de concurrence non traité dans la 1ʳᵉ rédaction de ce §10** — `setFatiguePoints`/
`resolveFatigueTest`/`restFatigue` lisaient `fatigue_points`, calculaient la nouvelle valeur en JS,
puis écrivaient — le même patron lire-puis-écrire déjà identifié comme dangereux et corrigé deux fois
dans ce plan (Lot 1 point 1 `adjustGameTime`, Lot 2 point 10 `pending_advance_undo_log`). Deux MJ (ou
un double-clic réseau) déclenchant un Test de Fatigue ou un repos sur le même personnage au même
instant perdraient silencieusement une des deux mutations. **Corrigé** : les trois fonctions
verrouillent la ligne `char_sheet` (`.forUpdate()`) avant de lire `fatigue_points`, dans la même
transaction que l'écriture — patron déjà réel dans le projet, pas inventé pour l'occasion
(`tradeService.js:190`, `db('char_sheet').where(...).forUpdate().first()`).

**3. Trou pré-existant révélé — tranché Saar 2026-07-30 : (a), corrigé dans ce lot** (« même si on
doit mettre le projet en pause pour bien recoder cette fonctionnalité »). Le système générique de
Test hors combat (`character_macros`/`MACRO_ROLL`, `socketDice.js:86-207`, et son aperçu
`POST /char-sheet/:id/macro-preview`, `char-sheet.js:1274-1326`) **n'applique aujourd'hui aucun malus
de blessure ni d'encombrement** — vérifié, `calcWoundPenalty` n'apparaît nulle part dans
`socketDice.js`. Un personnage blessé qui relance sa macro "Test Perception" obtient un seuil qui
ignore sa blessure, alors que la même compétence utilisée en combat l'inclut.

**Implémentation vérifiée contre le code réel des deux sites** (même geste aux deux endroits, code
quasi identique — `sheet`/`attrs`/`archetype`/`mutationEffects` déjà fetchés dans les deux, `na()`/
`secondaryValue()` déjà en place) :
- `sheet` (char_sheet complet, déjà fetché aux deux sites) porte déjà `fatigue_points` dès la
  migration 227 posée — aucune requête supplémentaire pour cette partie.
- Deux requêtes manquent aujourd'hui aux deux sites, à ajouter au même `Promise.all` existant :
  `db('character_wounds').where({ char_sheet_id: sheet.id })` (patron exact `char-sheet.js:835-837`)
  et le total pondéré `char_inventory` (patron exact `socketCombatHelpers.js:1388-1390`, join
  `ref_equipment`, exclusion `container === 'Coffre'`) + `getCampaignSettings(db, campaignId)` (déjà
  importée dans `char-sheet.js`, `campaignId` disponible via `req.character.campaign_id` — vérifié,
  posé par le middleware `router.param('characterId', ...)` — et déjà dans la closure du handler
  socket côté `socketDice.js`, aucun changement de signature de route/event nécessaire nulle part).
- `baseThreshold += calcActiveMalus({ wounds, fatiguePoints: sheet.fatigue_points, totalWeight,
  forNA: na('FOR'), settings })` — juste avant l'ajout du `modifier` manuel, aux deux endroits.
- Aucun opt-out par macro : le malus s'applique à toute source (`attribute`/`skill`/`secondary`),
  cohérent avec le fait qu'aucun des 5 sites combat n'a d'opt-out non plus (RAW : « malus à tous ses
  Tests », sans exception par type de Test).

**4. [3ᵉ passe d'analyse critique, même session] Le Test de Fatigue lui-même oubliait le malus actif
(blessure/encombrement).** Première rédaction : seuil = source + `getFatigueTestMalus` + `mjModifier`,
sans passer par `calcActiveMalus`. Or la Note RAW (ligne 976-979) n'exempte le Test de Fatigue **que**
du malus de **palier** de Fatigue lui-même (« les Tests de Fatigue ne sont pas affectés par le malus
que les différents états de Fatigue imposent aux autres Tests ») — elle ne dit rien d'une exemption au
malus de blessure ou d'encombrement, qui doivent donc continuer à s'appliquer normalement (rien dans
le texte ne les exempte). **Corrigé** : `calcActiveMalus` gagne un 2ᵉ paramètre optionnel
`{ exclude = [] }` (filtre `ACTIVE_MALUS_SOURCES` par `key` avant réduction — pas une resignature
fermée, une future source qui aurait besoin de la même auto-exemption pourra réutiliser le même
mécanisme). `resolveFatigueTest` appelle `calcActiveMalus(ctx, { exclude: ['fatigue'] })` +
`getFatigueTestMalus(...)` + `mjModifier` — nécessite donc de fetcher `wounds`/`char_inventory` dans
`fatigueService.js` aussi (pas seulement `attrs`/`archetype`/`mutationEffects`, comme la rédaction
initiale le laissait supposer).

**5. [3ᵉ passe] `applyStunWithDuration` n'est pas réutilisable tel quel pour "Évanoui"** — vérifié
dans le code (pas supposé) : `statusService.js:21-38` calcule
`statusCode = outcome === 'inconscient' ? 'unconscious' : 'stunned'`, un binaire fermé, et exclut
mutuellement `['stunned', 'unconscious']` à l'insertion. Passer `outcome: 'evanoui'` tomberait dans la
branche `else` et poserait `stunned` par erreur — pas le comportement voulu. **Corrigé** : extension
additive de `applyStunWithDuration` (accepter un `statusCode` explicite en paramètre plutôt que
déduit du seul `outcome`, défaut inchangé pour l'appelant existant qui continue à passer `outcome`
seul) + `evanoui` ajouté à la liste d'exclusion mutuelle (un personnage Étourdi/Évanoui/Inconscient ne
peut être que dans un seul de ces états à la fois, cohérent avec les deux autres déjà exclusifs entre
eux).

**6. [3ᵉ passe] Aucune émission WebSocket prévue pour le résultat du Test de Fatigue** — exactement la
même classe de bug que celle trouvée et corrigée en increment G du Lot 3 (§9 : dégâts environnementaux
créés en base mais invisibles dans le panneau de combat faute d'émission). La 1ʳᵉ rédaction de ce §10
ne prévoyait qu'un retour HTTP au MJ. **Corrigé** : nouvel événement `shared/events.js`
`FATIGUE_TEST_RESULT` (`'fatigue:test_result'`, patron `MACRO_ROLL_RESULT`/`WOUND_INFECTION_ROLL`),
diffusé à `campaignId` par `resolveFatigueTest` après résolution — visible MJ et joueur concerné, pas
seulement retourné à l'appelant de la route REST.

**7. [3ᵉ passe] Gate serveur `fatigue_enabled` pas explicite sur les routes elles-mêmes** — la
rédaction initiale ne mentionnait le gate que côté UI (bouton masqué) et côté calcul de malus
(`ACTIVE_MALUS_SOURCES`), pas comme un garde explicite en tête de `resolveFatigueTest`/`restFatigue`
(`AppError` si `fatigue_enabled` est `false`) — défense en profondeur, cohérent avec `core.md` (« le
serveur valide... avant toute mutation ») : un MJ pourrait sinon appeler la route directement même UI
masquée, sur une campagne où la mécanique est explicitement désactivée.

### Architecture retenue

**Modèle de données** : un seul entier persistant, `char_sheet.fatigue_points` **0 à 17** (6 paliers ×
3 cases — corrigé du §10 initial qui plafonnait à 14/5 paliers, erreur trouvée en relisant l'Annexe
p.250), plutôt que palier et case en deux champs séparés qui pourraient se désynchroniser — même
principe d'autorité unique que le compteur d'horloge du Lot 1. `palier = floor(points/3)` (max 5 par
construction dès que `points ≥ 15`, aucun clamp explicite nécessaire), `case = points % 3`.

**Fonctions pures** (`shared/fatigueConstants.js`, même patron que `fallDamageConstants.js`/
`woundConstants.js`, testées isolément) :
- `FATIGUE_LEVEL_MALUS = [0, -3, -5, -7, -10, -10]` (index = palier) — barème §4.1.
- `FATIGUE_TEST_MALUS = [0, -5, -10]` (index = case, paliers 0-4) — malus au prochain Test de Fatigue.
- `FATIGUE_CHOC_MALUS = [-5, -10, -15]` (index = case, palier 5 uniquement) — malus au Test de Choc de
  remplacement.
- `getFatiguePalier(points)`/`getFatigueCase(points)`, `getFatigueLevelMalus(points)`,
  `getFatigueTestMalus(points)` (sélectionne la bonne table selon le palier).

**`calcActiveMalus(ctx, { exclude = [] } = {})`** (révision point 4) : filtre `ACTIVE_MALUS_SOURCES`
par `key` avant de sommer — `exclude: ['fatigue']` pour le Test de Fatigue lui-même (auto-exemption
RAW, ligne 976-979), tableau vide (défaut) partout ailleurs (5 sites combat/fiche + macros).

**Point d'entrée mutateur unique** : `setFatiguePoints(trx, characterId, points)` (clampé [0, 17]) —
les Lots 5 (Froid), 7 (Maladies/Poisons), 8 (Drogues), 9 (Irradiations), 10 (Faim/soif) et le MJ
passent tous par elle ; aucun lot n'écrit `fatigue_points` directement (même contrat que
`adjustGameTime` pour l'horloge). **Verrouillage (trou structurel 2 ci-dessus)** : la fonction
suppose une transaction déjà ouverte par l'appelant sur laquelle `char_sheet` est déjà verrouillé
(`.forUpdate()`) — elle ne lit/écrit jamais en dehors de ce verrou, jamais de lire-puis-écrire sans
lock.

**Test de Fatigue — résolution immédiate, pas un consommateur du Lot 2.** Contrairement à Blessures/
Guérison, ce Test se déclare et se résout dans le même geste MJ (pas de réponse différée à travers
plusieurs jours réels) — même famille que la Chute (Lot 3, `fallDamageService.js`), pas le patron
interactif/différé du Lot 2. Nouveau `server/src/lib/fatigueService.js` :
- `resolveFatigueTest(io, db, campaignId, { characterId, source, mjModifier = 0 })` — `source` ∈
  `'CON'|'VOL'|'ENDURANCE'|'MOYENNE'`. **Garde en tête** : `AppError` si
  `!settings.fatigue_enabled` (point 7). Ouvre sa propre transaction, verrouille `char_sheet`
  (`.forUpdate()`, patron `tradeService.js:190`) avant toute lecture de `fatigue_points`. Fetch
  combiné : `attrs`/`archetype`/`mutationEffects`/`genotypeRow` (patron E, `fallDamageService.js`) +
  `char_skills`/`ref_skills` si `source === 'ENDURANCE'` (patron `socketCombatHelpers.js:1437-1442`)
  **+ `wounds`/`char_inventory` (point 4, nécessaires à `calcActiveMalus`)**. Seuil = valeur de
  `source` + `calcActiveMalus(ctx, { exclude: ['fatigue'] })` + `getFatigueTestMalus(fatigue_points
  actuels)` + `mjModifier` → `resolvePolarisTest(seuil)`. Applique la table de résultat ci-dessus
  (branche palier 5 = Choc séparée). Mute `fatigue_points` via `setFatiguePoints` (même transaction,
  verrou déjà posé) ; à palier 5, applique le statut Choc (`evanoui`/`unconscious`, durée 1D6 min ou
  1D6×10, point 5) via `applyStunWithDuration` étendue. **Diffuse `WS.FATIGUE_TEST_RESULT` à
  `campaignId`** (point 6) — jet, seuil, issue, nouveau palier/case, pas seulement un retour HTTP.

**8. [5ᵉ passe d'analyse critique, même session — tranché Saar 2026-07-30] Expiration du badge Choc
hors combat.** `current_turn` (`combat_state`, remis à 1 à `COMBAT_START`, statuts stunned/unconscious
nettoyés à `COMBAT_END`, `socketCombatState.js:126,179`) ne progresse jamais hors combat — un badge
posé avec une expiration en Tours ne se lèverait donc jamais si le Test de Fatigue est déclaré hors
combat (vérifié : ni `resolveFall` ni `resolveEnvironmentalHazardTicks`, Lot 3, n'appellent
`applyStunWithDuration`, elles ne font que retourner `shockResult` pour affichage — ce piège n'existe
donc pas déjà ailleurs dans le projet, `fatigueService.js` aurait été la première fonction à
l'introduire en suivant le patron combat trop littéralement). **Confirmé Saar** : comportement voulu,
pas un bug à corriger — « un Test que le MJ peut demander en et hors combat. En combat, le personnage
subit l'effet la durée prédéfinie ; hors combat, le MJ retire l'effet une fois le temps écoulé
narrativement. » `resolveFatigueTest` vérifie si `combat_state` existe pour la campagne avant
`applyStunWithDuration` : **présent** → badge avec expiration en Tours, patron combat inchangé ;
**absent** → badge posé avec `expires_at_turn: null` (retrait manuel MJ, `clearModStatus` déjà
existant), cohérent avec la philosophie déjà actée de la Fatigue (narratif/manuel, décision Lot 0
§4.2).
- `restFatigue(db, characterId, { full = true, caseDelta = 1 })` — même garde `fatigue_enabled` +
  même verrouillage. `full: true` → palier -1, case 0 ; `full: false` → case -= `caseDelta` (plancher
  borne basse du palier courant), jamais de changement de palier. Action MJ pure, aucun jet — diffuse
  aussi un event (même famille) pour que le palier/case affiché reste synchronisé chez tous les
  clients connectés (MJ + joueur du personnage), pas seulement l'auteur de l'action.

**Nouveau statut Choc-Fatigue** — `evanoui` (catégorie `sens`, même famille visuelle que
`stunned`/`unconscious`, `TokenPresentation.jsx:STATUS_CATEGORY`) : n'existe nulle part dans le projet
aujourd'hui (vérifié), à créer. `unconscious` (Catastrophe) est déjà un statut existant, réutilisé tel
quel — pas de 2ᵉ code pour la même chose. **Extension nécessaire (point 5)** : `applyStunWithDuration`
(`statusService.js:21-38`) déduit aujourd'hui `statusCode` uniquement de `outcome ('etourdi'/
'inconscient')`, binaire fermé qui ne sait pas produire `evanoui` — signature étendue pour accepter un
`statusCode` explicite (défaut = comportement actuel déduit de `outcome`, aucune régression sur
l'appelant existant du Choc de blessure) + `evanoui` ajouté à la liste d'exclusion mutuelle
`whereIn(['stunned', 'unconscious'])` → `['stunned', 'unconscious', 'evanoui']`.

**UI** — pas de badge token (tranché ci-dessus). Fiche de personnage (`CharacterSheet.jsx`), nouvelle
section Fatigue (masquée si `fatigue_enabled = false`) :
- Affichage palier/case courants + malus effectif (même famille que le panneau blessures existant).
- MJ uniquement : bouton "Lancer un Test de Fatigue" (choix source + modificateur optionnel), boutons
  "Repos complet"/"Repos partiel".
- Aucun composant nouveau structurel pressenti — à confirmer en codant (patron `AdvantagesPanel.jsx`/
  panneau blessures comme référence la plus proche).

**[4ᵉ passe d'analyse critique, même session] Correction sur le site fiche de personnage —
`calcActiveMalus` ne s'y applique pas tel quel.** Vérifié contre le code réel : contrairement aux 3
sites combat (une seule expression JS serveur), l'affichage fiche vient de **deux routes séparées**
(`GET /wounds` → `wound_penalty`, `GET /inventory` → `ini_penalty`, `inventoryService.js:229-231`) que
le **client** additionne lui-même (`CharacterSheet.jsx:327`). `calcActiveMalus` est une fonction
serveur (`server/src/lib/`), pas appelable côté client — la remplacer telle quelle ici serait une
erreur de câblage. De plus le tooltip de la fiche **décompose déjà le malus par source** (ligne
« Malus blessures », ligne « Malus encombrement » séparées) — un total agrégé unique y serait une
régression d'affichage, pas une simplification.
- **Vérifié** : `GET /char-sheet/:characterId` (`char-sheet.js:97-99`) fait
  `db('char_sheet').where(...).first()` sans `.select()` — `fatigue_points` y apparaît automatiquement
  dès la migration posée, **aucun changement de route nécessaire** pour l'exposer.
- Le malus de Fatigue est un simple lookup pur (`getFatigueLevelMalus`, déjà dans `shared/`, donc
  importable tel quel côté client comme côté serveur — une seule source de vérité pour la **valeur**,
  même si l'**agrégation** reste locale à ce site comme aujourd'hui). `CharacterSheet.jsx` calcule
  localement `fatiguePenalty = settings.fatigue_enabled ? getFatigueLevelMalus(sheet.fatigue_points ??
  0) : 0` (garde `fatigue_enabled` répliquée côté client, même raison que le garde serveur : un
  palier/case resté non nul après désactivation de la mécanique ne doit produire aucun malus) et
  l'ajoute à `effectiveMalus` + une 3ᵉ ligne dans `iniTooltip` (`charSheet.tooltip.malusFatigue`,
  même patron que `malusBlessures`/`malusEncombrement`).

**[7ᵉ passe d'analyse critique — correction avant d'écrire l'UI] Routes déplacées de `campaigns.js`
vers `char-sheet.js`.** Rédaction initiale : routes scope `campaignId` (`server/src/routes/
campaigns.js`, même patron que `hazards/fall`/`healing-choice`). Vérifié faux en préparant
`CharacterSheet.jsx` : ce composant n'a **jamais** `campaignId` en prop ni en state — tout son accès
API est scope `characterId` uniquement, le serveur résolvant `campaign_id` en interne via
`req.character.campaign_id` (patron déjà établi par toute la route family `char-sheet.js`, ex.
`/wounds`, `/macro-preview`). Router les deux nouvelles routes par `campaignId` aurait forcé un
prop-drilling non existant jusqu'ici dans ce composant pour rien — `resolveFatigueTest`/`restFatigue`
prennent déjà `campaignId` en paramètre, peu importe d'où il est résolu. **Routes finales** (MJ
uniquement, patron `if (!req.isGm) throw new AppError(403, ...)` + `try/catch/next(err)`, même style
que `PUT /:characterId/xp` — pas le style `requireRole('gm')` de `campaigns.js`, chaque fichier garde
son propre patron existant) :
- `POST /api/char-sheet/:characterId/fatigue-test` → `resolveFatigueTest`.
- `POST /api/char-sheet/:characterId/fatigue-rest` → `restFatigue`.

**Fichiers concernés** (aucun code écrit à ce stade) :

| Fichier | Rôle |
|---|---|
| `server/src/db/migrations/227_char_sheet_fatigue.js` | `char_sheet.fatigue_points` integer, `notNullable`, `defaultTo(0)` — 227 = prochain numéro impair libre (225 = `token_statuses_data.js`) |
| `shared/fatigueConstants.js` (nouveau) | tables/fonctions pures ci-dessus (`FATIGUE_LEVEL_MALUS`/`FATIGUE_TEST_MALUS`/`FATIGUE_CHOC_MALUS`/`getFatiguePalier`/`getFatigueCase`/`getFatigueLevelMalus`/`getFatigueTestMalus`), testées isolément |
| `server/src/lib/activeMalusRegistry.js` (nouveau) | `ACTIVE_MALUS_SOURCES` (wound/encumbrance/fatigue) + `calcActiveMalus(ctx)` — registre déclaratif, patron `echeanceTypeRegistry.js`/`environmentalHazardRegistry.js` |
| `server/src/socket/socketCombatHelpers.js` (×3), `socketEntity.js` | remplacent `woundPenalty - encumbrancePenalty` par `calcActiveMalus(ctx)` (calcul serveur unique, seuil de Test) |
| `client/src/character/CharacterSheet.jsx` | **pas `calcActiveMalus`** (fonction serveur, non appelable client) — voir correction ci-dessous |
| `server/src/routes/character/char-sheet.js` (`macro-preview`) | ajoute fetch `character_wounds`/`char_inventory`/`getCampaignSettings` + `calcActiveMalus(ctx)` dans le calcul de `baseThreshold` (point structurel 3) |
| `server/src/socket/socketDice.js` (`MACRO_ROLL`) | même correctif que `macro-preview`, code quasi identique aux deux endroits |
| `server/src/lib/campaignSettingsService.js` | ajoute `fatigue_enabled` à `SETTINGS_SCHEMA`, défaut `false` |
| `client/src/components/campaignSettings/SectionGameRules.jsx` | **trou trouvé après coup, corrigé** : le schéma serveur seul ne suffit pas à ce qu'un MJ puisse activer la mécanique — chaque clé de `SETTINGS_SCHEMA` a besoin de son propre contrôle explicite (pas de formulaire générique, patron déjà vu pour `encumbrance_enabled`/`calendar_start_*`). Case à cocher ajoutée, onglet Règle du jeu, même patron que `encumbrance_enabled` |
| `server/src/lib/fatigueService.js` (nouveau) | `resolveFatigueTest`/`restFatigue`, verrouillage `char_sheet.forUpdate()`, diffusion `WS.FATIGUE_TEST_RESULT` |
| `server/src/lib/statusService.js` | étend `applyStunWithDuration` : `statusCode` explicite optionnel (défaut = déduit de `outcome`, inchangé pour l'appelant existant) + `evanoui` dans l'exclusion mutuelle (point 5) |
| `shared/events.js` | nouvelle constante `FATIGUE_TEST_RESULT` (`'fatigue:test_result'`) |
| `server/src/routes/character/char-sheet.js` | 2 nouvelles routes (déplacées de `campaigns.js`, correction ci-dessus) |
| `client/src/components/TokenPresentation.jsx` | ajoute `evanoui` à `STATUS_CATEGORY` (catégorie `sens`) |
| `client/src/character/CharacterSheet.jsx` | nouvelle section Fatigue, écoute `FATIGUE_TEST_RESULT` |
| `client/src/locales/fr.json` | clés `charSheet.tooltip.malusFatigue` + section Fatigue — **corrigé** : `CharacterSheet.jsx` n'est **pas** migré vers `charSheet.json` (Lot 2 `PLAN_LOCALISATION.md`, non commencé) — vérifié, les clés `charSheet.*` existantes de ce fichier vivent dans `fr.json`, pas un namespace séparé ; suivre le même fichier plutôt que d'anticiper une migration non faite |

**Hors périmètre** : aucune cadence automatique de Test de Fatigue (RAW explicitement laissé à la
discrétion MJ) ; aucun badge token (tranché) ; aucun branchement Lot 2/échéances pour le Test lui-même
(résolution immédiate, pas différée).

### Validation prévue

- Tests Node ciblés (`node --test shared/fatigueConstants.test.mjs`) : `getFatiguePalier`/
  `getFatigueCase` aux bornes (0, 2, 3, 14, 15, 17), `getFatigueLevelMalus`/`getFatigueTestMalus` sur
  les 6 paliers, sélection correcte de la table Choc à palier 5.
- Test Node ciblé `activeMalusRegistry.test.mjs` : chaque source isolée (gate `enabled=false` → 0,
  `wounds` vide → 0, cumul des trois), `exclude: ['fatigue']` retire bien la bonne entrée et aucune
  autre.
- Test Node ciblé sur la table de résultat du Test de Fatigue (échec/catastrophe/réussite/second
  souffle/palier 5) — cas synthétiques avec seuil connu, pas de dépendance DB.
- Vérification manuelle du verrou de concurrence (deux Tests de Fatigue quasi simultanés sur le même
  personnage ne s'écrasent pas) — même scénario que celui déjà exécuté pour `adjustGameTime` (Lot 1).
- Vérification manuelle : une macro joueur sur un personnage blessé reflète désormais le malus
  (`macro-preview` et `MACRO_ROLL`), non-régression sur une macro sans blessure/fatigue active.
- `eslint`/`npm run build` (client), `node --check` (serveur) à chaque fichier touché.
- Nouveau concept Enclume (« Fatigue », « Compteur de Fatigue », « Test de Fatigue ») à ajouter dans
  `docs/VOCABULARY.md` une fois codé (`CLAUDE.md` §2), même geste que l'Horloge de campagne (Lot 1).

---

## 11. Lot 5 — Froid

> **2026-07-31 — cadrage détaillé (1ʳᵉ passe)**, après relecture RAW complète (`FATIGUE&DOMMAGES.md`
> p.243-244, citée intégralement ci-dessous) + exploration du code réel des trois fondations
> consommées (`echeanceService.js`/`echeanceTypeRegistry.js` Lot 2, `fatigueService.js`/
> `activeMalusRegistry.js` Lot 4, `resolveTargetHit`/`environmentalHazardService.js` Lot 3). **Aucun
> code écrit.** Deux trous structurels trouvés dans le moteur partagé du Lot 2 (points A/B ci-dessous)
> — Froid en est le premier consommateur à en avoir besoin, comme Blessures l'avait été pour le
> patron interactif.

**Dépend de** : Lot 1 (`adjustGameTime`), Lot 2 (`echeanceService.js`, patron automatique
`interactive:false`), Lot 4 (`resolveFatigueTest`/`calcActiveMalus`). Réutilise aussi `resolveTargetHit`
(moteur de blessures, §3) pour l'injection directe de dégâts physiques.

### RAW retenu (p.243-244)

- **Froid** (10-15°C) : Test de résistance à la Fatigue (Constitution) toutes les **2 heures**.
- **Très froid** (5-10°C) : même chose, toutes les **heures**.
- **Glacial** (~0°C) : même chose, toutes les **30 minutes**. En plus : dégâts physiques localisés —
  au bout d'1h, Bras/Jambes touchés (1D10), puis +1D10 à chaque heure supplémentaire (2D10, 3D10...) ;
  au bout de 2h, Corps/Tête s'y ajoutent, suivant la même progression indépendante.
- **Froid extrême** (<0°C) : mêmes règles que Glacial, mais **tous les temps divisés par deux** par
  tranche de 5°C supplémentaire sous 0°C.
- Action fatigante en cours → Tests plus fréquents à la discrétion du MJ (narratif, jamais mécanisé —
  cohérent avec la décision §4.2 : déclenchement narratif/manuel, effets automatiques une fois posés).
- Environnement humide (dans l'eau, ou vêtements mouillés) → **tous les temps divisés par deux**.
- Vêtements/tenue adaptée → ajustement manuel de la tranche déclarée par le MJ (déjà noté hors
  périmètre ci-dessous, RAW le permet nativement, aucun mécanisme à construire).
- Amputation (Blessure critique/mortelle sur Bras/Jambe) : **déjà couvert narrativement par le système
  Blessures existant** (`docs/PLAN_BLESSURES_GUERISON.md`, sévérité Critique/Mortelle implique déjà
  l'amputation en RAW général, pas un mécanisme séparé) — **rien à coder spécifiquement pour Froid**.

### Trou structurel A — `io` non tissé dans le moteur d'échéances (Lot 2)

`sweepDueEcheances`/`resolveEcheanceHandler` (`echeanceService.js`) n'ont aujourd'hui **aucun canal**
pour émettre un événement WS pendant un balayage automatique. Le contrat handler déclare déjà un champ
`effects` (`{ resolved: true, effects, reschedule, spawn, undoEntries }`, voir §8) mais **rien ne le
lit ni ne le propage** — vérifié : `resolveEcheanceHandler` ne déstructure que `{ reschedule, spawn }`
du retour du handler (`echeanceService.js:63`), et `sweepDueEcheances` ignore entièrement la valeur de
retour de chaque appel. Sans correction, un Test de Fatigue ou un dégât physique déclenché
automatiquement par le froid resterait invisible en temps réel côté client — même classe de bug que
Lot 3 increment G / Lot 4 passe 3, cette fois dans le **moteur partagé** plutôt que chez un
consommateur (Blessures n'avait jamais eu ce besoin : ses handlers sont `interactive:true`, résolus un
par un via `resolveEcheanceNow`, jamais depuis `sweepDueEcheances`).

**Correction proposée** (extension du contrat existant, pas un nouveau mécanisme) :
- `resolveEcheanceHandler` retourne aussi `handlerResult.effects` tel quel.
- `sweepDueEcheances` accumule les `effects` de chaque échéance résolue dans un tableau et le retourne
  (au lieu de ne rien retourner aujourd'hui).
- `performTimeAdjustment`/`adjustGameTime`/`requestGameTimeAdvance`/`confirmPendingAdvance`
  (`gameTimeService.js`) propagent ce tableau jusqu'à leur retour.
- La route `campaigns.js` qui appelle ces fonctions émet les événements WS correspondants **après le
  commit** (patron déjà en place ailleurs : `resolveFatigueTest` émet après la fin de son propre
  `db.transaction()`, jamais depuis l'intérieur) — jamais d'émission depuis un savepoint pas encore
  committé au niveau supérieur.

### Trou structurel B — `resolveFatigueTest` non réutilisable tel quel dans un handler

`resolveFatigueTest` (`fatigueService.js:97`) ouvre son **propre** `db.transaction()` et émet lui-même
le WS. Appelé depuis un handler d'échéance (déjà exécuté dans un savepoint du `trx` de balayage), ce
serait une transaction imbriquée sur une connexion différente — risque réel de deadlock sur
`char_sheet.forUpdate()` (le `trx` englobant tient déjà le verrou, la nouvelle transaction attendrait
indéfiniment sur la même ligne).

**Correction proposée** : extraire le cœur de la fonction en
`performFatigueTest(trx, characterId, { source, mjModifier })` — aucune transaction propre, aucune
émission, retourne le même objet `result` que `resolveFatigueTest` construit aujourd'hui (lignes
165-171). Réutilisé par :
- `resolveFatigueTest` existant (inchangé pour ses appelants actuels : ouvre sa transaction, appelle le
  cœur, émet après commit) ;
- le handler `cold_fatigue_check` (reçoit le `trx` du balayage, retourne le résultat dans `effects` pour
  émission différée via la correction A).

### Architecture retenue — deux échéances indépendantes par exposition, pas de nouvelle table

Pas de jauge (contrairement à Maladies/Poisons, Lot 7) : le froid n'a pas d'état cumulatif propre en
dehors de ce que `game_echeances.payload` porte déjà pour sa propre replanification.

- **`cold_fatigue_check`** (`interactive:false`) — Test de Fatigue (source `CON`) à la cadence de la
  tranche déclarée (2h/1h/30min, divisée par deux par tranche de Froid extrême et/ou environnement
  humide — l'`interval_minutes` **effectif** est calculé une fois à la déclaration, pas recalculé à
  chaque tick).
- **`cold_damage_tick`** (`interactive:false`) — créée **uniquement** si la tranche déclarée est
  Glacial ou en dessous. Cadence fixe 1h (elle aussi divisée par deux en Froid extrême/humide).
  `payload: { hoursElapsed }` : la 1ʳᵉ résolution touche Bras/Jambes (1D10), incrémente `hoursElapsed`
  et augmente le dé d'1D10 à chaque résolution suivante ; à partir de la 2ᵉ heure écoulée, Corps/Tête
  s'ajoutent (boucle sur les 4 localisations avec `forcedSlotCode`, même patron de boucle que
  `resolveEnvironmentalHazardTicks` sur `locationsCount`). Injection directe via `resolveTargetHit`
  (`trx` du savepoint passé en paramètre `db` — la fonction est déjà générique sur ce paramètre, vérifié
  `damageService.js:296`).
  **Précision (Q1 Saar 2026-07-31) : ce ne sont pas des dégâts au rabais.** `resolveTargetHit` appelle
  toujours `woundService.applyWound` **et** `statusService.resolveShockTest`
  (`damageService.js:436-459`, vérifié — ce n'est pas conditionné par `chocDsl`, qui ne fait qu'ajouter
  un Choc *supplémentaire* réservé aux munitions catégorie 3, absent ici). Une Blessure réelle est donc
  posée sur Bras/Jambes/Corps/Tête, avec son propre Test de Choc/étourdissement standard, **exactement
  le même mécanisme que Acide/Décompression/Feu** (Lot 3) — rien de spécifique à construire pour le
  Choc, il vient gratuitement en réutilisant `resolveTargetHit` tel quel. Le Froid a donc bien deux
  effets indépendants et cumulables à Glacial+ : le Test de Fatigue périodique (`cold_fatigue_check`,
  toutes tranches) ET de vraies Blessures physiques avec Choc standard (`cold_damage_tick`, Glacial+),
  jamais l'un au lieu de l'autre.
- Les deux échéances sont **scopées `character_id`**, jamais `token_id` — le froid affecte le
  personnage, pas seulement un token de combat (cohérent avec la scope "personnage, persistant hors
  combat" déjà actée pour Fatigue/Maladie/Poison/Drogue/Irradiation, §3).
- **Changement de tranche** (le MJ redéclare une tranche différente) : les échéances actives existantes
  de ce personnage pour ces deux `condition_type` passent `status:'completed'`, puis de nouvelles sont
  créées à la nouvelle cadence avec `hoursElapsed:0` — jamais un `UPDATE` en place de
  `interval_minutes` sur l'échéance existante (repartir à zéro les dégâts physiques à la ré-exposition
  est la lecture RAW la plus directe, bien qu'implicite : le texte ne couvre pas explicitement un
  changement de tranche en cours d'exposition).
- **Retrait complet** de l'exposition = mêmes échéances marquées `completed`, rien d'autre à nettoyer
  (pas de jauge à remettre à zéro, contrairement à Maladie/Poison à venir).
- **`armorReductionFactor`** : RAW ne mentionne aucune réduction d'armure spécifique pour le froid
  (contrairement à la Chute, `fallDamageService.js`) — défaut `1`, même traitement que Acide/
  Décompression/Feu (Lot 3), pas de cas spécial à coder.

### Décisions tranchées avec Saar (2026-07-31, 1ʳᵉ passe)

1. **[CORRIGÉ] `fatigue_enabled=false` ne bloque pas Froid — seul le volet Fatigue s'efface.** Ma
   proposition initiale (bloquer toute déclaration si `fatigue_enabled` est faux) était fausse — Saar :
   « Froid n'est pas conditionné à Fatigue_enabled, il n'inflige juste pas de dégât de fatigue si
   désactivé. » Retenu : `declareColdExposure` ne vérifie plus `fatigue_enabled` du tout. Les deux
   échéances (ci-dessous) sont créées inconditionnellement. Le handler `cold_fatigue_check` lit
   `getCampaignSettings` **à chaque résolution** (pas seulement à la déclaration, pour couvrir un
   bascule de réglage en cours d'exposition) : si `fatigue_enabled` est faux à cet instant, il retourne
   `{ resolved: true, effects: null, reschedule: {...même cadence...} }` — un tick neutre qui
   replanifie normalement sans toucher `fatigue_points`. `cold_damage_tick` (Glacial+) ne dépend
   d'aucun réglage campagne, jamais concerné par ce garde-fou.
2. **[CORRIGÉ] UI MJ — pas la fiche personnage : le bloc Statuts du token (`TokenStatusPanel.jsx`)
   existe déjà et porte un code inerte prévu pour ça.** Erreur de ma part : je n'avais pas relu ce
   composant avant de proposer la fiche personnage. Vérifié maintenant — `TokenStatusPanel.jsx:22`
   liste déjà `{ code: 'hypothermia', category: 'chronique' }` aux côtés de `infected`/`poisoned`/
   `irradiated` (catégorie "chronique" = les futurs Lots 7/9, personnage/persistant, par opposition à
   `dot` = Lot 3 combat/Tour). i18n déjà présent (`fr.json:909`, `"hypothermia": "Hypothermie"`), icône
   déjà présente (`client/public/assets/status/hypothermia.svg`), déjà dans `VALID_STATUS_CODES`
   (`socketToken.js:160`) — un toggle nu fonctionnerait déjà aujourd'hui, mais sans aucun effet
   mécanique, exactement l'état de `burning`/`acid`/`decompression` avant le Lot 3. Retenu : suivre
   **le même patron** que ces trois codes — ajouter `hypothermia` à un ensemble
   `CHRONIC_HAZARD_CODES` (à côté de `HAZARD_CODES`, `TokenStatusPanel.jsx:38`) qui intercepte le clic
   et ouvre un sous-formulaire (tranche + case "humide") au lieu d'un toggle nu, plutôt qu'un nouveau
   bloc dans `CharacterSheet.jsx`.
   **Distinction importante à ne pas mélanger** : ce sous-formulaire réutilise l'UI et l'icône du
   panneau Statuts (token), mais **pas** le moteur de tick de `environmentalHazardService.js`/
   `ENVIRONMENTAL_HAZARD_REGISTRY` (Lot 3, scope Tour de combat via `startResolutionPhase`) — Froid
   reste scope **temps de jeu** (Lot 1/2, `game_echeances`, `character_id`). Le clic sur un token
   résout le `character_id` derrière ce token (`token.character_id`) et appelle le service Froid
   (character-scope) ; le badge `hypothermia` est ensuite appliqué à **tous** les tokens de ce
   personnage (même patron que `resolveCharacterTokens` dans `fatigueService.js`, pas seulement le
   token cliqué) — cohérent avec "le froid affecte le personnage, pas un token de combat" (§3).
3. **Badge visuel token — confirmé, code déjà réservé (`hypothermia`), rien à créer.** Voir point 2 —
   asset/i18n/enum déjà en place, seul le branchement mécanique manque.
4. **Numéro de migration — aucune migration nécessaire pour ce Lot.** `game_echeances.payload` (jsonb
   libre, Lot 2) porte `{tier, wet}` sans nouvelle colonne ; `token_statuses.status_code` est déjà
   `hypothermia`, déjà sans contrainte CHECK/enum. Lot 5 n'a donc aucun fichier de migration à ce stade.

### 2ᵉ passe d'analyse critique (2026-07-31, demandée par Saar sur le cadrage déjà écrit)

Six constats, deux confirmations. Vérifiés contre le code réel, pas des hypothèses.

1. **[Trou] Le modèle "4 tranches fixes" est faux pour Froid extrême — la RAW le paramètre, elle ne
   l'énumère pas.** Relecture littérale (p.244) : « Pour chaque tranche de 5°C en dessous de 0°C, vous
   pouvez appliquer les règles ci-dessus [Glacial], en divisant à chaque fois les temps indiqués par
   deux. » Ce n'est pas un 4ᵉ palier discret, c'est Glacial **répété** avec un diviseur qui double à
   chaque tranche supplémentaire de -5°C (illimité en théorie). Un sélecteur à 4 options fixes
   (Froid/Très froid/Glacial/Froid extrême) ne peut pas représenter ça. **Correction retenue** :
   sélecteur à 3 options (Froid/Très froid/Glacial) + un compteur numérique séparé « paliers de Froid
   extrême » (0 = pas de Froid extrême, N ≥ 1 = Glacial avec diviseur `2^N` sur tous les temps,
   dégâts/Test inclus). `payload.extremeSteps` (entier ≥ 0), pas un enum.
2. **[Trou] Risque de double autorité entre `token_statuses.data` et `game_echeances.payload` pour la
   tranche courante — corrigé avant d'exister.** Les dangers Lot 3 stockent leur état dans
   `token_statuses.data` (`formula`/`locations`/`forcedLocation`) parce que ce sont eux, l'autorité
   (scope Tour/token, pas d'échéance derrière). Froid a son autorité ailleurs — les deux échéances
   `character_id`-scopées. Si `token_statuses.data` du badge `hypothermia` stockait *aussi* `{tier,
   wet}`, on aurait deux copies de la même donnée pouvant diverger (CLAUDE.md priorité 4 : autorité
   unique). **Retenu** : le badge `hypothermia` ne porte **aucun payload mécanique**, `data: null` —
   présence du statut = simple reflet visuel de "au moins une échéance froid active pour ce
   personnage". La tranche réelle se lit uniquement depuis `game_echeances` (point 3).
3. **[Trou, dépend du point 2] Il manque une lecture "tranche actuellement déclarée" — absente du
   tableau de fichiers précédent.** Sans elle, le sous-formulaire de `TokenStatusPanel.jsx` ne peut ni
   se pré-remplir à la réouverture, ni permettre "changer de tranche" en connaissance de cause. **Ajout
   nécessaire** : petite lecture (nouvelle route ou fonction service) `GET` — ou embarquée dans la
   réponse déjà chargée pour le token/personnage — qui retourne `{tier, wet, extremeSteps}` déduits des
   échéances `active` du personnage pour `cold_fatigue_check`/`cold_damage_tick` (absence des deux =
   pas exposé). Ajoutée au tableau de fichiers ci-dessous.
4. **[Trou] Contrat `effects` pas assez précis pour être consommé.** `effects` doit permettre à la
   route d'émettre le **bon** événement WS pour chaque entrée accumulée (un Test de Fatigue →
   `WS.FATIGUE_TEST_RESULT`, un coup physique → `WS.COMBAT_ATTACK_RESULT`) — un objet `effects` nu ne
   porte pas cette information. **Retenu** : chaque handler retourne `effects: { wsEvent, payload }` (ou
   `effects: null` pour un tick neutre, point "Décisions tranchées" 1) ; `sweepDueEcheances` accumule
   ces `{wsEvent, payload}` (en ignorant les `null`) ; la route boucle sur le tableau et fait
   `io.to(campaignId).emit(WS[wsEvent], payload)` pour chacun — dispatcher générique, aucune
   connaissance métier ajoutée à la route.
5. **[Confirmation, pas un trou] `effects` est bien mort aujourd'hui, vérifié à la source — la
   correction ne collisionne avec rien.** `woundEvolutionService.js:218` peuple déjà
   `effects: { isSuccess, infected, survivalHoursInfo }` dans son retour de handler, mais
   `resolveEcheanceNow` (`echeanceService.js:151-153`) ne le lit jamais, et ses 2 appelants
   (`campaigns.js` routes `healing-choice`/`infection-mode`, lignes 361-427) ne lisent pas non plus
   `result.effects` — ils re-requêtent `character_wounds` après coup et appellent `broadcastWoundUpdate`
   directement. **Pourquoi Blessures n'a jamais eu besoin du mécanisme du point 4** : sa route connaît
   déjà l'`echeanceId` précis (dans l'URL, un clic MJ = une échéance) donc peut re-requêter la bonne
   ligne après coup. `sweepDueEcheances`, lui, résout un nombre arbitraire d'échéances de personnages
   différents en une seule requête MJ (`game-time/adjust`) — la route n'a aucun moyen de deviner quoi
   re-requêter sans que le résultat le lui dise. Les deux problèmes sont réellement différents, la
   correction du point 4 n'est pas une réinvention inutile d'un mécanisme déjà résolu ailleurs.
6. **[Trou, duplication à éviter] `resolveCharacterTokens` doit être extrait, pas recopié.**
   `fatigueService.js:78-83` définit déjà cette fonction (résout les tokens d'un personnage dans une
   campagne). `coldExposureService.js` en a besoin à l'identique pour propager le badge `hypothermia` à
   tous les tokens du personnage. CLAUDE.md §7 : « pas de logique métier dupliquée ». **Retenu** :
   déplacer la fonction vers un fichier partagé neutre (candidat : `statusService.js`, déjà consommé par
   les deux) plutôt que de la dupliquer dans le nouveau service.

**Contrat `declareColdExposure` précisé** : **idempotent**, pas seulement pour le cas initial —
un appel alors que des échéances actives existent déjà pour ce personnage les marque `cancelled`
(corrigé passe 3 point 5, pas `completed`) puis recrée à la nouvelle tranche/`extremeSteps`/`wet`
(déjà décrit en §11 "Architecture retenue" pour le changement de tranche, mais pas explicitement
nommé comme LE contrat général de la fonction). Ça signifie qu'un seul endpoint sert à la fois
"déclarer" et "changer de tranche" — pas de route ou fonction séparée pour ce dernier cas.

### 3ᵉ passe d'analyse critique (2026-07-31, Saar : « on continue tant qu'on trouve des trous »)

1. **[Trou] Division fractionnaire des minutes — jamais remarqué avant.** `interval_minutes / 2^
   extremeSteps / (wet ? 2 : 1)` peut produire un non-entier : Glacial (base 30 min) avec
   `extremeSteps=1` **et** `wet=true` → 30/2/2 = **7.5**. La colonne est `integer`
   (migration 221) et le garde-fou anti-boucle infinie de `echeanceService.js:81` rejette déjà tout
   `intervalMinutes` non entier (`!Number.isInteger(...)` → `status:'error'`) — sans correction, cette
   combinaison ferait échouer silencieusement l'échéance au tick suivant. **Fix retenu** :
   `Math.max(1, Math.floor(baseMinutes / 2**extremeSteps / (wet ? 2 : 1)))` — dans une fonction pure
   partagée (voir point suivant), jamais recalculé différemment à deux endroits.
2. **[Trou] `extremeSteps` n'a de sens que si `tier==='glacial'` — RAW ne le traite pas comme une 5ᵉ
   option indépendante.** Relecture : « Froid extrême... vous pouvez appliquer les règles ci-dessus
   [Glacial], en divisant... » — c'est Glacial répété avec un diviseur, pas un régime séparé
   sélectionnable sur Froid/Très froid. Une combinaison `tier:'froid', extremeSteps:2` n'a pas de sens
   RAW. **Fix retenu** : validation serveur — `extremeSteps > 0` exige `tier === 'glacial'`
   (`AppError` sinon) ; côté client, le compteur `extremeSteps` reste désactivé/à 0 tant que "Glacial"
   n'est pas sélectionné. Confirme aussi le point précédent du plan : le calcul d'intervalle devient une
   fonction pure `shared/coldExposureConstants.js` (candidat, patron `shared/fatigueConstants.js`/
   `shared/gameTime.js`) — réutilisable côté client pour prévisualiser la cadence dans le
   sous-formulaire, jamais dupliquée serveur/client.
3. **[Trou, le plus significatif] `resolveTargetHit` n'a en réalité jamais été appelé avec un `trx`
   dans ce dépôt — ma citation précédente (« la fonction est déjà générique sur ce paramètre »)
   survendait la généricité.** Vérifié exhaustivement : les 9 appels existants
   (`socketCombatHelpers.js` ×6, `fallDamageService.js`, `environmentalHazardService.js`,
   plus la définition) passent tous le `db` brut du pool, jamais un `trx`/savepoint — cette composition
   serait inédite. En creusant plus loin : `getMutationEffects` (`mutationService.js:17-19`) et
   `getAdvantages` (`advantageService.js:13-18`), tous deux appelés à l'intérieur de
   `resolveTargetHit`, utilisent le **singleton `db` importé au niveau module**, pas le paramètre reçu
   — même en passant `sp` à `resolveTargetHit`, ces deux lectures s'exécuteraient sur une connexion
   séparée, hors de la transaction du balayage. `woundService.applyWound`, en revanche, ouvre bien sa
   propre sous-transaction **sur le `db` qu'on lui passe** (`db.transaction(...)`, `woundService.js:20`)
   — lui passer `sp` créerait un savepoint imbriqué, comportement déjà établi et sûr ailleurs dans ce
   projet (même mécanisme knex documenté dans `echeanceService.js`).
   **Verdict** : pas de risque de deadlock (les lectures mutations/avantages sont de simples `SELECT`,
   rien n'est verrouillé sur ces tables ailleurs dans ce flux) mais l'« atomicité totale » de l'appel
   reste illusoire — un rollback improbable du savepoint englobant n'annulerait pas ces lectures (sans
   conséquence puisque ce sont des lectures, pas des écritures). **Retenu : accepté comme limitation
   connue et documentée**, pas de refactor de `getMutationEffects`/`getAdvantages` pour accepter un
   `trx` — ces deux fonctions ont de nombreux appelants sans rapport avec ce Lot, un tel refactor serait
   disproportionné (CLAUDE.md : ne pas dépasser le périmètre demandé).
4. **[Trou] Concurrence non protégée sur `declareColdExposure`.** Aucune contrainte unique
   `(character_id, condition_type, status)` sur `game_echeances` (vérifié migration 221, seul index :
   `campaign_id`) — un double-clic MJ (ou deux onglets ouverts) sur "déclarer" pourrait créer deux
   `cold_fatigue_check` actifs simultanés pour le même personnage, chacun tickant indépendamment
   (double Test de Fatigue à chaque balayage, silencieusement). **Fix retenu** : `declareColdExposure`/
   `clearColdExposure` verrouillent `char_sheet` du personnage (`.forUpdate()`) pendant toute
   l'opération cancel+create — même patron déjà établi pour `resolveFatigueTest`/`adjustGameTime`.
5. **[Précision] `status:'cancelled'` existe déjà dans la contrainte CHECK (migration 221,
   `chk_echeances_status`) mais n'est utilisé nulle part dans le code actuel — c'est la bonne valeur
   pour un retrait/changement de tranche MJ, pas `'completed'`.** Ma rédaction précédente (§ "Contrat"
   ci-dessus et tableau de fichiers) employait `completed` par erreur — cette valeur signifie déjà "le
   handler a fini naturellement" (`echeanceService.js:79-80`, reschedule null/épuisé), pas "annulé par
   le MJ". Corrigé partout dans cette section.
6. **[Trou/edge case, à trancher] Un token créé pendant une exposition déjà active n'hérite pas du
   badge.** Le badge n'est posé qu'au moment de `declareColdExposure`/d'un tick, jamais à la création
   d'un token. Ma comparaison précédente avec le badge Choc de Lot 4 était inexacte : Choc est
   transitoire (posé au moment précis d'un échec de Test, un token créé après n'a jamais dû l'avoir),
   Froid est censé être persistant pendant toute la durée de l'exposition — un token créé en cours
   d'exposition "devrait" logiquement porter le badge dès sa création. **Deux options** : (a) accepter
   tel quel, contournement MJ = redéclarer la même tranche resynchronise manuellement le token oublié ;
   (b) câbler `tokenLifecycle.js` (création de token) pour vérifier l'exposition active du personnage et
   poser le badge d'emblée. **Recommandation** : (a) — cas rare (créer un token pour un personnage déjà
   exposé au froid en cours de partie), (b) toucherait un fichier partagé par toute création de token
   pour un bénéfice marginal. **Tranché par Saar (2026-07-31) : confirmé, option (a).**

### 4ᵉ passe d'analyse critique (2026-07-31)

Plus courte — surtout des réutilisations à confirmer contre le code réel, un vrai oubli.

1. **[Confirmé, patron exact à copier] Le garde `token.character_id` null existe déjà mot pour mot.**
   `campaigns.js:451-454` (route `hazards/fall`) : `if (!token.character_id) throw new AppError(400,
   'Ce token n\'a pas de personnage associé')`. Passe 3 point "edge case" traitait ça comme un ajout à
   faire — c'est en fait un copier-coller direct d'un garde déjà écrit pour Chute, pas une nouvelle
   invention.
2. **[Confirmé, patron exact à copier] `resolveCampaignToken(campaignId, tokenId)` existe déjà**
   (`campaigns.js:438-446`, fonction privée du fichier) — valide que le token appartient à la campagne
   et retourne `{id, character_id}`. Utilisé par toutes les routes hazards/fall existantes. Les
   nouvelles routes cold-exposure le réutilisent tel quel, aucune nouvelle validation à écrire.
3. **[Confirmé, patron exact à copier] `applyModStatus`/`clearModStatus` (`statusService.js:175-195`)
   sont les bonnes primitives pour le badge `hypothermia`** — `insert().onConflict(['token_id',
   'status_code']).merge()` / `delete()`, déjà utilisées par Lot 3 pour `burning`/`acid`/`decompression`
   avec `expiresAtTurn: null` (persistant, pas de purge automatique de fin de Tour). Rien de nouveau à
   écrire pour poser/retirer le badge lui-même, juste boucler dessus via `resolveCharacterTokens`.
4. **[Trou, réel oubli] Signatures `declareColdExposure`/`clearColdExposure`/`getColdExposureState` du
   tableau de fichiers omettaient `io`.** Or `applyModStatus`/`clearModStatus` (point 3) exigent `io`
   pour émettre `TOKEN_STATUS_UPDATED`. **Fix retenu** : signatures alignées sur le patron
   `exposeToHazard(io, db, campaignId, tokenId, hazardCode, {...})` — mais `declareColdExposure`/
   `clearColdExposure` gèrent leur **propre** transaction interne (comme `adjustGameTime`, pas de `db`/
   `trx` reçu de l'appelant), donc signature finale `declareColdExposure(io, campaignId, characterId,
   {tier, extremeSteps, wet})`. Le badge est posé **après** le commit de cette transaction interne —
   même règle déjà établie pour `resolveFatigueTest`→`applyStunWithDuration`
   (`fatigueService.js:174-176` : « jamais imbriquer une 2ᵉ transaction knex dans la première »).
5. **Route exacte, calquée sur le patron Lot 3 vérifié** (`campaigns.js:470-488`) :
   `POST/GET/DELETE /api/campaigns/:id/tokens/:tokenId/cold-exposure`, `requireAuth,
   requireRole('gm')` — même structure à trois lignes que `hazards/:code/expose`/`clear`, aucune
   nouvelle décision de routage.

Constat général de cette passe : plus de nouveaux trous structurels majeurs trouvés, seulement des
confirmations de réutilisation exacte + un paramètre manquant. Signe que le cadrage converge.

### Fichiers concernés — plan écrit avant tout code (2026-07-31)

| Fichier | Rôle |
|---|---|
| `server/src/lib/echeanceService.js` | **Trou A** — `resolveEcheanceHandler` retourne aussi `handlerResult.effects` ; `sweepDueEcheances` accumule les `effects` de chaque échéance résolue dans un tableau et le retourne (au lieu de `undefined` aujourd'hui) |
| `server/src/lib/gameTimeService.js` | Propage ce tableau d'`effects` à travers `performTimeAdjustment` → `adjustGameTime`/`requestGameTimeAdvance`/`confirmPendingAdvance`, jusqu'à leur valeur de retour |
| `server/src/lib/fatigueService.js` | **Trou B** — extraction de `performFatigueTest(trx, characterId, {source, mjModifier})` (aucune transaction propre, aucune émission WS, même calcul que `resolveFatigueTest` lignes 105-171) ; `resolveFatigueTest` existant devient un mince wrapper (ouvre sa transaction, appelle le cœur, émet après commit — comportement inchangé pour ses appelants actuels) |
| `shared/coldExposureConstants.js` (nouveau) | Fonction pure `computeColdIntervalMinutes({tier, extremeSteps, wet}, baseKind)` — `Math.max(1, Math.floor(...))` (fix passe 3 point 1), validation `extremeSteps>0 ⟹ tier==='glacial'` (passe 3 point 2), réutilisable client (prévisualisation cadence) et serveur, même patron que `shared/fatigueConstants.js`/`shared/gameTime.js` |
| `server/src/lib/coldExposureService.js` (nouveau) | `declareColdExposure(io, campaignId, characterId, {tier, extremeSteps, wet})` (signature corrigée passe 4 point 4 — `io` ajouté, gère sa propre transaction comme `adjustGameTime`) — verrouille `char_sheet` du personnage (`.forUpdate()`, fix concurrence passe 3 point 4) le temps de l'opération ; **idempotent** (`status:'cancelled'` sur les échéances actives existantes, pas `completed` — précision passe 3 point 5 — puis recrée), utilise `computeColdIntervalMinutes` pour l'`interval_minutes` effectif, crée `cold_fatigue_check` + `cold_damage_tick` si `tier==='glacial'`, `payload` ne stocke `tier`/`extremeSteps`/`wet` que comme mémoire de replanification (jamais dupliqué côté token, passe 2 point 2) ; badge `hypothermia` posé via `applyModStatus` (`resolveCharacterTokens` en boucle) **après le commit** de la transaction interne (passe 4 point 4) ; `clearColdExposure(io, campaignId, characterId)` (`status:'cancelled'` + `clearModStatus` en boucle après commit) ; `getColdExposureState(characterId)` (lecture, passe 2 point 3) ; handlers `coldFatigueCheckHandler` (retourne `effects: {kind:'fatigueTestResult', payload, applyStun} \| null`) et `coldDamageTickHandler` (calcule seulement les `hitSpecs`, retourne `effects: {kind:'coldDamageHits', characterId, campaignId, hitSpecs}` — **ne** appelle **pas** `resolveTargetHit` lui-même, voir "Correction trouvée en codant" ci-dessus) ; `applyColdDamageHits(io, campaignId, characterId, hitSpecs)` (nouveau, appelée par la route après commit — fetch contexte + boucle `resolveTargetHit`/émission `COMBAT_ATTACK_RESULT`, même patron que `resolveEnvironmentalHazardTicks`) |
| `server/src/lib/statusService.js` | Extraction de `resolveCharacterTokens` depuis `fatigueService.js:78-83` (passe 2 point 6) — réutilisé par `fatigueService.js` (import, comportement inchangé) et `coldExposureService.js` ; `applyModStatus`/`clearModStatus` déjà présents (`:175-195`) réutilisés tels quels pour le badge (confirmé passe 4 point 3) |
| `server/src/lib/echeanceHandlerRegistrations.js` | Enregistre les 2 handlers (`cold_fatigue_check`/`cold_damage_tick`, `interactive:false`) |
| `server/src/routes/campaigns.js` | Routes calquées mot pour mot sur le patron `hazards/:code/expose`/`clear` (passe 4 point 5, `campaigns.js:470-488`) : `POST/GET/DELETE /:id/tokens/:tokenId/cold-exposure`, `requireAuth, requireRole('gm')`, réutilisent `resolveCampaignToken` (passe 4 point 2) et le garde `if (!token.character_id) throw new AppError(400, ...)` déjà écrit pour `hazards/fall` (passe 4 point 1) ; route `game-time/adjust` existante boucle sur les `effects` remontés après le commit — `kind==='fatigueTestResult'` : applique `applyStun` puis émet `WS.FATIGUE_TEST_RESULT` ; `kind==='coldDamageHits'` : appelle `applyColdDamageHits` |
| `client/src/components/TokenStatusPanel.jsx` | Ajoute `hypothermia` à un ensemble `CHRONIC_HAZARD_CODES` qui ouvre un sous-formulaire (tranche à 3 options + compteur `extremeSteps` désactivé hors Glacial + case "humide") au lieu du toggle nu, pré-rempli via `getColdExposureState` à l'ouverture — même patron que `hazardForm`/`HAZARD_CODES` déjà en place pour Acide/Décompression/Feu |
| `client/src/locales/combat.json` (ou namespace du panneau) | Clés du sous-formulaire (titre, options de tranche, compteur paliers extrêmes, case humide, confirmer/retirer) — aucune clé `status.hypothermia` à ajouter, déjà présente |
| `shared/events.js` | Aucun nouvel événement — `getColdExposureState` couvre le pré-remplissage par lecture REST, `WS.FATIGUE_TEST_RESULT`/`WS.COMBAT_ATTACK_RESULT` déjà existants couvrent les deux `wsEvent` possibles |
| `server/src/lib/tokenLifecycle.js` | **Pas de changement retenu** (passe 3 point 6, option (a)) — un token créé pendant une exposition active n'hérite pas automatiquement du badge, contournement MJ = redéclarer la même tranche |

**Hors périmètre de ce Lot** (inchangé) : suivi automatique vêtements mouillés/tenue adaptée, système de
climat automatique, mécanisme d'amputation séparé.

### Correction trouvée en codant (2026-07-31) — au-delà des 4 passes de cadrage

En écrivant `coldDamageTickHandler` : `woundService.applyWound` (appelé par `resolveTargetHit`) émet
`WOUND_ADDED` de façon **synchrone et inconditionnelle** dès son appel (`woundService.js:38`), jamais
différée. L'appeler depuis l'intérieur du savepoint de `sweepDueEcheances` émettrait donc avant que la
transaction englobante (`adjustGameTime`) n'ait committé — en plus, `resolveTargetHit` a besoin d'un
`io` valide (`applyWound` plante sur `null.to()`), qu'aucune fonction du moteur d'échéances ne
transporte aujourd'hui. Threader `io` à travers tout le moteur (`adjustGameTime` →
`performTimeAdjustment` → `sweepDueEcheances` → `resolveEcheanceHandler` → handler) aurait été un
changement de signature partagé disproportionné pour ce Lot. **Retenu** : `coldDamageTickHandler` ne
fait que calculer les Localisations/formules à jouer (`hitSpecs`) et les retourne via `effects` ;
`applyColdDamageHits` (nouvelle fonction, `coldExposureService.js`) fait le jet + l'application réelle
(`resolveTargetHit`) **après le commit**, appelée par la route qui dispose d'`io` — même séparation que
`performFatigueTest`/`resolveFatigueTest`. Conséquence sur le contrat `effects` (passe 2 point 4,
raffiné passe 4) : discriminant renommé `kind` (`'fatigueTestResult'` | `'coldDamageHits'`) plutôt que
`wsEvent` nu, pour porter aussi bien un événement WS direct qu'une action différée à exécuter.

**Prochaine étape** : Saar valide ce plan de fichiers avant tout code (`CLAUDE.md` §6 point 5) — une
fois validé, implémentation fichier par fichier dans l'ordre du tableau (les deux trous du moteur
d'abord, consommés ensuite par le nouveau service).

### Bug trouvé par Saar en testant (2026-07-31) — Choc du dégât Glacial dépendait du combat

**Symptôme rapporté** : la fenêtre de résolution du Choc ne s'affichait qu'à l'ouverture de la fenêtre
combat, et deux personnages touchés simultanément ne pouvaient pas être résolus tous les deux (une
seule fenêtre, la seconde perdue).

**Cause** : `applyColdDamageHits` se contentait d'émettre `hit.shockResult` dans le payload
`COMBAT_ATTACK_RESULT`, exactement comme `resolveEnvironmentalHazardTicks` (Lot 3). Or le seul
mécanisme qui résout un `shockResult` ainsi émis est une fenêtre interactive côté client
(`CombatOverlay.jsx`, "Stun Dialog") — jamais un problème pour Lot 3 (ses dangers ne tickent que
pendant `startResolutionPhase`, donc la fenêtre de combat est *par construction* déjà ouverte), mais un
vrai bug pour le Froid : ses tics viennent de l'horloge de campagne, sans aucune garantie qu'une
fenêtre de combat soit ouverte, et un seul balayage peut toucher plusieurs personnages à la fois — or
cette fenêtre ne garde qu'un seul dialogue en mémoire (état simple, pas de file d'attente), les
résolutions suivantes écrasent silencieusement la précédente.

**Correction retenue** : `applyColdDamageHits` résout maintenant le Choc **automatiquement**,
exactement comme `performFatigueTest` le fait déjà pour son propre remplacement de Test au palier 5
(jet 1D6 de durée, ×10 si inconscient, `applyStunWithDuration` direct) — aucune fenêtre, aucune
dépendance au combat, aucune perte possible en cas de multi-personnages. `COMBAT_ATTACK_RESULT` reste
émis pour l'affichage (visible si la fenêtre combat est ouverte, silencieux sinon — cosmétique
uniquement désormais, plus aucune donnée mécanique n'en dépend).

### Bug trouvé par Saar en testant (2026-07-31, suite) — pas de file d'attente pour l'affichage

**Symptôme** : même après la correction ci-dessus, la fenêtre de résultat ne s'affiche qu'à
l'ouverture du mode combat, et deux personnages touchés dans le même balayage se perdent l'un
l'autre (un seul affiché, l'autre jamais montré).

**Cause confirmée** (`useCombatSocket.js`) : `gmAttackResult`/`pnjAttackResult` sont des variables
`useState` simples (pas un tableau), et le composant qui les affiche (`CombatOverlay.jsx`) n'est monté
que si `mode==='combat'` (`SessionPage.jsx`, `{mode==='combat' && <CombatOverlay .../>}`). Le listener
socket lui-même (`useCombatSocket`) est bien monté en permanence (appelé depuis `SessionPage.jsx`) —
l'événement est donc reçu et écrase l'état en arrière-plan hors combat, mais rien ne l'affiche tant que
`CombatOverlay` n'est pas monté ; un second résultat écrase le premier avant même d'avoir été vu.
**Jamais un problème pour Feu/Acide/Décompression** (Lot 3) : ils ne tiquent que pendant
`startResolutionPhase`, qui ne s'exécute que pendant la résolution d'un Tour de combat — la fenêtre
combat est donc toujours déjà montée quand ils déclenchent. Le Froid est le premier mécanisme
déclenché depuis l'horloge de campagne, sans cette garantie.

**Correction demandée par Saar, portée volontairement restreinte** (« ni plus ni moins » — pas de
refonte du chat, chantier séparé) : une file d'attente dédiée aux résultats de dangers
environnementaux, découplée du mode combat, sans toucher à l'affichage combat normal existant.

**Solution retenue** — nouveau composant `client/src/components/EnvironmentalResultQueue.jsx` :
- Toujours monté (même patron que `DicePanel`, ajouté dans `SessionPage.jsx` sans condition de mode).
- État `useState([])` — un vrai tableau qui s'ajoute (`[...q, item]`), jamais un slot unique écrasé.
- Écoute `WS.COMBAT_ATTACK_RESULT` directement, filtré sur `data.sourceCode` présent (jamais posé par
  une attaque de combat normale — vérifié : aucun des 3 emitters de combat normal dans
  `socketCombatHelpers.js` ne pose ce champ) — ne capte donc que Froid/Feu/Acide/Décompression, jamais
  un assaut PJ/PNJ classique.
- Réutilise **tel quel** `CombatResultGM`/`CombatResultPlayer` (`CombatResultPanels.jsx`) et le même
  calcul de libellé source que `CombatOverlay.jsx` (`resolveAttaquantLabel` : `status.${sourceCode}`,
  déjà traduit) — rien de nouveau côté présentation, seule la gestion de file est neuve.
- Un client qui n'est ni MJ ni la cible de l'entrée courante la retire silencieusement de sa propre
  file locale (sinon elle resterait bloquée indéfiniment de son point de vue, sans jamais avancer).
- **Correction en retour dans `useCombatSocket.js`** : `onAttackResult` ignore désormais les résultats
  porteurs de `sourceCode` (`if (data.sourceCode) return`) — sans ce garde-fou, Feu/Acide/Décompression
  s'afficheraient en double pendant un combat réel (une fois dans l'ancien slot combat, une fois dans
  la nouvelle file). Correction minimale (une ligne), aucune autre logique combat touchée.

Testé : ESLint (0 erreur, seulement des warnings préexistants sans rapport), build client réussi.
**Confirmé fonctionnel en navigateur par Saar** (2026-07-31) : file d'attente vérifiée avec plusieurs
personnages exposés simultanément, rien perdu.

### Décision explicite (2026-07-31) — rattrapage étalé sur plusieurs avances, pas en un seul saut

`sweepDueEcheances` (Lot 2, `echeanceService.js`) ne fait ticker chaque échéance due **qu'une seule
fois par appel**, quelle que soit l'ampleur du saut de temps — un unique `+6h` sur une exposition
Glacial (tic horaire) ne produit donc qu'1D10 (Bras/Jambes, 1ʳᵉ heure), pas un rattrapage complet des
6 heures d'un coup. L'échéance reste en retard et retique au prochain ajustement d'horloge, aussi
minime soit-il — l'escalade RAW (1D10→2D10→3D10..., Corps/Tête dès la 2ᵉ heure) s'observe donc étalée
sur plusieurs avances MJ successives plutôt qu'en une seule fois pour un grand saut.

**Saar confirme (2026-07-31), après explication du mécanisme, que ce comportement est celui souhaité**
— écart RAW explicite et discuté (`CLAUDE.md` priorité 9), pas un raccourci silencieux : consigné ici
pour que ce ne soit pas re-découvert comme un bug lors d'un futur test. Pas de correctif appliqué à
`sweepDueEcheances` — reste un moteur partagé avec Blessures (Lot 2), toute modification de son
comportement de rattrapage devrait être évaluée pour les deux consommateurs, pas seulement Froid.

**Hors périmètre** : pas de suivi automatique "vêtements mouillés"/"tenue adaptée" — ajustement
manuel de la tranche déclarée par le MJ, comme la RAW le permet déjà nativement. Pas de système de
climat/température ambiante automatique. Pas de mécanisme d'amputation séparé (déjà couvert
narrativement, voir RAW retenu ci-dessus).

---

## 12. Lot 6 — Noyade/Asphyxie

**Dépend de** : Lot 0 uniquement — délibérément indépendant de l'horloge. Le compte à rebours
d'inconscience (2D6 Tours de combat) est un délai de combat, réutilise le mécanisme du Lot 3
(tick `onTurnStart`/`token_statuses`). Le compte à rebours de mort (5-7 minutes réelles) est plus
fin que la granularité quart d'heure de l'horloge (Lot 1) — reste un minuteur narratif tenu par le
MJ, non automatisé dans ce lot.

- Consomme `calcSouffle` déjà calculé. Souffle à 0 → déclenche le compte à rebours d'inconscience
  via le mécanisme du Lot 3.
- Réanimation (Premiers soins) : Test avec malus fonction du temps écoulé — calcul simple, aucun
  nouvel état persistant.

---

## 13. Lot 7 — Maladies et Poisons

Premier vrai consommateur du patron « jauge graduée » du Lot 2 — **c'est ce lot qui affine le
schéma de données exact du Lot 2**, pas l'inverse.

**Modèle de données** :
- `ref_health_definitions` (nouvelle table catalogue, même convention que `ref_equipment`/
  `ref_advantages`/`ref_setbacks`) : type (`maladie`|`poison`), nom, mode de contamination,
  modificateur de contagion/détection, délai d'incubation/action (en quarts d'heure), formule
  d'apparition, formule/intervalle/nombre d'évolutions, seuils/effets, modificateur de diagnostic,
  modificateur de guérison.
- `char_conditions` (nouvelle table instance — **plusieurs lignes possibles par personnage**, un
  personnage peut porter deux maladies distinctes en même temps, ce n'est pas un slot unique) :
  personnage, campagne, définition, niveau courant, dernier seuil déjà appliqué (anti-double-
  application), statut de la condition (ex. `active`/`guerie`/`chronique` — distinct du `status` de
  l'échéance, voir correction ci-dessous). **Correction 2026-07-30** (gut-check du premier vrai
  consommateur "jauge" contre le contrat Lot 2, avant tout code) : une version antérieure de cette
  puce ajoutait aussi `prochaine échéance, occurrences restantes` sur cette table — **retiré**, ces
  deux informations sont déjà l'autorité unique de `game_echeances.next_due_minutes`/
  `occurrences_remaining` (§8 ci-dessus, `CLAUDE.md` §1.4 : une propriété possède une autorité
  unique). `char_conditions` ne stocke que l'état **métier** de la condition (niveau, seuil), jamais
  sa planification — pour connaître la prochaine échéance d'une condition, interroger
  `game_echeances WHERE payload->>'conditionId' = ? AND status = 'active'`, ne jamais dupliquer la
  valeur. Même règle que celle déjà appliquée par Blessures (`payload: { woundId }`, minimal) —
  généralisée en convention explicite pour Lot 2 dans le Modèle de données ci-dessus.
- Résistance appliquée à **chaque** jet (apparition ET chaque évolution, pas une seule fois) — relit
  `resistance_maladie`/`resistance_poison` déjà calculés (§3), rien à ajouter côté attribut.

**Services** : Test de contamination (maladies uniquement — un poison s'applique automatiquement à
l'administration), diagnostic (Médecine), traitement (réduit le niveau). Catalogue seedé par
migration (Peste écarlate, Grippe bleue, Doom, Dream, Chyrso — texte RAW déjà entièrement rédigé
dans le fichier source, travail de saisie plus que de conception).

**Point à vérifier avant de coder** (pas supposé ici) : le vocabulaire `effects[]` déjà utilisé par
Avantages/Revers (`shared/careerAdvantages.js`/`setbackEffects.js`, documenté dans
`docs/VOCABULARY.md`) est-il réutilisable pour des effets de seuil, ou ses types (pensés pour des
octrois ponctuels de création de personnage) ne couvrent-ils pas le cas d'un effet qui doit être
**retiré** quand la jauge redescend sous le seuil ?

**UI** : panneau personnage listant les conditions actives (patron `AdvantagesPanel.jsx`), outil MJ
pour appliquer une maladie/un poison à une cible.

---

## 14. Lot 8 — Drogues

Deuxième consommateur, bénéficie du Lot 7 (jauge d'intoxication 0-30, mêmes formes de seuils/
effets, même catalogue). Ajoute trois éléments absents des Maladies/Poisons :

- **Narco-dommages** : jauge **séparée et permanente** par personnage (cumulative toutes drogues
  confondues, pas une instance par drogue). Cardinalité 1-par-personnage → colonne dédiée
  `char_sheet.narco_dommages` plutôt qu'une ligne `char_conditions` de plus. Décroît dans le temps
  (1 point/jour à 1 point/mois selon la tranche atteinte) — consommateur du Lot 2 en mode
  "décroissance planifiée", recalculée à chaque changement de tranche.
- **Accoutumance** : lookup simple (tranche de Narco-dommages → modificateur de
  `resistance_drogues`), non cumulatif — calcul dérivé, pas un nouvel état.
- **Dépendance/Manque** : décompte depuis la dernière prise, par drogue — Test de résistance
  (CON/VOL le plus bas) à l'échéance, encore un consommateur du Lot 2.
- **Effets secondaires** : jet caché 1D20 vs Narco-dommages à chaque évolution au-delà du seuil
  concerné — logique de résolution, aucun nouvel état persistant.

---

## 15. Lot 9 — Irradiations

Troisième consommateur du Lot 2. Différence structurelle à confirmer en codant : l'irradiation est
vraisemblablement **une seule jauge cumulative par personnage** (les ré-expositions s'additionnent),
pas plusieurs instances simultanées comme des maladies distinctes — oriente vers une colonne dédiée
plutôt qu'une ligne `char_conditions` par exposition.

Ajoute :
- Perte de Constitution **temporaire** par tranche (non cumulable entre tranches, recalculée à
  chaque changement de niveau).
- Perte de Constitution **permanente** à chaque seuil franchi (jamais soignée) + point d'irradiation
  permanent (jamais traité).
- La perte permanente d'attribut doit réutiliser le mécanisme déjà existant de modification
  permanente d'un Attribut Naturel (mutations/avantages, `calcNA`/`calcAN`, `polarisUtils.js`)
  plutôt qu'en inventer un second. **À vérifier précisément en codant ce lot** — c'est aussi le
  mécanisme dont le Lot 10 aura besoin, donc à bien poser ici plutôt que de le refaire une 3e fois.

---

## 16. Lot 10 — Faim et soif

Débloqué par la décision §4.3. Dépend du Lot 2 (mode "injection directe", comme Froid), du Lot 4
(Fatigue), et réutilise le mécanisme de perte d'attribut posé au Lot 9 plutôt que d'en écrire un
troisième.

- Malnutrition (déclarée manuellement par le MJ — aucun suivi automatique de ce qu'un personnage
  mange) → perte hebdomadaire de Force/Constitution planifiée (Lot 2), gain mensuel automatique de
  Fatigue (appelle Lot 4) plafonné à Très fatigué. Privation totale → perte hebdomadaire, plafond
  Épuisé, vérification de mort si Attribut < 3.
- Manque d'eau : compteur de jours sans boire → malus -5 × jours cumulé, mort au-delà de 3 jours
  (1-2 en forte chaleur) — même patron de planification.

**Hors périmètre** : aucune détection automatique de "le personnage a-t-il mangé/bu" (pas de suivi
de rations) — entièrement déclaratif MJ, comme Froid.

---

## 17. Prochaine étape

**Lot 1 ✅ clos (2026-07-29)** — codé, vérifié par exécution à chaque étape (migration 217 appliquée,
`node --test` 202/202, `adjustGameTime` exercé sur une vraie campagne, ESLint/build client propres),
confirmé fonctionnel par Saar en navigateur. Détail complet en §7, y compris les corrections faites en
cours de route (type `integer` plutôt que `bigint`, invariant de non-fuite de `game_time_resolved_minutes`,
calendrier Jour/Mois/Année à mois fixes plutôt que Jour-de-l'année, widget UI revu deux fois sur retour
Saar). Dette hors périmètre trouvée en cours de route et non traitée : `docs/BUGIDENTIFIE.md` UI4.

**Lot 2 ✅ clos** — moteur générique d'échéances (§8), consommé par `PLAN_BLESSURES_GUERISON.md`.

**Lot 3 ✅ clos (2026-07-30)** — Chute/Acide/Décompression/Feu (§9), confirmé fonctionnel par Saar en
navigateur.

**Lot 4 ✅ clos (2026-07-30)** — Fatigue (§10), 7 passes d'analyse critique, confirmé fonctionnel par
Saar en navigateur. Point d'entrée partagé (`setFatiguePoints`) et registre de malus
(`activeMalusRegistry.js`) désormais en place pour les Lots 5/7/8/9/10.

Les Lots 6 à 10 restent planifiés dans leurs grandes lignes seulement ; plusieurs points marqués
« à vérifier/trancher en codant » sont volontairement laissés ouverts (ils dépendent de détails du
code réel au moment d'écrire chaque lot, pas d'une décision produit à prendre maintenant). Prochain
lot à reprendre : **Lot 5 (Froid)** — détail §11, dépend des Lots 1/2/4 (tous clos), sur confirmation
de Saar.
