# PLAN_BOUCLIER.md — Implantation des règles de Bouclier (LdB, `docs/REGLES/REGLEBOUCLIER.md`)

> Créé : 2026-07-17 (dev/Saar). Statut : **prérequis levé — `docs/PLAN_INVENTORY_SLOTS.md` est
> intégralement clos (Lots A/B/C), `char_inventory_slots` est désormais l'autorité unique des slots
> d'équipement. Prêt pour le Lot A de ce plan.**
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

**Ce qui existe déjà et sera réutilisé** `[VÉRIFIÉ]` par lecture directe :

- `server/src/services/inventoryService.js:16-18` — `VALID_SLOTS`/`ARMOR_SLOTS` (`T,C,BG,BD,JG,JD`)
  / `WEAPON_SLOTS` (`MG,MD,2M,Tr`), deux familles aujourd'hui strictement disjointes et validées par
  deux branches étanches (`updateItem`, lignes 376-458) : `WEAPON_SLOTS.has(slot)` exact-match pour
  les armes, sinon split `/` + `every ARMOR_SLOTS.has` pour l'armure. **Un slot composite mêlant les
  deux familles (ex. `"MG/BG/C"`) est aujourd'hui rejeté** par cette 2ᵉ branche (`MG` ∉ `ARMOR_SLOTS`)
  — extension nécessaire, voir Lot A.
- `inventoryService.js:412-435` — mécanisme multi-slot déjà mature (`slot.split('/')`, requête `LIKE`
  PI8, règle P58 « un item à `ref_location` simple ne couvre qu'un seul côté symétrique », règle
  « 1+S+S » anti-cumul de couches) : directement réutilisable pour la partie « protection localisée »
  du bouclier, aucune nouvelle logique de protection à écrire.
- `shared/armorConstants.js` — fichier responsable de la topologie des slots/localisations
  (`SYMMETRIC_SLOT_PAIRS`, `SLOT_TO_REF_LOCATION`, `SLOT_TO_WOUND_LOCATION`, `LOC_TABLE`...). C'est
  ici, et pas dans `shared/polarisUtils.js` (formules numériques pures, aucune notion de slot), que
  vivra la table de correspondance main→bras.
- `damageService.resolveTargetHit` (`server/src/lib/damageService.js:95-206`) — point d'insertion
  unique déjà en place pour toute résolution de dégâts côté cible (localisation D20 → armure → RD →
  sévérité → blessure → Choc). La protection à distance du bouclier s'y branche exactement comme une
  armure de plus (même requête `armuresCible`, ligne 121-126).
- `server/src/socket/socketCombatHelpers.js:29-43` — `SITUATION_MODS`, liste fermée de modificateurs
  fixes appliqués au Seuil d'attaque (ex. `cac_position_avantageuse: 3`). Le malus CaC du bouclier
  n'y rentre **pas** tel quel : ce n'est pas un choix du MJ à la Déclaration, c'est une donnée dérivée
  automatiquement de l'équipement de **la cible** — nouveau point d'insertion à identifier avec
  précision dans le chemin de résolution CaC (voir Lot B).
- Catalogue historique `docs/Old/script Extraction Excel/equipement/ref_equipments_data.js:9775-9836`
  — 3 lignes `EQ_00350/351/352`, famille `Protections`, catégorie `Bouclier`, jamais seedées en base
  (aucune trace dans `server/src/db/migrations`). Valeurs de prix/poids réutilisables comme point de
  départ, mais **pas** les valeurs mécaniques (jamais chiffrées côté malus/protection dans ces
  lignes) — celles-ci viennent du RAW ci-dessus.

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

1. **Un seul objet, un seul `char_inventory.slot` composite** — pas deux entités séparées (item-arme
   + item-armure liés par une contrainte). Le bouclier occupe une main **et** protège une/des
   localisation(s) sous la même ligne d'inventaire, ex. `"MG/BG/C"`. Choix motivé : évite de dupliquer
   la logique de protection dans un 2ᵉ chemin de code (viole §1.4 CLAUDE.md — autorité unique) et
   colle à la réalité RAW (un seul objet physique).
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
    `category === 'Bouclier'`, le serveur complète automatiquement le `slot` avec `HAND_TO_ARM_SLOT`
    + `shield_extra_locations` du catalogue avant validation. Aucune logique de composition côté
    client — cohérent avec « le serveur reste autoritaire » et « pas de logique métier dupliquée »
    (`CLAUDE.md` §7).
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

