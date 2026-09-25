# PLAN_PRISE_EN_MAIN — Permuter l'arme en combat (échange avec le Sac / la Ceinture)

> Créé 2026-09-24 ; v2 le 2026-09-24 (premier design rejeté par Saar) ; v3 le 2026-09-24 après l'analyse à charge de la v2 (§2bis) ;
> **v3.1 le 2026-09-25** après la seconde analyse à charge (§2ter) et les décisions de Saar. Plan **temporaire**
> (`RegleDocumentaire.md` Règle 10) : à la clôture, l'état stable passe dans `docs/SYSTEME/COMBAT.md` / `COMBAT_FLUX.md` /
> `CHARACTER.md`, les décisions dans `docs/JOURNAL8.md`, ce fichier est archivé dans `docs/Old/`.
>
> **Statut : CLOS le 2026-09-25 — validé par Saar en jeu, côté joueur ET côté MJ.** Toutes les étapes (Lot 0, A0 à A4, B1, B2a, B2b, C) sont
> faites et vérifiées. L'état stable est dans `docs/SYSTEME/COMBAT.md` (« Permuter l'arme en combat »), `COMBAT_FLUX.md`,
> `SERVICES_COMBAT.md` et `CHARACTER.md` ; les décisions dans `docs/JOURNAL8.md`. Plan conservé pour l'historique (analyses à charge §2bis /
> §2ter, découpage §6) : le §8 (« gardé / refait » du code v1) est périmé, le code v1 « Prendre en main » a été remplacé. Maquette :
> `docs/Old/maquette-permuter/index.html`.
>
> **Suite (v2) : `docs/PLANS/PLAN_OBJETS_AU_SOL.md`** — « à terre » réel (l'arme lâchée devient une entité 3D ramassable). Hors de
> ce plan : ici, une arme qui ne rentre pas fait **refuser** la permutation.

## 1. Origine et évolution du design

- **Besoin (Saar, liste de bugs du 2026-09-24).** La grenade en main est bien consommée au lancer, mais s'il en reste dans le Sac ou à
  la Ceinture, le personnage reste main vide et rien, en combat, ne permet de la remplacer.
  **Objectif confirmé par Saar (2026-09-25) :** après un lancer de grenade, le personnage doit forcément aller chercher une nouvelle
  arme (ou grenade) et **payer le coût en Initiative** — c'est voulu, pas un défaut à contourner.
- **v1 (rejetée).** Une section « Prendre en main » à part, qui ne remplissait qu'une main **libre**. Défauts : trop spécifique ;
  impossible de remplacer une arme déjà en main ; un deuxième concept dans une fenêtre où « la ligne d'arme EST l'action » (D5).
- **v2.** Un bouton ⇄ sur chaque ligne d'arme **et** sur « Mains nues » ; il ouvre la colonne de droite avec les armes rangées.
- **v3.** v2 + corrections de la 1ʳᵉ analyse à charge : échange **réellement atomique** (transaction, plus de restauration), une seule
  logique « quel emplacement pour quelle arme » (`shared/`), armes `2M/Tr` incluses, refus d'échange qui **annule explicitement**
  l'attaque dépendante, poids des grenades seedé (0,3 kg), bouton nommé **« Permuter »**. (Le bouclier « géré » de la v3 était un refus
  R15 : supprimé en v3.1.)
- **v3.1 (ce plan).** v3 + corrections de la 2ᵉ analyse (§2ter) : **tests de caractérisation avant la scission d'`updateItem`**,
  regroupement d'exemplaires **conditionné à l'état identique**, **plus de « à terre = Coffre »** (décision Saar : refus faute de place,
  le « à terre » réel est la v2), numéro de migration recalculé, une seule autorité de diffusion d'inventaire, erreur de concurrence
  traduite en refus propre.

## 2. Constat [VÉRIFIÉ dans le code et en base]

- `consumeThrownGrenade` (`socketCombatAoe.js`) supprime la ligne d'inventaire de la grenade lancée. Grenade = emplacement catalogue
  `M` : équipable donc **jamais empilable** (`inventoryRules.js`), une ligne `char_inventory` par grenade. Base locale au 2026-09-25 :
  5 grenades à fragmentation au Sac, 2 à la Ceinture (aucun exemplaire identique à état différent).
- **Aucune action de changement d'arme n'existe.** L'état `holstered / ready / drawn` (`combat_roster.state_weapon`, coûts dans
  `shared/combatIniCost.js`) est un état **du personnage**, pas de l'arme, et ne porte que sur l'arme déjà en main.
- Un Tour dont le seul contenu est une action simple (`move` / `reload` / `micro`) a son propre pas de résolution
  (`combatTurnEngine.js` `pickNextTimelineStep`, `kind: 'simple'`, position = Initiative × 100 après le delta de déclaration) ; avec
  une action complexe, les actions simples sont résolues **avant** l'entrée (`socketCombatResolution.js` l.354-372, tri par `sequence` :
  déplacement 1, `micro` 2, rechargement 3, tir / CaC 3).
- `inventoryService.updateItem(characterId, itemId, payload)` : valide mains et deux-mains, exige un Sac disponible (règle PI2),
  écrit `char_inventory_slots` en transaction, **force `container = 'Sac'`** quand on équipe (pas quand on déséquipe : le conteneur
  doit alors être passé explicitement). **≈ 20 lectures passent par `db`, hors transaction** (`_handSlotConflict`,
  `_armorSlotOccupants`, `isContainerAvailable`, lectures `ref_equipment`) ; **un seul appelant** hors tests (`PUT
  /char-sheet/:id/inventory/:itemId`, `char-sheet.js` l.1194) — plus `takeItemInHand` (v1).
- **Filet de test de `updateItem` [CORRIGÉ, 2ᵉ analyse].** `inventoryService.test.mjs` ne teste `updateItem` que pour les Sols
  (validation MJ), l'intégrité et la quantité. **Aucun test du chemin « équiper / déséquiper »** : mains, deux-mains, Sac requis,
  bouclier composite, armure 1+S+S, cascade Sac → Coffre, chargeur initial. C'est exactement ce que le Lot A0 touche.
- **Isolation.** `uq_inventory_slots_hand_container` (migration 114) : index unique `(character_id, slot_code)` sur `MG / MD / 2M /
  Tr / D / Ce` — deux objets ne peuvent pas partager un **même** slot de main ; rien n'empêche 2M + MG (contrôle applicatif seul).
  Une transaction donne l'atomicité, pas l'isolation : deux écritures concurrentes sur le même slot lèvent `23505`.
- Un objet équipé garde `container = 'Sac'` et un emplacement (`char_inventory_slots`) ; un objet **rangé** n'a aucun emplacement.
- **Diffusion d'inventaire.** La route choisit la salle par `resolveInventoryBroadcastRoom` (`wizard:<id>` tant que la fiche n'est pas
  verrouillée, sinon la campagne) puis `emitInventoryEvent`, tous deux **locaux à `char-sheet.js`**. Le code v1
  (`combatGrabService`, `consumeThrownGrenade`) émet `io.to(campaignId)` en direct : bénin en combat, mais une seconde autorité.
