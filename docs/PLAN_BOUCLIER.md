# PLAN_BOUCLIER.md — Implantation des règles de Bouclier (LdB, `docs/REGLES/REGLEBOUCLIER.md`)

> Créé : 2026-07-17 (dev/Saar). Statut : **Lots A, B et C codés et testés. Chantier fonctionnellement
> complet — reste la validation navigateur de Lot C par Saar avant clôture définitive.**
>
> ⚠️ **Correction post-code** : §0 affirmait à tort "jamais seedée en base" pour la catégorie
> Bouclier — faux, vérifié en pratique (pas en lecture seule) au moment de coder la migration : 3
> lignes catalogue existaient déjà (créées 2026-05-06, import Excel historique jamais tracké en
> migration), l'une équipée par un personnage réel. Un premier essai de migration a créé des
> doublons puis, en testant son `down()`, supprimé par erreur les 3 lignes d'origine (`DELETE WHERE
> category='Bouclier'` sans distinguo) — repéré et réparé immédiatement (réinsertion byte-for-byte
> depuis les données capturées avant coup, ré-attachement du `char_inventory.equipment_id` cassé,
> vérifié). Migration 168 finale : `UPDATE` en place des 3 lignes existantes (même patron que
> `142_ref_equipment_lunette_niveaux.js`), jamais un `INSERT`/`DELETE` par catégorie. Cycle
> up/down/up revalidé après coup, aucune perte résiduelle.
> Document temporaire (`docs/RegleDocumentaire.md` Règle 10) — à archiver dans `docs/Old/` une fois
> le chantier clos, contenu durable transféré vers `docs/SYSTEME/COMBAT.md`/`docs/VOCABULARY.md`.

---

## 0. Cadrage — ce qui est réellement vrai aujourd'hui

**RAW réel** `[VÉRIFIÉ]` (`docs/REGLES/REGLEBOUCLIER.md`, relu après correction d'un copier/coller
erroné en session) :

- **Au contact** : le bouclier porté impose un **malus au Test d'attaque de l'adversaire** (pas un
  bonus d'opposition au porteur — différent de « Combat à deux armes »). Trois paliers indicatifs
  donnés par le texte lui-même : Petit (30-50cm) **-3**, Moyen (50cm-1m) **-5**, Grand (anti-émeute)
  **-7**.
- **À distance** (armes à feu) : aucun malus à l'adversaire. Le bouclier fonctionne comme une
  protection simple localisée : Petit protège le Bras tenant le bouclier (+1 Localisation Corps/Tête
  via un Test de Chance réussi — mécanique simple, `1d20 ≤ char_sheet.chc`, voir Lot B) ; Moyen =
  Bras + 1 Localisation ; Grand = Bras + 2 Localisations (Corps, Tête ou Jambe du côté du bouclier).
- **Directionnel** : la protection ne vaut que si l'attaque peut être « interceptée » (un tir dans le
  dos l'ignore) — **décision Saar : pas d'automatisation, pas de notion de facing à construire dans le
  moteur monde pour ce chantier.**
- **Contre armes de jet/trait** (arcs, arbalètes, lance-harpons) : traité comme au contact (malus
  direct), pas comme protection à distance.
- Renvoi RAW explicite vers le système « protections et armures simples » déjà existant — confirme
  que la brique `protection`/`etq` déjà câblée est la bonne base, pas une nouvelle mécanique de
  protection à inventer.

**⚠️ Architecture des slots refondue depuis la rédaction initiale de ce plan (2026-07-17,
`docs/PLAN_INVENTORY_SLOTS.md`, clos et testé — commit `857becc`).** Tout ce qui suit reflète l'état
réel **après** cette refonte — l'ancienne description (colonne `char_inventory.slot`, requêtes `LIKE`,
branches `WEAPON_SLOTS.has`/`ARMOR_SLOTS.every`) n'existe plus du tout, ne pas coder dessus.

**Ce qui existe déjà et sera réutilisé** `[VÉRIFIÉ]` par lecture directe :

- **`char_inventory_slots`** (migration `162`, table, pas colonne) — une ligne par `(char_inventory_id,
  slot_code)`. Contrainte `UNIQUE` partielle sur les slots main/contenant (`MG,MD,2M,Tr,D,Ce` — un seul
  occupant possible) ; aucune contrainte d'unicité sur les slots armure (`T,C,BG,BD,JG,JD` — jusqu'à 3
  couches, règle 1+S+S toujours applicative, pas déclarative). `character_id` dénormalisé pour la
  contrainte. Index simple `(character_id, slot_code)` pour les lectures armure (perf combat).
- `server/src/services/inventoryService.js` — `VALID_SLOTS`/`ARMOR_SLOTS`/`WEAPON_SLOTS` (constantes
  de vocabulaire, inchangées). Trois nouvelles fonctions internes réutilisables telles quelles :
  - `_handSlotConflict(characterId, slotCodes, excludeItemId)` — un occupant existe-t-il déjà sur l'un
    de ces codes (main/contenant) ? Composite-safe (lit `char_inventory_slots`, plus d'égalité stricte
    sur une chaîne). **Le contrôle « main déjà occupée » du bouclier doit appeler cette fonction avec
    `['MG']` ou `['MD']`, pas réinventer une requête.**
  - `_armorSlotOccupants(characterId, slotCode, excludeItemId)` — occupants actuels d'un slot armure
    (pour la règle 1+S+S). **Le contrôle « localisation déjà pleine » du bouclier (Corps/Tête) doit
    appeler cette fonction pour chaque code de `shield_extra_locations`.**
  - `_writeSlots(trx, charInventoryId, characterId, slotValue)` — écrit l'état réel dans
    `char_inventory_slots` (supprime puis réinsère). Prend toujours une **chaîne `/`-jointe** en entrée
    (ex. `"MG/BG/C"`) et la découpe elle-même — le contrat d'entrée « chaîne composite » n'a donc pas
    changé, seul le stockage interne est normalisé. Appelée automatiquement par `addItem`/`updateItem`/
    `quickEquip` dans leur transaction — **aucun appel direct nécessaire depuis le code du bouclier**,
    juste construire la bonne chaîne avant l'appel à `updateItem`/`addItem` existant.
  - `getItemWithRef`/`getInventory` renvoient **`slots` (tableau)** — `char_inventory.slot` (texte)
    n'existe plus du tout (retiré migration `166`). Client déjà basculé sur `.slots` partout
    (`InventoryPanel`/`WeaponPanel`/`LocationPanel`/`ContainerPanel`/`CombatActionWindow`/
    `ExchangeWindow`).
- **Bonne nouvelle pour le Lot C (affichage combat)** : `battlemaps.js` (`/equipment`),
  `CombatGmDeclareWindow.jsx`, `CombatRosterWindow.jsx`, `MeleeCombatPanel.jsx` lisent déjà
  `char_inventory_slots` de façon générique et composite-safe (vérifié et testé pendant la refonte,
  y compris avec un objet `"MG/BG/C"` simulé — apparaît correctement à la fois comme occupant de main
  et comme pièce d'armure). Un bouclier catalogué devrait donc **déjà s'afficher correctement** dans
  ces fenêtres sans code supplémentaire, à vérifier en priorité avant d'écrire quoi que ce soit de
  neuf côté Lot C — seuls les filtres explicites `ref_category === 'Arme de contact'` continueront, à
  raison, d'exclure le bouclier des rôles « arme ».
- `shared/armorConstants.js` — fichier responsable de la topologie des slots/localisations
  (`SYMMETRIC_SLOT_PAIRS`, `SLOT_TO_REF_LOCATION`, `SLOT_TO_WOUND_LOCATION`, `LOC_TABLE`...). C'est
  ici, et pas dans `shared/polarisUtils.js` (formules numériques pures, aucune notion de slot), que
  vivra la table de correspondance main→bras (`HAND_TO_ARM_SLOT`, toujours pas encore ajoutée).
- `damageService.resolveTargetHit` (`server/src/lib/damageService.js:95-206`) — point d'insertion
  unique déjà en place pour toute résolution de dégâts côté cible (localisation D20 → armure → RD →
  sévérité → blessure → Choc). La protection à distance du bouclier s'y branche exactement comme une
  armure de plus — `[VÉRIFIÉ]` pendant la refonte : la requête `armuresSlot` (désormais sur
  `char_inventory_slots`, ligne ~121) ressort déjà tout item dont un `slot_code` correspond, **aucune
  modification nécessaire** dans ce fichier pour le bouclier.
- `server/src/socket/socketCombatHelpers.js:29-43` — `SITUATION_MODS`, liste fermée de modificateurs
  fixes appliqués au Seuil d'attaque (ex. `cac_position_avantageuse: 3`). Le malus CaC du bouclier
  n'y rentre **pas** tel quel : ce n'est pas un choix du MJ à la Déclaration, c'est une donnée dérivée
  automatiquement de l'équipement de **la cible** — nouveau point d'insertion à identifier avec
  précision dans le chemin de résolution CaC (voir Lot B). Ce même fichier contient déjà, depuis la
  refonte, plusieurs requêtes de ce type exact (`defContactWeapons` ~ligne 599, jointure
  `char_inventory_slots as cis` + `ref_equipment`, filtrée par catégorie) — **modèle direct à copier**
  pour la requête « bouclier de la cible » du Lot B.
- Catalogue historique `docs/Old/script Extraction Excel/equipement/ref_equipments_data.js:9775-9836`
  — 3 lignes `EQ_00350/351/352`, famille `Protections`, catégorie `Bouclier`. **Correction (§ statut
  en tête de document) : ces 3 lignes sont bel et bien déjà en base** (créées 2026-05-06, hors
  migration trackée), pas un catalogue à créer — migration 168 les a **mises à jour en place**
  (`location: 'B' → 'M'`, ajout `shield_atk_malus`/`shield_extra_locations`), jamais insérées à neuf.
  Prix/poids/rareté/min_str/description d'origine déjà identiques à la source Excel, non retouchés.

**Absent aujourd'hui** `[VÉRIFIÉ]` par recherche exhaustive (grep `bouclier` sur `server/src` et
`shared/`) : aucune trace de mécanique bouclier dans le code. Terrain neuf, aucun piège connu
(`docs/SYSTEME/CONVENTIONS.md` §19 vérifié, aucune entrée).

---

## 1. Scope tranché

**Inclus** : le bouclier catalogué (Petit/Moyen/Grand), porté en `MG` ou `MD`, avec ses deux effets
RAW (malus CaC à l'adversaire, protection localisée à distance).

**Exclus, décision explicite Saar cette session** : Boucliers improvisés et Barrières (optionnel) —
**non implantés**. Ce sont des valeurs déclarées au cas par cas par le MJ, jamais cataloguées ; elles
resteront un outil narratif pur, hors système, pas de code pour ce chantier.

Hors scope confirmé plus tôt dans la réflexion : Champs de force personnels (paragraphe voisin dans
le même extrait RAW, sujet distinct — protection intégrale futuriste, pas un bouclier physique).

---

## 2. Terminologie — `docs/VOCABULARY.md`

Aucune entrée « Bouclier » n'existe aujourd'hui dans `docs/VOCABULARY.md` (vérifié). À ajouter avant
le code (`CLAUDE.md` §2) : définition du terme, distinction avec Armure/Protection simple, et la
table des 3 paliers (Petit/Moyen/Grand) avec leurs deux valeurs (malus CaC fixe, Protection variable
3-10 « selon solidité »).

---

## 3. Décisions verrouillées cette session

1. **Un seul objet, plusieurs lignes `char_inventory_slots`** — pas deux entités séparées (item-arme
   + item-armure liés par une contrainte). Le bouclier occupe une main **et** protège une/des
   localisation(s) sous la même ligne `char_inventory` (un seul `char_inventory_id`, plusieurs
   `slot_code` — `MG`, `BG`, `C`). Choix motivé : évite de dupliquer la logique de protection dans un
   2ᵉ chemin de code (viole §1.4 CLAUDE.md — autorité unique) et colle à la réalité RAW (un seul objet
   physique). Mécaniquement inchangé depuis la refonte : le contrat d'entrée (`updateItem`/`addItem`
   reçoivent toujours une chaîne `/`-jointe, ex. `"MG/BG/C"`) est identique, seul le stockage interne
   (`char_inventory_slots` au lieu d'une colonne texte) a changé — voir §0.
2. **Table de correspondance main→bras** : nouvelle constante `shared/armorConstants.js`, aux côtés
   de `SYMMETRIC_SLOT_PAIRS` (même fichier, même responsabilité), ex. `HAND_TO_ARM_SLOT = { MG: 'BG',
   MD: 'BD' }`.
3. **Le malus CaC est automatique, jamais un choix MJ manuel** — dérivé de l'équipement de la cible au
   moment de la résolution, comme l'armure l'est déjà pour les dégâts. Cohérent avec « le serveur
   reste autoritaire » (`CLAUDE.md` §7).
4. **Directionnalité (interception) : non automatisée.** Pas de notion de facing à construire dans le
   moteur monde pour ce chantier — reste un jugement narratif MJ hors système, jamais un calcul
   spatial. Ne contredit pas l'autorité unique du `WorldSnapshot` (§8 CLAUDE.md) puisqu'aucune
   prétention à calculer une donnée spatiale n'est faite.
5. **« +1/+2 Localisation » figé au catalogue, jamais un choix joueur/MJ à l'équipement.** Cohérent
   avec tout le reste du système (aucun autre équipement ne demande « quelles localisations couvrir »)
   et évite le min-max (le joueur choisirait systématiquement Tête). Répartition retenue par défaut :
   Moyen → Bras+Corps ; Grand → Bras+Corps+Tête (le corps d'abord, la tête ensuite ; la jambe jamais
   retenue par défaut — la moins naturellement interposée par un bouclier tenu à hauteur de buste).
   Nouvelle colonne catalogue portant cette donnée fixe (ex. `ref_equipment.shield_extra_locations`,
   valeurs `null`/`'C'`/`'C/T'`) — combinée par le serveur avec `HAND_TO_ARM_SLOT` au moment de
   l'équipement pour construire le `slot` composite final ; le joueur choisit seulement la main.
6. **Discriminant catalogue** : réutiliser `ref_equipment.category = 'Bouclier'` (déjà le nom retenu
   dans les données Excel historiques) comme marqueur permettant à `updateItem` de reconnaître le cas
   spécial « slot composite main+armure », plutôt qu'une nouvelle colonne booléenne dédiée.
   `[VÉRIFIÉ]` après coup (§7, analyse à charge) : `family`/`category` sont bien deux colonnes
   `text().notNullable()` distinctes du schéma réel (`server/src/db/migrations/48_ref_equipment.js:
   22-23`) — l'hypothèse tient.
7. **Test de Chance du Petit bouclier : implanté fidèlement, RAW intégral.** Décision Saar — aucune
   raison de s'écarter de la règle. Annule la recommandation de simplification initialement proposée
   dans ce plan (voir §7, l'analyse à charge en tire les conséquences architecturales réelles).
8. **`malus_cat = 'S'`** pour les 3 lignes catalogue bouclier — aucun malus de compétence
   supplémentaire au-delà des effets déjà décrits par le RAW (décision Saar).
9. **Discriminant arme à feu / arme de jet-trait à distance : `ref_equipment.category`.**
   `[VÉRIFIÉ]` : colonne déjà utilisée en production exactement dans ce rôle (`re.category = 'Arme de
   contact'`, `socketCombatHelpers.js:431` et `484`, pour distinguer les armes de contact en CaC) —
   même colonne, même logique pour distinguer armes de trait (arcs/arbalètes) des armes à feu à
   distance. Valeur catalogue exacte des armes de trait non lue cette session (donnée à relever dans
   le catalogue au moment du Lot B, plus une question de conception).
