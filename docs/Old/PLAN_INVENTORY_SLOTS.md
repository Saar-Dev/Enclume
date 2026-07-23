# PLAN_INVENTORY_SLOTS.md — Refonte du modèle de slots d'équipement (`char_inventory.slot`)

> Créé : 2026-07-17 (dev/Saar). Statut : **✅ Chantier clos — Lots A, B, C codés et testés en base
> réelle. `char_inventory.slot` retiré, `char_inventory_slots` est l'autorité unique.**
> Prérequis bloquant pour `docs/PLAN_BOUCLIER.md` (Lot A) — exposé par le run à vide du chantier
> Bouclier, mais préexistant et indépendant de lui.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois
> le chantier clos, contenu durable transféré vers `docs/SYSTEME/COMBAT.md`/nouveau
> `docs/SYSTEME/INVENTAIRE.md` si pertinent.

---

## 0. Cadrage — diagnostic et exigences

**Exigences explicites Saar** : architecture robuste, pérenne, adaptative. Le temps et la charge de
travail ne sont pas des paramètres. Aucun bricolage toléré.

**Diagnostic `[VÉRIFIÉ]`** : `char_inventory.slot` stocke aujourd'hui une relation many-to-many
(« quels slots un objet occupe-t-il ») sous forme de chaîne délimitée par `/` (ex. `"BG/C"`), lue
tantôt par correspondance exacte (`where({slot: 'MG'})`, `whereIn('slot', [...])`), tantôt par
sous-chaîne (`LIKE '%/BG/%'`) selon l'endroit du code. C'est l'anti-pattern documenté sous le nom
« Jaywalking » (Bill Karwin, *SQL Antipatterns*) : une liste délimitée à la place d'une vraie table
d'intersection. Trouvé en simulant l'équipement d'un bouclier (`docs/PLAN_BOUCLIER.md` §7) : un objet
au `slot` composite échappe aux contrôles à correspondance exacte, permettant un double-équipement
non détecté (ex. arme + bouclier dans la même main).

**Solution retenue** : table d'intersection dédiée, remplaçant `char_inventory.slot`. C'est la seule
option qui déplace la garantie d'unicité vers une contrainte de base de données plutôt que vers du
code applicatif dispersé — cohérent avec les exigences ci-dessus.

**Nuance trouvée en concevant la contrainte** `[VÉRIFIÉ]` (`inventoryService.js:437-451`, règle
« 1+S+S ») : l'unicité n'est **pas** uniforme selon le type de slot :
- Slots main/contenant (`MG`, `MD`, `2M`, `Tr`, `D`, `Ce`) : un seul occupant, strictement — une vraie
  contrainte `UNIQUE` suffit intégralement.
