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
> `weaponModRegistry.js`) — sans impact sur l'architecture retenue. Toujours
> aucun code écrit sur Lot 2. Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver
> dans `docs/Old/` une fois le chantier entier clos, contenu durable transféré vers
> `docs/SYSTEME/*.md`.
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

1. Nom de la table — `game_echeances` proposé, pas figé.
2. `character_id` obligatoire (`NOT NULL`) ou nullable pour une future échéance non liée à un
   personnage précis ? Aucun cas connu — pencherait pour `NOT NULL` (YAGNI) sauf objection.
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

Les Lots 2 à 10 restent planifiés dans leurs grandes lignes seulement ; plusieurs points marqués
« à vérifier/trancher en codant » sont volontairement laissés ouverts (ils dépendent de détails du
code réel au moment d'écrire chaque lot, pas d'une décision produit à prendre maintenant). Prochain
lot à reprendre : Lot 2 (moteur générique d'échéances de jeu), sur confirmation de Saar.