10. **Composition du slot composite : dans `updateItem` (`inventoryService.js`).** Décision technique
    tranchée (déléguée par Saar) : le client envoie uniquement le choix de main (`MG`/`MD`) — quand
    `category === 'Bouclier'`, le serveur complète automatiquement la chaîne `/`-jointe avec
    `HAND_TO_ARM_SLOT` + `shield_extra_locations` du catalogue **avant** de la passer au flux existant
    (validation puis `_writeSlots` s'en charge, aucun nouvel appel à écrire). Aucune logique de
    composition côté client — cohérent avec « le serveur reste autoritaire » et « pas de logique
    métier dupliquée » (`CLAUDE.md` §7). Le contrôle de conflit qui suit doit réutiliser
    `_handSlotConflict`/`_armorSlotOccupants` (§0) — ne pas écrire une 3ᵉ variante de ces contrôles.
11. **`resolveMeleeAction` confirmé attaquant uniquement.** `[VÉRIFIÉ]` (lecture complète,
    `socketCombatHelpers.js:327-546`) : `character` est bien l'attaquant (`sheetAttaquant`,
    `invAttaquant` ligne 417-422) ; aucune donnée de la cible n'y est fetchée aujourd'hui hormis sa
    position (`measureBattlemapTokenDistance`) et son décompte dans `rosterTokens` pour le malus
    multi-adversaires. Le Lot B doit ajouter une requête dédiée : `targetTokenId` → `character_id` →
    `char_inventory`/`ref_equipment` filtrée `category = 'Bouclier'` et slot couvrant `MG`/`MD`.