- Slots armure (`T`, `C`, `BG`, `BD`, `JG`, `JD`) : jusqu'à 3 occupants simultanés autorisés par
  construction (1 couche principale non-`S` + jusqu'à 2 couches `S`) — une contrainte `UNIQUE` plate
  interdirait à tort l'empilement de protections déjà légitime aujourd'hui. Cette partie de la règle
  reste un comptage métier (nombre de lignes + catégorie), qui ne se réduit pas à une contrainte
  déclarative simple — elle continuera de vivre en code applicatif (ou un déclencheur dédié), mais en
  lisant une table propre au lieu de parser une chaîne.

**Un précédent déjà correct existe dans le code** `[VÉRIFIÉ]` (`modingService.js:107-119`,
`char_inventory_mods`) : les mods d'arme utilisent déjà une vraie contrainte `UNIQUE(weapon_inv_id,
mod_slot)` avec un `catch` sur le code d'erreur `23505` — exactement le pattern à reproduire ici. Ce
n'est pas un précédent à inventer, juste à généraliser au slot d'équipement principal.

---

## 1. Inventaire des consommateurs réels (`[VÉRIFIÉ]` par grep + lecture, faux positifs exclus)

**Serveur — consommateurs réels de `char_inventory.slot` :**
- `server/src/services/inventoryService.js` — cœur du système (validation, équipement, conflits,
  1+S+S, P58). Réécriture complète de la logique d'équipement/déséquipement/conflit.
- `server/src/lib/damageService.js` — `resolveTargetHit`, requête `armuresCible` (protection par
  localisation).
- `server/src/socket/socketCombatHelpers.js` — `resolveMeleeAction` (arme équipée MG/MD/2M/Tr, filtre
  `ref_category`), `deuxArmesSlots`.
- `server/src/socket/socketCombatAnnouncement.js:172,178` — vérifie qu'une arme est équipée
  (`['MG','MD','2M','Tr'].includes(weapon.slot)`) avant de permettre l'annonce d'action.
- `server/src/routes/battlemaps.js:198-242` — construit l'affichage combat (armes MG/MD, protections
  actives) pour tous les tokens du roster. **Bug confirmé au passage** (même famille que le run à vide
  Bouclier) : un objet à slot composite (ex. futur bouclier) ne matche ni `whereIn(['MG','MD','2M',
  'Tr'])` (ligne 200) ni n'est exclu par `whereNotIn(...)` (ligne 227) de la même façon selon l'angle
  — confirme que le problème n'est pas isolé au chantier Bouclier, il existe déjà en germe ici.
- 3 migrations historiques (`50_char_inventory.js`, `70_ammo_init_on_equip.js`,
  `131_split_equippable_stacks.js`) — création/évolution de la colonne, à ne pas modifier
  rétroactivement, juste informatives pour comprendre l'historique.

**Faux positifs exclus** `[VÉRIFIÉ]` — sujets différents, aucun rapport avec ce refactor :
- `server/src/lib/builtinModelCatalog.js`, `client/src/lib/modelMaterialSlots.js` — « slot » de
  matériau de modèle 3D (recolorisation), concept sans rapport.
- `server/src/services/modingService.js` — « slot » d'accessoire d'arme (`mod_slot`,
  `char_inventory_mods`), table et colonne déjà distinctes, déjà correctement normalisées (voir §0,
  précédent à réutiliser).

**Client — à confirmer précisément avant le Lot C ci-dessous** (grep large, lecture détaillée non
faite cette session) : `InventoryPanel.jsx`, `WeaponPanel.jsx`, `LocationPanel.jsx`,
`ContainerPanel.jsx`, `CombatGmDeclareWindow.jsx`, `CombatActionWindow.jsx`, `CombatRosterWindow.jsx`,
`MeleeCombatPanel.jsx`, `ExchangeWindow.jsx` — probablement tous de vrais consommateurs (affichage/
équipement), à vérifier un par un par simple lecture avant modification (`CLAUDE.md` §6.1), aucun
codé en supposant leur contenu.

---

## 2. Conception du nouveau modèle

**Nouvelle table `char_inventory_slots`** :
- `char_inventory_id` — FK vers `char_inventory.id`, `ON DELETE CASCADE` (retirer/supprimer un item
  libère tous ses slots automatiquement, aucune ligne orpheline possible).
- `character_id` — dénormalisé depuis `char_inventory.character_id`, nécessaire pour que la contrainte
  d'unicité porte sur « ce personnage », pas seulement « cet item » (deux items différents ne doivent
  jamais partager `MG` pour le même personnage).
- `slot_code` — un des `VALID_SLOTS` existants (`T,C,BG,BD,JG,JD,D,Ce,MG,MD,2M,Tr`).
- Clé primaire naturelle `(char_inventory_id, slot_code)` — un item ne peut pas occuper deux fois le
  même slot, aucun besoin de clé de substitution.
- Contrainte `UNIQUE(character_id, slot_code)` **partielle**, restreinte aux slots main/contenant
  (`MG,MD,2M,Tr,D,Ce`) — un vrai `UNIQUE INDEX ... WHERE slot_code IN (...)` Postgres. Pour les slots
  armure, pas de contrainte plate (layering légitime) — le comptage 1+S+S reste applicatif, mais lit
  désormais des lignes propres (`WHERE character_id = ? AND slot_code = ?`) au lieu de parser une
  chaîne.

**`char_inventory.slot` (colonne actuelle)** : supprimée en fin de refonte (Lot C), jamais maintenue en
double indéfiniment — une donnée, une autorité (`CLAUDE.md` §1.4). Le retrait n'intervient qu'après
migration complète de tous les lecteurs (§1), jamais avant.

---

## 3. Lots séquentiels (un seul codé à la fois, validé avant le suivant)

**Lot A — Fondation : nouvelle table, double-écriture, aucun lecteur basculé. ✅ CODÉ ET TESTÉ
(2026-07-17).**
- Migration `162_char_inventory_slots.js` (162 confirmé libre par audit fichiers + `knex_migrations` —
  dernier réel : 160) : `char_inventory_slots` (`char_inventory_id`/`character_id` en `uuid`, confirmé
  par lecture de `50_char_inventory.js` — pas des entiers), `CHECK slot_code IN (...)`, index `UNIQUE`
  partiel sur les slots main/contenant, index simple sur tous les slots (performance combat), backfill
  set-based (`unnest(string_to_array(...))`), vérification round-trip intégrée à la migration (abandon
  si incohérence plutôt qu'un commit silencieux).
- **2 bugs réels trouvés en testant en base réelle, pas seulement en relisant** : comparaison
  `text[]`/`character varying[]` invalide dans la vérification round-trip (corrigé par cast explicite
  `::text` sur chaque élément) ; `array_agg(DISTINCT ... ORDER BY ...)` exigeant que l'expression `ORDER
  BY` soit strictement identique à l'argument de l'agrégat (corrigé). Les deux ont été détectés par
  échec réel de la migration (transaction automatiquement annulée par Knex à chaque échec, aucune
  donnée corrompue), pas par relecture — confirme la valeur du test en base réelle par rapport au
  seul `node --check`.
- **Correction apportée en cours de route** : le contrôle P58 supposé « manquant » dans `addItem`
  (trouvé lors de l'analyse critique, §6 point implicite) s'est avéré **inapplicable, pas manquant** —
  `addItem` valide `VALID_SLOTS.includes(resolvedSlot)` en amont, qui ne contient que des codes simples ;
  un slot composite ne peut donc jamais atteindre cette fonction. Aucune correction nécessaire,
  affirmation initiale retirée.
- `inventoryService.js` : nouvelle fonction `_writeSlots` (supprime puis réinsère les lignes de l'item
  dans `char_inventory_slots`, jamais un diff) branchée dans les 3 points d'écriture réels de `.slot`
  (`quickEquip`, `addItem` — insert simple et insert multi P57 —, `updateItem`), chacun désormais
  enveloppé dans `db.transaction()` pour que l'ancienne colonne et la nouvelle table changent
  atomiquement ensemble. `removeItem` ne nécessite aucune modification — `ON DELETE CASCADE` nettoie
  automatiquement (vérifié en base réelle, transaction annulée).
- **Testé en base réelle (transactions annulées sauf la migration elle-même, appliquée pour de bon)** :
  migration appliquée avec succès (7 items à slot non nul avant migration = 7 items distincts dans la
  nouvelle table après, 10 lignes au total, échantillon de slots composites vérifié un par un — ex.
  `"C/BD/BG"` → `['BD','BG','C']`) ; contrainte `UNIQUE` partielle rejette un doublon de main
  (`23505`) ; `CHECK` rejette un code invalide (`23514`) ; empilement armure (2 items différents sur
  `C`) accepté comme attendu ; `ON DELETE CASCADE` vérifié (suppression d'un item vide bien ses lignes
  de slots). `node --check` 0 erreur sur les 2 fichiers touchés. ESLint non disponible dans ce
  worktree (aucun `eslint.config.js` trouvé, ni racine ni `server/`) — non exécuté, à signaler.
- **Non testé** : parcours HTTP/Socket.IO réel (route Express → `inventoryService` → réponse client) —
  seules les fonctions de service ont été exercées directement en base. Aucun lecteur (Lot B) n'est
  encore basculé sur la nouvelle table ; le comportement observable par un joueur reste strictement
  inchangé à ce stade (double-écriture invisible, ancienne colonne toujours seule autorité lue).

**Lot B — Bascule des lecteurs, un par un, vérifié après chaque fichier.**
- Chaque consommateur du §1 (serveur puis client) réécrit pour lire `char_inventory_slots` au lieu de
  `char_inventory.slot` — remplace les `whereIn`/`where({slot:...})`/`LIKE` par de vraies jointures/
  `WHERE slot_code = ?`, ensemblistes et fiables dans tous les cas, y compris les futurs objets à
  slots composites (bouclier compris).
- Le bug déjà repéré dans `battlemaps.js` (§1) se corrige naturellement à ce stade, sans lot séparé.
- Chaque fichier basculé est un changement isolé, testé avant de passer au suivant — pas un big-bang.

**`inventoryService.js` ✅ basculé et testé (2026-07-17)** — `_handSlotConflict`/`_armorSlotOccupants`
(nouvelles fonctions, lisent `char_inventory_slots`) remplacent les contrôles de conflit dans
`quickEquip`/`addItem`/`updateItem` (les 3 points d'écriture identifiés au Lot A). **Testé en base
réelle** (personnage jetable créé/détruit, aucun résidu — `char_inventory`/`char_inventory_slots`
vérifiés à 0 ligne après coup) : conflit de main simple (2ᵉ arme en `MG` rejetée) ; **correctif du bug
d'origine confirmé** — un objet à slot composite simulé (`"MD/BD/C"`, comme le fera un futur bouclier)
bloque désormais correctement une arme équipée ensuite dans `MD`, ce qui échouait silencieusement
avant ce lot (c'est le trou trouvé au run à vide du chantier Bouclier) ; empilement armure 1+S+S
(2 couches simples acceptées, 4ᵉ couche rejetée) ; exclusivité arme à 2 mains. `node --check` 0 erreur.
**Non testé** : parcours HTTP réel (route Express), ESLint (toujours indisponible, worktree sans
config).
**`socketCombatHelpers.js` ✅ basculé et testé (2026-07-17).** Fichier plus large que prévu au §1 —
4 consommateurs réels trouvés en le relisant en entier (pas seulement autour de `resolveMeleeAction`
comme prévu initialement) : `deuxArmesSlots`/`in_hand_slot` (attaquant CaC), `rosterTokens`/allonge max
multi-adversaires, `defContactWeapons` (arme de contact du défenseur, choix de compétence
d'opposition), `resolveReload` (détection auto MG/MD à recharger côté PNJ). 2 selects `char_inventory
.slot` non consommés (juste fetchés, jamais lus) supprimés au passage (`invCible`/`invTireur`, calcul
de poids uniquement). **Testé en base réelle** : comparaison directe ancien filtre exact vs nouvelle
requête `char_inventory_slots` sur les données réelles actuelles — résultats identiques (4/4 et 5/5
items, aucune régression). `node --check` 0 erreur.
**`socketCombatAnnouncement.js` ✅ basculé et testé.** Contrôle « l'arme doit être équipée » (PC22) —
lisait `char_inventory.slot` en égalité stricte sur un item déjà identifié par son id, remplacé par une
lecture `char_inventory_slots`. Testé sur données réelles (item équipé détecté vrai, item non équipé
détecté faux). `node --check` 0 erreur.

**`battlemaps.js` ✅ basculé et testé — bug confirmé et corrigé.** `weaponRows` (`whereIn` exact) et
`armorRows` (`whereNotIn` exact) remplacés par des lectures `char_inventory_slots`
(`whereExists` pour l'armure — un item garde au moins un slot armure). **Bug confirmé puis corrigé** :
un objet composite simulé (`"MG/BG/C"`, futur bouclier) apparaît désormais correctement à la fois
comme arme en main (`weaponMg`) **et** comme pièce d'armure — avant ce lot, il aurait été invisible
côté main (le `whereIn` exact ne matche jamais une chaîne composite). Testé en base réelle : requêtes
ancienne/nouvelle comparées sur données réelles actuelles (identiques, aucune régression) + scénario
composite sur personnage jetable (0 résidu après coup). `node --check` 0 erreur.

**`damageService.js` ✅ basculé et testé.** `resolveTargetHit` lisait déjà correctement via le filtre
substring PI8 (aucun bug ici, juste cohérence pour le retrait futur de la colonne) — remplacé par une
égalité exacte sur `slot_code`, plus simple, le post-filtre JS disparaît entièrement. Testé en base
réelle sur les 6 codes de localisation pour un personnage réel : résultats identiques ancien/nouveau
partout. `node --check` 0 erreur.

**Décision de séquencement (2026-07-17)** : bien que les 4 lecteurs bloquant explicitement
`docs/PLAN_BOUCLIER.md` §5 soient tous basculés, le chantier continue jusqu'à la clôture complète
(client + retrait de l'ancienne colonne) avant de reprendre le bouclier — exigence Saar : aucune
double autorité laissée en suspens, même temporairement.

**API (`getItemWithRef`/`getInventory`) ✅ basculée.** Ajout de `slots` (tableau, via
`array_agg(slot_code)`) en parallèle de `slot` (texte, conservé le temps de la bascule client).
Testé en base réelle : item simple et item composite existant, les deux champs cohérents entre eux.

**Client ✅ basculé et testé — 9 fichiers audités, 6 réellement concernés.** Lecture complète de
chacun avant modification (`CLAUDE.md` §6.1), pas de supposition sur le grep initial :
- **Réellement migrés** : `InventoryPanel.jsx`, `WeaponPanel.jsx`, `LocationPanel.jsx` (simplifie au
  passage — le parsing manuel `slot.split('/')` disparaît, remplacé par le tableau déjà éclaté),
  `ContainerPanel.jsx`, `CombatActionWindow.jsx`, `ExchangeWindow.jsx` — tous lisent
  `/char-sheet/:id/inventory`, désormais consommé via `.slots` (`.includes`/`.some`) au lieu de `.slot`
  (égalité stricte).
- **Faux positifs confirmés, aucun changement** : `CombatGmDeclareWindow.jsx`, `CombatRosterWindow.jsx`,
  `MeleeCombatPanel.jsx` — tous les trois affichent en réalité la donnée de
  `battlemaps.js` (`/equipment`, forme différente : une ligne par slot de main déjà singulière,
  jamais une chaîne délimitée) — remontés jusqu'à leur source avant de conclure, pas supposés.
- **Testé** : `npx eslint` sur les 6 fichiers réellement modifiés, comparé `git stash`/`git stash pop`
  — 0 nouvelle erreur (les erreurs présentes sont préexistantes, identiques avant/après).

**Lot C ✅ codé et testé — chantier clos (2026-07-17).** Migration `166_char_inventory_drop_slot.js` :
retrait de `char_inventory.slot` (`down()` reconstruit la colonne par `string_agg` depuis
`char_inventory_slots`, réversible). Code serveur : `addItem`/`updateItem`/`quickEquip` ne référencent
plus la colonne — le slot voulu est porté à part (variable locale / tableau `intendedSlots`) puis
appliqué via `_writeSlots` après l'insert/update ; la requête de stacking (`whereNull('slot')`) devient
`whereNotExists` sur `char_inventory_slots` ; le calcul des codes nouvellement ajoutés (`addedCodes`,
armure multi-slot) lit désormais `char_inventory_slots` au lieu de `existing.slot.split('/')`.
`getItemWithRef`/`getInventory` n'exposent plus que `slots` (tableau). Client :
`InventoryPanel.jsx` — dernière référence résiduelle à `updated.slot` retirée.
**Testé en base réelle après le retrait de la colonne** (personnage jetable, 0 résidu après coup) :
équiper en `MG`, conflit détecté, empilement armure (couches 1/2/3 acceptées, cohérent avec la règle
1+S+S), déplacement vers un slot composite (`BG/C`), déséquipement (`slots` redevient `null`),
`quickEquip` toujours valide. **Recherche exhaustive finale** (`grep` sur `server/src` et
`client/src`) : aucune référence de code restante à l'ancienne colonne — seules des mentions dans des
commentaires historiques et 3 faux positifs déjà confirmés (`CombatGmDeclareWindow.jsx`,
`CombatRosterWindow.jsx`, `MeleeCombatPanel.jsx`, tous alimentés par `battlemaps.js` qui n'a jamais
dépendu de cette colonne). `node --check` 0 erreur sur tous les fichiers serveur touchés.

**Non testé** : parcours HTTP/Socket.IO réel bout en bout (route Express → client rendu) — uniquement
les fonctions de service exercées directement. **Retour arrière** : `166` réversible tant que
`char_inventory_slots` existe (down() reconstruit la colonne) ; `162` réversible (drop table, aucune
perte tant que `166` n'a pas encore tourné).

---

## Clôture

**Chantier fermé.** Les 3 lots (fondation, bascule des lecteurs, retrait de l'ancienne colonne) sont
codés et testés en base réelle. `docs/PLAN_BOUCLIER.md` peut reprendre sur un modèle de slots à
autorité unique, sans double représentation à maintenir.

---

## 7. Run à vide post-implémentation (2026-07-17) — 4 fichiers manqués trouvés et corrigés

Après la clôture ci-dessus, relecture demandée par Saar avant de considérer le chantier réellement
fini. **Trouvaille méthodologique** : tout l'audit précédent cherchait `\.slot\b` (accès de propriété
JS sur un objet déjà récupéré) — angle mort total sur les références Knex, qui nomment une colonne par
une **chaîne de caractères** (`.whereNull('slot')`, `{ slot: null }`), un pattern différent qu'aucun
grep précédent ne couvrait. Recherche élargie (`['"]slot['"]|\bslot\s*:`) → 4 fichiers avec du code
réel encore cassé par le retrait de la colonne (confirmé, pas hypothétique — un de ces fichiers a
d'ailleurs été examiné et cité comme preuve à charge dans l'analyse critique du §6 point 1, sans que
la correction correspondante soit jamais appliquée) :

- **`server/src/services/modingService.js`** (`returnModToInventory`) — `.whereNull('slot')` /
  `slot: null` sur des accessoires jamais équipables → `whereNotExists` sur `char_inventory_slots` +
  retrait du champ à l'insert.
- **`server/src/services/tradeService.js`** — achat marchand (insert, `slot: null` retiré, rien à
  nettoyer, ligne neuve) et **`acceptTransfer`** (transfert PJ↔PJ, `slot: null` retiré + ajout d'un
  `DELETE char_inventory_slots` par item transféré, dans la même transaction).
- **`server/src/socket/socketTrade.js`** — transfert cargo drone → même correctif (update sans
  `slot`, delete `char_inventory_slots` par item, même transaction).
- **`server/src/routes/character/char-sheet.js`** (`POST /drone/cargo/:invId/drop`) — même correctif,
  update enveloppé dans une transaction (ne l'était pas avant) pour garantir l'atomicité avec le
  nettoyage des slots.

**Testé en base réelle** : `tradeService.acceptTransfer` exercé de bout en bout (2 personnages
jetables, un item équipé transféré de l'un à l'autre) — propriété transférée, container repassé à
`Coffre`, **`char_inventory_slots` correctement vidée pour l'item** (0 ligne résiduelle après
transfert, vérifié explicitement). `node --check` 0 erreur sur les 4 fichiers. Les 2 autres points de
transfert (`socketTrade.js`, `char-sheet.js`) suivent exactement le même correctif déjà prouvé mais
n'ont pas été exercés indépendamment (socket/route plus lourds à simuler isolément) — **non testé**,
à surveiller en priorité si un transfert cargo drone se comporte mal.

**Recherche finale exhaustive** (les deux patterns combinés, tout `server/src` et `client/src`) :
plus aucune référence de code à l'ancienne colonne, uniquement des commentaires explicatifs.

**Incident signalé pendant cette relecture** : écran blanc navigateur, erreur "module ContainerPanel
ne fournit pas d'export default". Vérifié par compilation réelle (`esbuild`) : le fichier est
syntaxiquement correct et exporte bien son `default` — écarté comme artefact de rechargement à chaud
Vite (plusieurs fichiers modifiés coup sur coup pendant que le serveur de dev tournait), pas une
régression de code. À confirmer par Saar après rechargement complet du navigateur.

**Lot C — Retrait de l'ancienne colonne.**
- Une fois tous les lecteurs confirmés sur la nouvelle table (Lot B entièrement clos, non partiel) :
  migration retirant `char_inventory.slot` et l'écriture double du Lot A.
- Clôture : recherche exhaustive (`grep`) confirmant qu'aucune référence résiduelle à l'ancienne
  colonne ne subsiste avant de la supprimer.

---

## 4. Ce que cette refonte ne change pas

Le vocabulaire des slots (`VALID_SLOTS`, codes `T/C/BG/BD/JG/JD/MG/MD/2M/Tr/D/Ce`), la règle 1+S+S, la
règle P58 (côté symétrique), et toutes les règles métier déjà tranchées restent identiques — seule la
représentation en base et les requêtes changent. Aucune régression de règle attendue, uniquement une
correction de fiabilité.

---

## 5. Lien avec `docs/PLAN_BOUCLIER.md`

Le Lot A de `PLAN_BOUCLIER.md` (équipement du bouclier, slot composite main+armure) est **bloqué**
jusqu'à la clôture du Lot B ci-dessus au minimum (les lecteurs concernés par le bouclier —
`inventoryService.js`, `damageService.js`, `socketCombatHelpers.js`, `battlemaps.js` — doivent déjà
lire la nouvelle table avant qu'un item à slot composite existe réellement en jeu). Le bouclier
devient alors un cas parmi d'autres pour un modèle déjà correct, plutôt qu'un cas spécial nécessitant
ses propres contrôles de conflit.

---

## 6. Analyse critique (2026-07-17, avant tout code)

Relecture du plan avec vérifications réelles plutôt que suppositions. 6 constats :

1. **Dénormalisation `character_id` — risque de désynchronisation à la cession de propriété, mais
   atténué par un invariant déjà réel.** `[VÉRIFIÉ]` (`server/src/services/tradeService.js:267-273`) :
   chaque transfert de propriété observé (vente joueur→MJ, vente joueur→joueur) déséquipe
   explicitement l'item dans la même opération (`slot: null`) avant de changer `character_id`. Un item
   équipé ne change donc jamais de personnage sans être déséquipé d'abord — `char_inventory_slots`
   n'aurait donc jamais de ligne à faire suivre lors d'un transfert, **à condition que la nouvelle
   table soit vidée dans cette même transaction**, pas seulement l'ancienne colonne. Nouvelle exigence
   précise pour le Lot B : auditer tout endroit qui réassigne `character_id` sur `char_inventory`
   (`tradeService.js` confirmé ; `server/src/services/echangeService.js` référencé dans le statut Git
   mais absent de ce worktree — probablement un chantier parallèle non encore mergé, à revérifier
   avant de clore ce lot, `[[project_parallel_sessions]]`) pour s'assurer que le nettoyage des slots
   suit dans les deux tables. `[VÉRIFIÉ]` également : `inventoryService.js` lui-même ne réassigne
   jamais `character_id` — le risque est entièrement circonscrit aux services de transfert, pas au
   cœur de l'inventaire.
2. **Forme de l'API client après la bascule — non tranchée.** Le plan disait « chaque consommateur
   réécrit pour lire `char_inventory_slots` » sans dire si le contrat JSON envoyé au client change.
   Reconstruire une chaîne délimitée (`string_agg(slot_code,'/')`) éviterait de toucher le client, mais
   ça ne ferait que déplacer l'anti-pattern à la frontière API au lieu de le supprimer — contraire à
   l'exigence « aucun bricolage ». Décision : exposer un vrai tableau (`slots: [...]`) côté API,
   quitte à ce que le Lot B côté client soit plus large que prévu (chaque consommateur du §1 doit
   être réécrit, pas seulement vérifié).
3. **Modèle mental équiper/déséquiper change de nature.** Passe d'un simple `UPDATE` d'une colonne
   texte à une séquence transactionnelle `INSERT` (équiper) / `DELETE` (déséquiper) de plusieurs
   lignes. Cas à couvrir explicitement au Lot A : déséquiper sans supprimer l'item (aujourd'hui
   `slot: null` accepté sans passer par les contrôles de conflit, `inventoryService.js:376`) doit
   désormais aussi vider les lignes `char_inventory_slots` correspondantes, dans la même transaction.
