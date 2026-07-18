# PLAN_COMBAT_ACTION_QUEUE.md — Prérequis chantier Tir Multi : file d'actions déclarées unifiée (CaC + Tir)

> Créé : 2026-07-18 (dev/Saar). Statut : **⚠️ EN PAUSE — absorbé par un chantier plus large,
> `docs/PLAN_COMBAT_TIMELINE.md`, décidé le 2026-07-18 (Option A).** En creusant ce plan (pourquoi/
> comment enchaîner les attaques d'une file), Saar a demandé si l'architecture supportait un
> dédoublement visuel du personnage dans la timeline à chaque action — la réponse (non, et le modèle
> `combat_roster` "un participant par token" ne le permet pas structurellement) a fait émerger un
> chantier bien plus large : une vraie timeline à phases (une carte = une action, entrelacée avec tous
> les combattants), qui rend d'ailleurs `docs/REGLES/REGLESYSCOMBAT.md` p.218 "Retarder son Action"
> (jamais implémenté) pertinent et implémentable pour la première fois. Le bug de collision de clé
> primaire sur `combat_pending` documenté ci-dessous (§0.1) **reste vrai et vérifié** — il sera corrigé
> comme sous-produit naturel de `PLAN_COMBAT_TIMELINE.md` (une vraie timeline élimine le besoin même de
> la recursion ad hoc qui cause le bug), pas séparément. Ne pas reprendre ce document isolément avant
> `PLAN_COMBAT_TIMELINE.md` — le §3 ci-dessous (conception "file plate") est probablement obsolète une
> fois la timeline à phases en place.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois le
> chantier clos, contenu durable transféré vers `docs/SYSTEME/COMBAT.md`.
> Précédent direct : `docs/PLAN_INVENTORY_SLOTS.md` (refonte du socle `char_inventory_slots` avant
> `docs/PLAN_BOUCLIER.md`) — même geste : un anti-pattern trouvé en préparant une fonctionnalité,
> refonte du socle avant de reprendre cette fonctionnalité plutôt qu'un correctif local.

---

## 0. Cadrage — ce qui est réellement vrai aujourd'hui

### 0.1 Bug réel `[VÉRIFIÉ]` — collision de clé primaire sur `combat_pending`

**Schéma actuel** (`server/src/db/migrations/80_combat_pending.js:2-15`) :
```js
table.primary(['campaign_id', 'token_id', 'type'])
// CHECK type IN ('melee_defense', 'damage', 'stun')
```
Une seule ligne possible par `(campagne, personnage, type)` — l'hypothèse de conception est qu'un
personnage n'a jamais plus d'une chose en attente d'un type donné.

**Flux CaC actuel** (`socketCombatResolution.js`, handler `COMBAT_MELEE_DEFENSE_CONFIRM`) :
1. Le défenseur PJ répond à un jet d'opposition (`melee_defense`, singulier, jamais concurrent — un
   seul jet de défense possible à la fois puisqu'il bloque déjà tout le reste, cf. §0.2).
2. Si l'attaque touche et que **l'attaquant est PJ** : `INSERT combat_pending(type:'damage',
   token_id: attackerTokenId, ...)` (lignes 656-679) — le joueur devra lancer lui-même ses dégâts.
3. **Immédiatement après**, sans attendre cette confirmation, le code enchaîne sur l'attaque suivante
   de la file déclarée (`pendingRemainingMelee`, lignes 733-747) — comportement **déjà conforme** à ce
   que Saar a validé en D4/D5 de `PLAN_TIRMULTI.md` ("on attend le jet d'attaque/défense, pas les
   dégâts").
4. **Si cette attaque suivante touche *elle aussi* un défenseur PJ** (2ᵉ ou 3ᵉ attaque de la même
   file), l'étape 2 se répète pour le **même** `attackerTokenId` — le second `INSERT` viole la
   contrainte de clé primaire (une ligne `damage` existe déjà pour ce personnage). L'exception est
   levée dans le `try` du handler `COMBAT_MELEE_DEFENSE_CONFIRM` (lignes 544-763) et absorbée par son
   `catch` générique (`console.error`, rien d'autre) — **la 2ᵉ/3ᵉ attaque n'est jamais résolue,
   silencieusement, sans erreur visible pour les joueurs.** La 1ʳᵉ attaque reste correcte et
   confirmable normalement (sa ligne `combat_pending` n'est pas touchée par l'échec de la 2ᵉ).

**Pourquoi c'est resté invisible jusqu'ici** : il faut deux défenseurs **PJ** touchés dans la **même**
attaque multiple CaC — combinaison rare en pratique (la majorité des combats visés en test sont
PJ-vs-PNJ, résolus entièrement côté serveur sans passer par ce chemin, cf. §0.2).

**Pourquoi ce n'est plus un cas rare pour le Tir Multi** `[VÉRIFIÉ]` (`resolveAssaultAction`,
`socketCombatHelpers.js:1564-1612`) : côté tir, **un tireur PJ passe systématiquement par ce même
mécanisme d'attente de dégâts, quel que soit le type de la cible** (PJ, PNJ ou drone) — contrairement
au CaC qui ne l'emprunte que si le *défenseur* est PJ. Un Tir Multi 2-3 coups où plusieurs touchent
percuterait cette collision de façon quasi systématique, pas dans un cas limite. **Bloquant réel pour
livrer Tir Multi**, pas une amélioration de confort.

### 0.2 `sub_phase` est une valeur unique par campagne — vérifié cohérent, pas un second bug

`combat_state.sub_phase` (`combatFSM.js`) est une seule valeur pour **toute la campagne**, pas par
personnage. `advanceSlot` (`socketCombatHelpers.js:194-210`) déplace `active_slot_idx` mais **ne touche
jamais `sub_phase`** — donc tant qu'un `AWAITING_DEFENSE`/`AWAITING_DAMAGE` est posé par un personnage,
`canTransition()` bloque `COMBAT_ACTION_CONFIRM` pour **tout le monde**, y compris pour le personnage
dont c'est déjà le tour actif. `[VÉRIFIÉ]` : cet invariant est en réalité respecté nulle part
ailleurs cassé — puisque personne d'autre ne peut déclarer/confirmer tant que `sub_phase` n'est pas
revenu à `SLOT_ACTIVE`, **un seul flux d'attente peut exister à la fois côté serveur**, quel que soit
le nombre de personnages dans le roster. Ce n'est donc pas un bug, c'est une contrainte de conception
implicite à **respecter explicitement** dans la nouvelle file (§3), pas à remplacer par un modèle
`sub_phase` par-personnage (hors scope, non justifié).

### 0.3 `combatFSM.js` lui-même — sain, ne change pas

Table de transitions compacte (8 états, `server/src/lib/combatFSM.js`), déjà générique : les
pseudo-événements `NEEDS_DEFENSE`/`NEEDS_DAMAGE` et les sub-phases `AWAITING_DEFENSE`/
`AWAITING_DAMAGE` ne distinguent déjà pas CaC vs Tir — `COMBAT_DAMAGE_CONFIRM` est un seul handler
partagé qui branche déjà en interne sur `pendingType === 'melee'` vs assault
(`socketCombatResolution.js:366`). Aucune modification de ce fichier n'est nécessaire pour ce plan.

### 0.4 Ce qui manque réellement

Un moteur unique "traiter l'action suivante de la file déclarée", que la file soit CaC, Tir, ou
(après `PLAN_TIRMULTI.md` D8) un mélange des deux. Aujourd'hui ce moteur n'existe qu'à moitié, ad hoc,
spécifique au CaC (`resolveMeleeAction` qui se rappelle lui-même + recursion dupliquée dans
`COMBAT_MELEE_DEFENSE_CONFIRM`) — construire le Tir Multi par-dessus aurait obligé à copier cette même
logique une seconde fois, avec sa propre variante, en plus d'hériter du bug de clé primaire ci-dessus.

---

## 1. Scope tranché

**Inclus** :
- Généraliser `combat_pending` pour supporter plusieurs entrées `type='damage'` simultanées pour un
  même personnage (file réelle, premier entré/premier sorti), sans toucher à `melee_defense`/`stun`
  (réellement singuliers, cf. §0.2).
- Extraire un moteur unique de traitement de file, utilisé identiquement par le CaC (adaptation de
  l'existant) et par le futur Tir Multi (`PLAN_TIRMULTI.md`), remplaçant toute recursion ad hoc
  spécifique à un type d'action.
- Corriger la formule de coût Initiative "Attaques multiples" (dette D3 de `PLAN_TIRMULTI.md`) pour
  qu'elle soit calculée une seule fois, correctement, sur le total réel de la file.

**Exclus** :
- Réécriture de `combatFSM.js` (sain, cf. §0.3).
- Passage de `sub_phase` à un modèle par-personnage (l'invariant "un seul flux en attente à la fois"
  tient déjà, cf. §0.2, aucune justification à le remplacer).
- Toute mécanique de jeu propre au Tir Multi (déclaration UI, malus au jet, etc.) — reste dans
  `docs/PLAN_TIRMULTI.md`, ce plan est un prérequis de plomberie pure, pas une deuxième fonctionnalité.

---

## 2. Terminologie

Aucun nouveau concept métier — plomberie interne serveur, rien à ajouter à `docs/VOCABULARY.md` pour
ce plan spécifiquement (les entrées "Attaques multiples" restent portées par `PLAN_TIRMULTI.md` §2,
qui reste le document de référence métier).

---

## 3. Conception proposée (à valider avant code)

- **`combat_pending`** : remplacer la clé primaire composite par un identifiant propre par ligne
  (migration, numéro pair à auditer au moment du code — `CLAUDE.md` §5). Retirer la contrainte
  d'unicité stricte pour `type='damage'` uniquement ; `melee_defense`/`stun` gardent une unicité par
  `(campaign_id, token_id, type)` (toujours singuliers, cf. §0.2). Index `(campaign_id, token_id,
  type, created_at)` pour les lectures FIFO.
- **`COMBAT_DAMAGE_CONFIRM`** : au lieu de `.first()` + `DELETE` par clé composite (qui supprimait
  potentiellement plusieurs lignes à la fois si plusieurs existaient), sélectionner la plus ancienne
  entrée (`ORDER BY created_at ASC LIMIT 1`) pour ce `(campaign_id, token_id)`, la traiter, la
  supprimer **par son identifiant propre**. S'il reste d'autres entrées après suppression, `sub_phase`
  reste `AWAITING_DAMAGE` (pas de retour à `SLOT_ACTIVE`) et un nouveau prompt est émis pour la
  suivante — le joueur voit ses dégâts en attente se vider un par un. `sub_phase` ne repasse à
  `SLOT_ACTIVE` que lorsque la file est réellement vide pour ce personnage.
- **Moteur de file unique** (nom/emplacement à trancher au moment du code — probablement
  `socketCombatHelpers.js` aux côtés de `resolveMeleeAction`/`resolveAssaultAction`, ou un nouveau
  module dédié si la taille le justifie — pas de nouveau service dupliqué, un seul point d'entrée) :
  prend une file hétérogène d'actions déclarées (melee et/ou assault mêlées, ordre de déclaration),
  un total-count pour le malus, dispatch chaque élément vers le bon resolver existant
  (`resolveMeleeAction`/`resolveAssaultAction`, eux-mêmes simplifiés — ils n'ont plus besoin de gérer
  leur propre recursion), et sait uniformément ::
  - continuer immédiatement si l'action ne nécessite aucune attente (défenseur PNJ/drone en CaC,
    n'importe quel tir non-PJ-attaquant) ;
  - suspendre réellement (bloquer la file) uniquement sur un jet de défense CaC en attente d'un PJ ;
  - ne **jamais** suspendre sur une confirmation de dégâts (cohérent avec D5 de `PLAN_TIRMULTI.md`).
- **Formule de malus/coût unique** : le malus au jet (`n===2 ? -5 : n>=3 ? -7 : 0`) est déjà correct,
  seul le point d'application change (calculé une fois sur le total réel de la file, CaC+Tir combinés
  une fois `PLAN_TIRMULTI.md` D8 codé). Le coût Initiative de déclaration (actuellement un forfait fixe
  -5 quel que soit 2 ou 3 attaques, cf. `PLAN_TIRMULTI.md` D3) est à corriger dans ce même moteur,
  formule proposée `-5 × (n-1)` (cumulatif, plus fidèle au décalage RAW p.218-219 -5/-10) — **point
  ouvert, cf. §4**, à valider avant de coder plutôt que trancher unilatéralement ici.

---

## 4. Points ouverts

- **Formule de coût Initiative** : `-5 × (n-1)` proposé ci-dessus (§3) — confirmer cette valeur ou en
  donner une autre. C'est directement la suite de la question D3 de `PLAN_TIRMULTI.md`.
- **Ordre de résolution des dégâts en file** : FIFO (le plus ancien tir/attaque d'abord) proposé —
  confirmer, ou préférer un autre ordre (ex. au choix du joueur, plus complexe côté UI, pas de raison
  RAW de le préférer identifiée pour l'instant).
- **Portée de la correction** : ce plan corrige le bug CaC existant *et* prépare le terrain pour le Tir
  Multi dans le même geste (déjà validé en pratique dans la discussion `PLAN_TIRMULTI.md` D3/D8) — noté
  ici pour clôture formelle du document, pas une vraie question ouverte.

---

## 5. Lots proposés

**Lot A — Fondations `combat_pending`.**
Migration (nouvelle PK par ligne, contrainte d'unicité ajustée), adaptation de tous les points
d'insertion/lecture/suppression existants (`COMBAT_MELEE_DEFENSE_CONFIRM`, `COMBAT_DAMAGE_CONFIRM`,
tout autre lecteur de `combat_pending` à auditer avant de coder).

**Lot B — Moteur de file unique.**
Extraction du moteur décrit en §3, migration du CaC existant dessus (remplace sa recursion actuelle),
formule de malus/coût unifiée. Non-régression CaC 4b à valider explicitement (scénario du bug §0.1
reproduit puis corrigé, en plus des scénarios déjà couverts session 74).

**Lot C — hors de ce plan.**
Brancher le Tir Multi sur ce moteur — reste entièrement dans `docs/PLAN_TIRMULTI.md` (Lots A/B de ce
document-là), une fois ce prérequis clos.

---

## 6. Hors scope (rappel)

Refonte de `combatFSM.js`, `sub_phase` par personnage, toute mécanique de jeu Tir Multi elle-même (voir
`docs/PLAN_TIRMULTI.md`). Si un chantier futur touche à la Rafale longue multi-cibles ou au dual-wield,
il s'appuiera sur ce même moteur de file sans qu'un nouveau plan de plomberie soit nécessaire.