12. **Valeurs catalogue Protection : Petit 10, Moyen 10, Grand 15** (malus CaC RAW inchangé : -3/-5/-7).

---

## 4. Points ouverts restants

Tous les points soulevés par l'analyse à charge (§7) ont été tranchés en session (§3, points 8-12).
Ne reste qu'un point routine, jamais une vraie question de conception :

- **Prochain numéro de migration** (pair, Saar) — non fixé ici. `[VÉRIFIÉ]` 2026-07-17 : dernières
  migrations réelles `162`/`164` (parallèle)/`166` — **168** libre au moment de la rédaction, mais
  ré-auditer (`server/src/db/migrations` + `knex_migrations`) au moment du code (`CLAUDE.md` §5), la
  session parallèle (Tir visé) peut avoir avancé entre-temps.

---

## 5. Lots séquentiels proposés (un seul codé à la fois, validé avant le suivant)

**Lot A — Fondations données. ✅ Codé et testé réel (2026-07-17).**
- Migration `168_ref_equipment_bouclier.js` : colonnes `ref_equipment.shield_atk_malus` (int, CHECK
  `< 0`) et `shield_extra_locations` (texte, CHECK `IN ('C','C/T')`). **Pas un seed** — `UPDATE` en
  place des 3 lignes déjà existantes (voir correction §0/statut) : `location: 'B' → 'M'`,
  `shield_atk_malus`/`shield_extra_locations` renseignés. `protection` déjà correct en base (10/10/15),
  non retouché. `down()` restaure `location='B'` et vide les 2 colonnes (jamais de `DELETE` par
  catégorie — a causé un incident data en session, réparé, voir statut en tête de document).
