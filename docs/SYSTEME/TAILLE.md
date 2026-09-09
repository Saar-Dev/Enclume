# SYSTEME/TAILLE.md — Taille d'un combattant

> Créé 2026-09-08 (`docs/PLANS/PLAN_TAILLE.md`). Révisé 2026-09-09 — S5 (champ de fiche) retiré,
> remplacé par l'option de campagne `combat_modifiers_mode` (`docs/PLANS/PLAN_MODE_MODIFICATEURS_COMBAT.md`).
> Statut : **actif**. Reste D7 (AOE, voir §6).
>
> Lire pour : tout code qui a besoin de la taille physique d'un personnage — modificateur
> de combat pour toucher, et à terme mise à l'échelle des tokens / occupation monde.

Documents associés :
- `docs/REGLES/REGLESYSCOMBAT.md:1382-1390` — table RAW « Taille de la cible ».
- `docs/REGLES/REGLEDRONE.md` / `docs/REGLES/REGLEARMURE.md:18-42` — taille RAW des drones / exo-armures.
- `docs/SYSTEME/COMBAT.md` § « Modificateurs de combat » — l'usage combat (mode LIBRE/AUTO, gate, AOE).
- `docs/PLANS/PLAN_MODE_MODIFICATEURS_COMBAT.md` — l'option de campagne qui pilote taille + allure.
- `docs/JOURNAL8.md` (2026-09-08 / -09) — décisions durables (breakpoints, clamp, AOE, mode).

---

## 1. Responsabilité

Produire, pour un personnage, **un palier de taille** parmi 8 (RAW p.218) :
`minuscule · tres_petite · petite · moyenne · grande · tres_grande · enorme · gigantesque`.

Un seul consommateur aujourd'hui : le **modificateur au Test d'attaque** (`TAILLE_MODS`,
−10 … +15). Conçu pour resservir : mise à l'échelle 3D des tokens, occupation monde.

**Ce que ce système n'est pas** — trois axes RAW voisins, jamais fusionnés :

| Axe | Rôle | Où |
|---|---|---|
| **Taille de la cible** | modificateur pour toucher (−10…+15) | ce document |
| **Échelle** (`H` / `V`) | mise à l'échelle des dégâts (« Dom. massifs (H)/(V) ») | `drone_sheet.echelle` |
| **Gabarit** | note de calibre drone/véhicule | `drone_sheet` (RAW) |

---

## 2. Autorité & cascade

Palier = premier résultat non nul de la cascade :

```
1. characters.size_category      — palier explicite posé à la main (MJ). Autoritaire, tout type.
2. dérivé des dimensions de la fiche, selon characters.type :
     'pj' / 'pnj' : char_identity.height (m → cm, clampé 120–300 cm)
     'drone'      : drone_sheet.taille (cm)
     'exo'        : exo_sheet.category → EXO_CATEGORY_HEIGHT_CM (hauteur RAW par catégorie)
3. 'moyenne'                      — aucune donnée exploitable.
```

`source` accompagne toujours le résultat : `explicit` | `derived` | `derived-clamped`
(le clamp humanoïde a mordu) | `default`.

### Conversion cm → palier

`shared/sizeCategory.js` — `sizeCategoryFromCm(cm, { min, max })`. Frontières =
**moyennes géométriques** des repères représentatifs RAW (30·50·100·170·300·500·700·1000 cm ;
`170` = humain), arrondies : **39 / 71 / 130 / 226 / 387 / 592 / 837 cm**. Le RAW dit
explicitement « un guide, pas une loi » — la frontière exacte est une house rule assumée
(précédent : *Size Modifier* logarithmique de GURPS). JOURNAL8 2026-09-08.

### Clamp humanoïde

`HUMANOID_SIZE_CLAMP_CM = { min: 120, max: 300 }` — appliqué **uniquement à la dérivation
auto** depuis `char_identity.height` (champ narratif libre : protège d'une saisie absurde).
Ne borne **jamais** une `size_category` explicite : un PNJ colossal reçoit son palier à la
main. « Petite » reste atteignable pour un humanoïde (120–130 cm).

---

## 3. Code

| Couche | Fichier | Rôle |
|---|---|---|
| Énumération + math (pur, testé sans base) | `shared/sizeCategory.js` | `SIZE_CATEGORIES`, `TAILLE_CM_BREAKPOINTS`, `HUMANOID_SIZE_CLAMP_CM`, `EXO_CATEGORY_HEIGHT_CM`, `sizeCategoryFromCm`, `resolveSizeCategoryFrom` (la cascade) |
| Modificateur de combat | `shared/combatSituationMods.js` | `TAILLE_MODS` (palier → mod) + garde de chargement qui casse si l'énumération diverge ; `GM_ONLY_CONFIRMED_MODIFIER_KEYS` / `stripGmOnlyModifiers` |
| Accès base (serveur) | `server/src/lib/characterSizeService.js` | `resolveSizeCategory(db, char, opts)` → `{ cm, category, source }` ; `resolveAttackTargetSize(db, cibleId, confirmedModifiers)` (combat) |
| Colonne | migration `327_characters_size_category.js` | `characters.size_category text` nullable + CHECK 8 valeurs. **Plus aucune UI ne l'écrit** (champ de fiche retiré, migration `328` l'a remise à NULL) — conservée comme 1er cran de la cascade `explicit ?? derived` |
| UI combat | `CombatModifiersWindow.jsx` / `CombatCacModifiersWindow.jsx` | selon `settings.combat_modifiers_mode` : `auto` → `<select>` si MJ sinon lecture seule ; `libre` → `<select>` pour tous. Voir `docs/PLANS/PLAN_MODE_MODIFICATEURS_COMBAT.md` |

