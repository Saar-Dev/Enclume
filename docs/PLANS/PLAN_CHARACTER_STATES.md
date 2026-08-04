# PLAN_CHARACTER_STATES.md — Autorité unique des états persistants de personnage (position, arme)

> Créé : 2026-07-26 (dev/Saar). Statut : **planification uniquement, aucun code écrit.**
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers un nouveau `docs/SYSTEME/ETATS_PERSONNAGE.md` (modèle :
> `docs/SYSTEME/BLESSURES.md`, même famille de sujet — condition persistante de personnage).
> Responsabilité unique de ce document : déplacer l'autorité de `state_position`/`state_weapon` hors de
> `combat_roster` (éphémère) vers une entité durable, et corriger le reset erroné de `state_position` en
> fin de tour. Prérequis pour `docs/PLAN_RW_TOKEN` (Phase 7), qui consommera cette autorité pour piloter
> les postures animées — mais ce plan ne traite aucune animation.

---

## 0. Cadrage — ce qui est vrai aujourd'hui

### 0.1 Le problème structurel `[VÉRIFIÉ]`

`combat_roster` est **entièrement éphémère** : ligne insérée à `COMBAT_START` (`socketCombatState.js:129`),
supprimée à `COMBAT_END` (`socketCombatState.js:235`) ou au retrait d'un token
(`socketCombatHelpers.js:2906`). `state_position`/`state_weapon` (migration `56_combat_v2.js`) vivent
uniquement dans cette table : ils cessent d'exister dès la fin du combat, alors qu'un personnage garde
une posture et un état d'arme en dehors de tout combat (exploration, RP).

### 0.2 Le bug déjà identifié dans cette session `[VÉRIFIÉ]`

`endTurn()` (`socketCombatHelpers.js:1035-1053`) réinitialise `state_position` à `'standing'` à **chaque
fin de tour**, dans le même `UPDATE` bulk que `initiative: base_ini` (celui-là justifié, INI4,
REGLESYSCOMBAT p.213 — évite l'accumulation des mods d'Initiative). Rien ne justifie `state_position`
au même endroit :