- **Capacité des conteneurs.** `ref_equipment.capacity` est en **kg** (Ceinture utilitaire 3, Sac urbain 8, Sac tactique 15, Sac de
  randonnée 30, Sac de portage lourd 50 ; `null` pour bouteille / caisson / extracteur d'oxygène en emplacement `D`). Elle n'est
  qu'**affichée** (`ContainerPanel.jsx:75`) : **aucun contrôle de capacité** n'existe. Base locale : aucun inventaire n'est en
  dépassement aujourd'hui.
- **Poids [CORRIGÉ].** Les **15** objets de catégorie `Grenade` (lus en base le 2026-09-25 ; le plan disait 14) ont `weight = NULL` (le Lance-grenades pèse 3 kg) ; 17 armes `M` sans poids
  au total. La colonne `weight` est un `real` en kg. **Décision Saar : 300 g (0,3 kg) par grenade** — Lot 0.
- **Emplacements catalogue des armes** : `M` 88, `2M` 60, `Tr` 12 (trépied pur), `2M/Tr` 11 (armes lourdes tenables à deux mains
  **ou** montées), `null` 25. `WeaponPanel.jsx#getSlotInfo` (client) sait déjà les lire (`2M/Tr` → défaut `2M`) ; **le code v1
  (`isGrabbableRef`, `pickFreeHandSlot`) écrivait une deuxième logique qui les excluait.**
- **Boucliers** (catalogue, lu en base le 2026-09-25) : 3 objets (Petit, Moyen, Grand), `location = 'M'`, `shield_extra_locations` =
  `null` / `C` / `C/T`, `malus_cat = 'S'`, **poids `NULL`** (comme les grenades : à compléter, ticket de données). `updateItem` reçoit
  la seule main (`MG` / `MD`) et compose la chaîne (main + bras + localisations d'armure). `REGLEBOUCLIER.md` ne définit aucun coût ni
  règle de prise en main : **rien ne distingue un bouclier d'une arme dans la main**.
- **Armes rangées tenables en base locale** : 7 grenades (sans poids), 2 armes de contact, 1 arme d'épaule (`2M`), 1 arme de poing ;
  aucune n'a de mod installé.
- **La fiche n'est pas verrouillée en combat** : aucune garde sur le `PUT` inventaire ; un joueur peut équiper gratuitement depuis sa
  fiche, en combat comme hors combat. **Décision Saar 2026-09-24 : pas de verrou** (R13).
- L'annonce exige l'arme **en main** au moment de la déclaration (`getOwnedHandWeapon`, `socketCombatAnnouncement.js` : Tir l.512,
  arme secondaire l.580, CaC principal l.886 et secondaire l.938) ; la **résolution** revérifie (`fetchAssaultWeaponAndMods`,
  `resolveReloadAction`, CaC) — et abandonne **sans message au chat** (`console.warn`) si l'arme n'est pas en main.
- **Munitions.** Le chargeur (`char_inventory.ammo_remaining`, entier) et le type chargé (`current_ammo`, uuid) sont **par exemplaire** et
  **survivent au déséquipement** (base locale : Breather au Sac 7 coups, Scorpion au Sac 14, Klauss au Coffre 1) : rien à ajouter pour
  « mémoriser » le chargeur d'une arme rangée. À la première mise en main d'une arme à calibre, `updateItem` initialise
  `ammo_remaining` au chargeur plein, **sans consommer de stock** (`resolveAmmoInit`, Session 81, 2026-06-04 : correctif voulu, sans lui
  le bouton de tir restait grisé) ; la fiche affiche alors « Non chargée » (le type n'est pas choisi). Avant, `ammo_remaining` est `null`,
  que `hasEnoughAmmo` lit comme « suivi désactivé » (l'annonce passe) mais que `weaponAmmoStatus` lit comme `'empty'`. Aucune arme locale
  n'a `ammo_remaining` null.
- Le client (fenêtre joueur) charge l'inventaire complet à chaque changement de phase (`CombatActionWindow.jsx:404-419`) et met son
  store à jour par `INVENTORY_ADDED / UPDATED / REMOVED` (`useCharacterSocket.js`). `assaultWeapons` est un `useState` recopié à la
  main d'une fonction pure de l'inventaire (`flattenItemsBySlot(items).filter(weaponHasRangedAttackPath)`), à côté de `allInventoryItems`.
  Un effet (`l.435-444`, dépendance `[assaultWeapons]`) recale le mode de tir sur l'arme principale.
- La fenêtre MJ dérive les armes du PNJ de la route `/combat-equipment` (armes en main seulement), pas de l'inventaire.
- « changement d'arme » désigne déjà, dans `getStateTransitionReasons`, le changement d'**état** Rangée / Au clair : d'où le nom
  « Permuter » (« Équiper » est déjà le mot de la fiche pour l'action libre).
- **RAW** (`REGLESYSCOMBAT.md`, relu le 2026-09-25) : « Sortir un objet d'un sac » = Action simple ; **« Saisir un objet : Initiative −3
  s'il est à portée de main, −5 à −10 s'il est à quelques pas de là »** (Préparations, l.441) ; « Dégainer » −5 ; « Préparer et lancer
  une grenade » = Action simple ; **« lâcher un objet ou une arme au sol » = Action gratuite** (l.333-334) ; ramasser un objet au sol
  « ne nécessite normalement aucun Test » (l.546-547). Le RAW **ne définit pas** Sac / Ceinture : la gradation Ceinture / Sac est une
  **décision de conception de Saar**.

## 2bis. Analyse à charge de la v2 — ce qui a changé en v3

| # | Le plan v2 disait | La réalité | Correction v3 |
|---|---|---|---|
| 1 | Deux écritures, restauration en cas d'échec (R11), transaction = « chantier à part » | ≈ 20 lectures hors transaction, un seul appelant : le rework est petit, et sans lui le slot libéré par la 1ʳᵉ écriture reste vu occupé | **Lot A0** : `updateItem` transactionnel ; R11 = une seule transaction |
| 2 | Chaque issue racontée au chat (R10) | Un tir dont l'arme n'est pas en main est abandonné sans chat | **R14** : le refus dit que l'attaque tombe |
| 3 | R6 : les armes en main sortent | Un Bouclier occupe `MG` : l'équipement du 2M échouerait après avoir rangé l'autre arme | **R15** : `planHandSwap` refuse avant d'écrire (**remplacée en v3.1** : le bouclier sort avec les autres objets, §2ter n° 8) |
| 4 | R1 : `M` / `2M` | 11 armes `2M/Tr` exclues par oubli ; deux logiques d'emplacement (client / v1) | R1 étendue ; **une logique** dans `shared/weaponSlots.js` |
| 5 | Exemple R5 : « grenade (3 kg) » | Le 3 est la capacité de la Ceinture ; grenades sans poids | Lot 0 (0,3 kg) ; exemple corrigé |
| 6 | Inventaire effectif côté client | Les munitions de l'entrante sont initialisées par le serveur (chargeur plein à la 1ʳᵉ mise en main) | **R16** : règle actuelle gardée (décision Saar) ; le calcul du chargeur initial devient partagé (`shared/ammoRules.js`) |
| 7 | (silence) | Fiche libre en combat | **R13** : décision écrite |
| 8 | Bouton « Changer d'arme » | Collision avec l'état Rangée / Au clair | Bouton **« Permuter »** |

## 2ter. Analyse à charge de la v3 (2026-09-25) — ce qui change en v3.1

| # | Le plan v3 disait | La réalité [VÉRIFIÉ] | Correction v3.1 |
|---|---|---|---|
| 1 | Lot A0 : « les tests existants de `inventoryService.test.mjs` servent de filet » | Ils ne couvrent ni les mains, ni le Sac requis, ni le bouclier, ni l'armure, ni la cascade, ni le chargeur initial | **A0-0** : tests de caractérisation **avant** la scission (§6) |
| 2 | R4 : une arme qui ne rentre pas est « laissée à terre » = le Coffre | Le Coffre est un stockage distant : l'arme est téléportée, le poids porté baisse (`computeTotalWeight` exclut le Coffre), la fiche libre la récupère gratuitement — une approximation « temporaire » (invariant 2) | **R4 / R17** : la permutation est **refusée** faute de place (décision Saar 2026-09-25) ; le « à terre » réel = `PLAN_OBJETS_AU_SOL.md` (v2) |
| 3 | `grabList.js` : « gardé » | Il regroupe les exemplaires identiques d'un conteneur et prend le premier : juste pour des grenades, **faux** pour des armes à chargeur (chargeur, type chargé, intégrité, mods propres à l'exemplaire) | Regroupement **seulement si l'état d'exemplaire est identique** (§5, §8) |
| 4 | Lot 0 : « 360-362 sont déjà pris par le drone » | 363 (`character_wounds_severity_mort_subite`) est aussi appliquée | Prochain numéro = premier libre **≥ 364**, à revérifier sur `ls` **et** `knex_migrations` au moment d'écrire |
| 5 | Diffusion par `io.to(campaignId)` | La route utilise `resolveInventoryBroadcastRoom` / `emitInventoryEvent` (locaux à `char-sheet.js`) | Extraction dans une lib partagée, utilisée par la route et le combat (Lot A) |
| 6 | Atomicité = transaction | Pas d'isolation : `23505` sur le même slot de main, rien contre 2M + MG | `23505` traduit en refus `HANDS_FULL` (chat), jamais une erreur brute ; limite documentée |
| 7 | R5 pour chaque sortante | Plusieurs sortantes (2M entrant) chargent le **même** conteneur | Poids des sortantes **cumulé** dans un seul calcul de capacité |
| 8 | R1 exclut le Bouclier (emplacement composite) ; R15 refuse la permutation qu'il bloque | **Aucune différence de règle** : `REGLEBOUCLIER.md` ne dit rien de sa prise en main ; au catalogue il est `location = 'M'` comme une arme à une main, et `updateItem` ajoute lui-même les localisations d'armure (`C`, `C/T`) à partir de la seule main. L'exclusion venait d'une contrainte d'implémentation (la v1 recalculait les slots), pas d'une règle (remarque de Saar, 2026-09-25) | **Bouclier = objet tenu à une main comme un autre** (R1, R6, R7) ; **R15 supprimée** ; une ligne d'objet tenu non-arme dans la fenêtre (Lot B) |
| 9 | `planHandSwap` valide aussi la validité des mains (règles recopiées de `updateItem`, comme l'était `pickFreeHandSlot` en v1) | Avec `applyItemUpdate` transactionnel (Lot A0), la validité des slots (mains, deux-mains, Sac requis, composite, couches d'armure) a **déjà une autorité** | `planHandSwap` ne fait que **choisir** (objets sortants, main cible) ; `applyItemUpdate` valide et tout refus **annule la transaction** ; l'`AppError` porte un code (3ᵉ argument `i18nKey` existant) traduit en ligne de chat |

## 3. Recherche externe (patrons professionnels)

- **Pathfinder 2e sur Foundry VTT** (`foundryvtt/pf2e`, code source lu) : l'état de port d'un objet est **une structure unique**
  (`carryType` tenu / porté / rangé + `handsHeld`) ; **une seule fonction fait autorité** pour la changer
  (`CreaturePF2e#changeCarryType`, qui vide aussi `containerId`) ; les mains occupées sont **dérivées** des objets, jamais un compteur
  stocké ; le **coût d'action n'est pas dans cette fonction** (la règle papier le donne). → séparation autorité d'état (inventaire) /
  coût d'action (combat), mains libres déduites de `char_inventory_slots`.
- **Trois niveaux d'accès** (tenu / ceinture-étui / sac à dos), tous payés en action (Interact) : même gradation que Ceinture / Sac.
- **D&D 5e** : interaction avec un objet = règle de table, aucun état automatisé à reprendre.
- Références : <https://github.com/foundryvtt/pf2e> (`actor/creature/document.ts`, `actor/base.ts`, `item/physical/document.ts`,
  `item/physical/data.ts`) ; <https://2e.aonprd.com/Rules.aspx?ID=2148>.
- Patron d'interface retenu : **état dérivé d'une commande en attente** (un « inventaire effectif » = l'inventaire tel qu'il sera à la
  résolution), au lieu de dupliquer la logique de la fenêtre pour le cas « arme pas encore en main ».
- Pour le « à terre » (v2) : Foundry *Item Piles* — voir `PLAN_OBJETS_AU_SOL.md`.

## 4. Règles de jeu

Validées par Saar le 2026-09-24 (R1-R12) ; R13-R16 issues de la 1ʳᵉ analyse à charge (R13 et R16 décidées par Saar) ; R4 et R17
tranchées par Saar le 2026-09-25.

- **R1 Portée.** N'importe quel objet tenable à la main : emplacement catalogue `M`, `2M` ou `2M/Tr` (traitée comme `2M`), hors `Tr`
  pur (trépied) ; y compris grenades **et boucliers** (catalogués `M` : un objet à une main comme un autre). Ou **l'absence
  d'objet** (ligne « Mains nues » : une main libre reçoit l'objet). Sources : Sac et Ceinture (jamais le Coffre).
- **R2 Interface.** Bouton ⇄ **« Permuter »** à côté de ↻ sur chaque ligne d'arme et sur « Mains nues ». Il ouvre la colonne de
  droite avec les armes rangées ; le coût apparaît par ligne selon la localisation.
- **R3 Coût = un seul paiement**, selon la localisation de l'arme **entrante** : **Ceinture** → Préparation, Initiative **−3**
  (RAW « Saisir un objet à portée de main »), cumulable avec toute autre action ; **Sac** → **Action simple** (aucun coût
  d'Initiative), exclusive avec tir / corps à corps / rechargement du même Tour. Le rangement de l'arme sortante est inclus (le RAW
  fait de « lâcher » une action gratuite). **La permutation ne change pas l'état Rangée / Au clair** (décision Saar) : le −3 couvre
  la prise ; les transitions d'état se paient comme aujourd'hui, si le joueur les déclare.
- **R4 Destination de l'arme sortante** = le conteneur d'origine de l'arme entrante (Ceinture ↔ Ceinture, Sac ↔ Sac), **si elle y
  rentre** (R5). Sinon la permutation est **refusée** (R17). Aucun autre conteneur n'est essayé en v1 (un repli vers l'autre
  conteneur, ou vers le sol, est une évolution de la v2). **Jamais le Coffre.**
- **R5 Règle de capacité « ne jamais empirer ».** Les armes sortantes **rentrent ensemble** si, une fois l'échange fait, le poids
  **rangé** du conteneur (poids des sortantes **cumulé**) vaut au plus `max(capacité en kg, poids d'avant l'échange)` : un conteneur
  conforme reste conforme, un conteneur déjà trop plein n'est jamais aggravé (formule précisée le 2026-09-25 ; l'ancienne
  formulation « ne dépasse ni la capacité, ni le poids d'avant » se lisait comme un ET, contredisant l'exemple ci-dessous). Un poids
  absent compte 0 ; une capacité absente = sans limite ; l'armure portée et les objets équipés ne comptent pas. Exemples (grenade
  0,3 kg, Ceinture 3 kg) : un fusil de 6 kg remplacé par une grenade de la Ceinture ne rentre pas → **permutation refusée** ; un
  pistolet de 1 kg rentre ; une arme plus légère que celle qui entre rentre toujours, même dans un Sac déjà trop plein.