4. **Index de performance manquant pour les lectures armure.** Seule une contrainte `UNIQUE` partielle
   (slots main/contenant) était prévue. Les lectures fréquentes en combat (`armuresCible`, appelée à
   chaque coup résolu) portent sur les slots armure, non couverts par cette contrainte — un index
   simple (non unique) `(character_id, slot_code)` couvrant toutes les lignes est nécessaire pour ne
   pas régresser en performance sur ce chemin chaud.
5. **Réversibilité de la migration du Lot C insuffisamment spécifiée.** Retirer `char_inventory.slot`
   est la moins réversible des 3 étapes. Le `down()` de cette migration doit reconstruire la colonne
   depuis `char_inventory_slots` (`string_agg` groupé par item, ordre stable) — cohérent avec la
   pratique déjà établie du projet pour ce genre de retrait de colonne.
6. **Vérification du backfill (Lot A) trop vague.** « Comptage avant/après, aucune perte » n'est pas
   un contrôle byte-exact. Contrôle requis : reconstruire la chaîne depuis les nouvelles lignes
   (`string_agg` triée de façon stable) et la comparer à l'ancienne colonne pour 100% des lignes, pas
   un simple comptage global.

**Conclusion** : le choix de la table d'intersection reste valide, mais le Lot A doit désormais
couvrir explicitement les points 3, 5, 6, et le Lot B doit couvrir les points 1, 2, 4 — le périmètre
du Lot B côté client est plus large que ce que la première rédaction laissait penser (réécriture, pas
simple vérification).