- **Prochain numéro de migration** (pair, Saar) — non fixé ici, à auditer (`server/src/db/migrations`
  + `knex_migrations`) au moment du code (`CLAUDE.md` §5).

---

## 5. Lots séquentiels proposés (un seul codé à la fois, validé avant le suivant)

**Lot A — Fondations données.**
- Migration (numéro à auditer) : colonnes `ref_equipment.shield_atk_malus` (int, CaC), réutilisation
  de `ref_equipment.protection` existant (valeur à distance), nouvelle `shield_extra_locations`
  (texte, `null`/`'C'`/`'C/T'`). Seed des 3 lignes catalogue (Petit/Moyen/Grand), `category =
  'Bouclier'`, `malus_cat = 'S'`, valeurs RAW : malus CaC -3/-5/-7, Protection **Petit 10, Moyen 10,
  Grand 15**.
- `shared/armorConstants.js` : ajout `HAND_TO_ARM_SLOT = { MG: 'BG', MD: 'BD' }`.
- `inventoryService.js` (`updateItem`) : nouveau cas de validation slot composite pour
  `category === 'Bouclier'` — le client envoie uniquement la main choisie (`MG`/`MD`), le serveur
  construit `[MG|MD] + HAND_TO_ARM_SLOT + shield_extra_locations` avant validation, applique les
  contrôles de conflit des deux familles (main occupée comme une arme, 1+S+S côté localisations).
- `docs/VOCABULARY.md` : entrée Bouclier.

**Lot B — Résolution combat (les 3 paliers, y compris le Test de Chance du Petit bouclier).**
- Malus CaC à l'adversaire : nouvelle requête dans `resolveMeleeAction`
  (`socketCombatHelpers.js:327`, `[VÉRIFIÉ]` aucune donnée cible n'y existe aujourd'hui — §3.11) —
  `targetTokenId` → `character_id` → bouclier équipé (`category='Bouclier'`, slot `MG`/`MD`),
  application au Seuil d'attaque de l'attaquant, breakdown affiché (même pattern que
  `deuxArmesBonus`/`SITUATION_MODS`).
- Protection à distance (Moyen/Grand) : branchement dans `resolveTargetHit` — `[VÉRIFIÉ]` (§7) : le
  bouclier de la cible ressort déjà naturellement de la requête `armuresCible` existante (ligne
  121-126), aucune modification de cette requête nécessaire.
- **Petit bouclier — Test de Chance** : mécanique simple, confirmée en session — `1d20 ≤
  char_sheet.chc` (`[VÉRIFIÉ]` colonne existante, `36_char_sheet.js:30`, « Chance 1-20, aucun
  calcul »), jet automatique côté serveur au même titre que le jet de Localisation déjà présent dans
  `resolveTargetHit` (`damageService.js:108`) — aucune interaction joueur à attendre, aucun impact
  FSM (correction de l'analyse à charge §7.1, qui surestimait la complexité). Déclenché quand la
  Localisation tombe sur Corps/Tête et que la cible porte un Petit bouclier : succès → applique la
  Protection du bouclier à ce coup ; échec → aucune protection sur ce coup.
- Distinction arme à feu / jet-trait (§3.9, `ref_equipment.category`) tranchée et câblée.
- Non-régression à vérifier explicitement : un bouclier en `MG` bloque bien l'équipement d'une arme
  dans `MG` et d'une arme à 2 mains (conséquence naturelle de l'occupation de slot, pas une règle à
  coder séparément) — donc aucune interaction possible avec le bonus « Combat à deux armes ».

**Lot C — UI équipement/combat.**
- Affichage bouclier dans les panneaux d'inventaire existants (`InventoryPanel.jsx`/`WeaponPanel.jsx`/
  `LocationPanel.jsx` — à confirmer lesquels sont pertinents en lisant leur contenu avant modification).
- Affichage du malus/protection dans les fenêtres de déclaration/résolution combat existantes (même
  pattern que les autres breakdowns de Seuil), y compris le résultat du Test de Chance du Petit
  bouclier (même pattern d'affichage que le jet de Localisation).

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
