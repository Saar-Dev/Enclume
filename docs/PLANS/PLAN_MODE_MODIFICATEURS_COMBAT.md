# PLAN_MODE_MODIFICATEURS_COMBAT — option de campagne LIBRE / AUTO

> Créé 2026-09-09. Statut : **CLOS** (M1→M5 codés, poussés, validés jeu réel).
> Absorbe `PLAN_ALLURE.md` A4/A5 ; retire `PLAN_TAILLE.md` S5.

## 1. Objectif

Enclume automatise les modificateurs de combat dérivables d'un état de jeu autoritaire :
- **taille de la cible** — propriété de la cible (`PLAN_TAILLE.md`) ;
- **allure tireur / cible** — conséquence du `movement_gait` déclaré ce Tour (`PLAN_ALLURE.md`).

Certaines tables ne veulent pas de cette automatisation. Redirection Saar 2026-09-09 : plutôt
qu'un champ « Taille » sur la fiche de personnage (S5, retiré), une **option de campagne** qui
pilote toute l'automatisation.

## 2. Décisions verrouillées

- `settings.combat_modifiers_mode ∈ { libre, auto }` — **2 modes**, défaut **`auto`** (campagnes
  neuves ET existantes via `mergeWithDefaults`).
- Couvre **taille + allure** uniquement.
- **Portée intouchée** : `authoritativeRangeBand` est déjà seul juge côté serveur
  (`confirmedModifiers.portee` mort). « Portée libre » serait cosmétique ou franchirait
  l'invariant 3 → chantier séparé `PLAN_PORTEE_NARRATIVE.md` si un jour.
- `auto` = dérivé + préselect + **joueur lecture seule** (taille + allure), MJ garde le `<select>`.
- `libre` = `<select>` neutre (fallback 0) **pour joueur ET MJ**, aucune dérivation, **aucun
  verrou caché** (Saar explicite : `tireur_allure_maximale` = Tir impossible n'est PAS forcé en
  `libre` ; seul un choix explicite de l'option dans le menu déclenche le refus).
- Colonne `characters.size_category` + CHECK 327 **conservées** (1er cran cascade
  `explicit ?? derived ?? default`, patron canonique Foundry/PF2e). Migration `328` a remis les
  valeurs à NULL (posées pendant la brève vie de S5 — 0 ligne sur la base de dev).
- Zone d'effet : hors périmètre. Le mode ne gate que le chemin non-AOE. Bug pré-existant
  (`cible_immobile` +3 en dur pour un tir de zone, `runAoePhaseA`) → ticket, résolu avec D7 /
  refacto `socketCombatAoe.js`.

## 3. Comportement par mode

| | `auto` (défaut) | `libre` |
|---|---|---|
| PRECHECK renvoie | `targetSizeCategory`, `shooterAllureKey`, `targetAllureKey` | les 3 = `null` |
| `stripGmOnlyModifiers` (taille) | strip pour non-MJ | pas de strip |
| Réécriture allure (résolution) | oui (non-MJ, Tir non-AOE) | non |
| Fenêtre — taille (Tir + CaC) | joueur lecture seule / MJ `<select>` | `<select>` fallback `moyenne` pour tous |
| Fenêtre — allure (Tir) | joueur lecture seule / MJ `<select>` seedé serveur | `<select>` fallback `immobile` / `cible_lente` pour tous |
| Fenêtre — portée | inchangée (pré-remplie distance + override) | idem |

Angle mort assumé : Tir drone/exo **auto sans fenêtre** (`confirmedModifiers == null`) →
`resolveAttackTargetSize` dérive même en `libre` (aucune saisie manuelle possible sans fenêtre).

## 4. Segments (tous faits)

| Seg | Contenu | Commit |
|---|---|---|
| **M1** | `SETTINGS_SCHEMA` +`combat_modifiers_mode` ; `SectionGameRules.jsx` bascule 2 boutons ; `fr.json` ; test | `6552716` |
| **M2** | Retrait S5 : `SizeCategoryField.jsx` + 3 montages, routes `GET\|PUT /char-sheet/:id/size`, `describeCharacterSize` + `ignoreExplicit`, clés `fr.json` ; migration `328` NULL-out | `e95c9d4` |
| **M3** | `socketCombatResolution.js` : `getCampaignSettings` hoisté par handler ; PRECHECK + CONFIRM gatés sur `combatModifiersAuto` | (M3+M4 groupés) |
| **M4** | `SessionPage`→`CombatOverlay` (`combatModifiersMode` + `assaultPrecheckAllure`) → 4 fenêtres ; `CombatModifiersWindow` / `CombatCacModifiersWindow` : `modifiersEditable = isGm \|\| !autoMode` ; `combat.json` +`modifiers.allureAuto` | (M3+M4 groupés) |
| **M5** | Docs (`COMBAT.md`, `TAILLE.md`, `COMBAT_FLUX.md`, `PLAN_TAILLE.md`, `PLAN_ALLURE.md`, `JOURNAL8`, ce fichier) + ticket AOE | (M5) |

Méthode : exploration ×2 → plan → 1 analyse à charge (verdict « faire », corrections RF1 NULL-out
/ RF3 pas de verrou caché intégrées).

## 5. Invariants

- **2** : `libre` n'est **pas** un moteur legacy — c'est un mode de campagne de première classe
  (précédents : `status_effects_mode: 'off'`, `pnj_unlimited_ammo`). Un `if (mode === 'auto')`
  autour de la dérivation, pas deux moteurs.
- **3** : autorité serveur préservée en `auto` ; `libre` = opt-out MJ explicite et documenté.
- **5** : `libre` laisse la table diverger du RAW — choix assumé du MJ, tracé JOURNAL8.
- **`combat.md`** : portée jamais touchée (`authoritativeRangeBand`).

## 6. Hors périmètre

- Portée arbitrée MJ (théâtre de l'esprit) → `PLAN_PORTEE_NARRATIVE.md` si un jour.
- Nettoyage modificateurs situationnels AOE (`cible_immobile` +3 bidon ; `isAoeAction` truthy pour
  un tir de zone en cible unique) → D7 / refacto `socketCombatAoe.js` (ticket).
- Symétrie opposition CaC.