- `shared/armorConstants.js` : `HAND_TO_ARM_SLOT = { MG: 'BG', MD: 'BD' }` ajouté.
- `inventoryService.js` (`updateItem`) : nouvelle branche dédiée avant le `if/else` slot existant —
  détecte `ref_equipment.category === 'Bouclier'` sur l'item, exige que le client envoie uniquement
  `MG`/`MD` (400 sinon), compose la chaîne `/`-jointe `[main, HAND_TO_ARM_SLOT[main], ...
  shield_extra_locations]`, puis réutilise tel quel `_handSlotConflict` (main) et
  `_armorSlotOccupants` (chaque localisation supplémentaire, règle 1+S+S) — branche séparée de
  `WEAPON_SLOTS`/armure générique (P58 structurellement inapplicable : un bouclier ne couvre jamais
  BG **et** BD à la fois). `addItem`/`quickEquip` volontairement non touchés (décision §3.10) : un
  bouclier ne peut donc être équipé qu'en pose manuelle post-ajout (`updateItem`), jamais en un seul
  appel équiper-à-l'achat — cohérent avec le comportement déjà existant de tout item multi-slot.
- `docs/VOCABULARY.md` : entrée Bouclier ajoutée.
- **Testé** (personnage jetable, nettoyé, 0 résidu) : Petit→MG (BG+MG), conflit main (MG déjà
  occupé), Moyen→MD (BD+C+MD), conflit main (MD déjà occupé), déséquipement, Grand→MD (BD+C+MD+T),
  slot C complet à 3 couches (409), main invalide (400), ré-équipement libre avec S+S (deux boucliers
  cumulant `C`). 9/9 scénarios OK. **Non testé** : parcours navigateur (aucune UI dédiée avant Lot C —
  seul `updateItem` via un appel direct/`InventoryPanel` générique a été exercé).

