# PLAN_TAILLE.md — Taille de cible ⇄ dimensions des personnages

> **⚠️ 2026-09-08 — La documentation de référence est passée dans `docs/SYSTEME/TAILLE.md`**
> (RegleDocumentaire Règle 10). Ce plan ne conserve que le suivi de **D7** (retrait du
> modificateur de taille en zone d'effet) — différé tant que `socketCombatAoe.js` est en
> refonte par le chantier grenades parallèle. Quand D7 est fait : archiver ce fichier.
>
> S1→S5 codés et committés sur `dev/Saar` (`6c3ef86` → `81ce06a`), S3+S4+S5 validés en jeu
> par Saar. Le reste du document est le journal de conception (analyses à charge, décisions),
> conservé comme historique.
>
> Architecture déléguée à Claude par Saar (2026-09-08). Priorité : aggradation structurelle,
> pas la vitesse.

---

## 1. Objectif et périmètre

Lier le modificateur RAW **« Taille de la cible »** (Test pour toucher, LdB p.218) aux
dimensions réelles des combattants, pour les trois corps du jeu (humanoïde, drone,
exo-armure), au lieu d'un `<select>` que le MJ repositionne à la main à chaque résolution.

**Dans le périmètre :** le modificateur au Test d'attaque **à cible unique** (`TAILLE_MODS`,
−10 … +15), sur les 5 sites de résolution combat à cible unique, avec préselection
automatique et override MJ.

**Hors périmètre :** voir §8.

---

## 2. Autorité RAW

### 2.1 Table « Taille de la cible » (`REGLESYSCOMBAT.md:1382-1390`)

| Palier | Repère RAW | Modificateur |
|---|---|---|
| Minuscule | ≈ 30 cm | −10 |
| Très petite | ≈ 50 cm | −5 |
| Petite | ≈ 1 m | −3 |
| Moyenne | taille humaine | +0 |
| Grande | ≈ 3 m | +3 |
| Très grande | ≈ 5 m | +5 |
| Énorme | ≈ 7 m | +10 |
| Gigantesque | 10 m et + | +15 |

RAW : *« Utilisez ces données comme un guide […] plus que comme une loi gravée dans le
marbre. »* → les frontières cm sont une **house rule assumée** (JOURNAL8), pas une
transcription.

### 2.2 Le RAW donne la taille des drones **en clair, comme catégorie**

`REGLEDRONE.md` : plusieurs modèles portent *« ce drone est considéré comme une cible de
petite taille (-3 pour toucher) »* ou *« très petite taille (-5) »*. C'est une donnée
directe du modèle — **pas** un centimétrage à convertir.

### 2.3 Le RAW donne la taille des exo-armures via `category` (`REGLEARMURE.md:18-42`)

| Catégorie | Hauteur RAW | | Catégorie | Hauteur RAW |
|---|---|---|---|---|
| exo-alpha | ≈ 1,80 m | | exo-3 | ≈ 2,80 m |
| exo-0 | ≈ 1,90 m | | exo-4 | ≈ 3,30 m |
| exo-1 | ≈ 2,20 m | | exo-5 | ≈ 3,90 m |
| exo-2 | ≈ 2,50 m | | exo-6 | ≈ 4,50 m |
| | | | exo-oméga | ≈ 4,60 m + |

### 2.4 Concepts RAW voisins — **à ne jamais fusionner** avec « Taille de la cible »

- **Échelle** (`H` / `V` — humain vs véhicule) : pilote la mise à l'échelle des dégâts
  (*« Dom. massifs (H)/(V) »*). Déjà présent : `drone_sheet.echelle` défaut `'H'`.
- **Gabarit** : note numérique de calibre des drones/véhicules (*« Gabarit : 13 »*).

Ce chantier ne touche **que** le modificateur pour toucher. `TAILLE.md` situera les trois
axes pour qu'un futur lecteur ne les re-mélange pas.