- `REGLESYSCOMBAT.md:926-939` (« POSITION DU PERSONNAGE ») : changer de position a un coût d'Initiative
  dédié (« S'accroupir/Se redresser » Init -3, « Se jeter à terre, plonger » Init -5). Payer ce coût
  n'a de sens que si la position obtenue persiste — aucun texte ne prévoit de reset automatique.
- `socketCombatAnnouncement.js:601` (déclaration de tour) fait déjà `state.position ?? entry.state_position`
  — un vrai souci de préserver la position si le joueur n'en déclare pas de nouvelle — immédiatement
  annulé par le reset inconditionnel d'`endTurn()` juste après la résolution du tour.
- **`state_weapon` n'est pas concerné** : `endTurn()` ne le réinitialise pas, conformément à
  `COMBAT.md:204` (« `state_weapon` [...] survivent entre les tours »). Seul `state_position` est fautif.
- Bonus trouvé en vérifiant le texte : le livre cite 4 positions (« debout, accroupi, **à genou**,
  allongé… ») ; le code n'en connaît que 3 (`chk_state_position` : `standing/crouching/prone`). « À
  genou » manque — corrigé dans ce chantier (Saar, session courante).

### 0.3 Le précédent déjà en place dans ce projet — même principe, pas un nouveau paradigme `[VÉRIFIÉ]`

`character_wounds` (migration `49_character_wounds.js`) est l'exemple exact de ce que ce plan reproduit :
clé sur `char_sheet_id` (entité durable, pas `combat_roster`), lu/écrit **directement** par le code de
combat (`woundUtils.js`, `socketCombatHelpers.js:1188/1295/1517/2499`) — jamais mirroré dans
`combat_roster`, qui n'a même pas de colonne wounds. Ce plan étend ce principe déjà appliqué, à
`state_position`/`state_weapon`.

### 0.3bis Correctif suite à relecture à charge (Saar, session courante) — l'ancre `characters.id` était fausse

> La version précédente de ce document choisissait `characters.id` comme ancre, par analogie directe
> avec `character_wounds` (§0.3). Analyse à charge : **cette analogie ne tient pas**, `character_wounds`
> et `state_position`/`state_weapon` n'ont pas la même cardinalité vis-à-vis de `character_id`.

`server/src/routes/tokens.js:14-59` : la contrainte « un seul token par `character_id` sur une
battlemap » (ligne 55-59, erreur 409) ne s'applique **qu'aux joueurs** (`if (!isGm)`, ligne 46). Le
commentaire ligne 14 le dit explicitement : *« GM : toujours autorisé, peut créer autant de tokens qu'il
veut »* — sans aucune limite sur le partage de `character_id`. C'est l'usage GM standard d'un VTT : un
seul stat-block « Gobelin » (`characters.id = X`), cinq tokens posés sur la carte, tous avec
`character_id = X`.

Avec une table clée `unique(character_id, axis)`, les cinq gobelins partageraient une seule ligne
d'état : faire s'accroupir le gobelin n°3 les ferait tous apparaître accroupis. C'est exactement le bug
que ce chantier corrige (`combat_roster` par `token_id`, un état par participant) — réintroduit par la
mauvaise clé.

**Ancre corrigée : `token_id`** (FK → `tokens.id ON DELETE CASCADE`), pas `character_id`. `tokens` n'est
pas supprimé à `COMBAT_END` (seul `combat_roster` l'est, `socketCombatState.js:235`) — `token_id` résout
le problème initial (survivre à la fin du combat) sans réintroduire le partage d'état entre tokens
clonés. C'est aussi la clé que `combat_roster` utilise déjà lui-même (`54_combat.js:24`) — cohérent avec
l'existant, pas un nouveau choix arbitraire. Bonus : un token de PNJ supprimé après l'encounter emporte
son état avec lui (`ON DELETE CASCADE`), sans ligne orpheline à nettoyer.

La table reste conceptuellement « état de personnage » (nom inchangé, §2) — seule la clé technique
change, exactement comme `combat_roster` reste conceptuellement un état de combat de personnage tout en
étant indexé par `token_id`.

### 0.3ter Limite non traitée, trouvée en creusant la même question — `character_wounds` pourrait porter le même défaut

`[HYPOTHÈSE non instrumentée]` : `char_sheet` est résolu par `character_id`
(`socketCombatState.js:69` : `db('char_sheet').where({ character_id: token.character_id })`). Si un GM
clone un token PNJ comme au §0.3bis, les deux tokens partageraient le même `char_sheet_id`, donc les
mêmes `character_wounds`. Non vérifié si ce cas se produit en pratique (peut-être que chaque monstre
reçoit conventionnellement son propre `character_id`, même si le code ne l'impose pas). **Hors périmètre
de ce plan** — noté pour un audit séparé de `character_wounds`, pas traité ni corrigé ici.

### 0.4 Inventaire complet des consommateurs actuels `[VÉRIFIÉ]` (grep exhaustif, hors `docs/`)

| Fichier | Lignes | Rôle |
|---|---|---|
| `server/src/socket/socketCombatHelpers.js` | 1046 | **Bug** — reset `state_position` en fin de tour |
| `server/src/socket/socketCombatState.js` | 117 | Seed initial PNJ à `COMBAT_START` (`state_weapon: 'drawn'`) |
| `server/src/socket/socketCombatState.js` | 315-316 | Handler `COMBAT_INIT_STATE` — écrit position/arme déclarées |
| `server/src/socket/socketCombatAnnouncement.js` | 601-602 | Déclaration de tour — merge position/arme si changées (coût Init) |
| `shared/combatExclusiveActions.js` | 98, 101-102 | Règle pure — détecte un changement de posture/arme non confirmé |
| `client/src/components/CombatGmDeclareWindow.jsx` | 156-157 | Lecture (défaut affiché) |
| `client/src/components/CombatActionWindow.jsx` | 166-167 | Lecture (défaut affiché) |
| `client/src/components/CombatInitStateWindow.jsx` | 41-42 | Lecture (état initial du formulaire) |
| `client/src/components/CombatRosterWindow.jsx` | 129-130, 329-331 | Lecture + **écriture** (GM édite un PNJ via `StateChip`, réémet `COMBAT_INIT_STATE`) |

Tous les consommateurs client lisent depuis le `roster` reçu via `COMBAT_ROSTER_UPDATED`
(`socketCombatState.js:321-323`) — aucun n'accède à `combat_roster` directement. C'est le point d'appui
de l'invariant §4 : si le serveur continue d'exposer `state_position`/`state_weapon` avec les mêmes noms
dans ce payload (recalculés depuis la nouvelle autorité), **aucun fichier client n'a besoin de changer**.

`state_fire_mode`, `state_cover`, `state_vitesse`, `state_combat_mode` : colonnes voisines, non
concernées par ce plan (voir §5).

### 0.4bis Correctif d'inventaire (session courante, vérification avant Lot 0) — le broadcast n'a pas un seul point de construction

> L'inventaire ci-dessus, en listant `COMBAT_ROSTER_UPDATED (socketCombatState.js:321-323)` comme
> l'unique point de construction du payload lu par le client, était incomplet. Vérifié par grep
> exhaustif du pattern de sanitization avant d'écrire la migration Lot 0.

Le pattern `roster.map(({ surprise_roll: _sr, ...rest }) => rest)` (spread brut de la ligne
`combat_roster`, retrait de `surprise_roll` uniquement) est dupliqué **5 fois** dans 2 fichiers, sur
3 événements WS distincts :

| Fichier | Ligne | Événement |
|---|---|---|
| `socketCombatState.js` | 146 | `COMBAT_STARTED` |
| `socketCombatState.js` | 324 | `COMBAT_ROSTER_UPDATED` (init state) |
| `socketCombatState.js` | 412 | `COMBAT_ROSTER_UPDATED` (surprise result) |
| `socketCombatHelpers.js` | 205 | `COMBAT_PHASE_CHANGED` (résolution) |
| `socketCombatHelpers.js` | 1139 | `COMBAT_PHASE_CHANGED` (nouveau tour) |

Sans correction, un Lot 2 qui ne patche que le site cité dans l'inventaire d'origine ferait disparaître
`state_position`/`state_weapon` du broadcast juste après `COMBAT_START` et après chaque changement de
phase (colonnes retirées de `combat_roster`, donc absentes du spread `...rest` aux 4 autres sites) —
régression visuelle silencieuse à l'écran GM/joueur, non couverte par l'invariant §4 tel qu'écrit.
Conséquence actée en §3 (Lot 2 restructuré en sous-étapes) — pas une nouvelle divergence de règle de
jeu, une correction de la carte du terrain avant d'y toucher.

### 0.5 Hors périmètre confirmé pendant la conception (Saar, session courante)

- **`state_vitesse` (`rushed`/`delayed`/`normal`)** : mécanisme Précipiter/Retarder son Action, sans
  animation associée — à ne pas toucher, aucun rapport avec la posture.
- **Allure de déplacement (lente/moyenne/rapide/maximale)** : déjà calculée dynamiquement par
  `shared/polarisUtils.js:191-202` (`calcAllures`) et `shared/combatMovement.js:18`
  (`selectCombatMovementForCost`) à partir de la distance réellement parcourue — une valeur **dérivée**,
  jamais un état à persister. Pilotera l'animation marche/course plus tard (`PLAN_RW_TOKEN`), en lisant
  ce calcul existant, pas une nouvelle colonne.
- **Animations ponctuelles (tirer, encaisser un coup)** : pas des états — des déclenchements uniques
  greffés sur la résolution d'une action déjà émise (`DICE_RESULT` / résultats de combat), `play_mode:
  'once'` déjà anticipé par `PLAN_RW_TOKEN`. Aucune ligne dans `character_states`.
- **Assis / dormir / nager** : de vrais états candidats (persistent jusqu'à changement), mais non
  nécessaires aujourd'hui. Le catalogue en base (§2) absorbe une nouvelle valeur sans migration —
  documentés comme extension future (§6), non codés dans ce chantier.

---

## 1. Recherche — sources externes et internes

- **Foundry VTT** — `Actor` (persistant) vs `Combatant` (éphémère, un par rencontre, référence
  l'`Actor`). Les conditions/status effects sont stockées sur l'`Actor`, précisément pour survivre
  indépendamment du statut de combat.
  Sources : [Active Effects | Foundry VTT](https://foundryvtt.com/article/active-effects/),
  [Tokens and Actors — DeepWiki](https://deepwiki.com/foundryvtt/foundryvtt/3.2-tokens-and-actors)
- **OpenXcom** — `Soldier` (persistant, campagne) vs `BattleUnit` (éphémère, une mission, **initialisé
  depuis** `Soldier`). Les stats permanentes restent sur `Soldier` ; l'état tactique temporaire vit sur
  `BattleUnit`.
  Sources : [BattleUnit.h](https://github.com/OpenXcom/OpenXcom/blob/master/src/Savegame/BattleUnit.h),
  [DeepWiki OpenXcom](https://deepwiki.com/OpenXcom/OpenXcom)
- **Convention interne `ref_*`** (`ref_advantages`, `ref_careers`, `ref_backgrounds`, `ref_mutations` —
  migrations 92/93/95/98) : catalogues extensibles en base plutôt que `CHECK` figés, déjà le pattern du
  projet pour « cette liste de valeurs va continuer à grandir ». Réutilisé ici pour le catalogue des
  valeurs d'état (§2), pas un nouveau paradigme.

Trois précédents indépendants (deux externes, un interne) convergent sur le même principe : l'entité
éphémère ne devient jamais l'autorité d'une donnée qui doit survivre à sa propre suppression.

---

## 2. Architecture retenue

### 2.1 Schéma

```sql
-- Catalogue extensible — ajouter une posture = une ligne, jamais une migration de schéma
ref_character_state_values (
  id          uuid primary key,
  axis        text not null,        -- 'position' | 'weapon' | (futur : 'activity'...)
  value_code  text not null,
  label       text not null,        -- FR — affichage GM (dette i18n existante, pas aggravée ici)
  unique (axis, value_code)
)

-- Autorité runtime — un seul état actif par axe et par token (§0.3bis : token_id, pas character_id —
-- un même character_id peut porter plusieurs tokens, chacun avec son propre état physique)
character_states (
  id            uuid primary key,
  token_id      uuid not null references tokens(id) on delete cascade,
  axis          text not null,
  value_code    text not null,
  updated_at    timestamptz not null default now(),
  unique (token_id, axis),
  foreign key (axis, value_code) references ref_character_state_values(axis, value_code)
)
```

Seed initial : `position` → `standing`/`crouching`/`kneeling`/`prone` (ajout de `kneeling` = « à genou »,
correctif §0.2) ; `weapon` → `holstered`/`ready`/`drawn`.

**Absence de ligne = valeur par défaut** (`standing`/`holstered`). Règle explicite pour éviter deux
représentations de « standing » (ligne présente avec `value_code='standing'` vs absence de ligne) :
`setCharacterState` **supprime** la ligne quand la valeur cible égale le défaut de l'axe, et fait un
upsert sinon. Une seule forme canonique de l'état par défaut. Pas de backfill des tokens existants.

### 2.2 Point de résolution unique — `server/src/lib/characterStateService.js`

Mirroring `damageService.js` (point de résolution unique déjà en place pour les dégâts) :

- `getCharacterStates(tokenId)` → `{ position, weapon }` (valeurs, avec défauts appliqués).
- `setCharacterState(tokenId, axis, valueCode, trx = db)` → upsert, ou `DELETE` si `valueCode` égale le
  défaut de l'axe (§2.1). Le paramètre `trx` optionnel (client de transaction Knex, `db` par défaut)
  permet au Lot 1 d'appeler cette fonction **dans la même transaction** que l'`UPDATE combat_roster`
  qu'elle double-écrit — sans ça, un échec partiel entre les deux écritures fausserait la vérification
  de parité en mode Scientist (§3, Lot 1) sans qu'on le détecte.

Aucun autre fichier ne touche `character_states` directement — même discipline que `character_wounds`
(un seul point d'écriture par domaine).

---

## 3. Lots — un seul problème par lot, validé avant le suivant

| Lot | Contenu | Risque | Statut |
|---|---|---|---|
| **Lot 0** | Migration `229_character_states.js` (numéro vérifié : dernière migration appliquée = 227, `knex migrate:list` sans pending, `CLAUDE.md` §5) : `ref_character_state_values` + `character_states` + seed (y compris `kneeling`), `characterStateService.js`. Aucune lecture/écriture existante modifiée — `combat_roster.state_position`/`state_weapon` restent l'autorité en prod. | Faible — ajout pur, rien de consommé encore | **Clos** (commit `96d04ef`) |
| **Lot 1 (shadow)** | Chaque écriture actuelle (`socketCombatState.js:117/315-316`, `socketCombatAnnouncement.js:601-602`) appelle aussi `setCharacterState(tokenId, ..., trx)` **dans la même transaction** que l'`UPDATE combat_roster` qu'elle double-écrit (§2.2). `endTurn()` pas encore touché. Comparaison des deux sources en jeu réel (log `[DBG-DECOUPLAGE]` sur écart, jamais bloquant), méthode Scientist — même dispositif que `PLAN_RW_SYSCOMBAT.md` Lot 1 (`characterStateShadowCheck.js`, temporaire, supprimé au Lot 2b). | Faible — double-écriture transactionnelle, aucune lecture basculée | **Clos** — session de combat réelle (Saar), plusieurs changements position/arme + fin de tour, aucun `[DBG-DECOUPLAGE]` |
| **Lot 2a (dédup broadcast)** | Helper unique `buildBroadcastRoster(rows)` (`server/src/lib/combatRosterBroadcast.js`), remplace les 5 occurrences du spread recensées en §0.4bis — seule la mise en forme est extraite, chaque site garde son propre `io.emit` (payloads hétérogènes : `phase`, `actions`... — même discipline que `PLAN_RW_SYSCOMBAT.md` §2.5.c, ne pas sur-extraire). Comportement identique bit-à-bit. Prérequis mécanique de Lot 2b : sans lui, le cutover ne peut être appliqué qu'à un site sur 5. | Faible — refactor sans changement de comportement | **Clos** — `combatRosterBroadcast.test.mjs` (3 tests) + 2 sessions de combat réelles (Saar) couvrant les 5 sites, dont un token surpris, aucun `[DBG-DECOUPLAGE]` |
| **Lot 2b (cutover + correctif du bug)** | Le helper Lot 2a construit `state_position`/`state_weapon` depuis `characterStateService.getCharacterStates(tokenId)` au lieu des colonnes `combat_roster`, aux 5 sites d'un coup. Retrait de la ligne `state_position: 'standing'` dans `endTurn()` (§0.2). Retrait des colonnes `state_position`/`state_weapon` + leurs `CHECK` de `combat_roster` une fois la lecture basculée et validée. | Moyen — touche la construction du broadcast lu par 4 fichiers client (§0.4) ; voir prérequis §3.1 | Non commencé |

Chaque lot = un commit isolé sur `dev/Saar`, testé et confirmé par Saar avant le lot suivant
(`CLAUDE.md` §5, §11). Le retrait des colonnes `combat_roster` n'intervient qu'**après** confirmation
que le Lot 2 fonctionne en jeu réel — pas dans le même commit que le basculement de lecture.

### 3.1 Prérequis avant de clore le Lot 2

- **Compatibilité fusion** `[INCONNU]` : `CLAUDE.md` §3/§5 exige qu'une migration reste rétrocompatible
  avec le code encore déployé pendant la fusion. Le dépôt `dev/monde` (Codex, `/home/codex/Enclume-integrated`)
  n'est pas accessible depuis ce worktree — vérifier avec Codex ou par lecture du dépôt distant si son
  code touche `combat_roster.state_position`/`state_weapon` avant de supprimer ces colonnes.
- **Validation d'équilibrage, pas seulement technique** : corriger le bug §0.2 change le comportement de
  jeu au-delà du correctif — un adversaire qui reste couché encaisse désormais les mods de position
  (CaC/Tir) tour après tour, effet cumulé jamais vécu ainsi à la table jusqu'ici (le bug le masquait).
  Demander à Saar une confirmation explicite que ce comportement cumulé est le comportement voulu, en
  jeu réel, avant de clore le Lot 2 — pas seulement « le code fonctionne ».

---

## 4. Invariant de ce chantier

- **Lot 0-1** : comportement identique bit-à-bit — `combat_roster.state_position`/`state_weapon`
  restent l'unique source lue par le jeu, `character_states` n'est qu'une copie miroir en construction.
- **Lot 2** : le payload `COMBAT_ROSTER_UPDATED` garde les clés `state_position`/`state_weapon` avec la
  même forme — **aucun des 4 fichiers client du §0.4 ne doit changer**. Seule la source serveur change.
- Un personnage qui s'accroupit reste accroupi tant qu'il ne change pas explicitement d'état (fin du
  bug §0.2) — comportement observable à valider en jeu réel avant clôture du Lot 2.
- Aucune règle de jeu autre que le correctif §0.2 ne change. Aucun nouvel événement WS (`COMBAT_INIT_STATE`
  et `COMBAT_ROSTER_UPDATED` réutilisés tels quels).

---

## 5. Hors périmètre de ce plan

- `state_vitesse`, `state_cover`, `state_combat_mode`, `state_fire_mode` — colonnes voisines de
  `combat_roster`, non auditées ici (§0.5). Un audit séparé dira si `state_cover`/`state_vitesse`
  méritent le même traitement — hypothèse non instrumentée, à ne pas présumer.
- Allure/animations de déplacement, animations ponctuelles (tirer, encaisser) — `PLAN_RW_TOKEN`, pas ce
  document (§0.5).
- Dette i18n de `ref_character_state_values.label` (labels FR en base) — même nature que la dette déjà
  documentée pour `combat.json`/`breakdown`, non créée ni corrigée ici.

## 6. Extension future documentée (non codée)

Axes candidats identifiés mais non nécessaires aujourd'hui : `activity` (assis/dormir/nager). Le
catalogue `ref_character_state_values` les absorbe sans migration de schéma le jour venu — seule une
décision de design (mutuellement exclusif avec `position` ou axe séparé) restera à trancher à ce
moment-là.

---

## 7. Validation attendue à la clôture de chaque lot

- **Testé (Lot 0)** : migration up/down, insertion/lecture via `characterStateService`, contrainte
  unique `(token_id, axis)` vérifiée (§0.3bis — ancre corrigée, pas `character_id`).
- **Testé (Lot 1)** : session de combat réelle (Saar) avec au moins un changement de position et un
  changement d'arme déclarés — aucun `[DBG-DECOUPLAGE]`.
- **Testé (Lot 2a)** : comportement du broadcast identique bit-à-bit après extraction du helper — même
  session de combat que Lot 1, aucun écart visuel sur les 5 événements recensés en §0.4bis.
- **Testé (Lot 2b)** : session de combat réelle couvrant plusieurs tours consécutifs avec un personnage
  resté accroupi/à genou sans re-déclaration — vérification visuelle des 4 fenêtres client (§0.4)
  inchangées à l'écran.
- **Testé (Lot 2b, équilibrage)** : confirmation explicite de Saar que l'effet cumulé des mods de position
  sur plusieurs tours (§3.1) est le comportement voulu — distinct de « le code ne plante pas ».
- **Non testé** : ce qui reste après le lot en cours — marquer `⚠️ clos partiel` tant que les 4 lots ne
  sont pas fermés.
- **Données** : migration Lot 0 (nouvelle table), pas de nouvelle donnée avant Lot 2b ; suppression de
  colonnes `combat_roster` en fin de Lot 2b seulement.
- **Retour arrière** : chaque lot est un commit isolé ; Lot 2b nécessite en plus le tag/backup avant
  suppression des colonnes `combat_roster` (`CLAUDE.md` §11 — risque de perte de données).

---

## 8. Fichiers concernés

| Fichier | Action | Lot |
|---|---|---|
| `server/src/db/migrations/229_character_states.js` | Créer (numéro vérifié, §3) | 0 |
| `server/src/lib/characterStateService.js` | Créer | 0 |
| `server/src/socket/socketCombatState.js:117,315-316` | Modifier (double-write puis lecture) | 1, 2b |
| `server/src/socket/socketCombatAnnouncement.js:601-602` | Modifier (double-write) | 1 |
| helper de broadcast (nouveau, emplacement à choisir au Lot 2a — candidat : `server/src/lib/combatRosterBroadcast.js`, un fichier = une responsabilité, §0.4bis) | Créer, puis appeler aux 5 sites recensés en §0.4bis | 2a |
| `server/src/socket/socketCombatHelpers.js:1074` | Modifier (retrait du reset fautif) | 2b |
| `server/src/db/migrations/56_combat_v2.js` équivalent — nouvelle migration `down` | Retrait colonnes `state_position`/`state_weapon` + `CHECK` de `combat_roster` | 2b |
| `docs/SYSTEME/COMBAT.md:198-208,761` | Mettre à jour (colonnes retirées, nouvelle autorité) | 2b (clôture) |
| `docs/SYSTEME/ETATS_PERSONNAGE.md` | Créer (contenu durable, en-tête du présent document) | Clôture |
| `docs/PLAN_CHARACTER_STATES.md` | Archiver dans `docs/Old/` | Clôture |

Aucun fichier client (§0.4) n'apparaît dans ce tableau — c'est l'invariant §4, à revérifier si le Lot 2b
s'écarte du plan.