**Lot B — Résolution combat. ✅ Codé et testé réel (2026-07-17).**

⚠️ **Découverte en codant, pas anticipée par la rédaction initiale** : le RAW sépare strictement les
deux effets par TYPE d'attaque, pas par fonction de résolution — « au contact » = malus seul, jamais
de protection ; « à distance (armes à feu) » = protection seule, jamais de malus. Sans garde-fou,
la requête `armuresSlot` déjà existante dans `resolveTargetHit` aurait accordé la Protection du
bouclier même à un coup au contact tombant sur le Bras (elle ne distingue pas le type d'attaque).
Nouveau paramètre `treatAsContact` (booléen, défaut `false`) ajouté à `resolveTargetHit` : exclut le
bouclier de la résolution armure quand `true`. `true` pour tout CaC, et pour toute arme à distance de
catégorie `'Armes de jet'`/`'Arme de trait'` (§3.9 — RAW : jet/trait "traité comme au contact") ;
`false` (comportement historique) pour les armes à feu.

- **Malus CaC à l'adversaire** — `resolveMeleeAction` (`socketCombatHelpers.js`) : nouvelle requête
  ajoutée au `Promise.all` existant (`targetTokenId` → bouclier équipé via `char_inventory_slots` +
  `tokens`, catégorie `'Bouclier'`), calculée AVANT le jet d'attaque (le jet et son émission
  `DICE_RESULT` ont lieu immédiatement après `chancesAttaque`, pas après le fetch cible habituel) —
  pliée dans `chancesAttaque` + breakdown (« Bouclier adverse »). `treatAsContact: true` passé aux 2
  appels `resolveTargetHit` liés au CaC (PNJ auto-résolu + `COMBAT_MELEE_DEFENSE_CONFIRM` PNJ-attaquant
  dans `socketCombatResolution.js`).
