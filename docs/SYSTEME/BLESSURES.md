# SYSTEME/BLESSURES.md — Blessures, armures, malus Polaris
> **Amendé 2026-09-25 (nuit) — Lot 0 de `PLANS/PLAN_REVUE_GUERISON.md`** : une échéance meurt avec sa case (plus d'échéance fantôme), et un Échec/une Catastrophe ne
> terminent plus jamais l'échéance de guérison (§« Guérison et Infection »).
> **Amendé 2026-09-25 (soir) — guérison en chaîne (ticket `WOUND-HEAL-CHAIN-STOPS`)** : toute case de blessure écrite (coup reçu, promotion,
> guérison, Chance, case d'infection) naît **avec** son échéance de guérison, programmée par le seul écrivain de lignes
> (`woundUtils.js`) ; la guérison ne s'arrête plus après un cran. Voir §« Guérison et Infection ».
> **Mis à jour 2026-09-25 (clôture du Lot 3 du chantier « 6ᵉ ligne du compteur »)** : le compteur a ses 6 lignes
> (`mort_subite` = « Mort » en Tête/Corps, « Membre détruit » sur un membre), le débordement de la Mortelle, la Mort qui pose le
> statut `dead` — **après la décision du joueur** —, la guérison du Membre détruit, et la **réaction de Chance** (§« Réaction de
> Chance ») qui permet de racheter une Mort ou un Membre détruit. Décisions : `docs/JOURNAL8.md` (2026-09-25). Reste : état permanent
> du membre (Lot 4) — `docs/PLANS/PLAN_BLESSURE_SIXIEME_LIGNE.md` ; suites de la réaction (minuteur PJ, garde de fin de Tour,
> Catastrophes) — `docs/PLANS/PLAN_CHANCE.md` §8.
> Audit de compréhension approfondie 2026-08-26 (suite) : WOUND_MAX_COUNTS et WOUND_HEALING
> confirmés exacts contre `woundConstants.js` ; formule `computeWoundInfectionThreshold` corrigée
> (les malus de cases/périodes sont conditionnels par gravité, pas universels — table étendue) ;
> piège `occurred_at_game_minutes` confirmé par un test dédié (`woundUtils.test.mjs`).
> Source : SYSTEME.md §16
> Lire pour : wounds, ArmorWoundPanel, LocationPanel, mille-feuille, calculs P51

---

## Architecture générale

```
shared/woundConstants.js  — WOUND_LOCATIONS / SEVERITIES / MAX_COUNTS / PENALTIES / SEVERITY_COLORS + les règles pures de la 6ᵉ ligne
                            (isWoundLinePromoted, isFatalWound, getWoundEffects, getWoundHealing, WOUND_IMPROVEMENT_TARGET…)
shared/armorConstants.js  — ARMOR_CATEGORY_MALUS / LOCATION_TO_SLOT / SLOT_TO_REF_LOCATION / LOCATION_TO_SVG / LOCATION_LABELS
server/lib/charStats.js   — calcWoundPenalty(wounds) / calcEncumbrancePenalty(totalWeight, forValue) / getShockMalus(severity, location)
server/lib/woundUtils.js  — SEUL écrivain ET SEUL suppresseur de `character_wounds` (une échéance vit et meurt avec sa case ; insertion en cascade, amélioration, case d'infection : chaque case naît
                            avec son échéance de guérison), tri SQL, Test de Choc requis
server/lib/woundHealingSchedule.js — programme l'échéance de guérison d'UNE case (module feuille, appelé par woundUtils.js)
server/lib/woundService.js — applyWound (insertion + `dead` + diffusion) / removeWound / /heal
```

## Constantes blessures (woundConstants.js)

```javascript
WOUND_LOCATIONS = ['tete', 'corps', 'bras_droit', 'bras_gauche', 'jambe_droite', 'jambe_gauche']

WOUND_SEVERITIES = ['legere', 'moyenne', 'grave', 'critique', 'mortelle', 'mort_subite']
// Les 6 lignes du compteur RAW. L'ORDRE est l'autorité de la promotion (nextSeverity), du « pire » (getWorstWoundSeverity, client)
// et du tri SQL (woundSeverityRankSql, généré depuis ce tableau — plus de CASE recopié). `mort_subite` est UNE gravité stockée
// dont le libellé dépend de la localisation : « Mort » en Tête/Corps, « Membre détruit » sur un bras/une jambe
// (isSuddenDeathLocation). Voir « La 6ᵉ ligne » ci-dessous.

WOUND_PENALTIES = { legere: -1, moyenne: -3, grave: -5, critique: -10, mortelle: 0, mort_subite: 0 }
// mortelle=0 (pas -20) : REGLEBLESSURES.md dit "non applicable, le blessé ne peut entreprendre
// aucune action demandant un Test" — le -20 était une extrapolation jamais confirmée par le LdB,
// corrigé (WNDMORT, docs/BUGIDENTIFIE.md). 0 = défense en profondeur si isTestBlockingWound est
// oublié par un appelant, pas une vraie valeur RAW.
// calcWoundPenalty retourne le minimum ENTRE PLUSIEURS BLESSURES (pire seule retenue) — voir
// correction ci-dessous : ça ne veut plus dire "malus santé non-cumulatif" au sens large.

SEVERITY_COLORS = {
  legere: '#FFD700', moyenne: '#FFA500', grave: '#FF6B6B', critique: '#FF0000', mortelle: '#8B0000', mort_subite: '#5c5c66'  // gris
}
```

### WOUND_MAX_COUNTS — nombre max de blessures par localisation

Capacités vérifiées sur la fiche papier (capture de Saar, 2026-09-24).

| Localisation | Légère | Moyenne | Grave | Critique | Mortelle | 6ᵉ ligne |
|---|---|---|---|---|---|---|
| Tête | 3 | 3 | 2 | 2 | 1 | 1 (« Mort ») |
| Corps | 4 | 3 | 3 | 2 | 2 | 1 (« Mort ») |
| Bras D/G | 3 | 3 | 2 | 2 | 1 | 1 (« Membre détruit ») |
| Jambe D/G | 3 | 3 | 2 | 2 | 1 | 1 (« Membre détruit ») |

### Promotion d'une ligne pleine

Règle générale (`isWoundLinePromoted`, `shared/woundConstants.js`) : la blessure qui **remplirait la dernière case** convertit la
ligne en une blessure de la gravité supérieure (3ᵉ Légère sur une ligne à 3 cases = 1 Moyenne), en cascade
(`resolveWoundInsertion`, `woundUtils.js`). **Exception : la ligne Mortelle ne se convertit qu'au dépassement**
(`OVERFLOW_ONLY_SEVERITIES`) — avec 1 case (Tête, bras, jambes), toute Mortelle deviendrait sinon aussitôt Mort ; or une Mortelle à
la tête est une survie avec stabilisation (d'où l'importance des casques). La 2ᵉ Mortelle à la tête (3ᵉ au corps) déborde vers la
6ᵉ ligne. Une 2ᵉ blessure sur la 6ᵉ ligne, déjà pleine, ne fait rien : `WoundLineFullError`, journalisée `[DBG]` par `applyWound`
(fait attendu, pas un échec — le cadavre continue de prendre des blessures ailleurs).

### Seuils de dommages — une autorité

`BLESSURE_SEUILS_TABLE` (5, 10, 15, 20, 25, **30 = `mort_subite`**) + `woundSeverityForDamage(degatsNets)` : humain
(`damageService.resolveTargetHit`) **et** drone (`resolveDroneIntegrityLoss`, qui traite avant lui la destruction propre au drone à
30). `_severityForDamage` n'existe plus ; `is_lethal` non plus (la gravité porte l'information). Un coup net ≥ 30 écrit directement
`mort_subite` ; le Choc virtuel combiné ≥ 30 en Tête/Corps est plafonné à `mortelle` pour le Test de Choc (`_shockTestSeverity`).

### La 6ᵉ ligne — Mort subite / Membre détruit

| Sujet | Règle | Où |
|---|---|---|
| Libellé | « Mort » en Tête/Corps, « Membre détruit » sur un membre ; case unique affichée comme un **mot**, toujours visible, cliquable (MJ seul) | `LocationPanel.jsx` |
| Pose/retrait manuel | **MJ seul** (`GM_ONLY_WOUND_SEVERITIES`) : sinon un joueur contournerait le statut `dead` réservé au MJ | `char-sheet.js` (403 « GM uniquement »), `LocationPanel.jsx` |
| Tests | interdits (RAW : Mortelle ET Membre détruit) ; jambe → déplacement impossible | `TEST_BLOCKING_SEVERITIES`, `isMortalWoundImmobilized` |
| Test de Choc | Mort (Tête/Corps) : aucun (« meurt sur le coup ») ; Membre détruit : requis, malus −10 (colonne RAW `membreDetruit`) | `isShockTestRequired`, `getWoundEffects` |
| Malus de Choc | lu dans `BLESSURE_EFFETS_TABLE` par `getWoundEffects(severity, location)` — plus de copie dans `charStats.js` | `getShockMalus` |
| Statut `dead` | la Mort (Tête/Corps) pose `dead` sur les tokens du personnage ; le Membre détruit ne tue pas | §« Mort et cadavre » |
| Guérison | Membre détruit : 3 semaines, Chirurgie + Médecine, soins constants, devient une **Critique** ; Mort : aucune échéance | §« Guérison et Infection » |
| Chance | racheter une Mort ou un Membre détruit **écrit directement par un coup ≥ 30** = Critique pour **3 points** (écart RAW assumé) ; jamais celui d'un débordement | §« Réaction de Chance », `openWoundReaction` |
| État permanent du membre | paralysie durable, rendu barré/gris — **non implémenté** (Lot 4) | plan |

## Composants client — onglet Matériel (CharacterWindow)

```
CharacterWindow
└── ArmorWoundPanel          — orchestrateur : charge wounds + inventory, layout 3 colonnes
    ├── LocationPanel × 6    — une localisation (Tête/Corps/Bras G/D/Jambe G/D)
    │   ├── armures équipées (multi-couches, mille-feuille ETQ/PRT/malus_cat)
    │   ├── select ajout couche (filtré par refCode + container='Sac')
    │   └── grille blessures (WOUND_SEVERITIES × MAX_COUNTS — clic POST/PUT/DELETE ; 6ᵉ ligne = mot « Mort »/« Membre détruit », cliquable MJ seul, prop `isGm`)
    ├── ContainerPanel (D)   — Sac à dos : équipement conteneur
    ├── ContainerPanel (Ce)  — Ceinture : équipement conteneur
    └── SilhouettePanel      — SVG silhouette 50%, colorée par pire blessure par localisation
```

## Mille-feuille (calcMillefeuille — client uniquement)

```javascript
// Couches sur une localisation → max + reste/2
const max  = Math.max(...vals)
const rest = vals.reduce((s, v) => s + v, 0) - max
return max + rest / 2
// Affiché ETQ/PRT dans LocationPanel — non encore intégré côté serveur (résolution dommages future)
```

## Codes slots — PI6 / PI7

```javascript
// LOCATION_TO_SLOT — armorConstants.js (complet)
{
  tete: 'T', corps: 'C',
  bras_gauche: 'BG', bras_droit: 'BD',
  jambe_gauche: 'JG', jambe_droite: 'JD',
  main_gauche: 'MG', main_droite: 'MD',  // slots armes / mains
  deux_mains: '2M', tripode: 'Tr',        // armes deux mains / support
}

// SLOT_TO_REF_LOCATION — slotCode → ref_location catalogue (complet)
{ T:'T', C:'C', BG:'B', BD:'B', JG:'J', JD:'J', MG:'M', MD:'M', '2M':'M', Tr:'M' }
// 'M' = main — tous les slots mains/armes mappent vers la ref_location 'M'

// SLOT_TO_WOUND_LOCATION — inverse pour blessures combat (existe déjà dans armorConstants.js)
{ T:'tete', C:'corps', BD:'bras_droit', BG:'bras_gauche', JD:'jambe_droite', JG:'jambe_gauche' }
// MG/MD/2M/Tr absents : les mains ne sont pas des localisations de blessure

// Dans LocationPanel :
const slotCode = LOCATION_TO_SLOT[location]           // 'BG'
const refCode  = SLOT_TO_REF_LOCATION[slotCode]       // 'B'
equippedItems  = items.filter(i => i.slot?.split('/').includes(slotCode))  // utilise 'BG'
availableItems = items.filter(i => i.ref_location?.split('/').includes(refCode))  // utilise 'B'
```

**PI6 :** `bras_gauche:'BG'`, `bras_droit:'BD'`, `jambe_gauche:'JG'`, `jambe_droite:'JD'` — pas de partage B/J.
**PI7 :** `slotCode` pour equip/unequip. `refCode` pour le lookup catalogue uniquement. Ne pas confondre.

## ARMOR_CATEGORY_MALUS (armorConstants.js)

Malus de carence par catégorie d'armure. S'applique quand la FOR est insuffisante (`calcCarenceArmure`).

```javascript
ARMOR_CATEGORY_MALUS = { S: 0, A: -2, B: -3, C: -4, D: -6 }
// S = Sans contrainte (combinaison souple)
// A/B/C/D = armures de plus en plus lourdes
```

## Routes REST armures/blessures

```
GET    /char-sheet/:id/wounds
  → { wounds: [], wound_penalty: number }

POST   /char-sheet/:id/wounds  { location, severity }
  → 201 { wound, promoted: bool, shock_test_required: bool }
  + WS WOUND_ADDED broadcast { characterId, wound, promoted, shock_test_required }
  → passe par applyWound. 403 « GM uniquement » pour `mort_subite` sans droit MJ (GM_ONLY_WOUND_SEVERITIES) ;
    400 « Ligne pleine » si la 6ᵉ ligne est déjà occupée.

PUT    /char-sheet/:id/wounds/:wid/stabilize
  → { wound } (is_stabilized: true)
  + WS WOUND_UPDATED broadcast { characterId, wound }

DELETE /char-sheet/:id/wounds/:wid
  → { deleted: true, woundId }   (403 pour `mort_subite` sans droit MJ, 404 si la blessure n'existe plus)
  + WS WOUND_REMOVED broadcast { characterId, woundId, worst_wound_severity }
  → passe par removeWound : si c'était une Mort, le `dead` qu'elle avait posé est retiré dans la même transaction.

GET    /char-sheet/:id/inventory
  → { items, sols, total_weight, threshold }

POST   /char-sheet/:id/inventory
  → 201 { item }
PUT    /char-sheet/:id/inventory/:itemId
  → { item }
DELETE /char-sheet/:id/inventory/:itemId
  → { ok: true }

PUT    /char-sheet/:id/sols  { sols }
  → { sols }  + WS SOLS_UPDATED { characterId, sols }

GET    /char-sheet/:id/weapon-skill/:weaponInvId
  → { skillId, skillLabel, skillTotal }   // null partout si arme sans compétence associée
```

## P51 — effectiveMalus dans les jets (périmé, corrigé ci-dessous en 153-158)

```javascript
// server/src/socket/socketEntity.js:323 — chancesDeReussite (PAS socket/index.js, cf. correction)
effectiveMalus = calcActiveMalus({ wounds, fatiguePoints, totalWeight, forNA, settings })  // ≤ 0
chancesDeReussite = mechanicalTotal + totalDiffMod + effectiveMalus
```

**Corrigé (audit 2026-08-26, périmé depuis `docs/PLAN_FATIGUE_DOMMAGES.md` §10 Lot 4)** : le calcul
`effectiveMalus` ne vit plus dans `socket/index.js` (fichier qui n'est qu'un routeur de handlers,
aucune formule dedans) mais dans `server/src/socket/socketEntity.js:323`. Il n'est plus recalculé
inline par site — un registre unique, `server/src/lib/activeMalusRegistry.js` (`calcActiveMalus`),
**somme** trois sources indépendantes (`wound`, `encumbrance`, `fatigue`), une entrée par lot futur
(Froid, Maladies/Poisons, Drogues, Irradiations) sans jamais retoucher les sites consommateurs.

**Malus blessures (entre plusieurs blessures) :** non-cumulatif — pire seule retenue (LdB p.236).
`calcWoundPenalty` retourne le minimum entre les blessures actives d'un même personnage.
**Malus encombrement :** cumulatif (règle maison).
**Malus fatigue :** cumulatif avec les deux précédents (`getFatigueLevelMalus`, exempté uniquement du
Test de Fatigue lui-même, RAW l.976-979).
**Entre les trois catégories (blessure/encombrement/fatigue) : cumulatif, pas "pire seul retenu"** —
correction de ce document, cette phrase était fausse depuis le Lot 4. **Jamais** appliquer sur un
attribut — toujours sur le total du jet.

## P49 — Promotion blessures

Si `res.data.promoted === true`, le serveur a supprimé la ligne source.
**Toujours `GET /wounds` complet** — jamais `setWounds(prev => [...prev, wound])` sur une promotion.

## Guérison et Infection (échéancier de campagne)

Consommateur du moteur d'échéances générique (`game_echeances`, `docs/PLAN_FATIGUE_DOMMAGES.md` §8).
Autorité complète (archivée) : `docs/Old/PLAN_BLESSURES_GUERISON.md`.

```
server/src/lib/woundEvolutionService.js  — les 2 handlers ci-dessous
shared/echeanceTypeRegistry.js           — condition_type → handler, interactive: true
server/src/routes/campaigns.js           — routes ci-dessous
client/src/components/BlessuresReviewPanel.jsx  — écran de revue MJ groupé
client/src/components/PendingRollsPanel.jsx     — jets joueurs en attente (Infection)
```

`interactive: true` — jamais résolus par le balayage automatique `sweepDueEcheances`, toujours via
`resolveEcheanceNow` (Lot 2), appelée dès qu'une réponse MJ/joueur est connue.

**`wound_healing_check`** — jamais de jet serveur pour son propre résultat ; lit `payload.mjChoice`
(`amelioration` / `echec` / `catastrophe`) déjà fourni par le MJ dans `BlessuresReviewPanel`. Table de
durée (`WOUND_HEALING`, `shared/woundConstants.js`), lue **uniquement** par `getWoundHealing(severity, location)` — autorité
unique de « cette blessure guérit-elle, et en combien de temps ? » (jamais `WOUND_HEALING[severity]` : la clé `membreDetruit` n'est pas
une gravité) :

| Gravité | Durée | Soins constants | Forme |
|---|---|---|---|
| Moyenne | 3 jours | Non | échéance unique |
| Grave | 1 semaine | Non | échéance unique |
| Critique | 3 semaines | Oui | hebdomadaire, 3 occurrences |
| Mortelle | 5 semaines | Oui | hebdomadaire, 5 occurrences |
| Membre détruit (`mort_subite` sur un bras/une jambe) | 3 semaines | Oui | hebdomadaire, 3 occurrences |

Légère guérit seule, sans échéance ni Test. **Une Mort (`mort_subite` en Tête/Corps) n'a aucune échéance** : la résurrection reste une
décision du MJ. `echec`/`catastrophe` engendrent une `wound_infection_check` **et ne terminent jamais l'échéance de guérison** (voir « Le Test suivant » ci-dessous).

**Cible d'une amélioration** — `improvedSeverity(severity)` (`woundUtils.js`, lit `WOUND_IMPROVEMENT_TARGET`) : la gravité juste en
dessous, **sauf** la 6ᵉ ligne qui devient une **Critique** (RAW : « un Membre détruit devient une Blessure critique » ;
`REGLE_CHANCE.md` : une Mort subite rachetée donne une Critique). `previousSeverity` reste l'inverse mécanique de la promotion, pas la
cible d'une guérison. `resolveWoundImprovement` (guérison, et Chance) l'utilise.

**Chaque case naît avec son échéance** (2026-09-25, `WOUND-HEAL-CHAIN-STOPS`) : `woundUtils.js` est le SEUL écrivain de lignes
`character_wounds` — insertion d'un coup, cascade de promotion, amélioration (guérison ou Chance), case ajoutée par une infection.
Il programme l'échéance de guérison de la case écrite (`woundHealingSchedule.js:initializeWoundHealingEcheance`) dans la même
transaction ; un appelant qui n'a pas le contexte `{ campaignId, characterId }` échoue tout de suite, il n'écrit jamais une case sans
échéance. Conséquences : la guérison s'enchaîne (Critique → Grave → Moyenne → Légère, la Légère guérit seule) ; la case obtenue par
la **Chance** guérit comme si elle avait été reçue ainsi (décision de Saar, 2026-09-25) ; la case ajoutée par une **infection** a sa propre
échéance (idem).
- **Départ de la durée de guérison de la case obtenue** : le jour d'échéance de la guérison qui l'a produite
  (`echeance.next_due_minutes`), **jamais** `game_time_resolved_minutes` — celui-ci n'avance qu'à la confirmation de l'avance de temps,
  après la revue du MJ : la case naîtrait datée avant le jour où elle est réellement devenue plus légère et guérirait en sautant des
  semaines. La Chance, elle, s'exerce « maintenant » : repère mécanique courant.
- **`steps`** : la Chance réduit de 1 à 3 crans d'un seul coup ; `resolveWoundImprovement(trx, id, schedule, { steps })` écrit UNE case à la
  gravité d'arrivée (jamais une case intermédiaire et son échéance aussitôt supprimées).
- **Annulation d'une avance de temps** : `buildWoundInsertionUndoEntries` / `buildWoundImprovementUndoEntries` journalisent aussi
  l'échéance créée avec la case (`previousValues: null`), pour que `cancelPendingAdvance` la retire.

**Une échéance meurt avec sa case** (Lot 0 de `PLAN_REVUE_GUERISON`, 2026-09-25, `WOUND-ECHEANCE-GHOSTS`) : `woundUtils.js` est aussi l'**UNIQUE
suppresseur** de lignes (`deleteWoundRows` — promotion, amélioration, `removeWound`, `/heal` n'écrivent plus jamais un `.del()`). Il annule les
échéances **vivantes** (`active`, `pending_mj_review`, `awaiting_player_roll`) de guérison ET d'infection des cases supprimées (statut `cancelled`,
aucune ligne effacée — `woundHealingSchedule.js:cancelWoundEcheances`). Avant ce lot, 87 des 97 lignes de l'écran de revue de la base locale
étaient des échéances « sans blessure » qui bloquaient la confirmation de l'avance de temps.
- **`exceptEcheanceId`** : l'échéance que le moteur est en train de résoudre n'est jamais annulée par ce suppresseur — c'est le moteur qui fixe son
  statut final (sinon il la « ressusciterait » en `active`). Un handler d'infection dont la case est fusionnée par la promotion se termine.
- **Annulation d'une avance de temps** : les échéances annulées avec une case (guérison : ex. son infection en cours ; promotion : les cases fusionnées)
  entrent dans les `undoEntries` avec leur ligne d'origine (`previousValues`) : annuler l'avance les **restaure**.
- **Diffusion** : `woundService.js` émet `GAME_ECHEANCE_RESOLVED` pour chaque échéance annulée (suppression MJ, `/heal`, promotion, Chance) : le panneau de
  revue ouvert retire la ligne. Les annulations faites dans un handler du moteur (sans `io`) ne sont pas diffusées (Lot 1 : route groupée).

**Le Test suivant** (Lot 0, `WOUND-HEAL-ONESHOT-STUCK`, décisions de Saar 2026-09-25) : **un seul calcul**, `woundEvolutionService.js:buildFailedHealingReschedule`.
Un Échec ou une Catastrophe ne terminent JAMAIS l'échéance : pas la dernière occurrence → le cycle continue ; dernière occurrence (ou échéance unique) →
une nouvelle tentative (`woundHealingSchedule.js:getHealingRetrySchedule`) — Moyenne/Grave (guérison naturelle) : la durée de la gravité (3 jours / 1 semaine) ;
Critique/Mortelle/Membre détruit (soins constants) : **1 semaine**. RAW (`REGLEBLESSURES.md:393-407`, `:435-485`) : un soin loupé n'est pas une guérison — Test de
Constitution contre l'infection ; le RAW ne dit pas la durée d'une nouvelle tentative (semaine suivante = décision de Saar). L'ancienne case « le personnage
continue-t-il d'être soigné ? » (`soinsContinues`) n'a plus aucun effet côté serveur (l'écran la retire au Lot 2). Vérifié par exécution avant le correctif : un 2ᵉ Échec,
un Échec sur la dernière semaine d'une Critique et une Catastrophe sur une Moyenne laissaient la blessure sans plus aucune échéance.

**Limites connues** (suivies en tickets) : `resolveWoundImprovement` ne vérifie pas la capacité de la ligne cible (`WOUND-HEAL-LINE-CAPACITY`) ; une Légère
n'est jamais retirée (`WOUND-LEGERE-NEVER-HEALS`) ; les échéances d'infection créées par un Échec/Catastrophe n'ont pas d'entrée d'annulation d'avance
(`ECHEANCE-SPAWN-UNDO`) ; une blessure Moyenne+ sur un personnage du Coffre (sans campagne) est refusée, pas d'horloge où programmer sa guérison
(`WOUND-VAULT-NO-CAMPAIGN`) ; toute blessure de PNJ programme une échéance (`WOUND-PNJ-ECHEANCES-FLOOD`) ; une échéance annulée par un handler reste affichée dans un
écran de revue déjà ouvert jusqu'au rechargement (un clic dessus reçoit un refus 409, sans effet).

**`wound_infection_check`** — garde un vrai jet (auto `resolvePolarisTest` ou joueur via l'événement
`WOUND_INFECTION_ROLL`, `server/src/socket/socketDice.js`), rythme fixe 2 jours. Seuil calculé par
`computeWoundInfectionThreshold` = NA(Constitution) + `WOUND_INFECTION[severity].baseModifier`, puis
**seulement si activé pour cette gravité** (corrigé 2026-08-26 — la formule n'est pas uniforme, `if
(rule.caseMalus)`/`if (rule.periodMalus)` dans `woundEvolutionService.js:158-168`) : malus de cases
(-2/case au-delà de la première sur la même ligne localisation/gravité) et/ou malus de périodes sans
soin (-2/période déjà écoulée) :

| Gravité | Modificateur | Malus de cases | Malus de périodes | S'infecte même en réussite |
|---|---|---|---|---|
| Moyenne | +5 | Non | Non | Non |
| Grave | +0 | Oui | Oui | Non |
| Critique | -5 | Oui | Oui | Oui |
| Mortelle **et Membre détruit** (`mort_subite`, même objet `MORTAL_INFECTION_RULE`) | -10 | Oui | Non | Oui |

Colonne **`extraCase`** (`WOUND_INFECTION`) : l'infection coche une case de plus sur la ligne pour Moyenne/Grave/Critique (RAW explicite),
**jamais** pour Mortelle/Membre détruit — le RAW y donne un délai de survie, pas une case ; en cocher une ferait déborder vers la 6ᵉ ligne
(mort ou membre détruit par simple infection). Colonne **`survivalHours`** : la conséquence est un délai de survie.

Mortelle ou Membre détruit non soigné : délai de survie (Constitution ou Constitution/2 **heures** — le RAW dit « minutes » p.237 et « heures »
p.240, le code garde « heures », ticket) calculé et affiché au MJ, jamais appliqué automatiquement — la mort reste narrative, à la charge du MJ (elle
peut être matérialisée par le statut `dead`, ci-dessous). Une Mort (Tête/Corps) n'a ni guérison ni infection.

## Mort et cadavre (statut de token)

La mort est un **statut de token** `dead` (`shared/tokenStatusRegistry.js`), pas une gravité — mais la blessure « Mort » (6ᵉ ligne en
Tête/Corps, `isFatalWound`) le **pose**, et le retrait de cette blessure le retire. **Règle : le cadavre reste là et prend des blessures**
(des technologies de résurrection existent) : `applyWound` continue de s'appliquer, mais un cadavre ne dépense pas de Chance (aucune
fenêtre de réduction de gravité), ne fait pas de test de Choc et ne reçoit pas d'état de corps vivant. Détail et sites de code :
`SYSTEME/STATUTS_TOKEN.md` §6. Le statut est par token, les blessures par fiche : la mort se lit au niveau du personnage
(`deathStateService.js:isCharacterDead`).

**Pose et retrait par la blessure** (`statusService.js:reconcileWoundDeath`, modèle `determineDefeatedStatus`/`applyDefeatedStatus` du
système Shadowrun 5 de FoundryVTT — décision pure, application après les dégâts) :

- `applyWound` l'appelle **dans la transaction de la blessure** (la conséquence persistante est écrite avec sa cause) **uniquement si la
  blessure posée est une Mort** ; `removeWound` de même à la suppression d'une Mort. **Elle ne tue pas tant qu'une réaction de Chance est
  ouverte sur la Mort** (invariant : `dead` ⇔ une blessure mortelle SANS réaction ouverte, §« Réaction de Chance »). Déclencheur étroit voulu : le MJ qui relève un
  personnage à la main (retire `dead`, garde la blessure) ne le voit pas re-tué par une Légère ultérieure. Le calcul, lui, est
  idempotent (l'état voulu se déduit des blessures présentes) : tant qu'une autre Mort subsiste (Tête **et** Corps), `dead` reste.
- **Provenance** : la ligne posée par une blessure porte `data.source = 'wound'` (`STATUS_SOURCE_WOUND`). Pose = « insérer si absent »
  (`onConflict … ignore`), **jamais** `merge` comme `applyModStatus` (qui écraserait la `data` d'un `dead` posé à la main : la blessure le
  « reprendrait », puis l'effacerait) ; retrait = seulement les lignes marquées. Un `dead` du MJ n'est donc **jamais** écrasé ni retiré par
  une blessure.
- Après la validation, `announceWoundDeath` diffuse les badges puis, **seulement si une ligne a été réellement insérée** (`becameDead` :
  PostgreSQL ne renvoie rien pour une ligne déjà présente), appelle `applyDeathConsequences` (mode `enforced`). Knex n'a pas de crochet
  « après commit » : on agit une fois `await db.transaction(...)` rendu, comme le reste d'`applyWound`.
- **`/heal` soigne tout** (décision de Saar, 2026-09-25 : « plus simple, plus compréhensible ») : blessures ET tous les statuts, y compris un
  `dead` posé à la main.
- **Limite connue** : un personnage sans token (jamais posé sur une carte) n'est pas « mort » mécaniquement, la mort se lit sur les tokens ; un
  token créé après la mort n'a pas `dead` (ticket).

**Réaction de Chance** (Lot 3, `woundService.js:openWoundReaction`, `finishWoundSeverityChoice` ; UI : `SYSTEME/COMBAT.md` §« Réaction de blessure », `WoundReactionDock.jsx`) — la « correction a posteriori » RAW (REGLE_CHANCE.md:112-131) :

- **Quand** : `applyWound` ouvre une réaction pour une blessure Grave, Critique, Mortelle ou 6ᵉ ligne (jamais Légère/Moyenne), si le
  destinataire existe (PJ ou PNJ, pilote pour une exo, jamais un drone ni un cadavre) ET si au moins une réduction est **payable**
  (RAW : il doit rester **3** points de Chance — `shared/chanceRules.js:canSpendChance`, donc 6 minimum pour un rachat à 3). Aucune carte
  inutile, pour aucune gravité. La ligne `pending_chance_choices` est écrite **dans la transaction de la blessure** (en
  **sous-transaction** : une panne de cette fonction annexe ne fait jamais échouer la blessure), publiée après la validation.
- **Coût** (`shared/woundConstants.js:chanceCostOfStep`) : 1 point par cran (2 crans maximum) ; **3 points** pour ramener la 6ᵉ ligne à une
  **Critique** (un seul cran proposé) ; si la Critique est pleine, l'exception RAW « palier plein » ajoute 1 point par cran (Grave pour 4).
  `computeAvailableSeverityReductions` retourne `{ degree, cost, targetSeverity }` ; le rachat réutilise `resolveWoundImprovement` (un seul appel,
  `steps = degree` ; la blessure obtenue a son échéance de guérison).
- **Rachetable** : la 6ᵉ ligne écrite **directement par un coup ≥ 30** (Mort *et* Membre détruit). **Jamais** celle qui vient d'un
  **débordement** (2ᵉ Mortelle sur la Tête, cascade) : posée tout de suite, ligne de chat dédiée (décision de Saar, écart RAW — les lignes
  fusionnées par la promotion sont déjà supprimées, il n'y aurait rien à restaurer).
- **Invariant de mort** (`reconcileWoundDeath`, seule fonction qui pose `dead`) : `dead` ⇔ une blessure mortelle sans réaction ouverte.
  Décision de Saar : « la mort n'est posée qu'à partir du moment où le choix est fait ». Une ligne de réaction périmée (blessure
  disparue) n'exclut rien : la requête ne regarde que les blessures existantes.
- **Fermeture** (`finishWoundSeverityChoice`, dans un `try/finally`) : dépense réussie, « Accepter » (`choice: null` posé par un utilisateur),
  délai écoulé (`choice: null`, personne), Chance devenue insuffisante, place disparue, blessure retirée, panne — **toute** issue sur une
  Mort appelle `settleFatalWound` (`reconcileWoundDeath` + `announceWoundDeath`). Dépense + réduction sont atomiques ; la blessure et la
  place du palier visé sont **revérifiées** à la réponse. Accepter **une** Mort tue tout de suite et **retire** la carte des autres
  réactions de blessure du personnage (`withdrawWoundReactions` : un cadavre n'a plus de Chance) ; en racheter une ne tue pas tant qu'une autre décide.
- **Chat** (`COMBAT_SYSTEM_NOTICE`, clés `combat:chance.notice.*`) : une ligne par branche — Chance dépensée (réduite / mort évitée / membre
  sauvé), « accepte sa blessure », « n'a pas répondu » (Mort seulement), « ne peut plus dépenser », « plus de place », « pas assez de
  Chance pour éviter la mort », « débordement : ne se rachète pas », et **une seule** ligne « meurt » (`announceWoundDeath`).
- **Limites (suites, `PLAN_CHANCE.md` §8)** : le PJ garde encore le minuteur de 45 s (lot 6a-3 : « le Tour attend sa décision ») ; un arrêt
  du serveur pendant l'attente perd le minuteur (lot 6a-2 : relance au démarrage) ; pas encore de garde de fin de Tour.

**Routes** (`campaigns.js`, toutes vérifient `game_echeances.campaign_id === :id`) :
`POST .../game-time/request-advance|confirm-advance|cancel-advance`,
`GET .../game-echeances/pending-review` (GM), `GET .../game-echeances/my-pending-rolls`,
`POST .../game-echeances/:id/healing-choice`, `POST .../game-echeances/:id/infection-mode`.

**Événements** (`shared/events.js`) : `CAMPAIGN_ADVANCE_PENDING`/`_RESOLVED`/`_CANCELLED`,
`GAME_ECHEANCE_RESOLVED`, `WOUND_INFECTION_ROLL` (client→serveur) ; `WOUND_UPDATED` réutilisé tel
quel (pas un nouvel événement) pour resynchroniser la fiche personnage après résolution.

**Pièges** :

| Code | Description |
|---|---|
| — | `character_wounds.occurred_at_game_minutes` ancré sur `campaigns.game_time_resolved_minutes`, jamais `game_time_minutes` (affiché) — sinon une blessure posée après un recul MJ de l'horloge peut déclencher son échéance dès la prochaine avance, sans qu'aucune minute ne se soit écoulée |
| — | Fusion de `payload` avant `resolveEcheanceNow` (`healing-choice`/`infection-mode`) : toujours une expression SQL atomique (`payload \|\| ?::jsonb`), jamais un lire-puis-écrire JS |
| — | `wound_infection_check` n'est jamais créée à la naissance de la blessure — uniquement en conséquence d'un Échec/Catastrophe du `wound_healing_check` |
| — | `WOUND_INFECTION[severity]` doit exister pour toute gravité qui a une échéance de guérison : sans l'entrée `mort_subite`, un échec de guérison d'un Membre détruit ferait planter le handler (`rule` indéfini). L'entrée d'infection et l'échéance de guérison d'une gravité arrivent dans le même commit |
| — | Ne jamais lire `WOUND_HEALING[severity]` directement : passer par `getWoundHealing(severity, location)` (Mort en Tête/Corps → `null`, Membre détruit → ligne `membreDetruit`) |
| — | Le statut `dead` d'une blessure ne s'écrit pas avec `applyModStatus` (écrit hors transaction et `merge` écrase la `data`) : `reconcileWoundDeath` |
| — | `isMortalWoundImmobilized` lit `wound.location` (nom réel de la colonne). Il lisait `wound_location` : la règle « jambe mortelle = déplacement impossible » ne se déclenchait jamais avant le 2026-09-25 |
| — | Le tri SQL des gravités se génère (`woundSeverityRankSql(colonne)`) ; ne jamais recopier un `CASE` littéral des gravités |

## Pièges inventaire

| Code | Description |
|---|---|
| PI1 | Container 'Sac' : dispo seulement si ≥1 item `ref_location='D'` — `isContainerAvailable()` avant POST/PUT |
| PI2 | Équipement `slot≠null` → container 'Sac' obligatoire — 400 si indispo, jamais Coffre silencieux |
| PI3 | Items équipés (`slot IS NOT NULL`) comptés dans poids — seul `container='Coffre'` exclut |
| PI4 | `calcEncumbrancePenalty` requiert FOR nette = `base_level + pc_modifier`, pas seulement `base_level` |
| PI5 | Items manuels (`equipment_id null`) → `ref_weight null` → exclus du calcul poids |
| PI8 | POST `/inventory` : LIKE query pour multi-slot — `WHERE slot = code` casse les multi-couches |
