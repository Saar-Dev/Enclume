# PLAN_RW_DECLARE_DESIGN — Refonte des fenêtres de déclaration de combat

> **Plan de travail vivant.** Décisions à jour, séquence, points ouverts. Réécrit-synthétisé le
> 2026-08-29 (avant : 2100 lignes de journal — 6 rounds d'analyse à charge + cadrages détaillés +
> revue §19). Le **raisonnement complet** derrière chaque décision est archivé :
> `docs/Old/PLAN_RW_DECLARE_DESIGN_JOURNAL.md` (à consulter si une décision est contestée).
>
> **Périmètre — chantier ÉLARGI assumé (Saar, 2026-08-29).** À l'origine « passe design seule »
> (le rework technique était `PLAN_RW_DECLARE_WINDOWS`, clos, archivé). Mais **D5 « l'arme EST
> l'action » n'est pas un changement graphique** — c'est un changement du modèle d'interaction qui
> touche l'état de sélection. Ce chantier porte donc les **deux volets** :
> - **design** (re-skin, ne touche pas la logique) : modules 2, 3, 5 ;
> - **technique** (touche l'état de sélection / la structure) : module 0 (fait), M0.4
>   (`useAssaultDeclaration` / `useMeleeDeclaration` — « la vraie cible du module 6 » de
>   `PLAN_RW_DECLARE_WINDOWS`), module 4 (D5).
>
> **Responsabilité** (`docs/RegleDocumentaire.md`) : le **langage visuel unifié** + la **structure
> commune** des trois fenêtres de déclaration d'action en phase ANNONCE (`CombatActionWindow`,
> `CombatGmDeclareWindow`, `CombatExoActionWindow`), **et le refactoring d'état que D5 impose**.
> **Ne traite pas** : la fusion des orchestrateurs (rejetée, REWORK-05 — on partage le châssis, pas
> le composant) ; le calcul métier (`shared/combatIniCost.js` / `combatSections.js`, intact) ; le
> dispatch de résolution Tir/CaC serveur (`ROADMAP.md` §5) ; la phase RÉSOLUTION — **sauf** la valeur
> i18n « Assaut » qui la traverse (lot B3).
>
> **PLAN temporaire** (`RegleDocumentaire.md` Règle 10) : à clôture, les invariants définitifs vont
> dans `docs/SYSTEME/COMBAT.md` (§ Fenêtres de déclaration) + `docs/SYSTEME/REACT.md` P58 ; les
> tokens dans `client/src/index.css` ; ce document + son journal sont archivés.
>
> **Maquette de référence** (5 itérations, validée sur le fond le 2026-08-28) :
> `https://claude.ai/code/artifact/3b8fb52d-aa6c-4905-a0d1-d6712c8c44d7` (4 artboards). Elle valide
> le **look**, pas la faisabilité de la structure (footprint, réagencement des panneaux, satellite
> qui suit — cf. §9).
> **Prototype d'interaction D5** (jetable, valide le *geste* « l'arme EST l'action » + la teinte
> Wizard) : `https://claude.ai/code/artifact/afcd5e28-341b-40ee-b109-30e69d9597fc`. **Validé Saar.**

---

## 0. Tableau de bord (2026-08-29)