- **Malus jet/trait à l'adversaire + exclusion protection** — `resolveAssaultAction` : même malus,
  seulement quand `ref_equipment.category` de l'arme tirée est `'Armes de jet'` ou `'Arme de trait'`
  (valeurs catalogue réelles confirmées en session, remplaçant le point ouvert §3.9). Aucun malus pour
  une arme à feu. `treatAsContact: isJetOuTrait` passé à `resolveTargetHit` (branche PNJ immédiate) et
  ajouté au payload `combat_pending` (branche PJ différée, relu et transporté par
  `socketCombatResolution.js` `COMBAT_DAMAGE_CONFIRM`, qui dérive aussi `treatAsContact: true`
  automatiquement pour tout `pendingType === 'melee'`).
- **Protection à distance (armes à feu, Bras automatique + Moyen/Grand)** : confirmé sans modification
  — la requête `armuresSlot` existante ressort déjà le bouclier quand `treatAsContact` est `false`.
- **Petit bouclier — Test de Chance** : implanté dans `resolveTargetHit`, `1d20 ≤ char_sheet.chc`,
  déclenché uniquement quand `!treatAsContact` ET localisation Corps/Tête ET un Petit bouclier
  (`shield_extra_locations IS NULL`, le distingue de Moyen/Grand) est équipé — succès → sa Protection
  rejoint le calcul `calcResistanceArmure` comme une couche d'armure de plus ; échec → rien. Résultat
  du jet (`rollChance`/`chanceRolls`/`chanceSeed`/`chanceSuccess`) retourné par `resolveTargetHit`
  mais **pas encore diffusé** en `DICE_RESULT` (même sort que `rollLoc` — l'émission se fait dans les
  handlers appelants, pas dans `damageService.js` — affichage repoussé au Lot C, comme
  `damageService.js` le fait déjà pour `rollLoc`).
- **Hors scope confirmé, non traité** : `resolveDroneAssaultAction` (armes de drone) — jamais
  `treatAsContact`, toujours traité comme arme à feu par défaut. Aucune arme de jet/trait connue côté
  drone à ce jour ; à revoir seulement si un cas réel apparaît.
- Non-régression déjà vraie sans code dédié : un bouclier en `MG` bloque l'équipement d'une arme dans
  `MG`/`2M` (occupation de slot ordinaire) — aucune interaction avec « Combat à deux armes ».

**Testé** (personnage + token jetables, nettoyés, 0 résidu) : Petit bouclier protège le Bras sans Test
de Chance ; Test de Chance Corps réussi (`chc=20`) applique la Protection ; Test de Chance Corps
échoué (`chc=0`) n'applique rien ; `treatAsContact=true` exclut totalement le bouclier (Bras compris) ;
Moyen bouclier protège Corps automatiquement sans Test de Chance ; requête du malus CaC retourne la
bonne valeur pour un bouclier équipé. 12/12 assertions OK.
**Testé en combat réel, confirmé fonctionnel par Saar (2026-07-17)** — scénario de bout en bout via
Socket.IO/FSM validé en jeu, en complément des 12 assertions unitaires ci-dessus.

**Lot C — UI équipement/combat. ✅ Codé et vérifié (2026-07-17), navigateur non testé.**

- **Confirmé sans code neuf** : `battlemaps.js` (`weaponRows`/`armorRows`, `[VÉRIFIÉ]` lu en détail) —
  un bouclier apparaît déjà naturellement dans les deux listes (main via `weaponRows`, corps via
  `armorRows` qui inclut tout item `family='Protections'` ayant au moins un `slot_code` hors main/
  contenant) ; `CombatGmDeclareWindow.jsx`/`CombatRosterWindow.jsx`/`MeleeCombatPanel.jsx` affichent
  ces listes génériquement, aucune hypothèse `ref_family==='Armes'` qui exclurait un bouclier. Le
  malus CaC/jet-trait (breakdown Lot B) s'affiche déjà aussi sans code neuf : `DiceBreakdownPopover`
  (`Sidebar.jsx`) rend n'importe quel `msg.breakdown` générique — l'entrée « Bouclier adverse » ajoutée
  en Lot B y apparaît automatiquement.