---

## 4. Flux combat

> Tout ce qui suit décrit le mode **`auto`** (défaut). En `libre`, le serveur ne dérive rien
> (PRECHECK renvoie `null`), ne strippe pas `taille`, et la fenêtre présente un `<select>` neutre
> à tous — `docs/PLANS/PLAN_MODE_MODIFICATEURS_COMBAT.md`.

1. **PRECHECK** — avant d'ouvrir la fenêtre de modificateurs, le client émet
   `COMBAT_ACTION_PRECHECK`. Le serveur (`socketCombatResolution.js`) y calcule
   `resolveSizeCategory(cible)` et **renvoie `targetSizeCategory` dans le callback** — jamais
   un `GET` de la fiche adverse (le `router.param` de `/char-sheet` le refuse à un joueur).
2. **Fenêtre** — `taille` affichée = `tailleOverride ?? targetSizeCategory ?? 'moyenne'`.
   `<select>` 8 paliers si `isGm`, sinon ligne en lecture seule. Le choix MJ part dans
   `confirmedModifiers.taille`.
3. **Réception** (`socketCombatResolution.js`) — `stripGmOnlyModifiers` retire `taille` du
   payload **si l'émetteur n'est pas MJ**. Filtrage unique, avant tout résolveur.
4. **Résolution** — chacun des 5 résolveurs à cible unique (`resolveMeleeAction`,
   `resolveAssaultAction`, `resolveDroneAssaultAction`, `resolveExoAssaultAction`,
   `resolveExoMeleeAction`) appelle `resolveAttackTargetSize(db, cibleId, confirmedModifiers)`
   → override MJ si présent, sinon taille dérivée. `TAILLE_MODS[palier].mod` entre dans le
   breakdown du Seuil.

Le modificateur s'applique **au jet de l'attaquant → cible uniquement**. En opposition CaC, le
jet opposé du défenseur ne reçoit pas « taille de l'attaquant » (état pré-existant ; symétriser
serait une décision JOURNAL8 séparée).

---

## 5. Édition MJ

**Il n'y a pas de champ « taille » sur la fiche** (retiré 2026-09-09 — redirection Saar). La
taille est **toujours dérivée** de la fiche (`char_identity.height` / `drone_sheet.taille` /
`exo_sheet.category`). Le champ `char_identity.height` (« Taille (m) », descriptif) reste libre —
seule la *dérivation* est clampée 120–300 cm.

En mode `auto`, le MJ surcharge par jet dans la fenêtre de modificateurs (`<select>` 8 paliers,
éphémère, non persisté). En `libre`, joueur et MJ choisissent le palier à la main.

`characters.size_category` (colonne + CHECK conservées) resterait autoritaire si elle était
renseignée, mais plus aucune UI ne l'écrit (cascade prête pour un futur pilotage explicite).

---

## 6. Zone d'effet (AOE) — écart, D7 EN ATTENTE

`runAoePhaseA` (`socketCombatAoe.js`) fait **un seul jet pour tout le cône** : incompatible
avec une taille par cible. Décision (D7, `PLAN_TAILLE.md`) : **l'AOE n'applique aucun
modificateur de taille** — cohérent avec les grenades (« pas de modificateur de taille pour
une zone visée », JOURNAL8) ; une gerbe / un cône n'est pas un tir ajusté au sens p.218.

**État au 2026-09-08** : le retrait du read `confirmedModifiers?.taille` de `runAoePhaseA`
est **différé** — `socketCombatAoe.js` est en cours de refonte par le chantier grenades 3f.
En attendant : un joueur → `taille` filtrée → contribue 0 (inoffensif) ; un MJ → sa valeur de
fenêtre s'applique au cône entier (comportement pré-chantier inchangé).