| Élément | État | Réf |
|---|---|---|
| Lot B (i18n + terminologie Tir/CaC + pastille INI) | ✅ **codé + committé** (non poussé) | §5.1 |
| B5 (« Passer le tour » déclarable — mécanisme) | ✅ **codé + committé** — ⚠ ne pas déployer sans module 5 | §5.2 |
| Module 0 M0.0-M0.3 (`buildDeclarePayload`, 51 tests) | ✅ **codé + committé** | §5.4 |
| **M-E2E** — filet Playwright **local** (approche tranchée) | à cadrer juste avant le module 2 — pas commencé | §5.5 |
| Module 2 — `CombatDeclareFrame` (châssis + tokens famille) | cadré + à charge — **pas commencé** | §5.6 |
| Module 3 — `CombatDeclareStatePanel` (satellite d'état) | cadré + à charge — **pas commencé** | §5.7 |
| M0.4 — hooks `useAssaultDeclaration` / `useMeleeDeclaration` | cadré + à charge — **pas commencé** | §5.8 |
| Module 4 — `CombatDeclareActionList` (D5) | cadré + à charge — **pas commencé** | §5.9 |
| Module 5 — `CombatDeclareFooter` (D12) | ✅ **5a-5d codés + validés navigateur** (Saar, 2026-08-29) | §5.10 |
| Push `dev/Saar` → `origin` | **en attente confirmation locale Saar** (`git log origin/dev/Saar..dev/Saar`) | — |

**Rythme (R2)** : cadrage → analyse à charge → code, **étapes séparées** (checkpoint). Validation
navigateur Saar **après chaque module ET sous-module** (plus « en bloc »). Un module validé avant le
suivant. `npm test` + M-E2E verts + un commit par fenêtre/sous-module. Chaque module ajoute ses
**clés i18n neuves** (`combat.json`) **avant** le JSX (R5, `i18n.md`).

---

## 1. Objectif

Trois fenêtres qui font le même geste (déclarer une action en phase ANNONCE) ont aujourd'hui trois
langages visuels, trois hiérarchies, trois logiques. Retour Saar 2026-08-28 : *« les fenêtres
DRONE/HUMAN/EXO ne se ressemblent pas, pas la même hiérarchie, pas la même logique. Zéro pointé. »*

**But** : une **seule structure visuelle** (même ossature, mêmes blocs, mêmes composants, même
disposition) déclinée par un **accent de famille** et par le **contenu des listes** — jamais par une
divergence de châssis. Débloquer au passage : les sélecteurs d'état exo (`ROADMAP.md` §1 point 4), la
réconciliation des tokens `--combat-*`.

**Ce que « une seule structure » ne veut PAS dire** : la fusion des orchestrateurs reste rejetée
(REWORK-05). Le MJ garde sa **navigation séquentielle de slots** (`activeTokenId` avance via
`COMBAT_SLOT_ADVANCED`, roster non cliquable `[VÉRIFIÉ]`) et sa **preview temps réel** aux joueurs ;
le PJ garde ses **multi-phases** (ANNONCE + RÉSOLUTION + surprise). Partagé = **châssis, disposition,
blocs, pied, tokens**. Pas le pilotage. Détail « reste spécifique MJ » : §7.

---

## 2. État des lieux `[VÉRIFIÉ]` (condensé)

### 2.1 Les trois fenêtres

| | `CombatActionWindow` (PJ + drone PJ) | `CombatGmDeclareWindow` (MJ) | `CombatExoActionWindow` (exo) |
|---|---|---|---|
| Classe racine | `.combat-float-win` (+ corps `.combat-win-body`) | `.combat-win` (+ poignée basse, habillage de section ≠) | `.combat-float-win` |
| Largeur | 360 / 720 (panneau droit) | 440 / 720 | 340 |
| État inline | `useReducer` + **24 `useState`** + 3 `useRef` `[VÉRIFIÉ]` grep 2026-08-29 | `useReducer` + **19 `useState`** + 6 `useRef` `[VÉRIFIÉ]` grep 2026-08-29 | délégué à `useExoDeclare` |
| Roster | oui (si > 1 token) | oui (**non cliquable**, `[VÉRIFIÉ]` — nav = auto-advance) + badge arme | **absent** (dette) |
| État tactique (posture/vitesse/arme) | sections TACTIQUE + ARMEMENT dans le flux | idem | **absent** (dette) |
| « Passer le tour » | débloqué par B5 (`canDeclare`) ; libellé explicite = module 5 | idem | implicite (déclarer vide) |
| `handleDeclare` | assemble le payload via `buildHumanDeclarePayload` (module 0) | via `buildGmDeclarePayload` | via `buildExoMapActions` |
| Aperçu temps réel (`COMBAT_ANNOUNCE_PREVIEW`) | **émis** par la fenêtre PJ (`CombatActionWindow.jsx:395`, `actions: [...mapSelected]`) | **affiché** via le prop `pjPreview` — n'émet rien | — |

`CombatActionWindow` reste montée en permanence et rend **6 états « message »** hors déclaration
(surprise, surpris-inactif, résolution mon tour / pas mon tour, attente, déjà déclaré) — le
`CombatDeclareFrame` (module 2) doit tous les héberger (§5.6). `CombatGmDeclareWindow` et
`CombatExoActionWindow` retournent `null` hors de leur tour.

### 2.2 Déjà propre — à réutiliser, ne pas réécrire `[VÉRIFIÉ]`

- **Briques `CombatDeclare*`** (`REACT.md` P58) : `CombatDeclareStateSelector`, `CombatDeclareStateChip`
  (API unifiée `stateKey / current / initial / onChange / availableKeys`), `CombatDeclareIniWidget`,
  `CombatDeclareErrorBanner`, `CombatDeclareLog`.
- **Calcul métier** : `shared/combatIniCost.js` (autorité coût INI client + serveur —
  `stateTransitionCost` / `computeIniDelta` / `iniDeltaBreakdown` / `projectedInitiative`),
  `combatSections.js` (`STATE_DEFS`, `nextKey`, `FIRE_MODE_VARIANTS`, `computeFireVariant`).
- **Panneaux détail présentationnels** : `AssaultRangedPanel` (376 l., **0 `useState`**),
  `MeleeCombatPanel` (400 l., **0 `useState`**) — aucune largeur interne figée bloquante → réagençables
  en colonne étroite (module 4), **pas à réécrire**.
- **Persistance `state.*`** : `socketCombatAnnouncement.js` (~l.815-828) écrit `state_position/weapon/
  fire_mode/cover/vitesse/combat_mode` depuis `state.X ?? entry.state_X`, **génériquement pour tout
  type y compris exo** — aucun `isExo`, aucune migration nécessaire pour le satellite exo.
- **Tokens combat** : `index.css` (`--combat-pj-*` #50c878, `--combat-pnj-*` #c86030, `--combat-drone-*`
  #30aaaa ; jeu `--wiz-*` navy/cyan). **Absent** : `--combat-exo-*`, `--combat-accent-*`, un jeu
  « fenêtre de déclaration ».

### 2.3 Terminologie RAW `[VÉRIFIÉ]` (`VOCABULARY.md` V2.6)

Actions **« Tir »** (Combat à distance, LdB p.226) / **« Corps à corps »** (Combat au contact,
p.223) ; catégories d'arme **« Distance » / « Contact »** (colonnes du tableau de localisation RAW ;
`ref_category='Arme de contact'` en base). **Proscrits en UI, y compris phase RÉSOLUTION** : « Assaut »
(ancien libellé maison), « Mêlée » (import hors RAW). Codes internes `action_key='assault'`/`'melee'`
**inchangés**.

---

## 3. Décisions (à jour — table unique)

> Fusion des tables D (§3 d'origine) + P1-P8 (§18, décisions issues du prototype). Traçabilité :
> **P7 remplace D2** ; **P1 + P4 amendent D3** ; **P4 → D4b** ; **P3 → D3/D4b** (glyphes feu/lame) ;
> **P5 → D13** (en-têtes pairs même police) ; **P2 → schéma §4** (titre `PHASE 1 · nom`) ; **P6 → D10**
> (glyphe `movement` reçu) ; **P8** conservé tel quel. Raisonnement complet : journal §3, §18.
> (`D4b` est un dédoublement de `D4` introduit à la réécriture pour séparer « réconciliation des
> tokens » de « groupes non colorés » — pas une décision neuve.)

| # | Décision |
|---|---|
| **D1** | **Une seule structure visuelle** PJ / MJ-PNJ / Drone / Exo : châssis, disposition, blocs, pied, tokens partagés. **Pilotage non partagé** (nav de slots MJ, multi-phases PJ). Le roster MJ n'est **pas** cliquable — l'idée « clic = navigue » de la v1 était une invention, retirée. |
| **D3** | **Accent par famille** via `--combat-accent-*` (fg/bg/border) basculé par l'attribut `data-family`. PJ vert `#50c878`, MJ-PNJ orange `#c86030`, Drone teal `#30aaaa`, **Exo violet `#9858c8`**. Cyan (`--decl-chrome`) = chrome partagé uniquement. Retire l'accent bleu `#5b8dee` parasite. **Charte de famille = couleur seule** (P1) : liseré d'accent 2 px en tête + bordure header teintée + accent sur sélection/Déclarer. **Pas de label, pas d'hexagone.** |
| **D4** | **Réconciliation des tokens `--combat-*`** (dans le module 2) : `--combat-accent-*` mappé par famille + `--combat-exo-*` (neuf) + jeu `--decl-*` (§ P7). Dérogation assumée au D8 de `PLAN_RW_DECLARE_WINDOWS` (« aucune CSS neuve ») — c'est la passe design que ce D8 réservait. La conversion complète hex → tokens des panneaux (~260 occurrences, la plupart pas des accents) reste **hors périmètre** (chantier CSS distinct). |
| **D4b** | **Groupes Distance / Contact NON colorés** (P4) : le glyphe (feu / lame) + le texte suffisent. Une seule couleur d'accent = celle de la famille (sélection + états actifs). **Rouge / vert réservés à leur sens** (erreur / succès) → neutralise aussi les rouges d'`AssaultRangedPanel` et les verts de `MeleeCombatPanel` **au module 4**. |
| **D5** | **L'arme EST l'action.** Liste d'armes groupée (Distance / Contact) ; choisir une arme = déclarer cette attaque. Plus de radio « Tir / Corps à corps » séparé, plus de bloc ARMEMENT redondant. Auto-dégaine (`weapon → drawn`) comme `SELECT_ATTACK`. |
| **D6** | **Deux colonnes hiérarchiques** : col. 1 = armement (*quoi*), col. 2 = détail de l'arme choisie (*comment*), en-tête `→ Nom` à l'accent. La col. 2 n'est **jamais** d'autres actions. Absente si rien de sélectionné → fenêtre 1 colonne. |
| **D7** | **Recharger vit dans la col. 2** (lié à une arme). En-tête `Tir │ Recharger` **uniquement pour une arme de distance** (PO2 tranché : le rechargement d'une arme de contact est rare). |
| **D8** | **État tactique = fenêtre satellite** accrochée au bord gauche, qui **suit** la fenêtre principale (mécanique neuve, §5.7). Posture (4) / Vitesse (3) / Arme (3), **identiques PJ / MJ / Exo**. Drone : **aucun satellite**. Glyphes iconiques, peu de texte. Câblé sur `CombatDeclareStateChip` + un `glyph`. **R3 (Saar 2026-08-29) : non négociable**, panneau qui suit tel quel ; les replis (satellite non-suiveur / section repliable) restent en secours si le positionnement résiste au code — jamais promus de leur propre initiative. |
| **D9** | **Pas de rond radio.** Sélection = bordure accent + fond teinté. |
| **D10** | **Glyphes SVG produits par Saar** dans `client/public/assets/status/` : `stand`/`crounch`/`kneel`/`crawl` (posture), `actionNormal`/`actionDelayed`/`actionRush` (vitesse), `WeaponA`/`WeaponB`/`WeaponC` (arme), `contact` / `distance`, `movement` (déplacement, reçu — P6). Chargés en **`mask-image: url(...)`, jamais intégrés en dur**, recolorés à l'accent. `crawl.svg` a reçu un `<clipPath>` (2026-08-29) ; centrage à valider à l'œil par Saar. |
| **D11** | **Silhouette « viser une localisation »** conservée, en **deux sous-colonnes** dans la col. 2 (silhouette │ résumé). Repliée par défaut. `AimedLocationPicker` est déjà `width: 45%, maxWidth: 130px` → passe dans la colonne étroite. |
| **D12** | **Pied** : `[pastille INI] [message de statut centré] [Passer le tour (ghost)] [Déclarer (primaire)]`. Pastille `INI = actuel → projeté` (flèche ASCII, ex. `INI = 7 -> 2`), **rouge si tour perdu** (INI ≤ 0) — jamais un blocage. « Passer le tour » = second bouton ghost, plus petit, **toujours cliquable** (D12 littéral — PO-M5-f rejeté, cf. §5.10). « Déclarer » = primaire, actif ⟺ `hasCompleteAction && canDeclare`, sinon grisé + raison au centre. |
| **D13** | **Déplacement** = 3ᵉ en-tête d'action pair avec `DISTANCE` / `CONTACT` (P5 : même police mono, même taille, chacun son glyphe), au-dessus de la liste, cumulable (hors du choix exclusif). Grisé / remplacé quand Charge ou Retraite actif (ils possèdent leur déplacement). |
| **D14** | **Fond PCB discret** (patron `ChangelogPanel.jsx`, `<svg>` absolu `pointer-events:none`, opacité ~0.10) sur header / pied / satellite uniquement. Détail d'implémentation, posé sur le header au module 2, sur pied/satellite à leurs modules. |
| **D15** | **Terminologie** = §2.3. « Assaut »/« Mêlée » proscrits en UI, y compris RÉSOLUTION (valeur i18n, lot B3). |
| **P7** *(remplace D2)* | **Teinte Wizard** pour les fenêtres de déclaration : grounds **navy profond opaque** (`--decl-bg #0a1524` / `--decl-head #071019`, **pas** de verre/flou), bordures `rgba(255,255,255,0.10)`, chrome cyan **vif** `--decl-chrome #2FD7FF`, radius **9 px**, léger **halo** `0 0 14px rgba(accent,0.28)` sur sélection + Déclarer. **Restent dehors** : `backdrop-filter`, transparence, halos radiaux pulsés, type fine. **Scopé à `.combat-float-win[data-family]`** — la classe de base reste intacte pour les fenêtres de RÉSOLUTION. Le MJ bascule sur `.combat-float-win[data-family="gm-pnj"]`. |
| **P8** | **Flash de reset col. 2** au changement d'arme : neutre (accent de la nouvelle arme + léger glissement), **jamais rouge** — recharger le panneau n'est pas une erreur. |

---

## 4. Structure cible (identique aux 4 familles)

```
┌─ SATELLITE « Statut » ─┐  ┌─ FENÊTRE PRINCIPALE ───────────────────────────┐
│ [glyphe] Posture        │  │ HEADER   liseré famille · PHASE 1 · nom · N/N   │
│ [glyphe] Vitesse        │  ├────────────────────────────────────────────────┤
│ [glyphe] Arme           │  │ [mvt] DÉPLACEMENT                    8 m · −5   │  ← D13, cumulable
└─ (absent pour un drone) ┘  ├─ COL. 1 : ACTION (un choix) ──┬─ COL. 2 : détail┤
                             │ [feu] DISTANCE               │ → Scorpion       │
                             │   Scorpion            24/24   │ [Tir | Recharger]│  ← D7 (distance)
                             │ [lame] CONTACT               │ Cible  …         │
                             │   Couteau Congre              │ Mode de tir …    │
                             │   Mains nues      (permanent) │ simple/visé/rép. │
                             │   Griffes (mutation)          │ Deux armes …     │
                             │                               │ Localisation :   │
                             │ ── ROSTER (repliable) ──      │  [silhouette|résumé]
                             │   ▶ Baboulinet         INI 7  │                  │
                             ├───────────────────────────────┴──────────────────┤
                             │ [INI 7 → 2] Prêt  [Passer le tour] [Déclarer]     │  ← D12
                             └──────────────────────────────────────────────────┘
```

**Ce qui varie par famille — rien d'autre :**

| | PJ | MJ / PNJ | Drone | Exo |
|---|---|---|---|---|
| Accent | vert | orange | teal | violet |
| Satellite | oui | oui | **non** | oui |
| Liste d'armes | inventaire du perso | équipement batch PNJ | 1 arme | armement exo (souvent 5) |
| Roster | si > 1 token | tous PNJ gérés (non cliquable) | — | — |
| Colonne 2 | complète (dual-wield, tir multi 1-3, visé, localisation) | complète | cible + mode | cible + mode (1 attaque / Tour) |
| Pilotage | multi-phases + émet `pjPreview` | nav séquentielle + affiche `pjPreview` | multi-phases (dans `CombatActionWindow`) | ANNONCE seule |

### Cas limites de « l'arme EST l'action » (D5) — à figer au module 4

- **Mains nues** : ligne permanente du groupe Contact.
- **Armes naturelles** (`char_mutations.natural_weapon_formula`) : lignes Contact.
- **Arme mixte** (contact + distance) : présente dans **les deux** groupes.
- **Dual-wield** : option de la col. 2 (`showDualWieldSection` existe déjà).
- **Modes de combat CaC** (Charge / Retraite / Défensif) : **PO2 tranché — ils NE bougent pas**,
  restent une section de `MeleeCombatPanel`. Charge garde son chaînage déplacement→cible.

---

## 5. Séquence

> **Décisions de la revue à charge §19 (journal), tranchées Saar 2026-08-29** — `R1` : M-E2E est
> prérequis avant le module 2. `R2` : checkpoint navigateur après chaque module ET sous-module (plus
> « en bloc »). `R3` : le satellite (D8) reste non négociable, panneau qui suit. `R4` : ce chantier =
> déclaration seule ; fenêtres de RÉSOLUTION = passe CSS future, 1 ligne ROADMAP, pas un module.
> `R5` : chaque module énumère ses clés i18n neuves + inventaire des lignes d'arme grisées (module 4).

### 5.0 Chemin critique — **ordre B tranché (2026-08-29, jugement délégué par Saar sur les priorités)**

**Ordre d'exécution** :

```
Lot B ✅ → B5 ✅ → Module 0 ✅
  → Module 5  (CombatDeclareFooter, AUTONOME dans les pieds actuels)
  → Module 3  (CombatDeclareStatePanel, AUTONOME contre les fenêtres actuelles)
  → M-E2E     (filet local — cf. §5.5)
  → Module 2  (CombatDeclareFrame — re-slotte le pied + le satellite déjà validés)
  → M0.4      (hooks)
  → Module 4  (liste d'action, 4a-4e)
```

**Pourquoi B et pas A (module 2 d'abord)** — critère : robustesse structurelle, pas rapidité.
- **A empile 3 modules à surface non testée** (2 = échange de châssis, 3, M0.4) avant la première
  vraie validation. Une régression introduite au module 2 ne se voit qu'après le module 4 — bisect
  pénible, cause racine noyée.
- **B = migration incrémentale (« strangler fig » / branch-by-abstraction, Fowler)** : on construit
  la pièce neuve, on la branche **dans le contexte actuel**, on la valide isolément, **puis** on
  déplace le contexte. Le pied et le satellite sont **petits, visibles, validables à l'œil** dans les
  fenêtres actuelles — aucun filet automatique nécessaire pour eux. Le seul module qui a vraiment
  besoin de l'E2E est le module 2 (l'échange de châssis), et il arrive **après** que ses deux
  consommateurs (pied, satellite) sont prouvés.
- Coût de B : le pied et le satellite sont intégrés **deux fois** (contexte actuel, puis frame).
  C'est le prix de la sécurité — et « le temps / la quantité de travail ne sont pas un facteur »
  (priorités Saar).
- B **aggrade** : à chaque étape le projet a une pièce de plus finie et testée, jamais un gros
  chantier à moitié fait.

**Dépendances vérifiées `[VÉRIFIÉ]`** : le module 5 autonome peut assembler `blockReason` depuis les
tableaux de raisons **qui existent déjà** dans les fenêtres actuelles (`aimIneligibilityReasons`…) —
M0.4 nettoiera la source plus tard (PO-M5-a). Le module 3 autonome lit le `pos` du `useDraggable` de
la fenêtre actuelle (chaque fenêtre a le sien). Aucun des deux ne dépend du frame.

### 5.1 Lot B — i18n + terminologie + pastille INI — **CODÉ 2026-08-28** (`fc0c25e`)

- **B2** : 8 fautes d'accent du bloc `actionWindow.*` (`combat.json`).
- **B3** : terminologie « Tir / Corps à corps » — valeur JSON partout (`combat.json` + `modifiers.header`
  résolution), **zéro `.jsx`**. `fr.json` « fusil d'assaut » = RAW, intouché. `grep -i assaut
  combat.json` = vide.
- **B4** : pastille INI `iniWidget.pill = "INI = {{current}} -> {{projected}}"` (flèche ASCII),
  `CombatDeclareIniWidget.jsx` rend le format, rouge si projeté ≤ 0.
- **B1** : `DÉCLARER` en dur (`CombatGmDeclareWindow.jsx:1056`) → `t('actionWindow.declareActionButton')`.
- **Serveur** : ~9 messages `COMBAT_DECLARE_ERROR` « Assaut » → « Tir » (swap de mot). **Ne corrige
  pas** la violation i18n (serveur émet du FR en dur) — l'i18n-ification complète de
  `COMBAT_DECLARE_ERROR` (~70 sites, changement de payload) est différée : `PLAN_LOCALISATION.md` §8.

### 5.2 B5 — « Passer le tour » déclarable pour un humain — **CODÉ 2026-08-28** (`eb0f84f`)

Le serveur acceptait déjà une déclaration vide (`socketCombatAnnouncement.js` l.67 : `{}` passe ;
l.78-79 valide chaque clé d'état **seulement si présente** ; pose `has_announced`). Seul le **client**
bloquait.

- `CombatActionWindow.jsx` : `hasAnyAction` + `stateChanged` supprimés ;
  `canDeclare = isDrone ? droneDeclare.canDeclare : (assaultValid && reloadValid && meleeValid)`.
- `CombatGmDeclareWindow.jsx` : `stateChanged` + `hasAction` supprimés ; **`meleeValid` neuf** ;
  `canDeclare = (isActivePnj && assaultValid && meleeValid) || (isActiveDrone && droneDeclare.canDeclare)`.
- Exo : rien (déjà déclarable vide).

Chaque `*Valid` vaut `true` si rien n'est sélectionné (tour vide passe) et `false` si une action
commencée est incomplète. **Vérifié à charge (2026-08-29) : correct**, y compris le `meleeValid` MJ
pour une Charge (`chargeSelection` est toujours posé avec `move` + `targetTokenId` ensemble).

> **⚠ Contrainte de déploiement** : B5 introduit le « mis-clic à l'ouverture = tour perdu », et
> **aucun chemin d'annulation de déclaration côté serveur n'a été trouvé**. Le libellé explicite
> « Passer le tour » + le gate `hasCompleteAction` du **module 5** lèvent ce coût. Sur `dev/Saar`
> local, sans effet ; **au push, B5 part avec le module 5** (ou le module 5 est avancé).

### 5.3 « Module 1 » (tokens d'accent) — **fusionné dans le module 2** (§5.6)

Le `data-family` n'a de sens qu'avec le chrome partagé — plus de module 1 autonome.

### 5.4 Module 0 — logique de déclaration en modules purs testés — **CODÉ 2026-08-28**

Pas « ajouter vitest » : extraction en fonctions pures `.mjs` + tests de caractérisation (philo
Enclume — 127 fichiers `*.test.mjs` `node --test` + Playwright E2E ; **aucun test composant**, choix
assumé).

| Sous-lot | Contenu | Commit |
|---|---|---|
| **M0.0** | Script `npm test` (`node --test` glob `shared/` + `client/src/` + `server/src/`) | `a7b740c` |
| **M0.1** | `buildHumanDeclarePayload` — extraction **verbatim** de `CombatActionWindow#handleDeclare` (branche non-drone) + 21 tests | `3798eda` |
| **M0.2** | `buildGmDeclarePayload` — extraction verbatim de `CombatGmDeclareWindow#handleDeclare` (branche PNJ) + 16 tests. Différences PJ/PNJ préservées **verbatim** (inventaire complet : commentaire `buildDeclarePayload.js`) | `9b6540d` |
| **M0.3** | `buildDroneMapActions` + `buildExoMapActions` — cœurs purs de `useDroneDeclare` / `useExoDeclare` + 14 tests | `6c5ca25` |
| **M0.4** | Extraction du sous-état de déclaration PJ ↔ MJ-PNJ — **cadré §5.8** | — |

**Portée réelle du filet** : les 51 tests figent **la forme du payload `COMBAT_ACTION_DECLARE`**. Ils
protègent **M0.4 et le module 4**. Ils ne protègent **pas** les modules 2 / 3 / 5 (JSX/CSS, payload
inchangé). Extraction vérifiée verbatim ; les tests sont écrits à la main (caractérisation, pas
snapshot) — filet réel mais pas magique.

### 5.5 M-E2E — filet Playwright local — **approche tranchée (2026-08-29), à cadrer en détail juste avant le module 2**

**Rôle réduit par l'ordre B** : le pied et le satellite se valident à l'œil dans les fenêtres
actuelles. M-E2E est le filet **du module 2 seul** (l'échange de châssis) et des modules 4/5 dans
leur re-slottage. Il tourne à chaque commit à partir de là. **Aggradation permanente** : le projet
gagne son premier vrai harness E2E stateful, réutilisable au-delà de ce chantier.

**Décision : LOCAL, pas staging.** Un filet qui n'est vert que quand un tunnel SSH est up et que
staging est propre n'est pas un filet ; taper un serveur distant à chaque run le pollue et le rend
non déterministe. Le local est isolé, reproductible, CI-able — la seule option qui aggrade.

**Le test minimal (évite le canvas Three.js)** :
```
setup (1×) : login GM → storageState
test :
  1. POST /api/test/combat-fixture  → crée campagne + battlemap + 1 token + char_sheet + démarre
     le combat en phase ANNONCE, renvoie {campaignId, sessionUrl}
  2. goto(sessionUrl) → CombatGmDeclareWindow s'affiche (1er PNJ, slot actif)
  3. assert : header + pied + satellite (3 puces) + pastille INI présents
  4. clic puce Posture Debout→Accroupi → assert : pastille INI "= X" → "-> X-3"
  5. clic « Passer le tour »  (déclaration vide, mécanisme B5 — zéro canvas)
  6. assert : progression header 0/N → 1/N (has_announced posé)
teardown : DELETE /api/test/combat-fixture/{campaignId}
```
Fenêtre MJ (pas PJ) : même frame/satellite/pied, **préconditions 2× plus simples** (pas de 2ᵉ
navigateur, pas de compte joueur).

**À construire** (patron standard Playwright — *project dependencies* + *storageState* + seed par
endpoint API, cf. sources) :
1. `playwright.config.mjs` : bloc `webServer` (démarre `docker-compose up` Postgres/Redis/MinIO +
   `server` + `client` en dev, attend les ports) + projet `setup` (auth → `storageState`) + projet
   `chromium` `dependencies: ['setup']` + projet `teardown`.
2. **`POST /api/test/combat-fixture`** (+ `DELETE`) — route serveur **gardée `NODE_ENV !== 'production'`**,
   qui **passe par les services existants** (`campaignService`, création de battlemap/token,
   `COMBAT_START` / `COMBAT_ANNOUNCE_START` en interne) — pas de SQL brut, pas de duplication de
   schéma → **reste correct quand les 317 migrations évoluent**. Idempotente (clé métier, `core.md`).
3. Un `char_sheet` minimal valide (juste ce qu'il faut pour que `calcREA` passe au `COMBAT_START`).
4. Le `.spec.mjs` ci-dessus.

**Recherche** : le seed-par-endpoint-API (vs script knex autonome) est le patron recommandé — il
reste synchrone avec le schéma via le code applicatif, et le test n'a pas besoin des creds DB
([Playwright global setup/teardown](https://qaskills.sh/blog/playwright-global-setup-teardown-guide),
[Playwright best practices 2026](https://getautonoma.com/blog/playwright-best-practices-2026)).

**Estimation honnête : 3-5 j** (le gros = l'endpoint fixture qui produit un combat en ANNONCE valide
+ le `webServer` multi-process fiable sous Windows). Le temps n'est pas un facteur (priorités Saar) —
mais **c'est la première vraie tâche du chantier**, à cadrer en détail (sa propre passe cadrage →
analyse à charge → code) juste avant le module 2, **après** les modules 5 et 3.

### 5.6 Module 2 — `CombatDeclareFrame` (châssis partagé + tokens famille)

**Ordre (B, §5.0)** : ce module se fait **après M-E2E**, et **re-slotte** le pied (module 5) et le
satellite (module 3) déjà construits et validés — il n'introduit que le châssis + les tokens, pas de
composant neuf non éprouvé. C'est le seul module qui a besoin du filet E2E.

**Responsabilité** : extraire le **châssis externe commun** — conteneur + `.combat-float-win` +
`useDraggable` + largeur/opacité/position + header (titre + drag) + emplacement satellite + slot pied
+ bannières. **Ne touche pas** le corps (module 4), le satellite (module 3), le pied (module 5),
aucun état, aucun payload. JSX/CSS uniquement.

**Absorbe l'« ex-module 1 »** (tokens d'accent par famille — le `data-family` n'a de sens qu'avec le
chrome partagé). Le remplacement des `#5b8dee` parasites, lui, n'est **pas** ici : le module 2 ne
touche que le châssis externe, les `#5b8dee` sont dans le corps → repoussé au fil des modules 3/4/5,
sur les fichiers qu'ils touchent déjà. Conversion hex → tokens complète = hors périmètre (§8).

**API cible** :
```
<CombatDeclareFrame
  family="pj"|"gm-pnj"|"drone"|"exo"        // → data-family (attribut) → --combat-accent-*
  storageKey  defaultPos  width             // useDraggable, clés existantes conservées
  title={<ReactNode>}                       // texte simple OU bloc enrichi MJ (nom + progression)
  hidden={bool}                             // remplace les 3 recopies inline opacity/pointerEvents
  banner={ReactNode|null}                   // sous le header
  satellite={ReactNode|null}                // RENDU COMME FRÈRE POSITIONNÉ depuis `pos` interne
  footer={ReactNode|null}                   // slot ; null → pas de barre de pied
>{corps}</CombatDeclareFrame>
```

- Le frame **possède `useDraggable`** et **expose `pos`** (le satellite du module 3 en est un frère
  positionné, pas un enfant — `overflow:hidden` le clipperait). Masqué avec le frame.
- **Contrainte Rules-of-Hooks** : le frame doit être **l'élément le plus externe de *chaque* des 6
  `return`** de `CombatActionWindow`, sans wrapper conditionnel. (Filet : `useDraggable` retombe sur
  `localStorage` même à un remount.)
- **Tokens ajoutés** (`index.css`, scopés `.combat-float-win[data-family]`) : jeu `--decl-*` (P7) +
  `--combat-exo-*` (`fg`/`border` = `#9858c8` validés ; **`--combat-exo-bg` `[INFÉRÉ]` `#140a1e`**, à
  valider à l'œil) + `--combat-accent-*` mappé par `data-family`. Classe de base `.combat-float-win`
  **intacte** (fenêtres RÉSOLUTION). Le MJ **bascule** de `.combat-win` sur
  `.combat-float-win[data-family="gm-pnj"]` — décalage de palette assumé (§ P7).
- `<CombatPcbBackdrop>` : sur le **header seulement** (module 2) ; pied et satellite le reçoivent à
  leurs modules.
- Poignée basse MJ (`S.bottomHandle`, ajoutée Session 118, délibérée) : conservée comme option
  `bottomHandle?` du frame, activée pour les 3.

**Risque : ÉLEVÉ** — réécrit le `return` de premier niveau des 3 fenêtres + décalage de palette.
**Aucun filet automatique** (golden master ne couvre pas — §5.4). → **filet réel** : M-E2E (R1) +
**un commit par fenêtre** (`CombatDeclareFrame` neuf + `CombatActionWindow` d'abord, puis MJ, puis
exo) + **checklist de vérif manuelle par fenêtre** (drag, masquage au ciblage, chaque état
non-déclaration, redimensionnement 360↔720). Rollback : `git revert` du commit de la fenêtre.

**Points ouverts restants** (mineurs, tranchés au moment du code) : `max-height` unifié
`calc(100vh - 80px)` ou `- 100px` ; roster PJ dans le frame ou enfant du corps ; largeur dynamique
(`width` au call site vs `baseWidth` + `expanded`).

### 5.7 Module 3 — `CombatDeclareStatePanel` (satellite d'état, D8) — **PROCHAIN** (module 5 validé 2026-08-29)

**Ordre (B, §5.0)** : ce module se fait **en 2ᵉ** (après le pied) — `CombatDeclareStatePanel` monté
comme frère des fenêtres actuelles (lit leur `pos` de `useDraggable`), validé à l'œil, re-slotté dans
le frame au module 2.

**Responsabilité** : sortir les sélecteurs d'état (posture, vitesse, arme) du corps vers un panneau
satellite qui **suit** la fenêtre (D8). Brique = **`CombatDeclareStateChip` tel quel** + un `glyph`
(mask-image d'un `assets/status/*.svg`, recoloré `--combat-accent-fg`). **Identique PJ / MJ / Exo**.
Drone : aucun satellite. `fire_mode` **reste au corps** jusqu'au module 4 (interim assumé).

**Axes** (`STATE_DEFS`, coûts `STATE_TRANSITION_COST` partagés serveur) :

| Axe | Valeurs | Glyphe |
|---|---|---|
| `position` | standing / crouching / kneeling / prone | `stand` / `crounch` / `kneel` / `crawl` |
| `vitesse` | delayed / normal / rushed | `actionDelayed` / `actionNormal` / `actionRush` |
| `weapon` | holstered / ready / drawn | `WeaponA` / `WeaponB` / `WeaponC` |

- **Exo — les 3 axes s'appliquent, `[VÉRIFIÉ]`** (journal §11 round 6 — corrige un `[VÉRIFIÉ]` faux antérieur) :
  posture = `POSITION_TRANSITION_COST` telle quelle (RAW `REGLESYSCOMBAT.md:929-941`) ; **arme =
  exactement comme HUMAN** (coût INI de transition **et** gate « on n'attaque pas avec une arme
  rangée » — sélectionner une arme auto-dégaine, attaque grisée si `weapon !== 'drawn'`) ; mode de tir
  fixe, jamais au satellite. **À vérifier au module 4** : le serveur applique-t-il déjà ce gate pour
  l'`isExo` (jamais exercé — l'exo envoie `state: {}` aujourd'hui) ?
- **Exo `prone`** : la puce Posture **remplace** le bouton « Tenter de se relever » (`handleStandUp`).
  Comportement **≠ puce normale** : au **clic** (pas à DÉCLARER), message système chat + jet
  (`isExoStandUpAttempt` / `resolveExoStandUpAction`, mécanisme serveur déjà là). Réussite → DEBOUT,
  échec → fin de tour. → le `onChange` de la puce Posture exo **branche**
  `isProne ? emitStandUp() : dispatch(SET_FIELD)` — le branchement vit dans le wiring de la fenêtre
  exo, la brique `CombatDeclareStateChip` reste générique.
- **Exo payload** : `CombatExoActionWindow.handleDeclare` envoie `state: { position, weapon, vitesse }`
  lus de `decl` (réutilise `declarationReducer` + `snapFromRosterEntry`, déjà partagés). **Passe-plat
  de 3 champs — aucune `buildExoDeclareState`, aucun test de caractérisation neuf.** Aucune migration.
- **`glyph` doit dégrader** : un `CombatDeclareStateChip` sans `glyph` rend le label texte comme
  aujourd'hui (`{glyph && <span class="chip-glyph" .../>}`).
- **Mécanisme « le satellite suit »** : le frame rend `{satellite && <div style={{position:'absolute',
  left: pos.left - SAT_W - GAP, top: pos.top, zIndex: <frame>}}>{satellite}</div>}`. Clamp bord gauche
  (`pos.left - SAT_W < 8` → passe à droite). **Aucun précédent dans le code** (`[VÉRIFIÉ]` — 7 fenêtres
  de combat, `useDraggable` indépendants). **Repli nommé** (jamais promu de sa propre initiative,
  R3) : satellite non-suiveur, ou section repliable « STATUT » en tête de corps — **à montrer à Saar
  avant de s'entêter** si la synchro résiste.

**Risque : MOYEN** (client, visuel). Payload PJ/MJ inchangé (golden master). Filet : **un commit par
fenêtre + checklist manuelle**. `CombatDeclareStateSelector` devient du code mort **au module 4**
(pas ici) quand `fire_mode` part en col. 2.

### 5.8 M0.4 — `useAssaultDeclaration` + `useMeleeDeclaration` (option C)

**Responsabilité** : extraire le **sous-état de sélection Tir** et le **sous-état de sélection CaC**
— recopiés à ~90 % entre PJ et MJ — en **deux hooks de domaine sans `mode`** (option C ; A =
`useHumanDeclare(mode)` rejeté sur la foi de la doc React « Hook difficile à nommer = trop couplé » ;
B = présentationnel pur « ne fait pas le travail »). Chaque hook = `useReducer(pureReducer, init)` +
sélecteurs dérivés purs `.mjs` (patron `declarationReducer` / `buildDeclarePayload`). **Aucune
dépendance neuve** (XState rejeté).

**Partageable `[VÉRIFIÉ]`** (journal §15.3 ; noms de variables re-vérifiés par grep 2026-08-29) : tout le sous-état Tir
(`assaultPendingTokenIds`↔`assaultTargets`, `count`, `bulletCount`, `variantAB`, `isDualWield`,
`aimTranches`, `aimedLocation`), tout le sous-état CaC (`meleeCount`↔`meleeAttackCount`,
`selectedMeleeWeaponId`↔`selectedGmMeleeWeaponId`, naturelle, `isDualWieldMelee`), la logique « 1er
clic remplit la série », les dérivés (`effectiveCount`, `currentVariant`, `*Valid`,
`*IneligibilityReasons`), le reset (~15 setters → 3 appels).

**Reste à la fenêtre** : `decl` tactique (déjà partagé), acquisition des données (fetch par token PJ
vs batch PNJ), pilotage, **et l'orchestration du mode de ciblage carte** (`onEnterTargetMode`) — le
point divergent. Le hook n'orchestre PAS `onEnterTargetMode` ; il expose des mutations d'état que le
callback de la fenêtre appelle.

**Deux formes à unifier dans le hook** (aggradation, pas contournement) : la forme de la **Charge**
(`charge: {move, targetTokenId} | null`) et le flag **« CaC en cours »** (`phase` explicite). Le PJ
s'y aligne (ripple 4-5 sites — sortir en **pas M0.4-g dédié**, ou reporter).

**Nuances de l'analyse à charge (à respecter au code)** :
- Les deux hooks sont **indépendants pour le *state*, composés par la fenêtre pour la *validité*** :
  `assault.aimIneligibility` dépend de la présence CaC → la fenêtre assemble `mapActionsObj` depuis
  `assault.*` + `melee.*` et le repasse au sélecteur d'éligibilité.
- `assault.clear()` = **comportement PJ** (reset `isDualWield`) → **changement de comportement pour le
  MJ** (qui ne le resettait pas) — plus sûr, mais à documenter comme correctif + test dédié.
- `selectNext` (chaîne récursive MJ multi-CaC) lit `effectiveMeleeCountRef` dans un callback async →
  le hook doit exposer un `setTarget` **self-terminant** (retourne « série complète ? ») pour que
  `selectNext` n'ait plus besoin de connaître `N`.
- Le hook **n'est PAS auto-resettant** — la fenêtre appelle `assault.reset()` / `melee.reset()` dans
  son effet `[tokenId, has_announced]`.
- Le sélecteur `isValid` prend un bag de contexte fenêtre (`weapon`, `hasTwoWeapons`, `rosterEntry`,
  `lunetteNiveau`…) → **nouvelle surface d'erreur silencieuse** si la fenêtre en oublie un.
  Atténuation : signature explicite + `.test.mjs` du sélecteur + checklist manuelle.
- Si l'unification `charge` / `phase` change quoi que ce soit d'observable au payload, un test
  `buildDeclarePayload` est **mis à jour explicitement + justifié en commit** — jamais un `.expected`
  ré-enregistré à l'aveugle.

**Fichiers** : `client/src/lib/assaultDeclaration.js` (reducer + sélecteurs, pur) +
`useAssaultDeclaration.js` (hook wrapper) + idem mêlée + 2 `.test.mjs`. 6 fichiers = juste.

**Découpe** : M0.4-a (`assaultDeclaration.js` + test, aucun câblage) → b (câblage PJ) → c (câblage MJ)
→ d (`meleeDeclaration.js` + test) → e (câblage mêlée PJ puis MJ) → f (reset : ~15 setters → 3
appels) → g (unification `charge`, ou reportée). Un pas = un commit, ancien `useState` retiré dans le
même. **Risque : MOYEN-ÉLEVÉ** (état interne de 2 gros composants) **mais le mieux fileté du chantier**
(golden master teste exactement la sortie à préserver + reducers `.test.mjs`).

### 5.9 Module 4 — `CombatDeclareActionList` (liste groupée, D5/D6/D7/D9/D13)

**Le cœur visuel.** Remplacer « tuiles ACTION + bloc ARMEMENT + panneau droit » par une **liste
d'armes groupée** (Distance / Contact) où **choisir une arme = déclarer cette attaque** (D5), en deux
colonnes (D6), Rechargement en col. 2 (D7), Déplacement en ligne distincte au-dessus (D13), sélection
sans radio (D9). **Consomme** : module 2 + 3 + M0.4. **Ne fait que du rendu + du câblage** (golden
master garde le payload). L'exclusivité CaC ⊕ Tir devient **automatique** (une arme sélectionnée).

- **Seule vraie logique neuve** : `client/src/lib/weaponList.js` — `buildWeaponList(sel) → { distance:
  WeaponRow[], contact: WeaponRow[] }`, normalisateur pur PJ/MJ (`shared/weaponSlots.js` est
  importable `node --test`, `[VÉRIFIÉ]`), `+ .test.mjs` (arme mixte 2 groupes, mains nues permanente,
  arme naturelle inéligible, MJ 4 slots, inventaire PJ).
- **Panneaux col. 2** : `AssaultRangedPanel` / `MeleeCombatPanel` **réagencés** en colonne étroite
  (~264 px) — **pas 100 % « CSS only »** : `RL_BUTTONS` (`flex-wrap`) et les rows segmentés vont
  wrapper, 2-3 rows à retoucher (labels courts ou empilé). Silhouette (D11) : 2 sous-colonnes.
- **Modes de combat CaC** (Charge/Défensif/Retraite) : **restent où ils sont** dans `MeleeCombatPanel`
  (PO2 tranché — « pourquoi changer d'un coup »).
- **`mapSelected` (Set PJ) / `isAttackActive`+`isMeleeSetup` (MJ)** → remplacés par « quelle arme
  sélectionnée ». **Le retrait de `mapSelected` (4d) doit reconstruire le champ `actions` de
  l'émission `COMBAT_ANNOUNCE_PREVIEW` dans `CombatActionWindow.jsx:395`** (fenêtre PJ) depuis le
  nouvel état (arme distance → `'attack'`, contact → `'melee'`, move → `'move'`, reload → `'reload'`)
  — **pas juste du rendu**.
- **`fire_mode`** arrive ici (retiré du corps au module 3) ; `AssaultRangedPanel` a déjà la « Section
  mode de tir » → `CombatDeclareStateSelector` devient **code mort, supprimé par ce module** (re-grep
  « mort » au moment du 4d — sessions parallèles).
- **États grisés de la liste d'armes** (R5) : `mortallyWounded` (interdit Attaque/CaC/Rechargement),
  `isStunned`, `isAmmoEmpty`, `weaponNotDrawn`, pas d'arme de distance (MJ) → ligne d'arme grisée +
  tooltip (miroir de la logique de grisage des tuiles actuelles).
- **Coût UX de D5, assumé** : sélectionner une arme = s'engager ; changer d'arme = reset de la config
  col. 2 (PO-M4-e). On ne peut pas parcourir les détails d'une arme sans perdre sa config en cours.
  Atténuation « config par arme » (`Map<weaponId, config>`) **rejetée** (over-engineering).

**Découpe** : 4a (`buildWeaponList` + test) → 4b (col. 1 : ligne Déplacement + liste groupée +
sélection, câblé PJ puis MJ ; col. 2 reste l'ancien panneau temporairement) → 4c (col. 2 réagencée) →
4d (segment `Tir │ Recharger` distance seule ; suppression `CombatDeclareStateSelector` ;
`mapSelected` retiré + reconstruction `actions`) → 4e (exo : **mini-cadrage**, col. 2 fortement
réduite — pas une simple bascule). **Risque : ÉLEVÉ** (corps des 2 fenêtres) — module 0 + M0.4 en
filet ; 1 sous-module validé (golden master + navigateur Saar) avant le suivant.

**Option de dé-risquage à proposer à Saar** : prototyper le **4b** contre les fenêtres **actuelles**
(avant 2/3/M0.4) — jetable — pour trancher tôt « est-ce que *l'arme EST l'action* fonctionne à
l'usage ? » avant d'avoir empilé 3 modules.

**Cible écran : PC 1920 px+** (PO3(a) tranché). Cluster satellite (~90) + fenêtre (720) = ~820 px,
reste ~1100 px de carte. Côte-à-côte col. 1 + col. 2, **pas de pop-out**.

### 5.10 Module 5 — `CombatDeclareFooter` (pied unifié, D12)

**Responsabilité** : un pied unique, consommé via le slot `footer` du frame :
`[pastille INI] [message de statut centré] [Passer le tour (ghost)] [Déclarer (primaire)]`.
**Introduit le bouton explicite « Passer le tour »** que B5 avait renvoyé ici. **Ne touche pas** le
calcul INI (`CombatDeclareIniWidget`, intact), le payload, `CombatDeclareErrorBanner` (reste au pied,
ligne séparée au-dessus des boutons — cohabite ≤ 4 s avec le message de statut, acceptable).

**Le vrai changement de comportement** : le bouton Déclarer est grisé si `!(hasCompleteAction &&
canDeclare)` (lève le coût intérimaire B5 « un mis-clic passe le tour » → **résout la contrainte de
déploiement B5** : B5 + module 5 partent ensemble).

| Notion | Définition | Qui la calcule |
|---|---|---|
| `canDeclare` | les actions **sélectionnées** sont valablement configurées | **`assaultCheck().valid && meleeCheck().valid && reloadCheck().valid`** (`declareChecks.js`) — remplace le `assaultValid`/`meleeValid`/`reloadValid` inline B5 dans les 3 fenêtres |
| `hasCompleteAction` | y a-t-il **quelque chose à déclarer** : attaque ∨ CaC ∨ reload ∨ move ∨ `hasDeliberateStateChange` ∨ action rapide | `hasSomethingToDeclare({6 drapeaux})` — **liste canonique** partagée (pas dupliquée PJ/MJ) ; les drapeaux calculés en fenêtre |
| `blockReason` | raison unique et lisible du grisage | **`buildBlockReason({assault, melee, reload})`** — mince : premier `.reason` non nul, précédence Tir → CaC → Rechargement. Les *raisons* viennent des mêmes `*Check` que `canDeclare` — **une seule dérivation**. |

**5a codé (2026-08-29, `0a9dfe9` — refait après analyse critique)** : `declareChecks.js`
(`assaultCheck`/`meleeCheck`/`reloadCheck` → `{valid, reason}`, `buildBlockReason`,
`hasSomethingToDeclare`) + `hasDeliberateStateChange.js` + 21 tests. **Source unique** : le booléen de
validité et le texte de blocage sortent de la même évaluation (l'ancien `buildBlockReason(bag)`
ré-encodait les conditions — dérive silencieuse possible). C'est le travail des sélecteurs M0.4, tiré
en avant par l'ordre B → M0.4 s'allège, la validité (**zéro test aujourd'hui**) est testée maintenant.
Écart iso-comportement **documenté** : le MJ gagne un contrôle d'arme / `chargeHasMove` côté client
qu'il n'avait pas (le serveur les refusait déjà — jamais un blocage à tort).

- **Déclarer actif ⟺ `hasCompleteAction && canDeclare`.**
- Le chevauchement `SELECT_ATTACK` (sélectionner une attaque auto-dégaine → `decl.weapon = 'drawn'`
  avant la cible) rend `hasCompleteAction` vrai avant la cible → **OK** : `canDeclare` gate,
  `blockReason` guide (« Choisir une cible »). **Pas de branche spéciale.**
  *Bug pré-existant lié* : explorer une attaque puis la désélectionner laisse `weapon='drawn'`
  orphelin (`clearAttackState` ne rerengaine pas) → « juste dégainer » se déclare par erreur.
  **Existe déjà aujourd'hui** ; le module 4 (« l'arme EST l'action », rerengaine à la désélection) le
  corrige. Module 5 ne touche pas la logique de tuiles.
- **`onPassTurn` = UN handler partagé** (analyse à charge 2026-08-29) : PJ / MJ / **drone** =
  `socket.emit(COMBAT_ACTION_DECLARE, { tokenId, state: {}, mapActions: {} })` — `[VÉRIFIÉ]` le
  serveur l'accepte pour tout type (`mapActions: {}` → aucune logique drone-spécifique). Exo =
  `handleDeclare()` (envoie déjà `state: {}`). Le pied prend `onPassTurn` + `tokenId` en props ;
  bouton gaté sur `!!activeSlot`.
- **Drone** : footer **« Passer le tour » uniforme dès le module 5** (émit direct, pas de course
  `setState`). La tuile « Passer » de `DroneDeclareSection` reste (retirée au module 4), redondante
  mais inoffensive. **Plus de `showPassTurn={false}`.**
- **PO-M5-e tranché** : « Passer le tour » = bouton secondaire constant, ne se promeut jamais.
- **PO-M5-f REJETÉ (analyse à charge 2026-08-29)** : « Passer le tour » reste **toujours cliquable**
  (D12 au pied de la lettre). L'auto-dégaine (ci-dessus) créait un piège avec « Passer grisé si
  action en cours » (impossible de passer après un clic exploratoire). Cliquer « Passer » envoie
  `state: {}` + `mapActions: {}`, jette la demi-config — sans conséquence dans un combat arbitré tour
  par tour, et le bouton est explicite.
- **`isBusy` / verrou `isDeclaring` exo** : **supprimé au 5d** (pas propagé en prop). L'exo est la
  seule fenêtre avec un verrou d'envoi ; le garde serveur `has_announced === false` est idempotent
  (PJ/MJ n'en ont pas et n'ont aucun problème). Changement de comportement → validation Saar au 5d.
- **`statusMessage`** = `blockReason` ∨ destination move `[x,y]` ∨ « Prêt » (précédence dans cet
  ordre). L'**erreur allures drone** reste un **élément distinct** (indicateur d'échec dur, pas un
  statut) — pas replié dans `statusMessage`.
- **PO-M5-d** : bouton primaire sur `.btn-tac` (cyan) comme base ; l'accent famille arrive au module 2.

**`statusMessage`** : le **composant** compose (il a `t`) depuis `blockReason: string|null` +
`moveDestination: {x,y}|null` + `hasCompleteAction: bool` — pas de string pré-rendue par la fenêtre.
Précédence `blockReason` > destination > « Prêt » ; vide si `!hasCompleteAction && !blockReason`.
L'**erreur allures drone** reste un **élément distinct** rendu par la fenêtre (échec dur, pas un
statut). CSS du footer en **tokens `--combat-*`** (`--combat-dim`, `--combat-border`…), jamais de hex
en dur.

**Risque : FAIBLE-MOYEN.** Le module touche `canDeclare` des 3 fenêtres (rebranche sur `declareChecks`)
— mais `declareChecks` est testé (21 tests) et iso-comportement documenté. Filet : golden master
(payload « Passer » = déclaration vide, couvert) + `declareChecks.test.mjs` + `hasDeliberateStateChange.test.mjs`.
**Zone sans filet** : le rendu du footer + l'affichage `blockReason` → checklist manuelle par cas.

**Ordre (B, §5.0)** : **premier module** — `CombatDeclareFooter` construit et validé dans les pieds
actuels (`.combat-float-footer` / `.combat-win-footer`), re-slotté dans le frame au module 2.

**Découpe** :
- **5a** ✅ (`0a9dfe9`, `119aa6c`) `declareChecks.js` (`assaultCheck`/`meleeCheck`/`reloadCheck` →
  `{valid,reason}`, `buildBlockReason`, `hasSomethingToDeclare`) + `hasDeliberateStateChange.js`
  (4 axes : position/weapon/fire_mode/vitesse) + 21 tests.
- **5b** ✅ (`5682b8f`) `CombatDeclareFooter.jsx` + CSS (`--combat-*`) + `declareFooter.*` + câblage
  `CombatActionWindow` : `canDeclare` rebranché sur `declareChecks` (iso vérifié ligne à ligne),
  `hasCompleteAction` = seul changement de comportement (Déclarer exige « qqch à déclarer »).
  `onPassTurn` = émit direct `{tokenId, state:{}, mapActions:{}}` (drone inclus). **Validation
  navigateur Saar en attente.**
- **5c** ✅ (`02f0aed`) câblage `CombatGmDeclareWindow` — `canDeclare` MJ rebranché en préservant
  `(isActivePnj && …) || (isActiveDrone && …)` ; primitifs `meleeStarted`/`attackStarted` définis
  une fois, `isMeleeSetup`/`isAttackActive` simplifiés dessus (byte-équivalent) ; pas de `reloadCheck` ;
  bouton vert → cyan (D12) ; `hasActiveSlot = isActivePnj || isActiveDrone`.
- **5d** ✅ (`f199ff4`) câblage `CombatExoActionWindow` + **verrou `isDeclaring` supprimé** (l'exo
  était la seule fenêtre à en avoir un ; garde serveur idempotent). Retirés avec lui : la tuile
  « Envoi… », l'ajustement-pendant-le-rendu `handledDeclareErrorId`, `useSessionStore(declareError)`,
  la clé `exoActionWindow.sending`.

**Module 5 codé (5a-5d). Écarts iso assumés + documentés** : PJ vérifié ligne à ligne ; MJ légèrement
plus strict (`started` = `isAttackActive`/`isMeleeSetup` → Déclarer grisé + raison en mode ciblage
sans cible, au lieu de dropper l'action silencieusement ; + contrôle d'arme client) — jamais un
blocage à tort. **Validation navigateur Saar en attente** (checklist : tour vide → Déclarer grisé /
Passer OK ; action incomplète → raison au centre ; `fire_mode` seul → Déclarer actif ; Charge sans
cible → raison ; MJ en attente d'un PJ → 2 boutons grisés ; bouton MJ cyan ; drone/exo Passer OK).

---

## 6. Migration / rollback

- **Lot B + B5** : chaque item = un commit isolé, **`git revert` suffit**. Aucun feature flag.
- **Module 0** : extraction mécanique + tests `.mjs` neufs — additif, `git revert` trivial.
- **Modules 2-5** : chaque module branché retire l'ancien code dans le même commit → **`git revert` du
  commit du module (ou de la fenêtre) = rollback**. **Pas de feature flag** : cohabiter deux
  `CombatActionWindow` de 1500 l. pendant une transition = enfer de merge + double surface de bugs.
- **Aucun de ces modules ne touche un schéma DB.** (La persistance `state.*` exo est déjà générique,
  `[VÉRIFIÉ]` §2.2.)
- **B5 ne se déploie pas sans le module 5** (§5.2).

---

## 7. Reste spécifique au MJ après la refonte (ne pas survendre « partagé »)

Après les 5 modules, `CombatGmDeclareWindow` garde une dizaine de particularités qui **ne se
partagent pas** : données batch (`equipment[tid]`), navigation de slots (`activeTokenId`
auto-advance), émission `pjPreview` (+ reconstruction de son champ `actions`), chaîne récursive
`selectNext` + `isMountedRef` + `*CountRef` (StrictMode), `setHasPassed` drone, `meleeValid` neuf
(B5), le cas `reloadValid` PJ-seul **absent** côté MJ, le message d'attente PJ + le bouton « Passer »
(skip PJ), le badge d'arme du roster, le `mapAction` reload booléen nu (sans arme ni munition).

**Partagé** = frame + puces d'état + hooks M0.4 + `CombatDeclareFooter` + `buildWeaponList` + panneaux
col. 2. Le MJ reste un **cousin**, pas un jumeau.

---

## 8. Hors-scope

- La phase RÉSOLUTION (`CombatModifiersWindow` / `CombatCacModifiersWindow` / `CombatDamageWindow` /
  `CombatStunWindow`) — **sauf** la valeur i18n « Assaut » (B3). Ces 4 fenêtres sont sur
  `--bg-session-*` + ~60 hex en dur + accent doré, **0 occurrence `--combat-*`** (`[VÉRIFIÉ]`) → les
  harmoniser = **passe CSS distincte future** (`ROADMAP.md`, 1 ligne — **pas un module**, R4).
- Le dispatch serveur Tir/CaC × PJ/PNJ/Drone/Exo (`ROADMAP.md` §5).
- La fusion des orchestrateurs (rejetée, REWORK-05).
- Le calcul métier (`combatIniCost`, `combatSections`, allures) — intact.
- L'i18n serveur des `COMBAT_DECLARE_ERROR` (~70 sites) — différée `PLAN_LOCALISATION.md` §8.
- Migration TypeScript. **Aucune nouvelle dépendance** (pas de vitest/RTL, pas de XState).
- Conversion complète hex → tokens des panneaux (~260 occurrences) — chantier CSS distinct, non
  ouvert.
- La barre d'action ancrée non-couvrante (style Argon HUD) — contraire au paradigme Enclume, non
  ouvert.

---

## 9. Points ouverts encore à trancher

| # | Quand | Question |
|---|---|---|
| PO-M2-b/d/e | au code du module 2 | roster PJ dans le frame ou enfant ; `max-height` unifié ; largeur dynamique. Mineurs, non bloquants. |
| PO-M3-repli | si la synchro satellite résiste | montrer les replis à Saar **avant de s'entêter** (R3 : jamais promu de sa propre initiative). |
| PO-M4-e | au cadrage code du 4c/4d | changement d'arme = `assault.reset()` / `melee.reset()` — est-ce le bon geste ? |
| PO-M4-4b-proto | **avant** de lancer 2/3/M0.4 | proposer à Saar un prototype jetable du 4b contre les fenêtres actuelles (valide D5 tôt). |
| PO-M5-a | à M0.4 | M0.4 peut simplifier le remplissage du `bag` de `buildBlockReason` (sélecteurs `{valid, reason}`) — la fonction elle-même reste. |
| PO7 | faible valeur | `CombatOverlay.jsx` : nettoyer les 4 gardes de montage ANNONCE en une table, ou laisser (au module 5 si un fichier le rend trivial). |

**Filet automatique par module** : M0.4 + module 4 = golden master (couvre la sortie) + reducers /
`weaponList` `.test.mjs`. **Modules 5 et 3** = pas de filet auto, mais **construits en autonome dans
les fenêtres actuelles (ordre B)** → validation à l'œil, petites pièces. **Module 2** = pas de filet
auto **et** échange structurel → **M-E2E local (§5.5) est son filet**, + un commit par fenêtre +
checklist manuelle + validation Saar après chaque sous-module (R2).

---

## 10. Ce qui n'est PAS fait en V1 est aussi important

- On ne fusionne pas les orchestrateurs. Le MJ garde sa nav séquentielle et sa preview.
- On ne réécrit pas `AssaultRangedPanel` / `MeleeCombatPanel` / `DroneWeaponPanel` — on les réagence.
- On ne touche pas au calcul d'Initiative ni au dispatch serveur.
- Lot B + B5 + module 0 sont codés (§5.1-5.4). **Ordre B (§5.0)** : pied → satellite → M-E2E → frame
  → M0.4 → liste. Un module validé avant le suivant.