- **`inventoryService.js`** : `getItemWithRef`/`getInventory` — 2 colonnes ajoutées au SELECT
  (`ref_shield_atk_malus`, `ref_shield_extra_locations`), absentes jusqu'ici, nécessaires pour tout
  affichage client des stats bouclier.
- **`WeaponPanel.jsx`** — corrigeait le bug original (« pas équipable dans l'emplacement dédié ») :
  `availableWeapons` élargi (`ref_family==='Armes' OU ref_category==='Bouclier'`, `ref_location`
  reste `'M'` donc `getSlotInfo` route déjà correctement vers `1H`/`MG`/`MD` sans changement). Badge de
  main corrigé (`slots[0]` n'est plus fiable pour un slot composite trié alphabétiquement, ex.
  `['BG','C','MG']` — nouveau helper `handSlotOf` qui cherche explicitement le code main). Stats
  dédiées ajoutées (malus CaC adverse, Protection à distance, localisations couvertes). `handleEquipItem`
  et l'unequip (`slot: null`) déjà composite-safe sans changement (opèrent uniquement sur des codes de
  main, jamais sur le détail des localisations).
- **`LocationPanel.jsx`** — bug réel trouvé en concevant Lot C, pas dans le plan initial : un bouclier
  équipé apparaît normalement dans les panneaux Bras/Corps/Tête concernés (affichage générique déjà
  suffisant), mais son bouton « × » y appelait `handleUnequip` avec un retrait partiel d'un seul
  `slot_code` — rejeté par le serveur (`updateItem` n'accepte que `MG`/`MD`/`null` pour un Bouclier,
  jamais une chaîne composite partielle). Corrigé : `handleUnequip` détecte `ref_category==='Bouclier'`
  et envoie toujours `slot: null` (déséquipement complet, main comprise) ; tag visuel « (bouclier) » +
  tooltip explicatif ajoutés pour que le comportement tout-ou-rien ne surprenne pas.
- **Test de Chance du Petit bouclier** : diffusion `DICE_RESULT` ajoutée dans
  `socketCombatResolution.js` (`COMBAT_DAMAGE_CONFIRM`), même patron exact que la carte `rollLoc`
  existante (`rollChance`/`chanceRolls`/`chanceSeed` retournés par `resolveTargetHit`, nouveau
  `chanceThreshold` ajouté au retour pour afficher le seuil réel testé).
- **`ContainerPanel.jsx`** : confirmé non concerné (slots `D`/`Ce`, aucun rapport avec le bouclier).
- **Tension i18n non résolue, signalée plutôt que tranchée seul** : `WeaponPanel.jsx`/`LocationPanel.jsx`/
  `InventoryPanel.jsx`/`ContainerPanel.jsx` n'utilisent `useTranslation` nulle part (`[VÉRIFIÉ]` grep,
  contrairement à `AdvantagesPanel.jsx`/`SkillsPanel.jsx` et consorts qui l'utilisent) — zone legacy
  antérieure au rollout i18n. Nouveau texte de ce Lot C écrit en dur, cohérent avec la convention
  locale de ces 4 fichiers précis, mais contraire à la règle générale `.claude/rules/react.md`
  (« jamais de string codée en dur »). Retrofit i18n de ces 4 fichiers explicitement hors scope de ce
  chantier (des dizaines de chaînes déjà en dur, chantier séparé) — signalé pour arbitrage, pas décidé
  unilatéralement.
- **Testé** : `getItemWithRef` renvoie bien les 2 nouvelles colonnes après équipement réel (personnage
  jetable, 0 résidu) ; ESLint 0 erreur sur les 3 fichiers client touchés ; lecture complète confirmant
  qu'aucun autre consommateur (`battlemaps.js`, fenêtres combat) ne suppose `ref_family==='Armes'` de
  façon excluante.
- **Non testé** : parcours navigateur réel (équiper un bouclier via `WeaponPanel`, vérifier son
  affichage dans `LocationPanel`, le déséquiper depuis chaque endroit, observer le breakdown CaC et la
  carte Test de Chance en combat réel) — nécessaire avant clôture définitive du chantier.

---

## 6. Hors scope (rappel)