- **R6 Arme entrante à deux mains** (`2M` ou `2M/Tr`) : **tous** les objets tenus sortent (armes, y compris une arme montée `Tr`, **et
  bouclier**), vers le conteneur d'origine de l'entrante, **ensemble** soumis à R5 ; si l'un ne rentre pas, la permutation est
  refusée en entier ; « l'action est complète : le personnage s'équipe complètement ».
- **R7 Objet entrant à une main.** L'objet sortant est celui de la **ligne cliquée** (arme ou bouclier) ; si cette ligne est un
  deux-mains, il sort (il occupe les deux mains). Sur « Mains nues », une main libre est requise (sinon refus, message d'orientation
  vers le « Permuter » d'une ligne). Un bouclier entrant se pose dans la main de la ligne cliquée (`MG` ou `MD`) ; `updateItem`
  compose seul les localisations d'armure.
- **R8 Sac = usage au Tour suivant** (Action simple) ; la Ceinture (Préparation) permet d'utiliser l'arme **dans le même Tour**.
- **R9 Une seule permutation par Tour.**
- **R10 Annonce permissive, résolution stricte** (`.claude/rules/combat.md`) : l'annonce ne refuse que le structurellement impossible ;
  main / capacité / Sac absent sont traités à la résolution, chaque issue racontée au chat.
- **R11 Atomicité.** Le choix (R6 / R7) et la capacité (R5) sont établis **avant** d'écrire ; les écritures (objets sortants rangés, puis
  entrant équipé) se font dans **une seule transaction** dont la validité des slots (`applyItemUpdate`) fait partie : tout refus
  annule tout, tout ou rien. Aucune restauration manuelle.
