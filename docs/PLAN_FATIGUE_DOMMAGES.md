# PLAN — Intégration FATIGUE&DOMMAGES.md

> Statut : Lot 0 (cadrage) tranché avec Saar 2026-07-23, aucun code encore écrit. Document
> temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers `docs/SYSTEME/*.md`.
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
  `resistance_radiation` (`char-sheet.js:1245-1289`, `calcResistanceNaturelle`,
  `getMutationModForResistance`/`getAdvantageModForResistance`). Rien à ajouter côté fiche
  personnage pour ces attributs — seul le moteur de jauge qui les consomme reste à construire.
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
| 1 | **Horloge de campagne** (fondation) — détail §7 | M | Lot 0 | structurant, planifié |
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

**Décision Saar 2026-07-23** : pas de mois — aucun calendrier canonique dans le Livre de Base
Polaris (vérifié dans `REGLEPOLARIS.md`), donc pur choix Enclume. Date = Jour N de l'Année Y,
nombre de jours/année configurable par le MJ. Granularité de l'horloge = minute (pas de secondes) —
unité unique de bout en bout (point 2 de l'analyse à charge).

- **Deux compteurs, pas un seul** (raison : point 8 de l'analyse à charge) :
  - `campaigns.game_time_minutes` — le compteur **affiché/narratif**, librement déplaçable par
    le MJ dans les deux sens (delta signé, positif ou négatif), peut descendre sous 0 (une date
    antérieure au départ de campagne configuré est une valeur valide, pas une erreur).
  - `campaigns.game_time_resolved_minutes` — le repère **mécanique**, jamais affiché au MJ,
    strictement non-décroissant (`GREATEST(ancien, nouveau_affiché)` à chaque ajustement). C'est
    l'unique valeur qui compte pour le futur balayage du Lot 2 : l'intervalle réellement à balayer
    est `(resolved_avant, resolved_après]`, jamais calculé sur le compteur affiché.
  - Un recul (`newDisplayed < ancien affiché`) laisse `resolved` inchangé → intervalle à balayer
    vide → « aucun effet mécanique », conforme à la décision Saar.
  - Une avance qui reste sous le repère `resolved` déjà atteint (ex. recul à Jour 5 puis ravance à
    Jour 8, alors que `resolved` est déjà à Jour 10) laisse `resolved` inchangé → intervalle vide →
    **aucune double résolution**, même si l'affichage retraverse un territoire déjà vécu.
  - Une avance qui dépasse le repère `resolved` (ravance à Jour 12 depuis l'exemple ci-dessus) ne
    balaie que le territoire réellement neuf, `(10, 12]` — jamais `(5, 12]`.
- **Config de calendrier** (rarement modifiée, posée une fois par le MJ) : nouvelles clés dans
  `SETTINGS_SCHEMA` (`campaignSettingsService.js`, mécanisme déjà en place, pas de nouveau fichier
  de config) : `calendar_start_year` (number), `calendar_start_day` (number, jour de l'année de
  départ), `calendar_days_per_year` (number, > 0). Passe par la route `PUT /campaigns/:id`
  existante (`requireRole('gm')`), aucune nouvelle route de config nécessaire. Projette uniquement
  le compteur **affiché** — `resolved` n'est jamais montré, n'a pas besoin d'une date lisible.
- **Projection pure** (jamais stockée) : à partir de `game_time_minutes` (affiché) + la config
  ci-dessus, calcule `{ year, dayOfYear, hour, minute }` — fonction pure côté `shared/` (réutilisable
  client + serveur, comme `polarisUtils.js`), pas de duplication de la logique de calcul. Attention
  d'implémentation à noter maintenant : `dayOfYear`/`year` doivent rester corrects pour un compteur
  négatif (modulo JS natif `%` ne se comporte pas comme un modulo mathématique sur les négatifs — à
  gérer explicitement, sinon bug garanti dès qu'un MJ recule avant le jour de départ).
- **Mutateur unique** : `adjustGameTime(db, campaignId, deltaMinutes)` — entier **signé non
  nul** (positif = avance, négatif = recul), renommé depuis `advanceGameTime` (l'ancien nom supposait
  un sens unique, plus vrai depuis le point 8). Verrouille la ligne `campaigns` (`.forUpdate()`,
  patron `tradeService.js`, analyse à charge point 1) avant de lire les deux compteurs courants, puis
  calcule `newDisplayed`/`newResolved` en application et écrit les deux valeurs concrètes (patron
  lire-sous-verrou-puis-écrire de `tradeService.js`, plutôt que l'expression SQL brute utilisée pour
  le merge JSONB de `settings` — les deux patrons coexistent déjà dans le projet pour des formes de
  mutation différentes). Retourne `{ displayedBefore, displayedAfter, resolvedBefore, resolvedAfter }`
  — c'est `resolvedBefore`/`resolvedAfter` que le futur Lot 2 consomme, jamais `displayed*`.
- **Diffusion** : un seul événement WS après la mutation, renommé `CAMPAIGN_GAME_TIME_ADJUSTED`
  (l'ancien nom `_ADVANCED` supposait aussi un sens unique) — transporte les deux compteurs affiché
  (pour l'UI) et résolu (inutile au client aujourd'hui, mais diffusé pour cohérence/debug). Pas de
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
| `server/src/db/migrations/<N>_campaigns_game_time.js` | ajoute `campaigns.game_time_minutes` (bigint, `notNullable`, `defaultTo(0)`) **et** `campaigns.game_time_resolved_minutes` (bigint, `notNullable`, `defaultTo(0)`) — rétrocompatible |
| `server/src/lib/campaignSettingsService.js` | ajoute `calendar_start_year`/`calendar_start_day`/`calendar_days_per_year` à `SETTINGS_SCHEMA` |
| `server/src/routes/campaigns.js` (route `PUT /:id` existante) | ajoute la validation de bornes `1 <= calendar_start_day <= calendar_days_per_year` au bloc de validation par clé déjà présent (analyse à charge point 4) |
| `shared/gameTime.js` (nouveau) | fonction pure de projection compteur affiché → `{year, dayOfYear, hour, minute}`, gère explicitement les valeurs négatives (voir note modulo ci-dessus), testée isolément, partagée client/serveur |
| `server/src/lib/gameTimeService.js` (nouveau) | `adjustGameTime(db, campaignId, deltaMinutes)` — verrou `.forUpdate()`, calcule et écrit les deux compteurs |
| `server/src/routes/campaigns.js` | nouvelle route `POST /:id/game-time/adjust`, `requireAuth, requireRole('gm')` (patron identique à `PUT /:id`), corps `{ minutes: <entier signé non nul> }` exclusivement (point 2) |
| `shared/events.js` | nouvelle constante `CAMPAIGN_GAME_TIME_ADJUSTED` |
| UI GM minimale | préréglages (+15min/+1h/+6h/+1 jour/+1 semaine, chacun disponible en + et en -) + saisie libre en minutes/heures/jours (tranché) — même unité que le serveur, aucune conversion, emplacement exact à préciser en codant |

### i18n (`.claude/rules/i18n.md`, vérifié avant d'écrire cette section)

- Aucun texte visible codé en dur dans le composant UI GM (labels des préréglages, saisie libre,
  confirmations) — `useTranslation()`/`t('clé')` obligatoire, clé ajoutée au namespace **avant**
  utilisation dans le JSX (jamais l'inverse).
- Namespaces existants vérifiés : seuls `fr.json` (transverse `common`), `en.json` (gelé, non
  chargé) et `creation.json` existent réellement aujourd'hui — `combat.json`/`charSheet.json`/
  `builder.json` cités dans la règle comme exemples ne sont pas encore créés. Décision : nouveau
  namespace dédié `campaignClock.json` plutôt que d'entasser dans `fr.json` — ce chantier
  (Lots 1-10) va ajouter beaucoup d'UI dans la durée, un namespace unique par domaine évite d'avoir
  à tout migrer plus tard (règle "un domaine dense a son propre fichier").
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

> Fondation structurante, aucun contenu de jeu réel dessus (même patron que Moding Groupe 4 Phase 1 :
> socle livré inerte, affiné par son premier vrai consommateur — ici le Lot 7).

**Objectif** : une seule primitive de planification sur l'horloge de campagne (Lot 1), consommée
par tout lot qui a besoin de « dans X temps de jeu, quelque chose se passe, éventuellement plusieurs
fois ». Deux patrons de consommation identifiés dans le RAW :
(a) **jauge graduée persistante 0-30** (Maladies, Poisons, Drogues, Irradiations) ;
(b) **injection directe** — dégâts physiques ou perte d'attribut sans jauge intermédiaire (Froid,
Faim/soif).

**Composition avec le Lot 1** : le balayage n'est **pas** un abonnement à l'event WS
`CAMPAIGN_GAME_TIME_ADVANCED` (un event WS ne boucle pas vers le serveur) — c'est un appel de
fonction direct, dans la **même transaction** que `advanceGameTime`, orchestré par la route
`POST /:id/game-time/advance` : avancer l'horloge et balayer les échéances dues doivent réussir ou
échouer ensemble. Le résumé des changements est diffusé dans le même event que la nouvelle heure.

**Modèle de données** (forme générale — schéma exact affiné en codant le Lot 7, premier vrai
consommateur, pas figé ici par principe de ne pas deviner) : une table d'échéances portant
personnage, campagne (dénormalisée pour la requête de balayage), horodatage de prochaine échéance,
intervalle de répétition, nombre d'occurrences restantes, et une référence au type de condition qui
détermine quoi faire à l'échéance (incrémenter une jauge vs injecter un dégât/malus direct).

**Idempotence** : pour le patron jauge, chaque instance retient le dernier seuil déjà appliqué —
un balayage qui traverse plusieurs seuils d'un coup (gros saut de temps) applique chaque seuil une
seule fois, jamais en boucle.

**Hors périmètre** : aucune maladie/poison/drogue/irradiation/froid réel branché — livré avec un
test isolé prouvant le moteur (une jauge factice qui monte, un dégât direct factice), avant
d'attaquer un vrai consommateur.

---

## 9. Lot 3 — Dommages environnementaux de combat (Chute, Acide, Décompression, Feu)

**Dépend de** : Lot 0 uniquement — indépendant de l'horloge de campagne, ces effets s'expriment en
**Tours de combat**, pas en temps de jeu réel.

- **Chute** (ponctuelle, un seul jet) : hauteur déclarée par le MJ (ou le joueur) → formule de dés +
  nombre de localisations aléatoires selon la table RAW déjà citée dans le fichier source, protection
  d'armure réduite de moitié (paramètre à vérifier/ajouter dans `resolveTargetHit` si absent), Test
  d'Acrobatie/Équilibre optionnel pour réduire les dégâts. Aucun état persistant.
- **Acide / Décompression / Feu** (récurrents, par Tour, jusqu'à neutralisation/sortie de zone) :
  patron déjà en germe dans le projet — `startResolutionPhase` (`socketCombatHelpers.js`) tick déjà
  `onTurnStart` pour les mods d'armes (Moding Groupe 4 Phase 3, item 103 `EN_COURS.md`), même point
  d'accroche à réutiliser plutôt qu'un nouveau minuteur. Retrait manuel (sortir de la zone, éteindre
  le feu, neutraliser l'acide) plutôt qu'une expiration `expires_at_turn` fixe, puisque la RAW ne fixe
  pas de durée a priori.
- Réutilise directement le moteur de blessures + localisation existants — aucune nouvelle jauge,
  aucun horodatage de campagne.

**Hors périmètre** : pas de détection automatique de hauteur de chute via le moteur monde
(`WorldSnapshot`) — saisie manuelle MJ pour ce lot, une intégration monde éventuelle resterait un
chantier séparé.

**Point ouvert** : le nom exact des nouveaux `status_code` (`acid_exposure`/`decompression`/
`on_fire` ou équivalent) — à trancher en codant.

---

## 10. Lot 4 — Fatigue

**Dépend de** : Lot 0. Avancé volontairement dans la séquence (voir §5) — fournit le point d'entrée
partagé que les Lots 5/7/8/9/10 appellent tous.

**Modèle de données** : un seul entier persistant, `char_sheet.fatigue_points` (0 à 14 — 5 paliers
× 3 cases), plutôt que palier et case en deux champs séparés qui pourraient se désynchroniser — même
principe d'autorité unique que le compteur d'horloge du Lot 1. Palier = `floor(points/3)`, case =
`points % 3`.

**Barème retenu** (décision §4.1, p.243 du chapitre Fatigue) : palier 0 Normal (0), 1 Légèrement
fatigué (-3), 2 Fatigué (-5), 3 Très fatigué (-7), 4 Épuisé (-10), 5 À bout de force (-10 + Test de
Choc à chaque action fatigante).

**Point d'entrée partagé** : `setFatiguePoints`/`addFatiguePoints(db, characterId, delta)` — unique
fonction mutatrice. Les Lots 5 (Froid), 7 (Maladies/Poisons), 8 (Drogues), 9 (Irradiations), 10
(Faim/soif) et le MJ (déclenchement narratif direct, décision §4.2) passent tous par elle ; aucun
lot n'écrit `fatigue_points` directement.

**Application du malus** : rejoint le point d'agrégation des modificateurs de Test déjà existant
(celui qui applique déjà le malus de blessure) — à identifier précisément en codant, pas un nouveau
site d'application séparé.

**Badge** (icône au-dessus du token) : la Fatigue est un état de **personnage**, persistant hors
combat, alors que `token_statuses` est scope **token** avec expiration en Tours. Option recommandée :
miroir — à chaque changement de `fatigue_points`, upsert/retrait d'une entrée `token_statuses` sans
expiration sur le(s) token(s) actif(s) du personnage, ce qui réutilise tel quel `TokenStatusPanel.jsx`/
`Canvas3D.jsx` sans toucher au rendu. Alternative (étendre le rendu pour lire un champ personnage)
possible mais plus invasive — choix final en codant.

**Récupération** : action MJ explicite (« marquer ce personnage comme reposé »), pas un balayage
automatique du Lot 2 — cohérent avec la décision §4.2 (narratif/manuel). Peut afficher l'heure de
l'horloge (Lot 1) comme simple référence, sans déclenchement automatique.

**Hors périmètre** : aucune cadence automatique de Test de Fatigue (RAW explicitement laissé à la
discrétion MJ).

---

## 11. Lot 5 — Froid

**Dépend de** : Lot 1 (horloge), Lot 2 (patron "injection directe"), Lot 4 (Fatigue).

Seul danger environnemental à s'exprimer en **heures de jeu réel** (toutes les 2h/1h/30min selon la
tranche de température), pas en Tours de combat — d'où sa dépendance à l'horloge plutôt qu'au tick
`onTurnStart` du Lot 3.

- Le MJ déclare/retire manuellement la tranche de température d'un personnage (Froid/Très froid/
  Glacial/Froid extrême) — aucun système de climat/température ambiante automatique dans le projet,
  hors périmètre d'y en ajouter un.
- Une fois déclarée, le Lot 2 planifie : (1) un Test de résistance à la Fatigue périodique (échec →
  appelle le Lot 4) ; (2) sous Glacial et en dessous, des dégâts physiques localisés croissants
  (Bras/Jambes puis Corps/Tête, 1D10 → 2D10 → 3D10...) injectés directement dans le moteur de
  blessures (Lot 3), sans jauge intermédiaire.
- Retrait de l'exposition = action MJ manuelle, arrête la planification en cours.

**Hors périmètre** : pas de suivi automatique "vêtements mouillés"/"tenue adaptée" — ajustement
manuel de la tranche déclarée par le MJ, comme la RAW le permet déjà nativement.

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
  application), prochaine échéance, occurrences restantes, statut.
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

Lot 1 prêt à être codé sur confirmation de Saar — présentation faite en §7 conformément à
`CLAUDE.md` §6. Les Lots 2 à 10 sont maintenant planifiés dans leurs grandes lignes ; plusieurs
points marqués « à vérifier/trancher en codant » sont volontairement laissés ouverts (ils dépendent
de détails du code réel au moment d'écrire chaque lot, pas d'une décision produit à prendre
maintenant). **Aucun code n'a encore été écrit, sur aucun lot.**