Boucliers improvisés, Barrières (optionnel), Champs de force personnels — aucun code prévu dans ce
plan. Si un chantier futur les reprend, il fera l'objet d'un nouveau plan séparé (§6.8 CLAUDE.md — un
plan ne couvre qu'un seul problème à la fois).

---

## 7. Analyse à charge (2026-07-17, demandée par Saar avant tout code)

Relecture critique du plan initial, avec vérifications réelles (grep/lecture de code) plutôt que
suppositions. 7 constats, du plus au moins structurant :

1. **Le Test de Chance du Petit bouclier était sous-évalué.** Grep exhaustif (`server/src`) : aucune
   mécanique « Test de Chance » (l'Attribut Chance, pas le mot générique « chances » utilisé partout
   pour désigner un seuil de réussite, ex. `chancesDeReussite`/`chancesAttaque`) n'existe dans le
   code. Ma première rédaction du plan traitait ça comme un point ouvert d'une ligne à trancher ;
   après relecture, c'est potentiellement le morceau le plus complexe du chantier — un jet réactif en
   plein milieu d'une résolution combat aujourd'hui strictement synchrone (`resolveTargetHit`), ce qui
   peut toucher la FSM combat (`combatFSM.js`). Correction : isolé dans son propre Lot C plutôt que
   noyé dans le Lot B.
2. **`ref_equipment.malus_cat` n'était pas du tout traité, alors que le schéma l'exige.** `[VÉRIFIÉ]`
   (`server/src/db/migrations/48_ref_equipment.js:83`) : contrainte `CHECK malus_cat IN
   ('S','A','B','C','D')`, obligatoire par ligne catalogue. Absent du Lot A initial — ajouté en point
   ouvert §4.
3. **`family`/`category` confirmés a posteriori, pas avant de les utiliser comme décision verrouillée.**
   `[VÉRIFIÉ]` maintenant (`48_ref_equipment.js:22-23`, deux colonnes `text().notNullable()`)  —
   l'hypothèse du §3.6 s'avère juste, mais elle avait été écrite avec plus de certitude que ce qui
   avait réellement été vérifié au moment de la rédaction. Corrigé rétroactivement dans le texte.
4. **`resolveMeleeAction` : localisé mais pas lu.** `[VÉRIFIÉ]` : `socketCombatHelpers.js:327`. Reste
   un vrai risque non résolu : son paramètre s'appelle `character` (probablement l'attaquant) — si la
   cible n'est pas déjà résolue à cet endroit du flux CaC, remonter son équipement pour calculer le
   malus n'est pas immédiat. À lire en entier avant d'écrire une seule ligne du Lot B.
5. **La composition du slot composite n'avait pas de point d'ancrage précis.** Le plan disait
   « combinée par le serveur au moment de l'équipement » sans dire où (`updateItem` ? un nouvel
   endpoint ?) ni comment le client est censé interagir (envoi d'un simple choix de main, réécriture
   silencieuse du `slot` côté serveur — pattern qui n'existe nulle part ailleurs dans le code
   aujourd'hui). Ajouté en point ouvert §4, à trancher avant le Lot A.
6. **Aucune valeur numérique concrète proposée pour le Lot A.** « Valeur par défaut raisonnable à
   documenter » n'est pas une donnée de seed exploitable. Un item catalogué (contrairement au bouclier
   improvisé, exclu du scope) a besoin de chiffres réels avant migration.
7. **L'asymétrie de la directionnalité écartée était insuffisamment soulignée.** Le RAW appelle
   explicitement l'inefficacité dos-tourné dans le paragraphe *distance* (« si le personnage subit un
   tir venant de l'arrière, le bouclier sera inefficace »), pas dans le paragraphe CaC. En écartant la
   directionnalité partout (décision confirmée, §3.4), la divergence RAW réelle se concentre
   précisément là où le texte insiste le plus — à garder en tête si Saar revient un jour sur ce point,
   plutôt qu'une déviation mineure symétrique aux deux cas.

**Conclusion** : aucun changement de scope (§1 inchangé). Les 5 points structurants ont été tranchés
en session (§3, points 8-12) : `malus_cat='S'`, discriminant `category` confirmé réutilisable,
composition du slot composite décidée (`updateItem`, serveur autoritaire), `resolveMeleeAction`
confirmé attaquant-only (nouvelle requête cible à ajouter), valeurs catalogue chiffrées (10/10/15).
Correction supplémentaire post-analyse : le Test de Chance du Petit bouclier, initialement estimé
comme le point le plus complexe du chantier, s'avère en réalité trivial (`1d20 ≤ char_sheet.chc`, jet
automatique sans interaction joueur) — Lot C annulé, refondu dans le Lot B. Plan prêt pour le Lot A.