---

## 3. État des lieux du code (vérifié 2026-09-08)

| Élément | Constat |
|---|---|
| `shared/combatSituationMods.js:61` | `TAILLE_MODS` — autorité unique catégorie → modificateur. 8 clés. Client + serveur. |
| `shared/droneConstants.js:20-41` | **Doublon** : `TAILLE_CIBLE_MODS` (recopie, **importé nulle part**) + `getTailleCible(cm)` (breakpoints `35/65/150/250/400/600/850`, non sourcés ; **2 appels client**). |
| `char_identity.height` | `numeric(4,1)`, **mètres**. Narratif, capturé par le wizard (`Step1Attributes.jsx:55/114`) et éditable fiche. Aucun autre usage. |
| `drone_sheet.taille` | `integer`, **cm**. Éditable libre. Presque toujours `NULL` (import beta n'en pose aucune). |
| `exo_sheet.taille` | `text`, **narratif libre**, créé explicitement comme *« aucun calcul ne le consomme »* (migration 254). `exo_sheet.category` existe déjà (copié du template, migration 254). |
| Résolution — cible unique | **5 sites** lisent `TAILLE_MODS[confirmedModifiers?.taille ?? 'moyenne']` : `socketCombatHelpers.js` (CaC humanoïde ~1063, tir humanoïde ~2523, drone ~2051), `socketCombatExo.js` (~186, ~359). Confiance totale à la clé client. |
| Résolution — zone (AOE) | `socketCombatAoe.js` (`runAoePhaseA` ~103) : **un seul jet d'attaque pour tout le cône**, un `tailleMod` unique dans le breakdown. Voir D7. |
| `COMBAT.md:1130-1137` | `confirmedModifiers.taille` documenté comme *« confirmation métier »* non-autoritaire (au rang de couverture/obscurité). **Jamais persisté** (ni `combat_actions`, ni log) — vérifié. |
| `socketCombatResolution.js:95` | Le handler `COMBAT_ACTION_CONFIRM` a **`isGm` dans son contexte** (déjà passé à `confirmDamage`/`confirmMeleeDefense`). |
| Sites de résolution | `characterIdCible` / `target_token_id` disponible partout ; discipline établie du fichier = **re-fetch minimal de la cible** au moment de la résolution (`socketCombatHelpers.js:373-378`). |
| Vault | `cloneCharacterDeep` (`vaultService.js:251`) insère `characters` par **spread de toutes les colonnes** → une colonne neuve se propage sans allowlist. |
| Fenêtres | `CombatModifiersWindow.jsx` (tir) / `CombatCacModifiersWindow.jsx` (CaC) : `<select>` 8 paliers, défaut `'moyenne'`, préselect **drone uniquement** (`getTailleCible`), aucun verrou MJ. Vues par le joueur (résolution de son PJ) **et** le MJ (PNJ/drone/exo). |

---

## 4. Décisions d'architecture

Modèle retenu : **catégorie de taille = propriété de première classe du personnage**,
avec cascade `explicite ?? dérivée ?? 'moyenne'`. Aligné sur le pattern des VTT pro
(Foundry `system.traits.size`, PF2e ; dérivation-par-table logarithmique de GURPS).

| # | Décision | Justification |
|---|---|---|
| D1 | **Catégorie stockée**, pas de dérivation live d'une mesure à chaque jet. | Le RAW donne la taille drone/exo comme catégorie ; recalculer à chaque jet une donnée stable couple le combat au schéma d'identité ; la cascade prépare l'échelle des tokens et l'occupation monde. |
| D2 | Colonne **`characters.size_category` nullable** (CHECK 8 valeurs), pas une colonne par fiche. | Propriété physique universelle des 4 types ; la future échelle des tokens s'ancre sur `characters` ; évite 3 colonnes divergentes ; seule la *source de dérivation* diffère par type. Vérifié : se propage seule via le clone Vault (§3). |
| D3 | `confirmedModifiers.taille` **conservé sur le fil** (aucune migration de protocole), sémantique resserrée = *choix de taille du MJ pour ce jet*. Serveur : retenu **seulement si `isGm`**, sinon `resolveSizeCategory(cible)`. | `isGm` déjà dans le contexte du handler (§3) → gate bon marché. `confirmedModifiers` jamais persisté → zéro impact rejeu. Le champ de fiche gère « cette créature est grande » ; l'override par jet gère le situationnel (cible au sol, recroquevillée) que le RAW invite à juger. Réversible. |
| D4 | Modificateur **attaquant → cible uniquement** (inchangé). | La table RAW est un modificateur *de difficulté pour toucher la cible*. |
| D5 | Breakpoints cm = **moyennes géométriques** des repères RAW (repère humain 170 cm), documentées. | Les modificateurs Polaris (−10…+15) sont compressés près de l'humain et dilatés aux extrêmes — comme le *Size Modifier* logarithmique de GURPS. Une frontière = moyenne géométrique de deux repères adjacents. |
| D6 | Doc définitive dans **`docs/SYSTEME/TAILLE.md`** (SYSTEM neuf). | Mécanisme transversal (Character + Combat + Tokens/Monde). |
| D7 | **L'AOE (zone) n'applique aucun modificateur de taille.** Le read `confirmedModifiers.taille` de `runAoePhaseA` disparaît. | Un jet unique pour tout le cône est incompatible avec une taille par cible ; éclater l'AOE en jets par cible = hors périmètre. Aligné sur la décision grenades déjà actée (JOURNAL8 : *« pas de modificateur de taille pour une zone visée »*). Une gerbe / un cône n'est de toute façon pas un tir ajusté sur une cible au sens p.218. |

### 4.1 Breakpoints retenus (D5)

Repères RAW : 30 · 50 · 100 · **170** (humain) · 300 · 500 · 700 · 1000.
Frontière = moyenne **géométrique** `√(a·b)` de deux repères adjacents :

| Borne supérieure (cm, incluse) | Palier |
|---|---|
| ≤ 39 | minuscule |
| ≤ 71 | très petite |
| ≤ 130 | petite |
| ≤ 226 | moyenne |
| ≤ 387 | grande |
| ≤ 592 | très grande |
| ≤ 837 | énorme |
| > 837 | gigantesque |

### 4.2 Clamp humanoïde (D2)

`HUMANOID_SIZE_CLAMP_CM = { min: 120, max: 300 }` — appliqué **uniquement à la dérivation
auto** depuis `char_identity.height` (champ narratif libre : protège des saisies
absurdes). Ne borne **jamais** une `size_category` explicite : un PNJ colossal
(troll, béhémoth) reçoit `characters.size_category = 'enorme'` posé à la main.
Un humanoïde 120–130 cm → « petite » (validé Saar : « petite » possible pour un
humanoïde). Quand le clamp mord réellement (height 5 m → plafonné à 300), la dérivation
retourne `source: 'derived-clamped'` (R3) pour que l'UI alerte au lieu de plafonner en
silence.

### 4.3 Mapping exo (2.3 → cm, alimente la même fonction)

`EXO_CATEGORY_HEIGHT_CM = { 'exo-alpha':180, 'exo-0':190, 'exo-1':220, 'exo-2':250,
'exo-3':280, 'exo-4':330, 'exo-5':390, 'exo-6':450, 'exo-omega':460 }`
→ via breakpoints §4.1 : exo-alpha/0/1 = moyenne (+0) · exo-2/3/4/5 = grande (+3) ·
exo-6/oméga = très grande (+5). **Aucune migration `exo_sheet` : `taille` reste narratif.**

### 4.4 Cascade `resolveSizeCategoryFrom(rows)` — **pure, en `shared/`** (R1)

```
entrée : { type, sizeCategory, heightM, droneTailleCm, exoCategory }
1. sizeCategory (non NULL)                       → { category: sizeCategory, source: 'explicit' }
2. sinon, dérivation par type :
   - 'pj' / 'pnj' : heightM présent   → sizeCategoryFromCm(heightM*100, HUMANOID_CLAMP)
                                         source 'derived' ou 'derived-clamped'
   - 'drone'      : droneTailleCm présent → sizeCategoryFromCm(droneTailleCm)     source 'derived'
   - 'exo'        : exoCategory présent   → sizeCategoryFromCm(EXO_CATEGORY_HEIGHT_CM[exoCategory])
                                            source 'derived'
3. sinon (donnée absente)                        → { category: 'moyenne', source: 'default' }
```

Retour complet : `{ cm, category, source }` — `cm` (résolu, avant mapping en palier) est
exposé pour la future échelle des tokens (R2), qui a besoin d'une valeur continue.

---

## 5. Modèle cible

### 5.1 `shared/sizeCategory.js` (neuf — responsabilité : l'échelle de taille)

- `SIZE_CATEGORIES` — tableau ordonné des 8 clés (source unique de l'énumération).
- `TAILLE_CM_BREAKPOINTS` — table §4.1.
- `HUMANOID_SIZE_CLAMP_CM` — §4.2.
- `EXO_CATEGORY_HEIGHT_CM` — §4.3.
- `sizeCategoryFromCm(cm, { min, max } = {})` → `{ category, clamped }`.
- `resolveSizeCategoryFrom({ type, sizeCategory, heightM, droneTailleCm, exoCategory })`
  → `{ cm, category, source }` — **cascade pure §4.4, testable sans base**.

`shared/combatSituationMods.js` : `TAILLE_MODS` importe `SIZE_CATEGORIES` et vérifie sa
couverture (garde anti-divergence). Responsabilité inchangée : catégorie → modificateur
de Test.

### 5.2 `characters.size_category` (migration `327`)

`text` nullable, `CHECK (size_category IS NULL OR size_category IN (<8 valeurs>))`
— patron migration `313`. NULL = « dériver » (défaut universel).

### 5.3 `server/src/lib/characterSizeService.js` (neuf — mince)

`resolveSizeCategory(characterOrId, { charIdentity?, droneSheet?, exoSheet? }, trx)` :
- accepte les lignes déjà chargées (discipline « re-fetch minimal » du combat) ;
- sinon, fetch ciblé selon `characters.type` (une requête `characters` + une requête fiche) ;
- assemble l'entrée et délègue **toute la logique** à `resolveSizeCategoryFrom` (`shared/`) ;
- retourne `{ cm, category, source }`.

Seul point d'autorité serveur ; les 5 sites combat et l'endpoint client passent par lui.

### 5.4 Endpoints

- `GET /char-sheet/:characterId/combat-size` → `{ category, source }` (préselect fenêtre).
  Ownership : réutilise le param router `/char-sheet` (bypass drone + résolution pilote
  exo, comme `/drone` et `/weapon-skill`).
- `PUT /char-sheet/:characterId/size` → `{ size_category }` (une des 8 valeurs, ou `null`
  pour repasser en « auto »). **MJ uniquement.** Écrit `characters.size_category` — route
  dédiée valable pour les 4 types, jamais greffée sur `PUT /identity` (qui écrit
  `char_identity`, pas `characters`).

---

## 6. Segments (un par validation)

> **Avancement 2026-09-08** : S1 (`6c3ef86`), S2 (`94da26f`), S3 (`d53b3e7`), S4 (`97b422d`),
> S5 (`81ce06a`) codés et committés sur `dev/Saar` (non poussés). S3+S4 **validés en combat
> réel par Saar**. **Reste D7** (AOE) — différé, `socketCombatAoe.js` en cours d'édition par le
> chantier grenades parallèle — puis `docs/SYSTEME/TAILLE.md` + archivage de ce plan.
>
> Écarts vs plan : S4 préselect via le callback `COMBAT_ACTION_PRECHECK` (pas d'endpoint REST —
> `router.param` /char-sheet refuse la fiche adverse au joueur) ; S5 sans `min`/`max` sur
> l'input `height` (bloquerait une saisie descriptive légitime, clamp reste côté serveur).

### S1 — Socle partagé (toute la logique, pure)
- `shared/sizeCategory.js` neuf (§5.1) — enum, breakpoints, clamp, map exo,
  `sizeCategoryFromCm`, `resolveSizeCategoryFrom`.
- `shared/combatSituationMods.js` : `TAILLE_MODS` re-câblé sur `SIZE_CATEGORIES`.
- `shared/droneConstants.js` : suppression `TAILLE_CIBLE_MODS` + `getTailleCible` ;
  les 2 appels client (`CombatModifiersWindow:162`, `CombatCacModifiersWindow:100`)
  redirigés vers `sizeCategoryFromCm` (comportement identique : drone cm → palier).
- Tests unité **purs** : `sizeCategoryFromCm` (bornes exactes, clamp) + `resolveSizeCategoryFrom`
  (4 types, donnée absente, override explicite, clamp mordu, map exo).
- `JOURNAL8.md` : breakpoints (moyennes géométriques, précédent GURPS), clamp humanoïde,
  séparation taille / échelle / gabarit, AOE sans modificateur de taille (D7).
- **Validation :** `node --test 'shared/**/*.test.mjs'`, `node --check`,
  `cd client && npx eslint <2 fenêtres>`, `cd client && npm run build`.

### S2 — Colonne + service serveur (non branché)
- Migration `327_characters_size_category.js` (colonne + CHECK) + test round-trip
  `up()`/`down()`.
- `server/src/lib/characterSizeService.js` (§5.3) — mince, délègue à `shared/`.
- Commit isolé (migration + service), rien encore consommé.
- **Validation :** `node --test`, `node --check`.

### S3 — Branchement combat (5 sites) + gate d'autorité
- 5 sites (`socketCombatHelpers.js` ×3, `socketCombatExo.js` ×2) : à chacun, s'assurer que
  le personnage cible + la fiche utile sont disponibles au point de calcul (re-fetch
  minimal, patron `socketCombatHelpers.js:378`), puis défaut = `resolveSizeCategory(cible)` ;
  `confirmedModifiers.taille` retenu seulement si `isGm` (threadé depuis le handler).
- `socketCombatAoe.js` : **retrait** du read `confirmedModifiers.taille` (D7).
- `COMBAT.md` : réécriture de la section taille (confirmation métier → propriété dérivée
  + nudge MJ situationnel ; AOE sans taille).
- **Validation :** scénario combat réel — tir + CaC, cibles pj / pnj / drone / exo, avec et
  sans override MJ ; tir de zone (vérifier l'absence de modificateur de taille) ;
  `npm run build` client. Validation comportementale Saar.

### S4 — Fenêtres de combat
- `GET /char-sheet/:characterId/combat-size` (§5.4).
- `CombatModifiersWindow.jsx` + `CombatCacModifiersWindow.jsx` : préselect depuis
  l'endpoint (remplace le fetch `/drone`-only) ; `<select>` actif si `isGm`, sinon valeur
  résolue affichée en lecture seule. Fallback `'moyenne'` si l'endpoint 404 (token sans
  personnage).
- **Validation :** Saar teste les 4 combos cible × (PJ résout / MJ résout).

### S5 — UI fiches
- `CharacterSheet.jsx` (identité), `DroneSheet.jsx` / `DroneWindow.jsx`,
  `ExoInfoPanel.jsx` : `<select>` catégorie explicite (8 paliers + « auto »), MJ
  uniquement, via `PUT /char-sheet/:id/size`. L'UI affiche **toujours la valeur résolue
  ET, si une valeur explicite est posée, ce que la dérivation donnerait** (protection
  anti-override périmé, R4). `min`/`max` sur l'input `height`. `exo_sheet.taille` reste
  du texte narratif.
- Locales `combat.json` / `charSheet.json` (clé « auto », libellés `source`).
- **Pas de re-seed** des drones existants : aucun lien entre une ligne `characters` et un
  modèle `REGLEDRONE.md`. Le MJ renseigne ses drones via le nouveau `<select>` ; sans
  valeur → « moyenne ».
- **Validation :** Saar.

### Finalisation
`docs/SYSTEME/TAILLE.md` (doc SYSTEM définitive) · archivage de ce plan · `ASBUILT.md`.

---

## 7. Fichiers touchés

**shared :** `sizeCategory.js` (neuf) · `combatSituationMods.js` · `droneConstants.js`
**serveur :** `db/migrations/327_characters_size_category.js` (neuf) ·
`lib/characterSizeService.js` (neuf) · `socket/socketCombatHelpers.js` ·
`socket/socketCombatExo.js` · `socket/socketCombatAoe.js` (retrait) ·
`routes/character/char-sheet.js`
**client :** `components/CombatModifiersWindow.jsx` ·
`components/CombatCacModifiersWindow.jsx` · `character/CharacterSheet.jsx` ·
`character/DroneSheet.jsx` · `character/DroneWindow.jsx` · `character/ExoInfoPanel.jsx` ·
`locales/combat.json` · `locales/charSheet.json`
**doc :** `JOURNAL8.md` · `SYSTEME/COMBAT.md` · `SYSTEME/TAILLE.md` (neuf, finalisation) ·
`ASBUILT.md`
**tests :** `shared/sizeCategory.test.mjs` · `combatAttackRoll.test.mjs` (déjà couvre la somme)

---

## 8. Hors périmètre

- **Mise à l'échelle 3D des tokens selon la taille** — chantier suivant ; `characters.size_category`
  + le `cm` exposé par le service en sont le point d'ancrage prévu (D2, R2).
- **Modificateur de taille en zone d'effet (AOE)** — abandonné (D7).
- **Opposition CaC bidirectionnelle** — le jet opposé du défenseur ne reçoit pas « taille
  de l'attaquant » (`resolveMeleeDefensePnj`). État pré-existant, inchangé. Symétriser
  serait une décision JOURNAL8 séparée (le RAW n'est pas explicite sur l'opposition) —
  ne pas l'entreprendre dans ce plan.
- Taille ↔ allonge d'arme (mécanique RAW distincte, LdB p.224).
- Taille ↔ nombre / cases de Localisations.
- `char_identity.height` converti en cm (reste en mètres, dérivé à la lecture).
- Échelle (H/V) et Gabarit (§2.4).

---

## 9. À vérifier au moment du code

1. Numéro `327` libre confirmé sur `knex_migrations` **et** `ls`, pas seulement `ls`.
2. Threading exact de `isGm` du handler `COMBAT_ACTION_CONFIRM` jusqu'aux 5 fonctions de
   résolution (les chemins PNJ/drone/exo sont déjà MJ-only par construction ; vérifier
   qu'aucun chemin joueur ne peut injecter `taille`).
3. Ownership de `GET /combat-size` et `PUT /size` pour les 4 types (param router
   `/char-sheet` + bypass drone + résolution pilote exo).
4. `TAILLE_LABELS` (FR figé serveur, `socketCombatHelpers.js`) : dette i18n connue et
   séparée — ne pas élargir le périmètre en la corrigeant ici.
5. Exo : `resolveSizeCategory` doit toujours être appelé avec le personnage **du token**
   (l'exo, `type='exo'`), jamais avec le pilote — la cascade lit alors `exo_sheet.category`.