- **R12 Sac obligatoire** (règle PI2 existante de l'équipement) : sans Sac équipé, aucune permutation ; message clair.
- **R13 La fiche reste libre** (décision Saar 2026-09-24) : équiper depuis la fiche de personnage n'est pas verrouillé en combat ;
  « Permuter » est le chemin **payant** du combat, pas le seul. Consigné au JOURNAL8 à la clôture.
- **R14 Un refus annule l'attaque dépendante, et le dit.** Si la permutation est refusée à la résolution (mains prises, Sac absent,
  objet parti, **faute de place**…) et que le même token a déclaré ce Tour une attaque / un rechargement avec l'arme entrante, une
  **ligne de chat dédiée** dit que cette action est annulée (aujourd'hui elle tomberait sans message).
  **Décision Saar 2026-09-25 : le personnage perd son action, pas de seconde chance** (« c'est sa faute : il a voulu faire rentrer une
  mitrailleuse dans sa poche banane à la place de sa grenade »). Conséquences : l'Initiative payée à l'annonce n'est pas remboursée ; un
  corps à corps déclaré avec une arme qui n'est plus en main est **annulé**, jamais dégradé en « mains nues » (comportement actuel, silencieux).
- **R15 (supprimée en v3.1) — Bouclier : aucun cas particulier.** Décision Saar, 2026-09-25 : rien ne distingue, en règle, un bouclier
  d'une arme dans la main. Un bouclier tenu sort avec les autres objets (R6) ; le refus éventuel vient de la validité des slots
  (couches d'armure de sa localisation, `applyItemUpdate`) ou de la capacité (R5), comme pour toute permutation.
- **R16 Munitions : la règle actuelle est gardée** (décision Saar 2026-09-24). Une permutation ne modifie jamais le chargeur ni le type
  chargé d'une arme sortante ou entrante, sauf la règle existante : une arme à calibre dont `ammo_remaining` est `null` reçoit le
  chargeur plein à sa toute première mise en main, sans consommer de stock. Le chargeur d'une arme rangée est mémorisé par exemplaire
  (déjà le cas). « Première mise en main = arme vide » (Recharger obligatoire) a été **écartée** : changement global (fiche, équipement
  d'urgence du MJ, PNJ) hors de ce chantier.
- **R17 Refus faute de place** (décision Saar 2026-09-25 : « si l'arme est trop grosse pour le contenant, message d'erreur, on
  corrigera en v2 »). Décidé à la résolution, **avant toute écriture** : aucun objet ne bouge, une ligne de chat nomme l'arme qui ne
  rentre pas et le conteneur, R14 s'applique. L'annonce ne refuse pas (R10) ; l'aperçu client peut griser la ligne avec la raison
  (information, jamais autorité).

## 5. Architecture

**Séparation des responsabilités (D1).** L'*état* (où est l'objet, mains libres, capacité) vit dans `inventoryService` ; les *règles
pures* dans `shared/` ; le *coût* (Initiative / exclusivité) dans `shared/combatIniCost.js` + `combatExclusiveActions.js` ; le
*chat et la diffusion* dans `server/src/lib/combatGrabService.js` ; le combat n'écrit jamais un emplacement lui-même.

- **`shared/weaponSlots.js`** (existant, étendu) : `getSlotInfo(refLocation)` **déplacé depuis `WeaponPanel.jsx`** (le client
  l'importe désormais de `shared/`) — autorité unique du type d'arme (`1H` / `2M` / `2M_Tr` / `Tr`) et de l'emplacement par défaut.
  `isGrabbableRef` (dans `combatGrabItem.js`) s'appuie dessus : `1H`, `2M`, `2M_Tr` (le Bouclier, catalogué `M`, est un objet à une
  main comme un autre). `pickFreeHandSlot` disparaît au profit de `planHandSwap`.
- **`shared/inventoryMath.js`** : `containerFillKg(items, container)` (objets rangés, sans emplacement) et
  `fitsInContainer({ capacityKg, fillKg, deltaKg })` implémentant R5 ; `deltaKg` = somme des poids des sortantes moins celui de
  l'entrante.
- **`shared/ammoRules.js`** (existant, étendu) : `initialMagazineOnEquip(caliber, ammoCountRaw)` → nombre de coups ou `null` (même condition
  que l'actuel `resolveAmmoInit` : calibre présent, capacité lisible et > 0). `resolveAmmoInit` (serveur) l'appelle après sa lecture de
  `ref_equipment` ; `applyDeclaredSwap` (client) l'appelle pour l'entrante dont `ammo_remaining` est `null` : l'aperçu et le serveur
  partagent **une seule règle**, jamais une copie.
- **`shared/combatGrabItem.js`** (existant, étendu) : coûts par conteneur (gardés) et **`planHandSwap({ incoming, heldItems,
  clickedItemId })`** → `{ ok, targetSlot, outgoingIds }` ou `{ ok: false, reason }`, qui encode le **choix** de R6 / R7 (2M sort
  tout objet tenu, une main = ligne cliquée, mains nues = main libre). Il **choisit** ; il ne **valide** pas les slots : la validité
  (mains, deux-mains, Sac requis, composite du bouclier, couches d'armure) reste l'autorité unique de `applyItemUpdate`. Le client
  (aperçu, grisage) et le serveur (résolution) appellent le même choix.
- **Point d'extension v2.** La destination d'une arme sortante est calculée par **une seule fonction** (`planStowDestination` : R4 + R5
  → `{ ok, container }` ou `{ ok: false, reason: 'no_room' }`). En v1 elle ne connaît que le conteneur d'origine ; la v2 y ajoutera
  le sol comme dernier barreau, sans toucher à `swapItemInHand` ni à l'interface.
- **`server/src/lib/inventoryBroadcast.js`** (nouveau, Lot A) : `resolveInventoryBroadcastRoom` et `emitInventoryEvent`, **extraits**
  de `char-sheet.js` ; la route, `combatGrabService` et `consumeThrownGrenade` les utilisent (une seule autorité de « à qui diffuser »).
- **`inventoryService` — Lot A0.** `updateItem` est scindé : un cœur **`applyItemUpdate(trx, characterId, itemId, payload)`** qui fait
  validations **et** écritures avec l'exécuteur transactionnel (`_handSlotConflict`, `_armorSlotOccupants`, `isContainerAvailable`,
  `resolveAmmoInit` et les lectures `ref_equipment` reçoivent un exécuteur, défaut `db`, nommé comme l'idiome existant `trxOrDb` de
  `removeItem`) ; `updateItem` l'enveloppe (`db.transaction`, puis relecture de l'objet et des objets en cascade **après commit**) —
  **comportement inchangé pour la route**. Le filet est écrit **avant** la scission (A0-0, §6).
- **`inventoryService` — Lot A.** `getContainerCapacityKg(characterId, container)` (capacité de l'objet équipé en `D` / `Ce`),
  `getContainerFillKg`, et **`swapItemInHand(characterId, { incomingId, clickedItemId })`** (remplace `takeItemInHand` ; la prise sans
  arme sortante en est le cas particulier) : lit conteneur d'origine, mains, capacités → `planHandSwap` → `planStowDestination` (R5
  cumulé) → **une transaction** : `applyItemUpdate` des sortantes (rangées avec `container` explicite) puis de l'entrante. Tout refus
  de `applyItemUpdate` (une `AppError` 4xx qui porte un code : 3ᵉ argument `i18nKey`, déjà prévu par `AppError`) **annule la
  transaction** et devient un refus codé, jamais un texte français émis vers le chat (`rules/i18n.md`). Une erreur `23505` (main prise
  entre le contrôle et l'écriture) est traduite en refus `HANDS_FULL`. Renvoie ce qui a bougé, pour le chat et la diffusion.
  *À vérifier au Lot A0 :* les `AppError` du chemin « équiper » n'ont aujourd'hui aucun code ; les ajouter est additif (la route garde
  statut et message).
- **Contrat de déclaration.** `mapActions.grab = { itemId, replaceItemId? }` (l'arme entrante, et la ligne cliquée). Le serveur relit
  le conteneur en base pour le coût (jamais du client), valide structurellement, refuse une deuxième permutation. Ligne
  `combat_actions` de type `micro`, `action_key: 'grab_item'`, `sequence: 2` (**pas de migration** : `chk_action_type` accepte
  `micro`).
- **Annonce et « utiliser dans le même Tour ».** L'arme d'une attaque déclarée est acceptée « en main » si
  `weaponInvId === mapActions.grab.itemId` (sites Tir, secondaire, CaC). Depuis le Sac l'exclusivité (R8) refuse déjà toute attaque
  du même Tour. Les munitions non initialisées (`null`) passent l'annonce (`hasEnoughAmmo`).
- **Résolution.** Dans la boucle des actions simples, avant l'entrée complexe : `swapItemInHand`, rediffusion `INVENTORY_UPDATED` de
  chaque objet déplacé, **une ligne de chat par issue** (permutée, déjà en main, refus par motif dont **faute de place**, erreur) et,
  après un refus, la ligne R14 si une action dépendante existe.
- **Client — liste des candidats (`grabList.js`).** Le regroupement d'exemplaires n'a lieu que si leur **empreinte d'état** est
  identique (`ammo_remaining`, `current_ammo`, `custom_name`, intégrité, panne, mods si le client les reçoit — à vérifier au Lot B) ;
  un objet à suivi de chargeur ou porteur d'état reste **une ligne par exemplaire**. Dans le doute, une ligne par exemplaire.
- **Client — inventaire effectif.** `applyDeclaredSwap(items, swap)` (pur, testé) : l'inventaire tel qu'il sera à la résolution
  (entrante équipée, sortantes rangées). La fenêtre dérive `assaultWeapons` **et** `allInventoryItems` de cet inventaire par
  `useMemo` sur `[items bruts, permutation choisie]` — `assaultWeapons` cesse d'être un `useState` recopié (état dérivé dupliqué
  supprimé) ; **mêmes noms**, donc les ≈ 21 lectures en aval ne changent pas. Le serveur ne reprend jamais cette version. Panneau de
  droite : candidats avec coût, raison si inutilisable (mains, **place** : information seulement).
- **Fenêtre MJ.** Sa dérivation passe par `/combat-equipment` : elle devra dériver de l'inventaire du PNJ actif (déjà chargé pour la
  v1) pour appliquer l'inventaire effectif. Livrée après le joueur.

## 6. Découpage en lots

Un lot par tour ; chacun attend la validation du précédent (`AGENTS.md`).

- **Lot 0 — Donnée : poids des grenades.** Migration `UPDATE ref_equipment SET weight = 0.3 WHERE category = 'Grenade' AND weight IS NULL`
  (clé naturelle, jamais l'`id` ; modèle : `325_ref_equipment_grenade_frag_aoe_profile.js`), `down` symétrique, numéro = **premier
  entier libre ≥ 364**, vérifié sur `ls` **et** `knex_migrations` au moment d'écrire (360-363 sont déjà pris). Écrire le fichier
  l'applique (nodemon) : à faire seulement après le « go ». *Effet à annoncer :* le poids porté des personnages existants monte
  (8 grenades = +2,4 kg). *Critère :* **15** lignes mises à jour, aucune autre touchée.
  **POSÉ ET APPLIQUÉ le 2026-09-25 (« go » de Saar) : `364_ref_equipment_grenade_weight.js`, lot 50 de `knex_migrations`, 15 grenades à
  0,3 kg, les 782 autres lignes inchangées (contrôle par comptage). Effet sur le personnage local (Jean Val-Jean, 8 grenades) : poids
  porté 11,525 kg pour un seuil de 39 kg, pénalité d'Initiative 0 — aucun effet d'encombrement.** Essayé à blanc avant pose (le
  serveur de dev tournait : poser le fichier l'applique aussitôt) : idempotent (n'écrit que là où `weight` est NULL, un
  poids curé n'est jamais écrasé), non bloquant, `down` comparé en `::real` (`0.3::real = 0.3` vaut **faux** en PostgreSQL). Essai
  dans une transaction annulée : 15 lignes → 0,3 kg, 0 autre ligne touchée, re-`up` sans effet, `down` remet les 15 à NULL, rien
  de persisté.
- **Lot A0 — `updateItem` transactionnel.**
  - **A0-0 — tests de caractérisation** (avant toute modification de `updateItem`), à fixtures base, lancés par Saar : équiper une arme
    en `MD` (conteneur forcé `Sac`) ; refus d'une arme à deux mains si une main est prise ; refus d'une arme à une main si un deux-mains
    est équipé ; refus sans Sac équipé (PI2) ; bouclier composite (main + bras + localisations) ; armure 1+S+S ; déséquipement du Sac
    avec et sans `confirmEmptyContainer` (cascade vers le Coffre) ; déséquipement d'une arme avec `container` explicite ; chargeur
    initial à la première mise en main. Ces tests **passent sur le code actuel** : ils figent le comportement.
    **Livré 2026-09-25 :** `server/src/services/inventoryEquip.test.mjs` (20 tests, syntaxe vérifiée, références du catalogue
    vérifiées en lecture, **non exécuté** : à lancer par Saar, `node --env-file=.env --test server/src/services/inventoryEquip.test.mjs`).
    Un test rouge ici décrit mal le comportement actuel : à réparer **dans le test**, jamais dans `updateItem`, avant A0-1.
    **Résultat (Saar, 2026-09-25) : les 20 tests passent** sur le code d'avant la scission. Le fichier était en plus « annulé » :
    le pool de connexions n'était pas fermé (`test.after(... db.destroy())`, convention de `inventoryService.test.mjs`) — corrigé,
    y compris dans `inventoryGrab.test.mjs` (v1) qui avait le même oubli.
  - **A0-1 — scission — codée et VÉRIFIÉE 2026-09-25 : `inventoryEquip` 23/23, `inventoryService` 26/26, `inventoryGrab` 12/12
    (lancés par Claude, base locale, aucun résidu de fixture).** `applyItemUpdate(trx, …)` (toutes les lectures via `trx`,
    retourne `{ cascadedItemIds }`) + `updateItem` (une `db.transaction`, relecture après commit, contrat de la route inchangé).
    Helpers `_handSlotConflict`, `_armorSlotOccupants`, `isContainerAvailable`, `resolveAmmoInit` : paramètre optionnel `executor`
    (défaut `db`), donc `addItem`, `quickEquip` et la v1 sont inchangés.
  - **A0-2 — 3 tests de transaction ajoutés** au même fichier (23 au total) : une main libérée par une première écriture est vue libre
    par la seconde ; l'échec de la seconde annule la première ; la cascade ne rend que des identifiants.
  - **A0-1 — scission** `applyItemUpdate` / `updateItem`, exécuteur passé aux helpers.
  - **A0-2 — test de la transaction :** deux écritures dans une transaction, échec de la seconde = rien d'écrit.
  - *Critère :* les tests A0-0 **inchangés et verts** avant et après la scission ; aucune interface.
- **Lot A — partagé + serveur (testable sans interface).** `getSlotInfo` déplacé, `initialMagazineOnEquip` extrait (avec test : mêmes
  résultats que l'ancien `resolveAmmoInit`), `inventoryMath` (capacité cumulée), `planHandSwap`, `planStowDestination`,
  `swapItemInHand` (capacité, transaction, `23505` → refus), `inventoryBroadcast.js` extrait, contrat `grab { itemId, replaceItemId? }`
  et validation d'annonce, acceptation de l'arme entrante « en main » à l'annonce, résolution + chat (R14 et R17 comprises),
  remplacement de `takeItemInHand` et de ses tests v1. *Critère :* tests purs ; tests à fixtures base (Saar) ; aucune interface.
  **Découpage du Lot A et avancement (2026-09-25) :**
  - **A1 — règles pures partagées — FAIT et VÉRIFIÉ** : `getSlotInfo` déplacé dans `shared/weaponSlots.js` (client branché) ;
    `isGrabbableRef` (bouclier et `2M/Tr` acceptés, trépied pur refusé) ; vocabulaire de refus unique `GRAB_REFUSAL` dans
    `shared/combatGrabItem.js` (3 codes ajoutés : `already_in_hand`, `container_unavailable`, `no_room`, chacun avec sa ligne de chat et
    sa clé i18n) ; `planHandSwap` et `planStowDestination` (R4 : conteneur d'origine seulement) ; `inventoryMath` :
    `containerFillKg`, `containerState`, `fitsInContainer` (après ≤ max(capacité, avant), tolérance flottante 1e-6) ;
    `initialMagazineOnEquip` (`resolveAmmoInit` l'appelle). Tests : shared 796/796, client 119/119, en base `inventoryEquip` 23,
    `inventoryService` 26, `inventoryGrab` 13, `combatGrabService` 6 — tous verts ; lint et `npm run build` client OK.
  - **A2 — serveur : `swapItemInHand` — FAIT et VÉRIFIÉ (2026-09-25).**
    - `inventoryService.swapItemInHand(characterId, { incomingId, clickedItemId })` : instantané de l'inventaire lu DANS la
      transaction (`_loadSwapSnapshot`), `classifyGrabCandidate` → R12 (Sac) → `planHandSwap` → `planStowDestination` → écritures
      `applyItemUpdate` (sortants d'abord, avec `container` explicite, puis l'entrant), tout ou rien. Retourne `swapped` / `already` /
      `refused` (+ `container` et `outgoingIds` pour « ne rentre pas »). Pas de verrou de personnage (le moteur de tour sérialise
      déjà ; l'index unique attrape le reste).
    - Refus d'équipement à CODE : `equipRefusal` (propriété `refusal` sur l'`AppError`, statut et message inchangés pour la route,
      l'`errorHandler` ne sérialise que status / message / i18nKey) sur les 12 refus du chemin « équiper » d'`applyItemUpdate` ;
      `23505` → `HANDS_FULL`. Nouveau code `ARMOR_LAYERS` (couches d'armure pleines, bouclier).
    - `describeGrabCandidate` et la résolution partagent `classifyGrabCandidate` (une seule autorité du « structurellement
      impossible »).
    - `lib/inventoryBroadcast.js` extrait (route PUT, permutation et `consumeThrownGrenade` : une seule autorité de salle) ;
      `itemWeightKg` (formule de poids unique) dans `inventoryMath`.
    - `combatGrabService` réécrit sur `swapItemInHand` : diffusion de chaque objet déplacé, une ligne de chat par issue —
      `swapDone` (remplacement), `grabTaken`, `grabAlready`, un refus par code, **R17 : le refus « ne rentre pas » nomme l'arme et le
      conteneur**.
    - Code v1 supprimé : `takeItemInHand`, `findFreeHandSlot`, `pickFreeHandSlot` et leurs tests.
    - Tests en base : `inventorySwap` 15 (dont l'atomicité — le rangement de l'arme sortante est annulé quand le bouclier est refusé —
      et une **vraie concurrence** : la permutation attend l'index unique, signalée par `pg_stat_activity`, puis `23505` → refus),
      `inventoryEquip` 23, `inventoryService` 26, `inventoryGrab` 4 (structurel), `combatGrabService` 10 ; shared 794, client 119.
    - ⚠ Comportement transitoire côté interface : la déclaration v1 n'envoie pas encore `replaceItemId` (A3) — elle équivaut à
      « Mains nues », avec la règle R6 pour un deux-mains (tout ce qui est tenu est rangé, au lieu du refus v1).
  - **A3 — annonce — FAIT et VÉRIFIÉ (2026-09-25).**
    - Nouveau module `lib/combatGrabAnnouncement.js` (extrait du gestionnaire de 1 100 lignes, testable seul) :
      `validateGrabDeclaration` (forme du payload jamais fiable : tableau / null / scalaire refusés = **R9**, identifiants non textuels,
      objet entrant structurel via `describeGrabCandidate`, **ligne à remplacer : doit appartenir au personnage et différer de l'entrant**,
      exclusivité de l'Action simple du Sac, drone / exo refusés), `isGrabbedInHand`, `buildGrabActionRow`.
    - Contrat `mapActions.grab = { itemId, replaceItemId? }` transporté jusqu'à `combat_actions.modifiers` (`itemId`, `container`,
      `replaceItemId`, `ini_mod`) ; le **conteneur et le coût viennent de la base**, jamais du client.
    - L'objet entrant est accepté « en main » aux **4 sites** (Tir principal, Tir secondaire, CaC principal, CaC secondaire) si sa
      main visée y est permise (une arme à deux mains n'est jamais une arme secondaire). Le rechargement n'a pas de contrôle « en main »
      à l'annonce : sa vérification est à la résolution.
    - **Décision (R10) :** l'annonce ne détecte PAS l'auto-contradiction « attaquer avec l'arme que la même permutation range » : elle
      dépend de l'état à la résolution (la ligne à remplacer peut disparaître). C'est la résolution (A4) qui la dit au chat.
    - Tests : `combatGrabAnnouncement` 13 (dont cas réels en base : identifiant forgé, ligne d'un autre personnage) ;
      **`socketCombatAnnouncementGrab` 7 — le VRAI gestionnaire `COMBAT_ACTION_DECLARE`** (faux `io` / `socket`, vraie base, fixtures
      supprimées) : ligne `grab_item` micro / sequence 2, Initiative −3 (Ceinture) ou 0 (Sac), coût forgé ignoré, refus sans écriture,
      **Tir avec l'arme de la Ceinture refusé sans permutation puis accepté avec**, exclusivité du Sac.
  - **A4 — R14 : un refus annule l'attaque dépendante et le dit — FAIT et VÉRIFIÉ (2026-09-25).** (`consumeThrownGrenade` via
    `inventoryBroadcast`, les lignes de chat par issue et R17 étaient déjà faits en A2.)
    - **Une seule règle, pas une branche par cause** : à l'endroit où chaque résolution constate que l'arme déclarée n'est pas en main
      (permutation refusée, arme rangée par la même permutation, arme rangée depuis la fiche), l'action tombe et une ligne de chat le
      dit. Nouveau module `lib/combatHandWeaponNotice.js` (`weaponNotInHandEmission`, `offhandNotInHandEmission`, `itemDisplayName`,
      partagé avec `combatGrabService`). Le nom de l'arme n'est jamais celui d'un objet étranger (variante sans nom).
    - **Quatre sites** : Tir (`resolveAssaultAction` — l'arme est désormais lue AVANT la ligne de vue : une action impossible n'a aucun
      effet de bord), arme de zone / grenade (`resolveAoeAssaultAction`), corps à corps (`resolveMeleeAction` — **plus de repli
      silencieux « mains nues »**, l'attaque est annulée), rechargement (le panneau du joueur reste, la salle a en plus la ligne de chat).
    - **Seconde arme absente** (tir / corps à corps à deux armes) : l'attaque continue avec l'arme principale, notice dédiée
      `session.dualWieldOffhandNotInHand` (l'ancienne disait « à sec », faux pour une arme absente) ; le corps à corps, qui perdait le
      bonus « deux armes » sans un mot, la reçoit aussi.
    - Clés i18n (`fr.json`, section `session`) : `actionCancelledWeaponNotInHand`, `actionCancelledWeaponUnknown`, `dualWieldOffhandNotInHand`.
    - Tests : `socketCombatHandWeaponAbsence` 9 (notice seule ; **vraies fonctions de résolution** avec faux `io` / `socket` et vraie
      base : Tir, objet d'un autre personnage, grenade, corps à corps, rechargement rangé et en main — munitions et grenade intactes).
      Non couvert de bout en bout : le tir à deux armes dont seule la seconde manque (carte complète requise) — sa notice est testée seule.
      Suites du chantier : DB 132/132, shared 794/794.
- **Lot B — fenêtre joueur** (plan validé par Saar le 2026-09-25 ; **analyse à charge faite le 2026-09-25, corrections ci-dessous**). Trois
  étapes, une par tour, chacune attend la validation de la précédente. Le bouclier est traité comme une arme à une main (décision Saar) :
  même ligne, même bouton ⇄, sans groupe à part ; seule différence, inhérente à la fenêtre : cliquer le corps d'une ligne d'arme déclare une
  attaque, un bouclier n'en a pas, donc seul ⇄ agit sur sa ligne.
  - **B1 — logique pure, sans écran, avec tests.** `applyDeclaredSwap(items, swap)` (mêmes fonctions partagées que le serveur :
    `planHandSwap` + `planStowDestination` ; l'entrante jamais équipée reçoit le chargeur initial de R16 ; **les objets rangés ont
    `slots: null`, pas `[]`** — convention du serveur (`array_agg` vide = NULL) dont dépendent le filtre des munitions et `grabList`) ;
    `buildGrabList` à empreinte d'état (**ne regroupe que les objets SANS calibre et à état identique** : `ammo_remaining`,
    `current_ammo`, `custom_name`, `custom_props`, `integrity_current`, `malfunction_severity`, `lunette_niveau` ; les autres mods ne sont
    pas exposés au client [OBSERVÉ] → toute arme à chargeur = une ligne par exemplaire) ; statut d'un candidat (`swapCandidateStatus` :
    mêmes codes `GRAB_REFUSAL` que le serveur, donc mêmes textes) ; « objets tenus sans ligne d'action » = objets en main absents des
    listes Distance ∪ Contact (bouclier, grenade sans profil de zone) ; liste des munitions filtrée sur la famille `Munitions`. **Test de
    transport serveur ajouté** : déclaration réelle « Permuter la grenade à fragmentation (Ceinture) + la lancer au même Tour » (visée
    `aoe.intendedOrigin`), jamais couverte en A3 (seul le tir à l'arme à feu l'était).
    **B1 — FAIT et VÉRIFIÉ (2026-09-25).**
    - **`decideHandSwap` (shared/combatGrabItem.js) — autorité unique de la décision** : classification, Sac requis, objets sortants,
      main, place du rangement. Le serveur (`swapItemInHand`) et le client l'appellent : le serveur n'avait cette séquence qu'EN LIGNE
      dans sa transaction, refactorée sans changement de comportement (55 tests en base verts). Le client n'en copie aucune règle.
    - **`client/src/lib/declaredSwap.js`** : `applyDeclaredSwap(items, swap)` (inventaire effectif ; `slots: null` pour les objets rangés ;
      chargeur plein R16 seulement si `ammo_remaining === null`, comme le serveur ; **même référence** sans permutation ou si elle sera
      refusée), `swapWarning` (l'avertissement : `GRAB_REFUSAL` + conteneur + nom de l'objet qui ne rentre pas), `heldItemsWithoutActionRow`
      (objets en main sans ligne d'action : bouclier, grenade sans profil de zone). 16 tests.
    - **`grabList.js` à empreinte d'état** : ne regroupe que des exemplaires identiques (nom, `custom_props`, intégrité, panne, lunette,
      chargeur, type chargé) ; **toute arme à calibre = une ligne par exemplaire**. 13 tests.
    - **`isCompatibleAmmoItem` (shared/ammoRules.js)** : règle unique « cette ligne d'inventaire est une munition pour ce calibre »
      (famille `Munitions`, calibre, hors Coffre) ; la fiche (`WeaponPanel`) l'utilise déjà ; la fenêtre de combat le fera en B2a. Armes ET
      munitions portent un calibre : la fenêtre de combat proposait une arme rangée du même calibre comme « munition » [OBSERVÉ dans le code].
    - **Transport serveur** : « Permuter la grenade (Ceinture) + la lancer au même Tour » accepté (ligne `grab_item` seq 2 avant `assault`
      seq 3, point visé et détonation conservés, Initiative −3) et refusé sans permutation ; depuis le Sac, refusé (Action simple exclusive).
    - **Décision Saar (2026-09-25) — aperçu de refus : AVERTIR EN ROUGE MAIS PERMETTRE** (la ligne reste cliquable, la déclaration reste
      possible ; le serveur tranche, le chat le dit).
    - Vérifié : shared 809/809, client 328/328, DB 134/134, `npx eslint` des fichiers touchés, `git diff --check`, aucun résidu en base.
  - **B2a — FAIT (2026-09-25), en attente du coup d'œil de Saar en jeu.** `CombatActionWindow.jsx` : `baseInventory` est la seule copie
    d'état ; `allInventoryItems` en est l'alias (B2b y branchera `applyDeclaredSwap`) et `assaultWeapons` est dérivé par `useMemo`
    (les deux `useState` recopiés et leurs deux `set…` du fetch disparaissent) ; `reloadAmmoItems` utilise `isCompatibleAmmoItem`
    (seul changement visible : une arme rangée du même calibre n'est plus proposée comme munition). Vérifié : `eslint` (0 erreur, les 4
    avertissements `exhaustive-deps` existaient déjà dans la version commitée), `npm run build`, `git diff --check`. Aucun test de fenêtre
    n'existe : le contrôle de non-régression est le coup d'œil de Saar.
    Description initiale — dérivations, aucun changement visible : `assaultWeapons` et `allInventoryItems` cessent d'être deux `useState` recopiés :
    dérivés par `useMemo` d'un inventaire de base et de la permutation (`null` pour l'instant). Mêmes noms → les ≈ 21 lectures en aval ne
    changent pas ; `useMemo` placé avec les autres états (avant le `return null` de la ligne 478 : règle des hooks respectée). Contrôle :
    lint, build, puis un coup d'œil de Saar en jeu (rien ne doit changer).
  - **B2b — CODÉ (2026-09-25), en attente du test de Saar en jeu.** Maquette validée par Saar (« exactement ce que j'attends »).
    Livré : `CombatSwapPanel.jsx` (extension colonne 2, candidats Ceinture / Sac avec coût et avertissement rouge cliquable) ;
    `CombatDeclareActionList` (prop `swap` : bouton ⇄ à côté de ↻ sur les lignes à distance, de contact et « Mains nues », étiquette
    « permutée » ; prop `heldRows` : lignes des objets tenus sans action, ⇄ seulement ; la prop `grab` v1 reste pour la fenêtre MJ) ;
    `CombatActionWindow` (états `swap` / `swapPanel` distincts, `allInventoryItems` = `useMemo(applyDeclaredSwap)`, **une extension à la
    fois** : ⇄ prend la colonne 2, choisir une arme / ↻ / un clic sur un token la rend ; choisir une permutation qui range l'arme de
    l'attaque la **désélectionne** ; candidats lus dans l'inventaire de BASE) ; `buildHumanDeclarePayload` (`replaceItemId`, absent pour
    « Mains nues » ; 3 tests) ; clés `combat.json` (`swapPanel.*`, `declareList.swapButton` / `swappedTag`) ; styles `index.css`
    (`.decl-swap*`, `.decl-wpn__swap`). Vérifié : `npx eslint` des 7 fichiers (0 erreur, 4 avertissements déjà présents), `npm run build`,
    shared 809/809, client 331/331. **Non testé : tout l'écran** (aucun test de fenêtre, Saar teste en jeu). Description initiale :
    État `swap = { itemId, replaceItemId }` (remplace `grabItemId` ; « Mains nues » = `replaceItemId` null) ; bouton ⇄
    à côté de ↻ (armes à distance, armes de contact, « Mains nues », lignes d'objets tenus) ; colonne de droite « Permuter avec… »
    (Ceinture / Sac, coût par ligne) ; choisir un autre candidat REMPLACE le choix (R9), recliquer l'annule ; la liste montre l'état
    après permutation ; **choisir une permutation qui range l'arme d'attaque sélectionnée désélectionne cette attaque** (sinon
    `selectedWeapon` retombe silencieusement sur l'arme principale, ligne 492, et l'attaque partirait avec une autre arme) ; `replaceItemId`
    dans `buildHumanDeclarePayload` ; clés i18n. **La section v1 « Prendre en main » n'est PAS retirée ici** : la fenêtre MJ s'en sert
    encore (prop `grab` de `CombatDeclareActionList`, composant partagé par les 3 fenêtres) ; elle disparaît au Lot C. Maquette HTML
    validée par Saar AVANT le code : **`docs/Old/maquette-permuter/index.html`** (4 scènes : mains vides après un lancer, grenade
    choisie, bouclier remplacé, avertissement rouge cliquable). **Principe de Saar (2026-09-25) : une action = une extension de fenêtre
    dédiée** — sur la ligne d'une arme, ↻ (munitions, existe) et ⇄ (armes disponibles pour la permutation) ouvrent chacun leur extension
    en colonne 2 ; le « Prendre en main » de la colonne 1 (v1, visible dans la fenêtre actuelle) n'est qu'un état transitoire.
  - **Aperçu de refus (information, jamais autorité) :** le client sait calculer avec les fonctions partagées `NO_SAC`, `HANDS_FULL`,
    `NO_ROOM`, `CONTAINER_UNAVAILABLE`, `ALREADY_IN_HAND` ; il **ne sait pas** prévoir `ARMOR_LAYERS` (règle 1+S+S du bouclier, à ne pas
    dupliquer) : le serveur le refuse à la résolution, le chat le dit. Forme de l'aperçu : **avertissement rouge, ligne cliquable**
    (décision Saar 2026-09-25).
  - *Critère :* tests purs ; lint / build ; scénario de Saar en jeu.
- **B2b — VALIDÉ par Saar (2026-09-25) : côté JOUEUR, « fonctionnel ».** (Saar testait d'abord côté MJ, où l'ancien « Prendre en main »
  était encore visible : malentendu levé.)
- **Lot C — fenêtre MJ / PNJ — CODÉ (2026-09-25), en attente du test de Saar (c'est la fenêtre qu'il utilise).**
  `CombatGmDeclareWindow.jsx` : mêmes états `swap` / `swapPanel`, même extension `CombatSwapPanel` en colonne 2 (une extension à la
  fois), mêmes ⇄ sur les lignes, mêmes lignes d'objets tenus, même désélection de l'attaque dont l'arme est rangée. **Les armes en main du
  PNJ actif sont désormais DÉRIVÉES de son inventaire** (`lib/pnjHandEquipment.js`, mêmes règles `resolveHandWeapons` et même forme
  `inv_id` / `name` / `slot` que la route `combat-equipment`, 5 tests) au lieu de l'instantané `combat-equipment` chargé une seule fois
  par carte — donc plus périmées après une permutation ou un lancer de grenade [OBSERVÉ dans le code : `setEquipment` n'est appelé qu'au
  changement de carte]. Tant que l'inventaire n'est pas chargé (ou en erreur : `items: null`), la fenêtre garde l'instantané serveur.
  `buildGmDeclarePayload` : `replaceItemId` (1 test). **L'ancienne section « Prendre en main » disparaît** : prop `grab` de
  `CombatDeclareActionList`, clés `declareList.groupGrab / grabBeltCost / grabBagCost / grabTitle`. Vérifié : eslint (l'unique erreur
  `set-state-in-effect` et les avertissements `exhaustive-deps` du fichier existaient avant), `npm run build`, shared 809, client 337,
  DB 79, `git diff --check`, aucun résidu. **Non testé : tout l'écran MJ.** Description initiale :
  Même principe, dérivation depuis l'inventaire du PNJ actif.
- **Clôture.** Règle 10 : documentation, JOURNAL8, VOCABULARY (« permuter », distinction avec Rangée / Au clair), CHANGELOG, archivage.
- **Suite — v2 :** `PLAN_OBJETS_AU_SOL.md` (cadrage, non commencé).

## 7. Risques et parades

| Risque | Parade |
|---|---|
| Capacité jamais vérifiée : inventaires déjà « trop pleins » | R5 « ne jamais empirer » ; une arme plus légère que l'entrante rentre toujours |
| Refonte transactionnelle d'une fonction centrale (`updateItem`) sans filet réel | **A0-0 : tests de caractérisation d'abord**, puis scission ; comportement inchangé pour la route ; une seule route appelante |
| Refonte de dérivation dans une fenêtre de ≈ 1 300 lignes | Fonction pure testée ; mêmes noms de variables ; `useMemo` (une identité stable évite les boucles d'effets, dont celui qui recale le mode de tir sur `assaultWeapons`) |
| Fenêtre MJ dérivée d'une autre route | Lot C séparé, après le joueur |
| Le bouclier n'a aujourd'hui aucune ligne dans la fenêtre (les lignes d'« armement » ne listent que des armes : `isWeaponItem`) | Lot B : une ligne d'objet tenu non-arme, avec ⇄ mais sans attaque ; `handSlotDisplayRows` reste l'autorité de l'ordre |
| Un refus de `applyItemUpdate` sans code exploitable | Lot A0 : codes additifs sur les `AppError` du chemin « équiper » (statut et message inchangés pour la route) |
| L'inventaire effectif diverge du serveur | Le serveur re-dérive tout depuis la base ; `planHandSwap` et `planStowDestination` partagés ; l'aperçu n'est jamais l'autorité |
| Capacité `null` (bouteille en emplacement `D`) | Traitée « sans limite » ; documentée |
| Poids seedé qui change l'encombrement des personnages existants | Annoncé (Lot 0) ; effet voulu (les grenades pèsent) |
| Fiche libre : le coût de « Permuter » est contournable | Décision assumée (R13), consignée au JOURNAL8 |
| Permutation refusée faute de place en pleine partie (arme lourde ↔ grenade de la Ceinture) | Décision assumée (R17) : message clair, aucun objet ne bouge ; la v2 (sol) lèvera la limite. Le cas d'origine (main vide après un lancer) passe par « Mains nues », sans arme sortante |
| Deux écritures concurrentes sur les mains | `23505` traduit en refus `HANDS_FULL` ; 2M + MG reste un contrôle applicatif (limite existante, documentée) |
| Fichiers du chantier drone mêlés dans le worktree | Staging par fichier / hunk au commit (`git apply --cached`) |

## 8. Code v1 déjà présent (non commité) — gardé / refait

- **Gardé :** `shared/combatGrabItem.js` (coûts, exclusivité) ; poste `grab` de `combatIniCost.js` et ajout aux listes d'exclusivité ;
  `describeGrabCandidate` ; `combatGrabService.js` (chat, à étendre : R14, R17 ; diffusion via `inventoryBroadcast.js`) ; branche de
  résolution des actions simples ; correctif `consumeThrownGrenade` (diffusion + « grenades restantes », diffusion via
  `inventoryBroadcast.js`) ; clés de chat ; `grabCheck` / `hasSomethingToDeclare` ; payload `grab`.
- **Refait :** `takeItemInHand` → `swapItemInHand` ; `isGrabbableRef` / `pickFreeHandSlot` → `getSlotInfo` partagé + `planHandSwap`
  (les tests v1 « bouclier exclu » de `combatGrabItem.test.mjs` et `grabList.test.mjs` deviennent « bouclier accepté ») ;
  **`grabList.js` : regroupement à empreinte d'état** (et ses tests : le test « regroupe les exemplaires identiques » devient « …
  d'état identique », plus un test « armes à chargeur différent = deux lignes ») ; validation d'annonce (arme sortante, une
  permutation par Tour, arme entrante acceptée en main) ; l'interface : la section « Prendre en main » (`CombatDeclareActionList` prop
  `grab`, câblages des Lots 1b / 1c) est remplacée par le bouton « Permuter » et le panneau ; `inventoryGrab.test.mjs` (fixtures base)
  et `combatGrabService.test.mjs`.
- **Dette existante, non traitée ici :** les messages d'erreur d'annonce sont émis en français littéral par le serveur
  (`COMBAT_DECLARE_ERROR`, aucun n'utilise `i18nKey` aujourd'hui) — la v1 suit le voisinage ; la résolution, elle, utilise bien des clés.

## 9. Hors périmètre / V2

« À terre » réel — **`PLAN_OBJETS_AU_SOL.md`** (v2) ; repli d'une arme sortante vers l'autre conteneur (v2, avec le sol) ; exo-armure et drone ; hors combat (l'équipement reste
libre) ; verrou de la fiche en combat (R13) ; objets non tenables (aucun objet non-arme en `M` / `2M` dans le catalogue aujourd'hui) ;
armes sur trépied pur (`Tr`) ; refonte de la capacité des conteneurs (jauge par conteneur, refus d'ajout) ; poids manquants des autres
armes (17 armes `M` sans poids : ticket de données) ; règle « première mise en main = vide » (écartée, R16) ; divergence
`weaponAmmoStatus(null)` = vide / `hasEnoughAmmo(null)` = suivi désactivé pour une arme jamais initialisée hors permutation (aucun cas
en base locale).

## 10. Validation

Tests : `shared` (capacité cumulée, plan d'échange, destination, emplacements, coûts, exclusivité), `server` (résolution et chat sans
base ; inventaire, caractérisation et transaction à fixtures base, lancés par Saar), `client` (inventaire effectif, liste à empreinte
d'état, vérifications, payload). Scénario réel (Saar) : lancer, permuter avec une grenade de la Ceinture, permutation au Sac (usage au
Tour suivant), permutation Ceinture + tir du même Tour, deux-mains entrant (les deux armes rangées ; avec un bouclier en main, il sort
aussi), bouclier permuté comme une arme, Mains nues, refus (Sac absent, couches d'armure pleines pour le bouclier, **arme trop lourde
pour le conteneur : rien ne bouge, message clair**) avec annulation de l'attaque dépendante dite au chat.

## 11. Clôture (Règle 10)

Archivage de ce plan ; état stable dans `SYSTEME/COMBAT.md` / `COMBAT_FLUX.md` / `CHARACTER.md` ; `ROADMAP` / `INDEX` ;
`JOURNAL8` (dont la décision Ceinture / Sac, la règle de capacité, le refus faute de place, la fiche non verrouillée, le poids des
grenades) ; `VOCABULARY` ; `CHANGELOG`.
