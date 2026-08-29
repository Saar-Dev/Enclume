# PLAN_RW_DECLARE_DESIGN — Refonte des fenêtres de déclaration de combat (design + technique associée)

> **Statut : conception / planification — aucun code hors lot B / B5 / module 0.** 2026-08-28,
> **révisé** après analyse à charge (§11) puis cadrage M0.4 / PO6 (§12), module 2 (§13).
>
> **Décision de périmètre — Saar 2026-08-29 : chantier ÉLARGI, assumé.** À l'origine « passe design
> seule » (le rework technique était `PLAN_RW_DECLARE_WINDOWS`, clos). Mais **D5 « l'arme EST
> l'action » n'est pas un changement graphique** — c'est un changement du modèle d'interaction qui
> touche l'état de sélection (assaut/mêlée). Plutôt que de scinder en deux chantiers, Saar assume
> **explicitement** que ce chantier porte les deux volets :
> - **volet design** (re-skin pur, ne touche pas la logique de déclaration) : modules 2, 3, 5 ;
> - **volet technique** (touche l'état de sélection / la structure) : module 0 (fait), M0.4
>   (`useAssaultDeclaration` / `useMeleeDeclaration` — c'était déjà « la vraie cible du module 6 » de
>   `PLAN_RW_DECLARE_WINDOWS`), module 4 (D5).
>
> Ce n'est **pas** une dérive de périmètre non maîtrisée (le risque, relevé par Saar le 2026-08-29) —
> c'est une extension décidée, tracée ici. Le fil de conversation qui l'a établie reste en
> **planification seule** (aucun code).
>
> **Autres décisions Saar 2026-08-28** : validation navigateur **en bloc à la fin** (Q1/Q4) ;
> maquette non réalisable → **adapter et montrer**, pas de STOP (Q3) ; satellite exo **sans
> migration** (Q5, §12.5) ; glyphes **jamais en dur** (fichiers dans `assets/status/`, rework Saar).
>
> **Responsabilité** (Règle 1, `docs/RegleDocumentaire.md`) : le **langage visuel unifié** + la
> **structure commune** des trois fenêtres de déclaration d'action en phase ANNONCE
> (`CombatActionWindow`, `CombatGmDeclareWindow`, `CombatExoActionWindow`), **et le refactoring
> d'état que le modèle d'interaction cible (D5) impose**. Reprend la « passe de design dédiée » que
> `PLAN_RW_DECLARE_WINDOWS.md` (clos, archivé `docs/Old/`) a différée en annulant son module 5
> (`CombatDeclareFrame`) + le module 6 (`useHumanDeclare`) qu'il avait nommé sans le faire.
>
> **Ne traite pas** : la **fusion des orchestrateurs** (rejetée, REWORK-05 — M0.4 extrait des
> sous-états partagés, il ne fusionne pas les 3 composants) ; le calcul métier (autorité
> `shared/combatIniCost.js` / `combatSections.js`, intact) ; le dispatch de résolution Tir/CaC serveur
> (`ROADMAP.md` §5) ; la phase RÉSOLUTION (`CombatModifiersWindow` etc.) — **sauf la valeur i18n
> « Assaut » qui la traverse** (lot B3).
>
> **PLAN temporaire** (Règle 10) : à clôture, les invariants définitifs vont dans `docs/SYSTEME/COMBAT.md`
> (§ Fenêtres de déclaration) + `docs/SYSTEME/REACT.md` P58 ; les tokens dans `client/src/index.css` ;
> ce document est archivé.
>
> **Maquette de référence** (5 itérations avec Saar, **validée sur le fond** le 2026-08-28) :
> `https://claude.ai/code/artifact/3b8fb52d-aa6c-4905-a0d1-d6712c8c44d7` — 4 artboards : Humain/MJ-PNJ,
> Drone, Exo, « Décisions ». Elle valide le **look** ; elle **ne prouve pas** la faisabilité de la
> structure (footprint écran, réagencement des panneaux, satellite qui suit la fenêtre) — cf. §7 PO3.

---

## 1. Objectif

Trois fenêtres qui font le même geste (déclarer une action en phase ANNONCE) ont aujourd'hui trois
langages visuels, trois hiérarchies, trois logiques. Retour Saar 2026-08-28 : *« les fenêtres
DRONE/HUMAN/EXO ne se ressemblent pas, pas la même hiérarchie, pas la même logique. Zéro pointé. »*

**But** : une **seule structure visuelle** (même ossature, mêmes blocs, mêmes composants, même
disposition) déclinée par un **accent de famille** et par le **contenu des listes** — jamais par une
divergence de châssis. Débloquer au passage : le module 5 de `PLAN_RW_DECLARE_WINDOWS` (chrome
partagé), les sélecteurs d'état exo (`ROADMAP.md` §1 point 4), la réconciliation des tokens
`--combat-*`.

**Ce que « une seule structure » ne veut PAS dire** (analyse à charge, §11) : la fusion des
orchestrateurs reste rejetée (REWORK-05). Le MJ garde sa **navigation séquentielle de slots**
(`activeTokenId` avance via `COMBAT_SLOT_ADVANCED`, roster non cliquable `[VÉRIFIÉ]`) et sa **preview
temps réel** aux joueurs ; le PJ garde ses **multi-phases** (ANNONCE + RÉSOLUTION + surprise). Partagé
= le **châssis, la disposition, les blocs, le pied, les tokens**. Pas le pilotage.

Méthode : `docs/METHODO_PLAN.md` + `PLAN_LOCALISATION.md` §1 (i18n = critère de clôture). Un module à
la fois, validé navigateur avant le suivant.

---

## 2. État des lieux `[VÉRIFIÉ]` — lecture 2026-08-28

### 2.1 Les trois fenêtres

| | `CombatActionWindow` (PJ + drone PJ) | `CombatGmDeclareWindow` (MJ) | `CombatExoActionWindow` (exo) |
|---|---|---|---|
| Famille CSS | `combat-float-*` | `combat-win-*` (+ poignée basse, habillage de section différent) | `combat-float-*` |
| Largeur | 360 / 720 (panneau droit) | 440 | 340 |
| Titres de section | 1 couleur (`--combat-section`, 8 px) | **1 couleur codée en dur par section** (`#aa6a30`, `#aa8a30`, `#5a8a5a`…) | 1 couleur |
| Fond des tuiles ACTION | `rgba(255,255,255,0.02)` (≈ invisible) | `#0a1018` + bordure `#15212e` (visible) | `rgba(255,255,255,0.02)` |
| Bouton de pied | `t('actionWindow.declareActionButton')` | `DÉCLARER` en dur → **B1 corrigé** : `t('actionWindow.declareActionButton')` (`CombatGmDeclareWindow.jsx:1056`) | `t('actionWindow.declareActionButton')` — valeur B2 corrigée `"Déclarer l'action"` |
| État inline | `useState`/`useReducer` : **25** (1 `useReducer` + 24 `useState`, + 3 `useRef`) `[VÉRIFIÉ]` grep 2026-08-29 | **20** (1 `useReducer` + 19 `useState`, + 6 `useRef`) `[VÉRIFIÉ]` | délégué à `useExoDeclare` |
| Roster | oui (si > 1 token) | oui (non cliquable, `[VÉRIFIÉ]` — navigation = auto-advance) + badge arme | **absent** |
| État tactique | sections TACTIQUE + ARMEMENT dans le flux | idem | **absent** (dette) |
| « Passer le tour » | **impossible** (`canDeclare` exige `stateChanged \|\| hasAction`) `[VÉRIFIÉ]` | **impossible** (idem, `canDeclare` l.415) `[VÉRIFIÉ]` | implicite (déclarer vide) |
| Drone « Passer le tour » | tuile toggle explicite (`useDroneDeclare#hasPassed`) `[VÉRIFIÉ]` | idem | — |

### 2.2 « Assaut » dans `combat.json` `[VÉRIFIÉ]` (grep 2026-08-28)

| Clé | Valeur | Rendu par | Phase |
|---|---|---|---|
| `mapActions.attack.label` | `"Assaut (tir)"` | tuile ACTION (`MAP_ACTIONS`) | ANNONCE |
| `mapActions.melee.label` | `"Corps à corps"` (déjà OK) | tuile ACTION | ANNONCE |
| `actionLabels.assault` | `"Assaut (tir)"` | `CombatDeclareLog` (`ACTION_LABELS`) | ANNONCE (log) |
| `actionLabels.melee` | `"Assaut (CaC)"` (**incohérent**) | `CombatDeclareLog` | ANNONCE (log) |
| `combatOverlay` targeting `ranged` (l.21) | `"Assaut — Cliquez sur la cible"` | overlay de ciblage | ANNONCE |
| `…header` (l.534) | `"{{shooter}} — Assaut — {{target}}"` | panneau de résolution | **RÉSOLUTION** |

→ « Assaut » **traverse la phase RÉSOLUTION**. C'est de la **valeur JSON** partout (clés stables) —
un changement sans risque de code, mais qui doit être **complet** pour ne pas laisser un split
terminologique en plein milieu du flux de combat (analyse à charge §11 point 6).

### 2.3 Ce qui est déjà propre (à réutiliser, ne pas réécrire)

- **Briques `CombatDeclare*`** (`REACT.md` P58) : `CombatDeclareStateSelector`,
  `CombatDeclareStateChip` (API `stateKey`), `CombatDeclareIniWidget`, `CombatDeclareErrorBanner`,
  `CombatDeclareLog`. `[VÉRIFIÉ]`
- **Calcul métier** : `shared/combatIniCost.js` (autorité coût INI client+serveur), `combatSections.js`
  (`STATE_DEFS`, `nextKey`, `FIRE_MODE_VARIANTS`, `computeFireVariant`). `[VÉRIFIÉ]`
- **Panneaux détail** : `AssaultRangedPanel` (`[VÉRIFIÉ]` — sections Arme / Nombre de tirs / Cible(s) /
  Type de tir / Mode de tir CC-RC-RL + simple-visé-répétition / Viser une localisation), `MeleeCombatPanel`.
  Le contenu de la colonne 2 (§4). **Non réécrits — réagencés en colonne** (peut être moins trivial
  que « réagence » : sections à bordures internes, largeur actuelle 360 px → 264 px — cf. §7 PO3).
- **Tokens combat** : `client/src/index.css` l.136-184. `[VÉRIFIÉ]`

### 2.4 Le design system Enclume `[VÉRIFIÉ]` — bundle `temp/wizard/`

- Rétro-conçu depuis le code, source de vérité = `client/src/index.css`. Signature : eyebrow **10 px**
  all-caps tracké ; boutons **sentence case** ; nombres **Share Tech Mono** ; sélection = bordure
  accent ; spacing 4 px ; radius 4/6/12.
- **HUD combat = 3ᵉ palette volontairement distincte** (cyan `#3a8aaa`, dense, dure). À **conserver**.
- Le README DS glose « Assaut = ranged attack » — **périmé** par D15 (le DS n'est pas dans la
  hiérarchie d'autorité, `RegleDocumentaire.md` §12).
- Iconographie : cadre hexagonal HUD, accent par famille (`assets/status/*.svg`).
- Prototype `Professions.dc.html` : pied `[ghost] [statut centré] [primaire]`, `dis` + phrase = **patron
  maison déjà établi**.

### 2.5 Terminologie RAW `[VÉRIFIÉ]`

RAW : « Combat au contact » p.223 / « Combat à distance » p.226 ; tableau de localisation des dommages :
colonnes « Distance » / « Contact ». Base : `ref_category='Arme de contact'`. « Assaut » = invention
maison, absente du RAW et de `VOCABULARY.md` (corrigé : V2.6). « Mêlée » = import D&D, jamais employé.

---

## 3. Décisions actées (Saar, 2026-08-28)

| # | Décision |
|---|---|
| D1 | **Une seule structure visuelle**, PJ / MJ-PNJ / Drone / Exo. Châssis, disposition, blocs, pied, tokens = partagés. **Pilotage non partagé** : le MJ garde navigation séquentielle + preview, le PJ garde multi-phases. `[VÉRIFIÉ]` le roster MJ n'est **pas** cliquable — l'idée « clic = navigue » de la v1 du plan était une invention, retirée. |
| D2 | **Skin HUD combat cyan conservé.** Le Wizard = référence de discipline structurelle, pas de palette. |
| D3 | **Accent par famille** via `--combat-accent-*` (fg/bg/border) basculé par `data-family`. PJ vert `#50c878`, MJ-PNJ orange `#c86030`, Drone teal `#30aaaa`, **Exo violet `#9858c8`** (confirmé). Cyan `--combat-title` = chrome partagé uniquement. Retire l'accent bleu `#5b8dee` parasite des sélections. |
| D4 | **Réconciliation des tokens `--combat-*`** (module 1) : un seul jeu canonique dans `index.css` (vocabulaire réel + export DS), `--combat-accent-*`, `--combat-drone-*` (existe) + `--combat-exo-*` (neuf), suppression des hex en dur des objets `W`/`S` des `.jsx`. Dérogation assumée à D8 de `PLAN_RW_DECLARE_WINDOWS` — c'est la passe design que ce D8 réservait. |
| D5 | **L'arme EST l'action.** Liste d'armes groupée (Distance / Contact), choisir une arme = déclarer cette attaque. Plus de radio « Tir / Corps à corps » séparé, plus de bloc ARMEMENT redondant. Reprend la proposition exo de Saar, généralisée. |
| D6 | **Deux colonnes hiérarchiques** : col. 1 = armement (*quoi*), col. 2 = détail de l'arme choisie (*comment*, en-tête `→ Scorpion` à l'accent). La col. 2 n'est **jamais** d'autres actions. Absente si rien n'est sélectionné (fenêtre 1 colonne). |
| D7 | **Recharger vit dans la col. 2** — lié à une arme précise. En-tête : `Tir \| Recharger`, puis le détail correspondant. |
| D8 | **État tactique = fenêtre satellite** accrochée au bord gauche, se déplace avec la principale (mécanique à concevoir — cf. §7 PO3). Posture / Vitesse / Arme. « Statut, pas actions » (Saar). **Présent PJ / MJ / Exo, absent Drone.** Glyphes iconiques, peu de texte. Câblé sur `CombatDeclareStateChip`. Neuf pour l'exo. |
| D9 | **Pas de rond radio.** Sélection = bordure accent + fond teinté. |
| D10 | **Icônes = glyphes SVG produits par Saar** dans `client/public/assets/status/` : `stand`/`crounch`/`kneel`/`crawl` (posture), `actionNormal`/`actionDelayed`/`actionRush` (vitesse), `WeaponA`/`WeaponB`/`WeaponC` (arme rangée / main dessus / au clair), `contact` / `distance`. **Chargés en `mask-image: url(/assets/status/x.svg)`, jamais intégrés en dur** (Saar 2026-08-28 : garder les fichiers dans le répertoire, rework en cours), recolorés à l'accent. Vérif 2026-08-28 (§12.6) : `crawl.svg` cassé (tracé hors `viewBox`), à recadrer par Saar ; les 11 autres OK. |
| D11 | **Silhouette « viser une localisation »** conservée, en **deux sous-colonnes** dans la col. 2 (silhouette \| résumé). Repliée par défaut. |
| D12 | **Pied** : `[pastille INI] [message de statut] [Passer le tour] [Déclarer]`. Pastille `actuel → projeté` (ex. `INI 7 → 2`), **deux couleurs** : normale, rouge si tour perdu (INI ≤ 0) — jamais un blocage. « Passer le tour » = **second bouton ghost, plus petit, toujours disponible**. « Déclarer » = primaire, actif si l'action est valide, sinon grisé + raison au centre. |
| D13 | **Déplacement** = ligne distincte **au-dessus** de la liste ACTION (cumulable, hors du choix exclusif) — traitement visuel propre (encadré, « + définir la zone » / « 8 m · −5 »). |
| D14 | **Fond PCB discret** (patron `ChangelogPanel.jsx`) sur header / pied / satellite uniquement, opacité < Changelog. **Détail d'implémentation du module 2, pas une décision structurelle** — pas de point ouvert dédié. |
| D15 | **Terminologie** (`VOCABULARY.md` V2.6) : actions « Tir » / « Corps à corps » ; catégories « Distance » / « Contact ». « Assaut »/« Mêlée » proscrits en UI, **y compris en phase RÉSOLUTION** (§2.2). Codes internes `action_key='assault'`/`'melee'` **inchangés**. |

---

## 4. Structure cible (identique aux 4 familles)

```
┌─ SATELLITE « Statut » ─┐  ┌─ FENÊTRE PRINCIPALE ───────────────────────────┐
│ [glyphe] Posture        │  │ HEADER   hexa famille · nom · N/N déclarés      │
│ [glyphe] Vitesse        │  ├────────────────────────────────────────────────┤
│ [glyphe] Arme           │  │ + Déplacement                      8 m · −5     │  ← D13, cumulable
└─ (absent pour un drone) ┘  ├─ COL. 1 : ACTION (un choix) ──┬─ COL. 2 : détail┤
                             │ [hexa] DISTANCE               │ → Scorpion       │
                             │   Scorpion            24/24   │ [Tir | Recharger]│  ← D7
                             │ [hexa] CONTACT                │ Cible  …         │
                             │   Couteau Congre              │ Mode de tir …    │
                             │   Mains nues                  │ Tir simple/visé/ │
                             │ (armes naturelles…)           │   répétition …   │
                             │                               │ Deux armes …     │
                             │ ── ROSTER (repliable) ──      │ Localisation :   │
                             │   ▶ Baboulinet         INI 7  │  [silhouette|résumé]
                             │   ✓ Jean Val-Jean      INI 11 │                  │
                             ├───────────────────────────────┴──────────────────┤
                             │ [INI 7 → 2] Prêt  [Passer le tour] [Déclarer]     │  ← D12
                             └──────────────────────────────────────────────────┘
```

**États non-déclaration** `[VÉRIFIÉ]` — `CombatActionWindow` rend aussi : jet de surprise,
surpris-inactif, résolution (mon tour / pas mon tour), attente d'un autre déclarant, déjà déclaré.
`CombatDeclareFrame` (module 2) doit tous les héberger — ce sont des variantes simples (titre +
message), à inventorier au cadrage du module 2, pas à négliger.

**Ce qui varie par famille — rien d'autre :**

| | PJ | MJ / PNJ | Drone | Exo |
|---|---|---|---|---|
| Accent | vert | orange | teal | violet |
| Satellite | oui | oui | **non** | oui |
| Liste d'armes | inventaire du perso | équipement batch PNJ | 1 arme | armement exo (souvent 5) |
| Roster | si > 1 token | tous PNJ gérés (**non cliquable**, auto-advance) | — | — |
| Colonne 2 | complète (dual-wield, tir multi 1-3, visé, localisation) | complète | cible + mode | cible + mode (une attaque / Tour) |
| Pilotage | multi-phases | navigation séquentielle + `pjPreview` | multi-phases (dans `CombatActionWindow`) | ANNONCE seule |

### 4.1 Cas limites de « l'arme EST l'action » (D5) `[INFÉRÉ]` — à figer au module 4

- **Mains nues** : ligne permanente du groupe Contact.
- **Armes naturelles** (`char_mutations.natural_weapon_formula`) : lignes du groupe Contact.
- **Arme mixte** (contact + distance) : présente dans **les deux** groupes.
- **Dual-wield** : **option de la col. 2** (`showDualWieldSection` existe déjà, `AssaultRangedPanel` /
  `MeleeCombatPanel`).
- **Modes de combat CaC** (Charge / Retraite / Défensif) : `[INFÉRÉ]` — segments en tête de col. 2
  (`Attaque \| Défensif \| Charge \| Retraite \| Recharger`) ou sous-bloc ? Charge chaîne
  déplacement→cible. **Point ouvert PO2.**

---

## 5. Séquence

> **Historique** : round 2 (§11) limitait le périmètre engageable à lot B + B5 + module 1 et parquait
> les modules 2-5. Round 4 les a dé-parkés. **2026-08-29 : chantier élargi assumé** (en-tête) — les
> modules 2-5 + M0.4 sont **le chantier**, plus « en attente ». Ordre : §10. Rythme : cadrage →
> analyse à charge → code, séparés (checkpoint), un module validé avant le suivant.

### 5.1 À FAIRE MAINTENANT (aggrade sans condition) — lot B — **CODÉ 2026-08-28**

Client-only. **Trois passes** :

**Passe 1 — `combat.json` (valeur JSON seule, aucune clé) — FAIT** — B2 + B3, un commit :

| # | Contenu | Fait |
|---|---|---|
| B2 | 8 fautes d'accent du bloc `actionWindow.*` (`Déclarer l'action`, `Vous êtes surpris`, `Lancer le dé d'initiative`, `déterminer`, `Phase 2 — Résolution`, `Précipité (-5)`, `Phase 1 — Déclaration d'intention`, `Action déclarée`). | ✅ |
| B3 | Terminologie (`[VÉRIFIÉ]` grep exhaustif) : `targetLegend.ranged` → « Tir » ; `actionLabels.assault` → « Tir » ; `actionLabels.melee` « Assaut (CaC) » → « Corps à corps » ; `mapActions.attack.label` → « Tir » ; `droneWeaponPanel.ready` « Prêt à l'assaut » → « Prêt à tirer » ; `modifiers.header` (résolution, `CombatModifiersWindow.jsx:245`) → `{{shooter}} — Tir — {{target}}`. `fr.json` « fusil d'assaut » = RAW, intouché. | ✅ |
| B4 | Pastille INI : `iniWidget.pill` = `"INI = {{current}} -> {{projected}}"` (flèche ASCII, décision Saar) ; `CombatDeclareIniWidget.jsx` rend le format + aria mise à jour ; rouge si projeté ≤ 0 inchangé. `REACT.md` P58 disait déjà « current + delta » (pas « juste le chiffre »), pas de contradiction — précision ajoutée. | ✅ |

**Passe 2 — `CombatGmDeclareWindow.jsx` — FAIT** :

| # | Contenu | Fait |
|---|---|---|
| B1 | `DÉCLARER` en dur (l.1085) → `{t('actionWindow.declareActionButton')}`. Le MJ affiche « DÉCLARER L'ACTION » (CSS `.btn-tac-confirm` uppercase) comme joueur/exo. | ✅ |

**Passe 3 — `socketCombatAnnouncement.js` — FAIT (swap de mot)** : les ~9 messages `COMBAT_DECLARE_ERROR`
avec « Assaut » → « Tir » (« Tir drone/exo impossible », « Tir impossible », « Corps à corps et Tir
sont mutuellement exclusifs », « Tir : sélectionner une cible… »). **Ne corrige pas** la violation
i18n (serveur émet du FR en dur) — l'i18n-ification complète de `COMBAT_DECLARE_ERROR` (~70 sites,
changement de payload) est **différée** : `PLAN_LOCALISATION.md` §8 (Lot 6, décision Saar 2026-08-28).

**Testé** : `combat.json` JSON valide ; `node -c` serveur OK ; `eslint` widget (0/0) + GM (baseline
inchangée) ; `vite build` propre ×2. **Non testé** : parcours navigateur (validation en bloc,
`feedback_batch_tests`). Pas de script de résolution i18next dans le repo — vérif manuelle : clés
inchangées, `grep -i assaut combat.json` = vide.

### 5.2 B5 — « Passer le tour » déclarable pour un humain — **CODÉ 2026-08-28**

**Cadrage `[VÉRIFIÉ]`** : le serveur accepte déjà une déclaration vide — `socketCombatAnnouncement.js`
l.67 `if (!tokenId || !state) return` (un objet `{}` passe), l.78-79 valide chaque clé d'état
**seulement si présente**, puis pose `has_announced`. Le drone (`useDroneDeclare#hasPassed`) et l'exo
(déclaration vide) le font déjà. Seul le **client** bloquait : `canDeclare` exigeait
`hasAnyAction || stateChanged` (PJ, ex-l.642-644) / `stateChanged || hasAction` (MJ, ex-l.399-415).

**Question de fond (Saar)** — « autoriser une déclaration vide, ou modéliser explicitement une action
"ne rien faire" ? » → B5 = **le mécanisme** (débloquer `canDeclare`). Le **libellé explicite**
« Passer le tour » (le joueur *veut* passer, pas un mis-clic sur « Déclarer ») = **D12 / module 5**
(refonte du pied). Ajouter un swap de libellé maintenant = ré-introduire le code supprimé que le
module 5 re-supprime — churn, écarté.

**Fait** :
- `CombatActionWindow.jsx` : `hasAnyAction` + `stateChanged` supprimés (seuls usages) ;
  `canDeclare = isDrone ? droneDeclare.canDeclare : (assaultValid && reloadValid && meleeValid)`.
  Une action de combat *incomplète* reste bloquée — `assaultValid`/`reloadValid`/`meleeValid` valent
  `false` tant qu'une tuile sélectionnée n'est pas configurée.
- `CombatGmDeclareWindow.jsx` : `stateChanged` + `hasAction` supprimés ; **`meleeValid` neuf** (miroir
  d'`assaultValid` : un CaC en cours de configuration doit avoir une cible, ou être passif
  Défensif/Retraite, ou une Charge avec cible) ; `canDeclare = (isActivePnj && assaultValid &&
  meleeValid) || (isActiveDrone && droneDeclare.canDeclare)`.
- Exo : rien à faire (déjà déclarable vide).

**Coût intérimaire assumé** : le bouton « DÉCLARER L'ACTION » est actif dès l'ouverture de la fenêtre
(rien de sélectionné). Un mis-clic passe le tour. Recouvrable (combat arbitré tour par tour par le
MJ) ; le module 5 corrige le libellé.

**Testé** : `vite build` propre ; `eslint` = **baseline exacte** (6 problèmes GM pré-existants
inchangés, `CombatActionWindow` 0/0) ; résidus `hasAnyAction`/`hasAction`/`stateChanged` = 0 (hors
1 mention en commentaire).
**Non testé** : parcours navigateur (validation en bloc).

### 5.3 Module 1 — Tokens d'accent par famille (D3/D4) — **RE-CADRÉ round 4**

**Analyse à charge round 4** (inventaire ; recompté `[VÉRIFIÉ]` 2026-08-29, `#hex` seul) : ~**260
couleurs en dur** dans les 9 fichiers de fenêtres (`CombatGmDeclareWindow` 94, `CombatActionWindow`
56, `MeleeCombatPanel` 33, `AssaultRangedPanel` 25, `DroneWeaponPanel` 15, `DroneDeclareSection` 13,
`CombatExoActionWindow` 9, `CombatDeclareStateSelector` 7, `CombatDeclareStateChip` 6) — et la
plupart ne sont **pas** des accents (texte, bordures, rouges/verts de panneau). Les convertir toutes
= refonte CSS complète, churn, risque visuel
élevé. **La dette « 3 vocabulaires » n'existe pas au runtime** : l'export DS (`temp/wizard/`) n'est
**pas chargé** ; `index.css` a déjà un jeu `--combat-*` propre (pj/pnj/drone triplets, `--combat-ini-*`).

**Périmètre réel du module 1, réduit** :
- `+ --combat-exo-*` (fg/bg/border, violet `#9858c8`) dans `index.css` — 3 lignes, zéro risque.
- Introduire `--combat-accent-*` **mappé par famille**, consommé par `CombatDeclareFrame` (module 2) —
  donc **le module 1 fusionne dans le module 2** (le `data-family` n'a de sens qu'avec le chrome
  partagé). Pas de module 1 autonome.
- Le remplacement des ~25 occurrences d'accent bleu parasite (`#5b8dee` / `rgba(91,141,238,*)`) se
  fait **au fil des modules 2/4/5**, sur les fichiers qu'ils touchent déjà — pas en passe séparée.
- La conversion complète hex → tokens des panneaux = **hors périmètre** (chantier CSS distinct, non
  ouvert).

### 5.4 Modules 0-5 — la refonte, faite avec un filet (round 4 : dé-parkée)

**Round 4 (rappel des priorités par Saar, 2026-08-28)** : « qualité structurelle >>> vitesse ;
si on doit rework pour stabiliser, on le fait ; on n'est pas pressés ». → les modules 2-5 ne sont
**plus « en attente d'un backlog plus mince »**. Ils se font, **après le filet** (module 0), qui est
lui-même une aggradation légitime que ces priorités endossent explicitement.

**Module 0 — Extraire la logique de déclaration en modules purs testés (PAS « ajouter vitest »).**
`[VÉRIFIÉ]` la philo de test d'Enclume : 127 fichiers `*.test.mjs` (`node --test`, fonctions pures ;
compte 2026-08-29, en croissance) +
Playwright E2E (`tests/e2e/`, `@playwright/test` installé) ; **aucun test composant, choix assumé**.
`client/src/lib/declarationReducer.test.mjs` + `client/src/components/combatSections.test.mjs` +
`shared/combatIniCost.test.mjs` couvrent déjà le **calcul pur** de la déclaration. Ce qui n'est **pas**
testé : l'**assemblage du payload** `COMBAT_ACTION_DECLARE` (aujourd'hui inline dans `handleDeclare` de
chaque fenêtre) et les **invariants croisés** (Attaque ⊕ CaC, Tir visé ⊕ Tir Multi ⊕ dual-wield,
Charge/Retraite → force move+cible).

Méthode (golden master / characterization, pratique pro documentée — sources §11 round 4) :

| Sous-lot | Contenu | État |
|---|---|---|
| **M0.0** | Script `npm test` (`node --test` glob `shared/` + `client/src/` + `server/src/`) — ~126 `*.test.mjs` sans commande pour les lancer en bloc. `package.json`. | ✅ **codé 2026-08-28** — 1001 → 1022 tests, 0 fail |
| **M0.1** | `client/src/lib/buildDeclarePayload.js` (`buildHumanDeclarePayload`, pur) — extraction **verbatim** de `CombatActionWindow.jsx#handleDeclare` branche non-drone ; `handleDeclare` rassemble un bag plat et appelle la fonction. `+ buildDeclarePayload.test.mjs` : **21 tests de caractérisation** (tour vide, Tir simple/Multi/visé/dual-wield/sans variant, CaC/naturelle/défensif/dual-wield, rechargement, déplacement normal/Charge/Retraite/sans Z, actions rapides, état tactique). | ✅ **codé 2026-08-28** — 21/21, build propre, eslint baseline inchangée |
| **M0.2** | `buildGmDeclarePayload` — extraction **verbatim** de `CombatGmDeclareWindow.jsx#handleDeclare` branche PNJ. Différences légitimes vs PJ préservées et testées (`fireModeBonus*` par défaut `0` vs `null` ; `move` brut sans forçage `ini_mod` ; `weapon.inv_id`). `+ 16 tests`. | ✅ **codé 2026-08-28** — 37/37 total, npm test 1038/0 fail, eslint GM 2→2 (baseline) |
| **M0.3** | `buildDroneMapActions` + `buildExoMapActions` — cœurs purs extraits verbatim de `useDroneDeclare` / `useExoDeclare` `#buildMapActions` (les hooks deviennent des wrappers `useCallback`). `+ 14 tests` (logique fire_mode drone, CaC vs Tir par `ref_category` exo, déplacement, quirks figés). | ✅ **codé 2026-08-28** — 51/51 total, npm test 1052/0 fail |
| **M0.4** | Extraction du sous-état de déclaration PJ ↔ MJ-PNJ. **Option C actée (Saar)** : deux hooks de domaine sans `mode` — `useAssaultDeclaration` + `useMeleeDeclaration`, chacun sur un reducer pur `.mjs`. **Cadré en détail §15** (recherche pro/dépôts, état dupliqué `[VÉRIFIÉ]`, frontière hook/fenêtre, API, découpe M0.4-a..f, 4 PO). | cadré §15 — analyse à charge = tour suivant, puis code (6 pas, 1 commit/pas) |

**Jalon M0.1-M0.3 (2026-08-28)** : le payload `COMBAT_ACTION_DECLARE` des 4 familles (PJ / PNJ / drone /
exo) est extrait en `client/src/lib/buildDeclarePayload.js` et couvert par **51 tests de
caractérisation** figés sur le comportement actuel. Les modules 2-3 (chrome, satellite) ne touchent
que du layout → le golden master casse si le payload bouge. Modules 2-5 (refonte visuelle) ne touchent
alors **que du JSX/layout** — le golden master attrape
   toute régression de payload.

Aggradation **permanente** : le chemin de déclaration de combat devient testable pour de bon, pas
juste pour cette refonte. Aligné sur la philo `.mjs` du projet — **pas de nouveau paradigme**.
Playwright E2E reste possible en complément (scénario combat réel) mais n'est pas le filet principal.

**Modules 2 → 5** : après le module 0. Un module = un commit, validé (tests `.mjs` verts + navigateur
Saar) avant le suivant. Ancien code retiré dans le même commit.

**Module 2 — `CombatDeclareFrame` (chrome partagé) + `--combat-accent-*` par famille (ex-module 1).**
**Cadré en détail §13** (API, châssis actuels `[VÉRIFIÉ]`, 6 états non-déclaration, tokens, PCB,
gardes de montage, risque, 5 points ouverts PO-M2-a..e). En bref : `CombatDeclareFrame` possède
`useDraggable` + châssis (palette `--combat-*` dédiée) + masquage + slots `satellite`/`footer` +
`data-family` → `--combat-accent-*` ; `+ --combat-exo-*` (#9858c8) dans `index.css`. Risque **élevé**
(structure externe des 3 fenêtres) — mais **JSX/CSS only, payload inchangé** → golden master du
module 0 en filet ; un commit par fenêtre migrée.

**Module 3 — `CombatDeclareStatePanel` (satellite, D8).** **Cadré §14** (simplifié 2026-08-29,
plus de point ouvert). Relocaliser les puces d'état dans un **panneau frère** du frame (positionné
depuis `pos`). Brique = **`CombatDeclareStateChip` existant + un `glyph`** (glyphes `assets/status/`
de Saar, `--combat-accent-fg`). Axes : **Posture (4) + Vitesse (3) + Arme (3)**, **identiques
PJ / MJ / Exo** (« fenêtre MJ = PJ » ; Session 158 caduque). Drone : aucun satellite. `fire_mode`
reste au corps jusqu'au module 4 (§14.7). Exo `prone` : la puce Posture remplace le bouton « Tenter
de se relever » (mécanisme serveur déjà là). **PAS de migration serveur** (§12.5). Risque moyen ;
payload PJ/MJ inchangé (golden master) ; exo : `+ buildExoDeclareState` pur + test (§14.6). Un commit
par fenêtre + checklist manuelle.

**Module 4 — `CombatDeclareActionList` (liste groupée, D5/D6/D7/D9/D13).** Le cœur visuel. **Cadré
§16** : panneaux col. 2 `[VÉRIFIÉ]` présentationnels → **réagencement pas réécriture** ; PO2 tranché
(**modes de combat CaC ne bougent pas** — Saar « pourquoi changer d'un coup ») ; PO3(a) tranché
(**cible PC, côte-à-côte**). Liste d'armes groupée Distance/Contact, sélection sans radio (D9),
Déplacement en ligne distincte (D13). Neuf = **`buildWeaponList`** (normalisateur pur PJ/MJ, testé
`.mjs`). **Déplace `fire_mode` en col. 2 → supprime `CombatDeclareStateSelector`** (code mort).
Risque **élevé** — module 0 + M0.4 en filet ; le module 4 **ne fait que du rendu + câblage**.
Découpe 4a-4e, 1 validé avant le suivant.

**Module 5 — Pied unifié (D12).** `CombatDeclareFooter` : pastille + statut + `Passer le tour` (ghost)
+ `Déclarer` (primaire, raison bloquante si `!canDeclare`). Consommé par les 3 (slot `footer` du
module 2). Dépend de B5 (le « Passer le tour » toujours disponible). Risque : faible-moyen.

---

## 6. Migration / rollback

- **Lot B + B5** : chaque item est un commit isolé, **`git revert` suffit** (JSON, un one-liner).
  Aucun feature flag.
- **Module 0** : extraction mécanique + tests `.mjs` neufs — additif, `git revert` trivial ; le
  `vite build` + les tests verts couvrent l'extraction.
- **Modules 2-5** (si rouverts) : chaque module branché retire l'ancien code dans le même commit —
  **`git revert` du commit du module** est le rollback. **Pas de feature flag** (analyse à charge
  round 2) : cohabiter deux `CombatActionWindow` de 1500 l. pendant une transition = enfer de merge et
  double surface de bugs — remplacement franc, revert si régression.
- **Aucun de ces modules ne touche un schéma DB.** (Correction 2026-08-29, §11 round 5 : la version
  précédente affirmait « sauf le sous-module serveur du module 3 (état exo) — migration standard » —
  faux, `[VÉRIFIÉ]` §12.5, la persistance `state.*` exo est déjà générique et sans migration.)

---

## 7. Points ouverts

| # | Module | Question |
|---|---|---|
| PO1 | 2 | **Tranché §13.5** : `data-family` en **attribut** (pas classe `.combat-fam-*`). Le `#5b8dee` parasite → `--combat-accent-*` **sur les fichiers que les modules 2/4/5 touchent déjà**, pas en passe séparée. |
| PO2 | 4 | **Cadré §16.5 (reco : segment de tête `Attaque │ Défensif │ Charge │ Retraite │ Recharger`).** Décision Saar = PO-M4-a. |
| PO3 | 2 / 4 | (a) faisabilité écran → **§16.7 / PO-M4-b** (test 1366 px avant 4b/4c, repli pop-out). (b) réagencement vs réécriture → **§16.2 tranché : réagencement** (panneaux `[VÉRIFIÉ]` présentationnels, aucune largeur figée). (c) satellite qui suit → **§14.5 tranché** (frère positionné depuis `pos` du frame). Col. 2 haute → pied épinglé + corps scrollable (module 2, `.combat-float-win` a déjà `overflow:hidden` + flex). Changement d'arme = reset config → **PO-M4-e**. |
| PO4 | 0 | ~~Quelle infra de test~~ **Tranché round 4** : `node --test` + fonctions pures `.mjs` (philo projet), pas de vitest/RTL. Périmètre M0.1-M0.3 fait (51 tests). |
| PO5 | 3 | Satellite : glyphe qui **reflète la valeur** (Saar a produit les 4 glyphes de posture → plutôt oui) ou glyphe de catégorie + texte ? |
| PO6 | 4 | **Cadré §12.** Options : hook `useHumanDeclare(mode)` (rejeté, cf. §12.3-A) / présentationnel pur (ne fait pas le travail, §12.3-B) / **deux hooks de domaine sans `mode`** (reco, §12.3-C). Décision Saar en attente. À trancher **avant** le module 4. |
| PO7 | — | `CombatOverlay.jsx` : 4 gardes de montage ANNONCE — nettoyer en une table ou laisser ? (faible valeur) |

---

## 8. Hors-scope

- La phase RÉSOLUTION (fenêtres `CombatModifiersWindow`, `CombatCacModifiersWindow`,
  `CombatDamageWindow`, `CombatStunWindow`) — **sauf** la valeur i18n « Assaut » (B3).
- Le dispatch serveur Tir/CaC × PJ/PNJ/Drone/Exo (`ROADMAP.md` §5).
- La fusion des orchestrateurs (rejetée, REWORK-05 — on partage le châssis, pas le composant).
- Le calcul métier (`combatIniCost`, `combatSections`, allures) — intact.
- Migration TypeScript. **Aucune nouvelle dépendance** : le module 0 reste sur `node --test` +
  fonctions pures `.mjs` (philo du projet), pas de vitest/RTL.
- Conversion complète hex → tokens des panneaux combat (~260 occurrences) — chantier CSS distinct,
  non ouvert (round 4).
- La barre d'action ancrée non-couvrante (style Argon Combat HUD) — très gros chantier, contraire au
  paradigme Enclume. Nommé pour mémoire, non ouvert.

---

## 9. Ce qui n'est PAS fait en V1 est aussi important

- On ne fusionne pas les orchestrateurs. Le MJ garde sa navigation séquentielle et sa preview.
- On ne réécrit pas `AssaultRangedPanel` / `MeleeCombatPanel` / `DroneWeaponPanel` — on les réagence
  (col. 2), sous réserve PO3.
- On ne touche pas au calcul d'Initiative ni au dispatch serveur.
- **Lot B (B1-B4)** est codé (§5.1). **B5** = chantier isolé, cadrage + analyse à charge d'abord.
- **La refonte (modules 0-5) se fait** (round 4) — module 0 (filet de test pur) d'abord, puis 2→5,
  un module validé avant le suivant. Le module 1 a fusionné dans le module 2.

---

## 10. Ordre recommandé

1. **Lot B** — ✅ **codé 2026-08-28** : `combat.json` (B2 + B3 + B4) + `CombatGmDeclareWindow.jsx` (B1) +
   `socketCombatAnnouncement.js` (swap « Assaut » → « Tir »). Validation navigateur en bloc à venir.
2. **B5** — ✅ **codé 2026-08-28** : `canDeclare` débloqué (PJ + MJ), `meleeValid` neuf côté MJ.
   Libellé explicite « Passer le tour » = module 5.
3. **Module 0** — `buildDeclarePayload` M0.1-M0.3 ✅ (golden master, 51 tests). M0.4 (sous-état Tir/CaC)
   cadré §12, **décision Saar en attente**, placé avant le module 4.
4. **Module 2** (chrome partagé + accent par famille + `--combat-exo-*`) → **3** (satellite) →
   **M0.4** (extraction sous-état, §12.4) → **4** (liste d'action) → **5** (pied). Un module validé
   (tests verts ; navigateur Saar **en bloc à la fin**, Q1/Q4) avant le suivant.

La maquette est la cible. Le module 0 est le filet qui rend le reste sûr.

---

## 11. Journal de l'analyse à charge (2026-08-28)

Revue demandée par Saar juste après la première rédaction. Conclusions intégrées ci-dessus :

1. **Plan à ~8 problèmes** → assumé comme roadmap (précédent `PLAN_RW_DECLARE_WINDOWS`), framing
   « faire maintenant / isolé / gaté » ajouté (§5, §10). **B5 sorti du lot B** (comportement ≠ texte).
2. **D1 « MJ = forme joueur » sous-analysé** → `[VÉRIFIÉ]` le roster MJ n'est pas cliquable, navigation
   = auto-advance. L'idée « clic = navigue » de la v1 était une invention, retirée. Le partage
   PJ↔MJ-PNJ de la logique d'action = PO6, à trancher **avant** le module 4.
3. **Maquette valide le look, pas la structure** → §7 PO3 (footprint, réagencement des panneaux,
   satellite qui suit).
4. **Module 4 très risqué, pas de dé-risquage** → **Module 0 (infra de test) promu en prérequis
   ferme**, §5.3. Critère d'aggradation appliqué : modules 2-5 n'aggradent pas la testabilité → gatés.
5. **Périmètre terminologie plus large que 3 fichiers** → grep fait (§2.2), B3 reformulé « valeur JSON
   partout, y compris résolution », zéro `.jsx`.
6. **Split terminologique/visuel au milieu du flux combat** → B3 s'étend à la valeur i18n de la
   résolution ; le split **visuel** reste (résolution hors-scope) et est assumé comme transitoire,
   noté §8.
7. **Fond PCB sur-décidé** → D14 rétrogradé en détail d'implémentation du module 2, PO6 dédié retiré.
8. **États non-déclaration manquants** → ajoutés au périmètre du module 2 (§4).
9. **Pas de migration/rollback** → §6.
10. **Chiffres non re-vérifiés** → recomptés `[VÉRIFIÉ]` (2026-08-29, cf. round 5) : `CombatActionWindow`
    = **25** `useState`/`useReducer` (+3 `useRef`), `CombatGmDeclareWindow` = **20** (+6 `useRef`) —
    les « 27 / 21 » annoncés ici le 28 étaient faux ; bouton exo = `t('actionWindow.declareActionButton')`.

### Round 2 (même jour, après réponse « Go implanter ? »)

1. **Module 0 = virage de philosophie de test transverse, pas un module** → modules 2-5 passés de
   « gatés » à **« en attente, déclencheur explicite »** (§5.4). Périmètre engagé assumé =
   **lot B + B5 + module 1**.
2. **D5/D6/D8 = paris porteurs non résolus** (mode « Défensif » ≠ arme ; col. 2 à 264 px ; satellite
   qui suit) → restent en PO2/PO3, explicitement « si un pari lâche, la structure lâche » — à
   éprouver avant module 4, pas pendant.
3. **B4 inverse une décision validée + sous-cadre** (docs + overflow pied étroit) → **retiré du lot B**,
   décision Saar requise (§5.1).
4. **Grep « assaut » incomplet 2× + serveur** → re-grep exhaustif : `combat.json` l.21/204/205/263/473/534
   (dont l.473 « Prêt à l'assaut » et l.534 = `CombatModifiersWindow` résolution) ; **serveur
   `socketCombatAnnouncement.js` : 8 messages FR en dur** (dette voisine, option (a) swap au passage) ;
   `fr.json` « fusil d'assaut » = RAW, **intouché**.
5. **B1/B2/B3 ordre + fragmentation** → B2+B3 = un commit `combat.json`, puis B1. `fr.json` exclu.
6. **Feature flag module 4** → retiré du §6 : cohabitation de deux `CombatActionWindow` de 1500 l. =
   pire que remplacement franc + `git revert`.

### Round 3 (même jour — lot B codé)

1. **B4 tranché par Saar** : « on a déjà tranché » — format `INI = 7 -> 2` (flèche ASCII), deux
   couleurs. Réintégré au lot B, codé. `REACT.md` P58 disait « current + delta » (pas « juste le
   chiffre ») → pas de contradiction de doc à corriger. Overflow du pied : non pertinent tant que le
   2ᵉ bouton (« Passer le tour », module 5) n'existe pas — à surveiller au test navigateur du lot B5/5.
2. **i18n serveur `COMBAT_DECLARE_ERROR`** : Saar a demandé la norme i18n « maintenant, sauf
   difficulté ». `[VÉRIFIÉ]` ~70 sites d'émission + changement de payload + messages dynamiques +
   chaîne client → **difficulté réelle**, différé → `PLAN_LOCALISATION.md` §8 (Lot 6). Swap de mot
   « Assaut » → « Tir » fait au passage (9 messages, cohérence terminologique).
3. Commentaire stale `CombatExoActionWindow.jsx:288` (« libellé générique "Assaut (tir)" ») laissé —
   commentaire, pas du texte visible ; à nettoyer si le fichier est rouvert.

### Round 4 (même jour — Saar rappelle les priorités : qualité structurelle >>> vitesse, rework pour stabiliser si besoin, pas pressés, se documenter)

1. **Module 1 (tokens) `[VÉRIFIÉ]` : ~260 couleurs en dur, la plupart pas des accents ; l'export DS
   n'est pas chargé (pas de vraie dette « 3 vocabulaires » runtime).** → module 1 réduit à `+ --combat-exo-*`
   + `--combat-accent-*` par famille, et **fusionné dans le module 2** (le `data-family` n'a de sens
   qu'avec le chrome partagé). La conversion complète hex → tokens = chantier CSS distinct, non ouvert.
2. **Modules 2-5 dé-parkés.** Les priorités rappelées par Saar endossent explicitement « rework pour
   stabiliser ». Le blocage n'est plus « attendre un backlog plus mince » — c'est « faire le filet
   d'abord ».
3. **Module 0 re-cadré (recherche : golden master / characterization tests, sources ci-dessous).**
   `[VÉRIFIÉ]` Enclume = ~127 fichiers `*.test.mjs` (`node --test`, fonctions pures) + Playwright E2E ;
   aucun test composant, choix assumé. `declarationReducer.test.mjs` / `combatSections.test.mjs` /
   `combatIniCost.test.mjs` couvrent déjà le **calcul pur**. Non testé = **l'assemblage du payload**
   `COMBAT_ACTION_DECLARE` (inline dans `handleDeclare`) + les invariants croisés. → module 0 =
   **extraire `buildDeclarePayload` / `useHumanDeclare` en `.mjs` purs + tests de caractérisation**,
   PAS ajouter vitest. Aligné sur la philo du projet, aggradation permanente. Modules 2-5 ne touchent
   ensuite que du JSX, le golden master casse au moindre changement de payload.

**Sources recherche round 4** :
- Golden Master / Characterization test — [Fabrizio Duroni](https://www.fabrizioduroni.it/blog/post/2018/03/20/golden-master-test-characterization-test-legacy-code),
  [Codurance](https://www.codurance.com/publications/2012/11/11/testing-legacy-code-with-golden-master),
  [Wikipedia](https://en.wikipedia.org/wiki/Characterization_test).
- Refactoring React avec characterization tests (behaviour, pas state interne ; petits pas ; state
  untangling) — [Koder.ai](https://koder.ai/blog/refactoring-react-components-claude-code),
  [Cloudamite](https://cloudamite.com/characterization-testing/).
- (Vitest + RTL considéré puis écarté — nouveau paradigme contraire à la philo `.mjs` d'Enclume :
  [Incubyte](https://blog.incubyte.co/blog/vitest-react-testing-library-guide/),
  [Makers Den](https://makersden.io/blog/guide-to-react-testing-library-vitest).)

### Round 5 (2026-08-29 — analyse à charge demandée par Saar : la fausse contrainte « satellite exo = migration serveur »)

**Fait.** Le plan a affirmé, de sa rédaction jusqu'au 2026-08-28, que le satellite d'état exo
(module 3) « nécessite le serveur (persistance `state_position` / `state_weapon` exo, gate de
résolution) », avec un « sous-module serveur explicite », un risque « moyen-élevé (exo + serveur) »
(§5.4) et une ligne dédiée en §6 (« sauf le sous-module serveur du module 3 — migration
rétrocompatible standard »). **C'était faux** : `socketCombatAnnouncement.js:810-829` persiste
`state.*` génériquement pour tout type y compris exo ; `setCharacterState` est agnostique au type ;
les colonnes existent. Aucune migration. Vérifié en ~15 min, mais seulement après « ENORMES DOUTES »
de Saar — pas par une relecture, pas par les rounds 1-4.

**Chaîne de défaillance.**
1. `ROADMAP.md` §1 point 4 (session exo antérieure) : « reste à câbler dans `CombatExoActionWindow` +
   le serveur » — sans marqueur, sans source.
2. Rédaction du présent plan : j'ai **importé et amplifié** cette phrase — « + le serveur » vague est
   devenu « persistance `state_position`/`state_weapon` exo », « gate de résolution », « migration
   rétrocompatible standard », « risque moyen-élevé ». Détail concret ajouté, jamais dans la source,
   jamais vérifié.
3. Rounds d'analyse à charge 1-4 : ont critiqué la **structure** du plan (périmètre, découpage,
   ordre, risque du module 4) — **jamais rouvert `socketCombatAnnouncement.js`** pour vérifier la
   branche `isExo`.
4. Révélé par Saar, pas par moi.

**Règles violées.** CLAUDE.md §1.1 (code observé > mémoire/conversation — ROADMAP est de la
conversation figée, pas du code) ; §6 (« termes interdits sans preuve » — une affirmation posée là où
il fallait `[INCONNU]`) ; §13 détecteur de dérive (« diagnostic sans lecture ni instrumentation » —
c'est ce qu'était une analyse à charge qui ne rouvre pas les fichiers) ; `METHODO_PLAN.md` (marqueurs
`[VÉRIFIÉ]`/`[INFÉRÉ]` obligatoires — la ligne module 3 exo n'avait **aucun** marqueur, donc se lisait
comme un fait). Mémoire `feedback_ticket_content_not_authoritative` (« revérifier le code avant
d'agir ») : la leçon existait, appliquée aux tickets, **pas** appliquée à ROADMAP.

**Le vrai problème (pas l'instance).** Copier une contrainte d'un doc de planification vers un autre
**blanchit l'inférence en fait**. Amplifier une affirmation héritée (ajouter « migration », « gate »,
un niveau de risque) est une erreur composée, pire que la répéter.

**Coût si non corrigé.** Module 3 séquencé avec un « sous-module serveur + migration » fantôme : soit
une migration inutile écrite (dette de schéma pure, règles §5 lourdes), soit un cadrage jeté à
mi-parcours. Et tout l'arbitrage de risque/ordre en aval était calibré sur un faux « exo + serveur ».

**Ce qui change.**
1. **Avant de committer ce plan** : passe de vérification sur *chaque* affirmation technique non
   marquée `[VÉRIFIÉ]` — rouvrir le fichier, marquer `[VÉRIFIÉ]` ou rétrograder en `[INCONNU]`.
2. **Règle permanente** : une contrainte reprise d'un autre doc / de la mémoire / d'un ticket / d'un
   plan antérieur n'entre dans un plan **qu'avec sa propre vérification code**, jamais par copie.
3. Les prochaines analyses à charge de ce chantier **rouvrent les fichiers cités**, pas seulement la
   structure du plan.
4. `[INCONNU]` explicite posé sur le seul point non vérifié restant (§12.5 : la résolution lit-elle
   `state_position` exo).

**Passe de vérification du plan (2026-08-29, avant commit) — corrections appliquées :**

| Affirmation | Annoncé | `[VÉRIFIÉ]` 2026-08-29 | Action |
|---|---|---|---|
| État inline PJ / GM | 27 / 21 `useState` | **25 / 20** (+3 / +6 `useRef`) | corrigé §2.1, §11-r4-10, §12 |
| Migration serveur module 3 | « oui, exo » (§6) | **aucune** (persistance générique) | §6 réécrit |
| Couleurs en dur (9 fichiers) | ~290 (GM 108…) | **~260** (GM 94, PJ 56, Melee 33, Assault 25…) | corrigé §5.3, §8, §11-r4-1 |
| Fichiers `*.test.mjs` | 126 / « ~98 » | **127** (en croissance) | harmonisé §5.4, §5.4-M0.0 |
| Bouton de pied MJ « DÉCLARER » en dur | dette ouverte | **B1 corrigé** (`:1056`, `t(…)`) | §2.1 mis à jour |
| Bouton exo « Declarer » sans accents | dette | **B2 corrigé** (`"Déclarer l'action"`) | §2.1 mis à jour |
| `grep -i assaut combat.json` | — | **vide** | B3 confirmé complet (combat.json) |
| Tokens `index.css` : `--combat-{pj,pnj,drone}-*` triplets, pas de `--combat-exo-*`/`--combat-accent-*` | affirmé | **confirmé** (l.157-165) | inchangé |
| Export DS `temp/wizard/` non chargé par l'app | affirmé | **confirmé** (0 import ; `temp/` gitignoré) | inchangé |
| Briques `CombatDeclare*` (5 fichiers) | listées | **confirmé** (ErrorBanner, IniWidget, Log, StateChip, StateSelector) | inchangé |
| Sections `AssaultRangedPanel` (Arme / Nb tirs / Cible(s) / Type de tir / Mode CC-RC-RL / Localisation) | affirmé | **confirmé** (376 l.) ; `MeleeCombatPanel` 400 l. | inchangé |
| Roster MJ non cliquable | `[VÉRIFIÉ]` | **confirmé** (`S.rosterRow`, aucun `onClick`) | inchangé |
| Serveur accepte déclaration vide (`{}` passe, clés validées si présentes) | `[VÉRIFIÉ]` | **confirmé** (`socketCombatAnnouncement.js:63-79`) | inchangé |
| Golden master 4 familles | 51 tests | **51/51 vert** ce jour | inchangé |

### Round 6 (2026-08-29 — Saar corrige le cadrage du module 3 : les axes d'état exo)

**Fait.** §14.3 affirmait « `[VÉRIFIÉ]` `EXOARMURE.md` : posture exo = {standing, prone} seulement,
pas de crouch/kneel, `weapon` ne s'applique pas → l'exo n'a probablement pas de satellite ». **Faux.**
Saar : *« l'exo-armure a un satellite : position DEBOUT/COUCHÉ/ACCROUPI/GENOU, arme AU CLAIR/MAIN
SUR L'ARME/RANGÉE… à moins que tu me trouves le texte RAW qui dit l'inverse »*. Vérifié :
- `POSITION_TRANSITION_COST` (RAW `REGLESYSCOMBAT.md:929-941`) = les 4 postures, et `PLAN_EXOARMURE.md`
  §9 dit qu'elle s'applique **telle quelle** à l'exo.
- `ROADMAP.md` §1 point 4 **listait déjà explicitement** « arme rangée/au clair, position
  accroupi/genou » pour l'exo.
- `REGLEARMURE.md` p.323-329 relu ligne à ligne : **aucune** restriction de posture ni d'état d'arme
  (seules restrictions exo : 1 Attaque/Tour, milieu inadapté → allure lente, Intégrité 0 → détruite).

**Mécanisme de la faute — identique au round 5.** Inférence tirée du *silence* d'un doc `SYSTEME`
(`EXOARMURE.md` ne parle de posture exo que pour « se relever ») → conclusion « ça n'existe pas »,
marquée `[VÉRIFIÉ]`. Et `ROADMAP.md` §1.4, qui contredisait frontalement, **pas relu** au moment
d'écrire §14.3. Deux tours après avoir écrit la règle « ne pas blanchir une inférence », re-fait.

**Ce qui change (au-delà de §14.3 corrigé).** La règle
[[feedback_no_laundering_inherited_claims]] est renforcée : **« un doc qui ne mentionne pas X » n'est
jamais une preuve que « X n'existe pas »** — pour une question de règle, vérifier l'extrait RAW
(`REGLE*.md`) **et** `ROADMAP`/`VOCABULARY`, pas seulement le doc `SYSTEME` du domaine. Marqueur
`[VÉRIFIÉ]` interdit sur une conclusion négative tirée d'une absence de mention.

---

## 12. Cadrage M0.4 / PO6 — mutualiser l'état de déclaration PJ ↔ MJ-PNJ

> Demandé par Saar (2026-08-28) : « je n'ai pas le niveau technique pour estimer les répercussions,
> documente ce point pour un choix éclairé ». Lecture faite ce jour, intégrale : `CombatActionWindow.jsx`
> (1580 l., 25 états), `CombatGmDeclareWindow.jsx` (1192 l., 20 états), `CombatExoActionWindow.jsx`
> (442 l.), `declarationReducer.js`, `useDroneDeclare`/`useExoDeclare`, `socketCombatAnnouncement.js`,
> `characterStateService.js`.

### 12.1 En clair

Les fenêtres joueur et MJ font le même geste (déclarer Tir / Corps à corps / Déplacement) mais
**chacune reconstruit sa propre machinerie de sélection** — ~200 lignes quasi identiques copiées dans
les deux fichiers. Preuves que la copie coûte : le combat à deux armes (COM24) implémenté deux fois ;
le bug de réinitialisation entre tours corrigé deux fois le même jour (2026-08-28) ; l'éligibilité du
Tir visé câblée deux fois.

Question : au module 4, on **fusionne cette machinerie dans un module commun**, ou on **laisse chaque
fenêtre avec la sienne** et on ne partage que l'apparence ?

### 12.2 Ce qui est vraiment commun / vraiment différent  `[VÉRIFIÉ]`

| | Commun (même forme, même sens) | Différent — à préserver |
|---|---|---|
| État tactique | `decl` + `declarationReducer` — **déjà** partagé | — |
| Sous-état Tir | `assault*`, `isDualWield`, `aim*`, `aimedLocation` — jeu identique, mêmes calculs (`computeFireVariant`, `getAim*`) | — |
| Sous-état CaC | `melee*Count`, `selected*MeleeWeaponId`, `*NaturalWeaponId`, `isDualWieldMelee` — jeu identique | — |
| Assemblage payload | **déjà** extrait (`buildHumanDeclarePayload` / `buildGmDeclarePayload`, module 0) | `move` brut vs `ini_mod:0` forcé ; bonus `0` vs `null` (figés + testés) |
| Réinitialisation tour/slot | logique quasi identique (`prevHasAnnouncedRef` + reset ~15 états) — **dupliquée** | — |
| Acquisition des données | — | PJ : fetch par token actif (`/inventory`, `/mutations`, allures locales). MJ : **batch** `/combat-equipment` tous PNJ, indexé tokenId. Formes ≠ (`allInventoryItems[]` vs `equipment[tid].weaponMg`) |
| Modèle de sélection | — | PJ : `Set` multi-tuiles. MJ : booléens dérivés + `mapAction` (reload seul) |
| Flux de ciblage | — | PJ : `inTargetMode`/`inMeleeTargetMode` + `handleChooseTarget(i)`. MJ : `isSelectingOnMap` (conflate) + chaîne récursive `selectNext` + refs `isMountedRef`/`*CountRef` (StrictMode) |
| Charge | — | PJ : `moveSelection` + cible dans `meleePendingTokenIds`. MJ : objet composite `chargeSelection:{move,targetTokenId}` |
| Pilotage | — | PJ : multi-phases (surprise, résolution mon tour / pas mon tour, attente, déjà déclaré). MJ : navigation de slots + preview live `pjPreview` + bouton « Passer » |

**Lecture** : le partageable = **sous-état Tir** + **sous-état CaC** (+ réinitialisation). Le reste
diverge pour de bonnes raisons et doit le rester.

### 12.3 Options

- **A — hook `useHumanDeclare(mode: 'pj' | 'gm-pnj')`** (option d'origine du plan). Tout l'état de
  déclaration dans un hook, `mode` bascule la source de données et quelques comportements.
  *Contre* : la doc React officielle le déconseille — « beaucoup d'arguments = à refactorer », « Hook
  difficile à nommer = trop couplé pour être extrait » (react.dev, *Reusing Logic with Custom Hooks*).
  Ici PJ et MJ divergent sur l'acquisition de données, le pilotage, le flux de ciblage, la forme de
  la Charge : le hook porterait tout ça derrière des `if (mode === …)`. ~400 lignes, testable
  seulement via React, « le fichier que personne ne veut toucher ».
- **B — `CombatDeclareActionList` purement présentationnel** (autre option du plan). Liste = props,
  aucun état ; chaque fenêtre garde le sien.
  *Contre* : la copie de ~200 lignes (Tir + CaC + reset) **reste dans les deux fenêtres** —
  exactement la douleur actuelle. Réorganise l'affichage, n'aggrade pas la structure.
- **C — deux hooks de domaine, sans `mode`** : `useAssaultDeclaration({ weapons, … })` +
  `useMeleeDeclaration({ weapons, … })`. Chacun tient **une** tranche cohérente que les deux fenêtres
  dupliquent ; on leur passe les données en paramètre (l'appelant décide batch ou par token). Cœur
  de décision (validité, comptes effectifs, exclusivités) en fonctions pures `.mjs` — patron
  `buildDeclarePayload`. Les fenêtres gardent `decl`, fetch, pilotage, flags de ciblage. Aucun `mode`.
  *Pour* : direction déjà prise par le code (`useDroneDeclare`/`useExoDeclare` = hooks par domaine,
  pas `useDeclare(mode)` ; `useAutoMoveMode`/`useCombatClickAttack` = partagés sans mode). Tue la
  vraie duplication. Chaque hook nommable + responsabilité unique (le test react.dev de « prêt à
  extraire »). Golden master du module 0 garde déjà la sortie.
  *Contre* : 2 hooks au lieu d'1 ; la frontière sous-état / flux-de-ciblage doit être propre — à
  prouver au cadrage du module 4 (la chaîne récursive `selectNext` du MJ = le point délicat).

Sources : [react.dev — Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)
(« si un Hook prend beaucoup d'arguments… le refactorer » ; « difficile de nommer = pas prêt à
extraire ») ; [patterns headless / logique découplée de l'UI, ITNEXT](https://itnext.io/decoupling-ui-and-logic-in-react-a-clean-code-approach-with-headless-components-82e46b5820c) ;
[anti-patterns Hooks, dev.to](https://dev.to/justboris/popular-patterns-and-anti-patterns-with-react-hooks-4da2).

### 12.4 Recommandation

**Option C**, logique de décision non triviale sortie en fonctions pures testées `.mjs`. **Rejeter A**
(sur la foi de la doc React). B ne fait pas le travail.

Séquence proposée : **module 2 (châssis) → module 3 (satellite) → M0.4 = extraction
`useAssaultDeclaration` + `useMeleeDeclaration` + reset commun (tests verts) → module 4 (liste — ne
fait que consommer + rendre) → module 5 (pied)**. M0.4 juste avant son consommateur, pas avant les
modules purement visuels (rien ne change à l'écran, validation navigateur en aveugle).

### 12.5 Correctif au plan — le satellite exo ne demande PAS de migration  `[VÉRIFIÉ]`

`socketCombatAnnouncement.js:810-829` persiste `state.position/weapon/fire_mode/cover/vitesse/
combat_mode` **génériquement, pour tout type de personnage, exo compris** ; `setCharacterState`
(`characterStateService.js`) est agnostique au type ; `combat_roster.state_*` et `character_states`
existent déjà. Aujourd'hui `CombatExoActionWindow` envoie `state: {}` → rien n'est persisté, mais **le
chemin d'écriture est déjà là**. Le satellite exo (module 3) est donc :
(a) **client** : câbler `CombatDeclareStateChip`, envoyer un `state` peuplé ;
(b) **cadrage règles** (pas migration) : quels axes une exo a vraiment (RAW — « arme rangée / au
clair » n'a probablement aucun sens pour une exo ; accroupi/genou : ça modifie quelque chose à la
résolution ?).
La mention « + le serveur » de `ROADMAP.md` §1 point 4 est surévaluée. **Reste `[INCONNU]`** (non
vérifié) : est-ce que la phase RÉSOLUTION *lit* `state_position` exo pour un malus de posture, et le
RAW le veut-il ? Portée bornée — « lecture + éventuellement quelques lignes », **catégoriquement pas
une migration**. Genèse de la fausse contrainte : §11 round 5.

### 12.6 Glyphes (Q6, vérif demandée)  `[VÉRIFIÉ]`

12 glyphes examinés (`stand/crounch/kneel/crawl`, `contact/distance`, `WeaponA/B/C`,
`actionNormal/Delayed/Rush`). `crawl.svg` avait le tracé hors `viewBox` (démarrage `x = -25.76`) —
**Saar a ajouté un `<clipPath>` (2026-08-29)** : l'overflow ne peint plus hors du cadre ; reste à
juger visuellement si la figure est bien centrée dans le `0 0 48 48` (jugement Saar, il a le rendu).
Les 11 autres tiennent dans `0 0 48 48`. Deux styles de fichier coexistent (Inkscape multi-lignes vs
compact mono-ligne) — sans impact en `mask-image` (seul l'alpha compte). Rien à intégrer en dur :
`mask-image: url(/assets/status/x.svg)` recoloré à l'accent (D10), fichiers laissés dans le répertoire.

---

## 13. Cadrage Module 2 — `CombatDeclareFrame` (châssis partagé)

> Cadrage 2026-08-29. Lecture faite : `useDraggable.js`, `index.css` l.1533-1658 (`.combat-win*`) +
> l.1846-1912 (`.combat-float-*`), `ChangelogPanel.jsx` (motif PCB), `CombatOverlay.jsx` l.153-260
> (montage des 3 fenêtres), les 3 fenêtres (déjà en §12). **Aucun code — cadrage seul.**
> Analyse à charge dédiée = tour suivant (checkpoint : plan / analyse à charge / code séparés).

### 13.1 Responsabilité du module 2

Extraire **le châssis externe commun** aux 3 fenêtres de déclaration en un seul composant
`CombatDeclareFrame` : conteneur + classe CSS unique + `useDraggable` + largeur/opacité/position +
header (titre + poignée de drag) + emplacement satellite + emplacement pied + bannières. **Ne touche
pas** : le contenu du corps (liste d'action = module 4), le satellite lui-même (module 3), le pied
lui-même (module 5), aucun état de déclaration, aucun payload. JSX/CSS uniquement → golden master du
module 0 en filet.

### 13.2 État des lieux `[VÉRIFIÉ]` — les 3 châssis actuels

| | `CombatActionWindow` (PJ/drone) | `CombatGmDeclareWindow` (MJ) | `CombatExoActionWindow` (exo) |
|---|---|---|---|
| Classe racine | `.combat-float-win` | `.combat-win` | `.combat-float-win` |
| Tokens CSS | `--bg-session-raised` / `--border-session-2` (génériques session) | **`--combat-body/header/border/title/section`** (palette combat dédiée) | `--bg-session-raised` / `--border-session-2` |
| Position | inline `position: fixed`, `left/top` de `useDraggable` | inline `left/top` de `useDraggable` (pas de `position` — `.combat-win` = `absolute`) | inline `position: fixed` |
| Largeur | inline `360` → `720` (panneau droit) | inline `440` → `720` | inline `340` |
| `max-height` | inline `calc(100vh - 80px)` | CSS `.combat-win` `calc(100vh - 100px)` | inline `calc(100vh - 80px)` |
| Header | `.combat-float-header` (bg `--bg-session-raised`) | `.combat-win-header` (bg `--combat-header`) + **poignée basse** `S.bottomHandle` (2ᵉ zone de drag) | `.combat-float-header` |
| Titre | enfant texte direct | `.combat-win-title` (cyan `--combat-title`) + `S.headerActiveToken` (nom PNJ) + `S.headerProgress` (`n/n`) | enfant texte `t('exoActionWindow.title', {name})` |
| Corps | `.combat-win-body` (flex row) | `<div style={{display:flex,flex:1,minHeight:0}}>` | `.combat-win-body` + panneau interne `S.panel` |
| Pied | `.combat-float-footer` | `.combat-win-footer` (bg `--combat-header`) | `.combat-float-footer` |
| Masquage (ciblage) | inline `opacity` + `pointerEvents` | idem | idem |
| `useDraggable` clé | `combat-action-pos` | `combat-gm-declare-pos` | `combat-exo-action-pos` |

**Divergences réelles à absorber :** 2 familles CSS (session vs combat), la poignée basse MJ, le
bloc titre MJ enrichi (nom + progression), `.combat-win` en `absolute` vs `fixed`. ~~Choix proposé :
adopter la palette combat dédiée `--combat-*`.~~ **→ révisé par l'analyse à charge §13.11 point 5 :
réutiliser `.combat-float-win` existant (2 fenêtres sur 3 déjà dessus), MJ bascule dessus — 1 fenêtre
change de famille, pas 3.**

### 13.3 API cible `CombatDeclareFrame`

> Visuel de base = `.combat-float-win` réutilisé (§13.11 pt 5), pas une classe neuve.

```
<CombatDeclareFrame
  family="pj" | "gm-pnj" | "drone" | "exo"   // → data-family → --combat-accent-*
  storageKey="combat-declare-pj"              // useDraggable (clés existantes conservées)
  defaultPos={{ left, top }}
  width={360}                                 // largeur courante (le call site calcule 360/440/720)
  title={<>…</>}                              // ReactNode : texte simple OU bloc enrichi MJ
  hidden={isHidden}                           // opacity 0 + pointer-events none
  banner={mortalWoundBanner || null}          // au-dessus du corps, sous le header
  satellite={<CombatDeclareStatePanel …/> || null}   // module 3 ; RENDU COMME FRÈRE positionné à
                                                     // partir de `pos` (pas enfant — overflow:hidden), §14.5
  footer={<CombatDeclareFooter …/> || null}   // module 5
>
  {corps}                                     // module 4 (ou <p>message</p> pour les états simples)
</CombatDeclareFrame>
```

- Le frame **possède** `useDraggable` (plus dans chaque fenêtre) et rend la poignée de drag sur le
  header. Poignée basse MJ : à conserver comme option `bottomHandle?` ou à abandonner — **PO-M2-a**.
- **`satellite` = rendu comme *frère positionné*** (`position: absolute`, `left = pos.left - SAT_W -
  GAP`, `top = pos.top`, `z-index` = celui du frame), **pas enfant** (`overflow: hidden` le
  clipperait) — le frame l'expose donc via son `pos` interne (§14.5, §14.11 pt 6-7). Masqué avec le
  frame (`hidden`). `satellite={null}` → rien rendu (drone, états non-déclaration).
- `footer={null}` → pas de barre de pied rendue (états non-déclaration sans action).
- `hidden` remplace les 3 recopies inline de `opacity/pointerEvents`.
- Le frame ne connaît **aucun** état métier — il ne sait pas ce qu'est la surprise ou la résolution.

### 13.4 États non-déclaration à héberger  `[VÉRIFIÉ]`

`CombatGmDeclareWindow` et `CombatExoActionWindow` **retournent `null`** hors de leur tour → rien à
héberger côté MJ/exo (le corps a juste 2-3 variantes internes : PNJ / drone / attente-PJ pour le MJ,
prone / normal pour l'exo — contenu du corps, pas du châssis).

`CombatActionWindow` reste montée en permanence et rend **6 états « message »** distincts, chacun =
`<CombatDeclareFrame family="pj" title=… footer={…|null} satellite={null}><p>…</p></…>` :

| # | Condition | Titre (clé i18n) | Contenu |
|---|---|---|---|
| 1 | `pendingSurpriseRoll` pour un de mes tokens | `actionWindow.surpriseTitle` | texte + **bouton** « lancer le dé » (→ `footer` ou corps) |
| 2 | `is_surprised && has_announced && initiative === 0` | `actionWindow.surpriseTitle` | `surprisedCannotAct` |
| 3 | `isMyTurnInResolution` | `actionWindow.resolutionPhaseShort` | liste d'actions + pied variable (attente MJ / recharger / bouton Agir) |
| 4 | ANNONCE, pas mon tour, pas encore déclaré | `actionWindow.declarationPhaseTitle` | `awaitingPlayer` |
| 5 | RÉSOLUTION, pas mon slot | `actionWindow.resolutionPhaseTitle` | `tokenActing` / `resolutionInProgress` |
| 6 | `has_announced` (ANNONCE) | `actionWindow.declarationPhaseTitleAlt` | `actionDeclaredWaiting` |

→ le frame doit rendre **proprement** avec `footer={null}` **et** avec un `footer` non trivial (cas 1
et 3). Aucun nouveau composant pour ces 6 états — juste le frame + un enfant. Le roster PJ
(`rosterSection`, présent « dans tous les états » selon le code) : à décider s'il passe dans le frame
ou reste un enfant du corps — **PO-M2-b**.

### 13.5 Tokens d'accent (D3/D4) — `--combat-accent-*` + `--combat-exo-*`  `[VÉRIFIÉ]`

`index.css` a déjà (l.157-165) : `--combat-pj-{fg,bg,border}` (#50c878 vert), `--combat-pnj-*`
(#c86030 orange), `--combat-drone-*` (#30aaaa teal). **Absent** : `--combat-exo-*`, `--combat-accent-*`.

Module 2 ajoute (le sélecteur = `.combat-float-win[data-family]`, pas de classe neuve — §13.11 pt 5) :
```
:root {
  --combat-exo-fg: #9858c8; --combat-exo-bg: #140a1e; --combat-exo-border: #9858c8;
  /* --combat-exo-bg : [INFÉRÉ], à valider à l'œil par Saar (§13.11 pt 5) */
}
.combat-float-win[data-family="pj"]     { --combat-accent-fg: var(--combat-pj-fg);   … }
.combat-float-win[data-family="gm-pnj"] { --combat-accent-fg: var(--combat-pnj-fg);  … }
.combat-float-win[data-family="drone"]  { --combat-accent-fg: var(--combat-drone-fg);… }
.combat-float-win[data-family="exo"]    { --combat-accent-fg: var(--combat-exo-fg);  … }
```
**Module 2 se limite à *définir* ces tokens** (+ les consommer sur le châssis : bordure de fenêtre,
accent du header). La conversion des `#5b8dee` / `rgba(91,141,238,*)` (« bleue parasite », D3) →
`var(--combat-accent-*)` vit dans le **corps** des fenêtres → sous-objectif des modules **3/4/5**,
pas 2 (§13.11 pt 3). La conversion hex→token complète (~260 occ.) reste hors périmètre (§8).
`data-family` en **attribut** (PO1 tranché : pas de classe `.combat-fam-*`).

### 13.6 Motif PCB (D14)  `[VÉRIFIÉ]` `ChangelogPanel.jsx`

Changelog : `<svg style={{position:absolute,inset:0,opacity:0.22}} preserveAspectRatio="slice">` avec
`<pattern>` de pastilles + 4 `<path>` de pistes + pastilles + 2 rectangles, couleur `ACCENT`.
Décisions D9/D14 : **discret** (opacité < 0.22, viser ~0.10), **header + pied + satellite
uniquement** (pas le corps). → petit composant `<CombatPcbBackdrop />` (svg absolu, `pointer-events:
none`, `currentColor` piloté par `--combat-accent-fg` ou `--combat-dim`), monté dans ces 3 zones.
Détail d'implémentation, pas un point ouvert (D14).

### 13.7 PO7 — les 4 gardes de montage `CombatOverlay.jsx`  `[VÉRIFIÉ]`

Phase ANNONCE, 4 conditions (l.198/215/234/254) : GM+exo → `CombatExoActionWindow` ; GM+non-exo →
`CombatGmDeclareWindow` ; joueur+exo actif → `CombatExoActionWindow` ; joueur sinon (+ RÉSOLUTION) →
`CombatActionWindow`. Se lisent en escalier avec des négations croisées (`!(isActiveExoForPlayer &&
ANNOUNCEMENT)`). **Décision : laisser tel quel pour le module 2** — le frame ne change pas *quelle*
fenêtre monte, seulement leur châssis interne. Nettoyage en table = valeur faible, hors périmètre
(peut se faire au module 5 si un fichier le rend trivial).

### 13.8 Risque + rollback

**Risque élevé** — structure externe des 3 fenêtres réécrite (leur `return (…)` de premier niveau).
Atténuations : (1) JSX/CSS seul, payload et `handleDeclare` intacts → `npm test` (golden master 51
tests) casse à toute régression de sortie ; (2) `vite build` + comparaison eslint baseline
`git stash` avant/après (patron modules 0) ; (3) un commit par fenêtre migrée (`CombatDeclareFrame`
neuf + `CombatActionWindow` d'abord, puis MJ, puis exo) — `git revert` du commit = rollback. Pas de
feature flag (§6).

### 13.9 Hors périmètre module 2

- Le satellite (module 3), la liste d'action (module 4), le pied (module 5) — le frame n'expose que
  des *slots* vides pour eux.
- La conversion hex→token complète des panneaux (§8).
- Le nettoyage des 4 gardes `CombatOverlay` (§13.7).
- Toute fusion d'orchestrateurs (REWORK-05).
- `.combat-win` (MJ) : le MJ bascule sur `.combat-float-win`, mais **les autres consommateurs de
  `.combat-win`** (RÉSOLUTION : `CombatModifiersWindow`, `CombatDamageWindow`…) **ne sont pas
  touchés** — `.combat-win` reste défini pour eux. Le frame réutilise `.combat-float-win` (+ éventuels
  ajouts ciblés `[data-family]`), pas de classe neuve à recaler (§13.11 pt 5).

### 13.10 Points ouverts du module 2

| # | Question |
|---|---|
| PO-M2-a | Poignée de drag basse du MJ (`S.bottomHandle`) : la garder comme `bottomHandle?` du frame (pour tous ?) ou l'abandonner (header seul, comme PJ/exo) ? |
| PO-M2-b | Roster PJ (`rosterSection`, « présent dans tous les états ») : slot dédié du frame, ou enfant du corps géré par la fenêtre ? |
| PO-M2-c | ~~`fixed` ou `absolute` ?~~ **Tranché `[VÉRIFIÉ]`** : `CombatOverlay` `styles.overlay` = `position: fixed; inset: 0; zIndex: 1000`. Donc `absolute` (contre l'overlay) et `fixed` (contre le viewport) rendent à l'identique. Le frame prend **`position: absolute` porté par la classe** (comme `.combat-win`), plus de `position` inline. |
| PO-M2-d | `max-height` : `calc(100vh - 80px)` (PJ/exo) ou `- 100px` (MJ) ? Unifier à une valeur. |
| PO-M2-e | Largeur dynamique 360/440/340 → 720 : le call site passe `width`, ou le frame prend `baseWidth` + `expanded` bool et connaît la valeur 720 ? (le 720 « panneau droit » disparaît au module 4 avec la col. 2 — anticiper ou pas ?) |

### 13.11 Analyse à charge du module 2 (2026-08-29)

Revue critique du cadrage §13.1-13.10, faite comme étape distincte (checkpoint).

**1. `CombatDeclareFrame` possède `useDraggable` — risque des retours anticipés `[VÉRIFIÉ]`.**
`CombatActionWindow` a **6 `return` avant son rendu principal** (§13.4). Si chacun retourne
`<CombatDeclareFrame>`, `useDraggable` (dans le frame) tourne à chaque état. React réconcilie sur le
type au même emplacement racine → instance préservée entre surprise → déclaration → résolution, la
position tient. **Mais** : le frame **doit être l'élément le plus externe de *chaque* chemin de
retour**, sans wrapper conditionnel autour. À écrire comme contrainte explicite dans le module.
Filet : `useDraggable` retombe sur `localStorage` même à un remount — dégradation gracieuse.

**2. Aucun test n'attrape une régression de module 2. `[VÉRIFIÉ]`** `tests/e2e/` = `smoke.spec.mjs`
seul, **zéro parcours de déclaration de combat**. Le golden master (module 0) teste le **payload**,
pas le châssis. Donc `useDraggable`, le prop `hidden` (masquage pendant ciblage), le header, les
slots : **rien ne les couvre** jusqu'à la validation navigateur « en bloc » de Saar — qui ne peut pas
bisecter un lot. → **un commit par fenêtre** (§13.8) devient non négociable, et le module doit
livrer un **checklist de vérification manuelle** (drag, masquage au ciblage, chaque état
non-déclaration, redimensionnement 360↔720) que Saar déroule à la fin, fenêtre par fenêtre.

**3. Le cadrage sur-vend le nettoyage `#5b8dee` du module 2.** §13.5 : « tout ce qui est `#5b8dee`
dans les fichiers que ce module touche déjà → `--combat-accent-*` ». Or module 2 ne touche que le
**châssis externe** — les `#5b8dee` sont dans le **corps** (`W.itemSelected`, `S.quickRowActive`,
roster actif, `AssaultRangedPanel`…), périmètre des modules 3/4/5. **Module 2 *définit*
`--combat-accent-*` et n'en convertit quasiment aucun.** Corrigé : le nettoyage `#5b8dee` est un
sous-objectif des modules **3/4/5**, pas 2.

**4. Ordre : module 2 est le plus risqué ET le moins visible.** Il réécrit la structure externe des
3 fenêtres (risque élevé, §13.8) pour un gain que Saar **ne verra presque pas** (unification de
châssis). Modules 3 (satellite) et 5 (pied) sont plus visibles et moins risqués. **Mais** 3 et 5
consomment les slots `satellite`/`footer` du frame → dépendance réelle. **Compromis retenu** :
module 2 d'abord, mais **réduit au strict minimum** (cf. point 5) ; 3 et 5 apportent le visible juste
après.

**5. Le cadrage crée une classe CSS neuve (`.combat-declare-frame`) et une nouvelle valeur
`--combat-exo-bg` inventée — sur-ingénierie pour un module « châssis ».** Reformulation :
- Le frame **réutilise le visuel `.combat-float-win`** existant (2 des 3 fenêtres l'utilisent déjà),
  pas une classe neuve. Le MJ **bascule dessus** (perd `.combat-win` / `--combat-header`). Une seule
  famille, celle qui existe déjà et couvre la majorité — moins de surface de régression qu'une
  classe neuve à recaler pixel par pixel. *(Contredit §13.2 « adopter la palette combat dédiée » —
  arbitrage : la palette `--combat-*` est « plus juste » mais bascule les 3 fenêtres au lieu d'1, ×3
  le risque visuel non testé. Le strict re-parentage `.combat-float-win` bascule 1 fenêtre.)*
- `--combat-exo-fg/border` = `#9858c8` (D3, validé). `--combat-exo-bg` : **`[INFÉRÉ]` `#140a1e`**
  (teinte violette très sombre, cohérente avec `pj-bg #0a1a0a` / `pnj-bg #1a0a08` / `drone-bg
  #081414`) — **à valider à l'œil par Saar**, pas à figer ici.
- `<CombatPcbBackdrop>` : garder l'idée, mais **module 2 le pose seulement sur le header** (une zone,
  un test). Pied et satellite le reçoivent à leurs modules respectifs (5 et 3).

**6. Poignée basse MJ (PO-M2-a) — `[VÉRIFIÉ]` genèse.** Ajoutée Session 118 (commit `02aee6f`,
« poignées basses », pass d'ergonomie COM15) — délibérée, pas un accident. La retirer = régression
UX mineure assumée. **Reco : la garder** comme `bottomHandle` optionnel du frame, activé pour les
3 (gratuit une fois le frame en place, cohérent).

**7. REACT.md P58 — pas de conflit `[VÉRIFIÉ]`.** P58 : « les 3 fenêtres restent des orchestrateurs
séparés — la fusion GM + Joueur est rejetée ». Le frame est du **châssis**, pas du pilotage ; P58
liste déjà les briques `CombatDeclare*` et nomme le frame comme « chantier design séparé ».
`CombatDeclareFrame` s'ajoute à la table des briques de P58 à la clôture.

**Conclusion — le module 2 se fait, révisé :**
- Frame = **wrapper structurel minimal** réutilisant `.combat-float-win` ; MJ bascule dessus (1
  fenêtre change de famille, pas 3).
- `--combat-accent-*` + `--combat-exo-*` **définis** ; conversion `#5b8dee` **repoussée aux modules
  3/4/5**.
- PCB sur le header seulement.
- `bottomHandle` conservé (option du frame).
- Contrainte Rules-of-Hooks : frame = élément le plus externe de chaque `return`.
- Livrable = code **+ checklist de vérif manuelle par fenêtre** (aucun filet automatisé, point 2).
- PO-M2-b / d / e restent à trancher au moment du code (décisions mineures, pas bloquantes).

---

## 14. Cadrage Module 3 — `CombatDeclareStatePanel` (satellite d'état, D8)

> Cadrage 2026-08-29. Lecture faite : `combatSections.js` (`STATE_DEFS`, `stateTransitionCost`,
> `nextKey`), `CombatDeclareStateSelector.jsx` + `CombatDeclareStateChip.jsx`, sections TACTIQUE /
> ARMEMENT des 3 fenêtres, `combat.json` `states.*`, `docs/SYSTEME/EXOARMURE.md` (posture exo).
> **Aucun code — cadrage seul.** Analyse à charge = tour suivant.

### 14.1 Responsabilité

Sortir les **sélecteurs d'état tactique** (posture, vitesse, arme) du corps des fenêtres vers un
**panneau satellite accroché au bord gauche** de la fenêtre principale, qui **suit sa position**
(D8 : « statut, pas actions »). Brique = `CombatDeclareStateChip` **existant** + un glyphe (§14.4).
**Identique PJ / MJ / Exo** ; l'exo, qui envoie `state: {}` aujourd'hui, gagne les mêmes puces.
**Ne touche pas** : `fire_mode` (→ col. 2, module 4, §14.7), la liste d'armes (module 4), le pied
(module 5), le calcul de coût INI (`STATE_TRANSITION_COST`, autorité serveur, intact).

### 14.2 État des lieux `[VÉRIFIÉ]` — les axes d'état

`STATE_DEFS` (`combatSections.js`) définit **5 axes** ; coûts de transition dans
`shared/combatIniCost.js` (`STATE_TRANSITION_COST`, partagé serveur) :

| Axe | Valeurs | i18n (`states.*`) | Glyphe (`assets/status/`) |
|---|---|---|---|
| `position` | standing / crouching / kneeling / prone | Debout / Accroupi / À genou / Couché | `stand` / `crounch` / `kneel` / `crawl` |
| `vitesse` | delayed / normal / rushed | Retardée / Normale / Précipitée | `actionDelayed` / `actionNormal` / `actionRush` |
| `weapon` | holstered / ready / drawn | Rangée / Prête / Au clair | `WeaponA` / `WeaponB` / `WeaponC` |
| `fire_mode` | cc / rc / rl | — | — → **part au module 4**, pas au satellite |
| `cover` | exposed / partial / important | Exposé / Partiel / Important | — → **aucun sélecteur nulle part** aujourd'hui `[VÉRIFIÉ]`, hors satellite |

`CombatDeclareStateChip` (click-to-cycle `nextKey`, API `{stateKey, current, initial, onChange,
availableKeys}`, coût vs `initial` = `snapFromRosterEntry`) est **la** brique du satellite, avec un
glyphe. `initial` = `initialStates.current[axe]` inchangé.

### 14.3 Contenu du satellite par famille

> **Erreur corrigée (Saar, 2026-08-29 — §11 round 6).** La version précédente affirmait
> « `[VÉRIFIÉ]` exo = {standing, prone} seulement, pas de crouch/kneel, pas de weapon ». **Faux** —
> inférence tirée du *silence* de `EXOARMURE.md` (qui ne parle de posture exo que dans le contexte
> « se relever »), alors que `ROADMAP.md` §1 point 4 **liste explicitement** « arme rangée/au clair,
> position accroupi/genou » pour l'exo, et que rien dans le RAW ne restreint. Même faute que le
> round 5. Modèle correct ci-dessous.

**Satellite identique PJ / MJ-PNJ / Exo** (Saar 2026-08-29 : *« la fenêtre d'action MJ = PJ »* — la
divergence Session 158 « MJ Vitesse en segmented » est **caduque**, D1). **Drone : aucun satellite**
(D8 — `state` fixe).

| Axes du satellite | PJ | MJ-PNJ | Exo |
|---|---|---|---|
| **Posture** (4) + **Vitesse** (3) + **Arme** (3), en `CombatDeclareStateChip` glyphe | ✅ | ✅ | ✅ |

Exo : **pas** de `fire_mode` (fixe, `[VÉRIFIÉ]` `EXOARMURE.md:300`). Vitesse **incluse** (Saar
confirmé 2026-08-29).

**Exo — pourquoi les 3 axes s'appliquent, `[VÉRIFIÉ]` :**
- **Posture (4)** : `POSITION_TRANSITION_COST` (`shared/combatStatePositionCost.js`, source RAW
  `REGLESYSCOMBAT.md:929-941`) s'applique **telle quelle** à l'exo (`PLAN_EXOARMURE.md` §9). Coût
  d'Initiative standard sur toutes les transitions.
- **Arme (3)** : **exactement comme HUMAN** (Saar 2026-08-29) — coût d'Initiative de transition
  (`STATE_TRANSITION_COST.weapon`, `drawn↔holstered -10`, `drawn↔ready -3`) **et** restrictions de
  jeu (on n'attaque pas avec une arme rangée : sélectionner une arme dans la liste d'action
  auto-dégaine, `weapon → drawn`, comme `SELECT_ATTACK` pour l'humain ; attaque grisée si
  `weapon !== 'drawn'`). Pas de « pas de restriction » — c'était une hypothèse fausse de l'analyse à
  charge, corrigée. À vérifier au module 4 : le serveur applique-t-il déjà ce gate pour l'`isExo`
  (aujourd'hui l'exo envoie `state: {}`, donc jamais exercé) — si non, même règle que l'humain à
  ajouter.
- **Mode de tir** : fixe, dérivé de l'arme — jamais au satellite.

**Cas `prone` (se relever) — TRANCHÉ (Saar 2026-08-29)** : même puce Posture que HUMAN. Depuis
`couché`, sélectionner une autre position = **tentative de se relever** (mécanisme serveur déjà là :
`isExoStandUpAttempt` / `resolveExoStandUpAction` ; jet `DICE_RESULT` visible). Le bouton dédié
« Tenter de se relever » du corps (`handleStandUp`) **disparaît**, remplacé par la puce. Ajout :
au clic, un **message système chat** « Test pour tenter de se relever. En cas d'échec, fin de tour ».
Résultat : **réussite → DEBOUT** (`state:{position:'standing'}`, comme aujourd'hui) ; **échec → fin
de tour**. (Message serveur FR en dur comme les voisins, `PLAN_LOCALISATION` §8 ; ou `system:true`
/`i18nKey` si trivial.)

### 14.4 Brique — réutiliser `CombatDeclareStateChip`, + le glyphe

Recadrage Saar 2026-08-29 : *« tu te fourvoies à réinventer l'interface plutôt que réutiliser
l'existant »*. → Module 3 = **relocaliser** les sélecteurs d'état dans le satellite, pas les refondre.

- **Brique = `CombatDeclareStateChip` tel quel** : click-to-cycle (`nextKey`), coût INI vs `initial`.
  Aucun nouveau composant, aucune question « cycle vs déplier ».
- **Glyphe** : `CombatDeclareStateChip` reçoit un `glyph` (`mask-image` d'un `assets/status/*.svg`
  déjà produit par Saar, recoloré `--combat-accent-fg`) à la place / en tête du label texte (D8
  « peu de texte »). **Mêmes glyphes EXO et HUMAN** (Saar). Mapping = tableau §14.2, un glyphe par
  valeur (PO5 : le glyphe reflète la valeur). 1 fichier modifié, s'applique partout où le chip sert.

### 14.5 Mécanisme « le satellite suit la fenêtre » (PO3c)  `[VÉRIFIÉ]` aucun précédent

Grep : **aucune fenêtre de combat n'est accrochée à une autre** — chacune a son `useDraggable`
indépendant. Mécanisme neuf. Le frame (`CombatDeclareFrame`, module 2) **possède `pos`**
(`useDraggable`, décision module 2) → il rend le satellite comme **élément frère positionné**, pas
comme enfant (le frame a `overflow: hidden`, un enfant « à gauche » serait clippé) :

```
// dans CombatDeclareFrame :
{satellite && (
  <div style={{ position:'absolute', left: pos.left - SAT_W - GAP, top: pos.top }}>
    {satellite}
  </div>
)}
<div className="combat-float-win" data-family={family} style={{ left: pos.left, top: pos.top, … }}>
  … header / body / footer …
</div>
```

→ **raffine l'API module 2** : le prop `satellite` n'est pas un slot *dans* le châssis, c'est un
frère que le frame positionne à partir de son `pos`. Le `hidden` du frame masque les deux. Drag :
gratuit (le satellite lit `pos` à chaque rendu). Clamp bord d'écran gauche : si `pos.left - SAT_W < 8`,
le satellite passe à droite (`left: pos.left + windowWidth + GAP`) — **PO-M3-d**.

### 14.6 Exo — payload `state` (pas de nouvelle fonction pure, cf. §14.11 pt 4)

`CombatExoActionWindow.handleDeclare` envoie aujourd'hui `state: {}`. Avec le satellite :
- **réutiliser `declarationReducer` + `snapFromRosterEntry`** (déjà partagés — Règle 2, pas de
  mini-reducer maison) ;
- `handleDeclare` (branche « déclaration normale ») envoie `state: { position, weapon, vitesse }`
  lus de `decl` — **passe-plat de 3 champs, pas de l'assemblage** → **aucune** `buildExoDeclareState`,
  **aucun** test de caractérisation neuf (le patron module 0 visait le payload complexe).
- branche « se relever » (`prone` → autre, §14.3) : `handleStandUp` existant, envoi immédiat.

`buildExoMapActions` inchangé. Golden master PJ/MJ non concerné.

### 14.7 Seam `fire_mode` (PJ/MJ : reste au corps jusqu'au module 4)

Module 3 retire **position + vitesse + weapon** du corps → satellite, **pour PJ et MJ**.
`fire_mode` **reste** dans la section ARMEMENT du corps (réduite à : liste d'armes équipées +
sélecteur `fire_mode`) jusqu'à ce que le module 4 le déplace en col. 2 (`AssaultRangedPanel` a déjà
« Section mode de tir »). Interim assumé. `decl.fire_mode` reste un champ du reducer tout du long
(le payload le lit). **Exo** : pas de `fire_mode` du tout (fixe), donc pas de seam — son corps
perd juste les sélecteurs qu'il n'avait pas (rien) et gagne le satellite.

### 14.8 Risque + rollback

**Risque moyen (client).** PJ + MJ : déplace 3 puces `CombatDeclareStateChip` (**réutilisé tel
quel**, + un `glyph`) du corps → panneau frère. **Pas de changement de forme de payload** (mêmes
`decl.*` → mêmes `buildXDeclarePayload` → golden master 51 tests). **Exo** : les mêmes puces +
`state` peuplé au payload (14.6) ; le `prone → Test` **existe déjà serveur** (`isExoStandUpAttempt` /
`resolveExoStandUpAction`) — le module ne fait que router la puce vers ce chemin + ajouter le message
chat. Risque **visuel** : positionnement du satellite frère, pas de test auto → **un commit par
fenêtre + checklist manuelle** (comme module 2). Rollback : `git revert` par commit.

### 14.9 Hors périmètre module 3

- `fire_mode` (module 4, §14.7), la liste d'armes (module 4), le pied (module 5).
- `cover` : pas de sélecteur aujourd'hui, on n'en ajoute pas.
- Le recadrage des glyphes mal cadrés (Saar, hors code).
- La conversion hex→token générale (§8).
- Le calcul de coût INI (`STATE_TRANSITION_COST`, serveur).

### 14.10 Points ouverts module 3

**Tout tranché (Saar 2026-08-29) — plus de point ouvert :**
- Satellite **identique PJ / MJ / Exo** (« fenêtre MJ = PJ »). Drone : aucun. Session 158 caduque.
- Brique = `CombatDeclareStateChip` tel quel + un `glyph` (glyphes `assets/status/`, mêmes pour
  tous). Axes : Posture + Vitesse + Arme.
- Exo `prone` : la puce Posture **remplace** le bouton « Tenter de se relever » ; clic → message
  système chat + jet (mécanisme serveur déjà là) ; réussite → DEBOUT, échec → fin de tour.
- Satellite strictement collé au frame (`pos` du frame, D8). Clamp bord d'écran = détail
  d'implémentation (passe à droite si pas la place à gauche).

### 14.11 Analyse à charge du module 3 (2026-08-29)

Revue critique du cadrage §14, étape distincte (checkpoint).

**1. Réutilisation des briques — vérifiée saine, avec un décalage de timing. `[VÉRIFIÉ]`**
`CombatDeclareStateChip` n'est utilisé **que** dans `CombatGmDeclareWindow` (position, weapon,
fire_mode). Lui ajouter un `glyph` optionnel n'a aucun effet collatéral. `CombatDeclareStateSelector`
n'est utilisé **que** dans `CombatActionWindow` (4 usages : position/vitesse/weapon → satellite au
module 3 ; **fire_mode reste** jusqu'au module 4). → `CombatDeclareStateSelector` devient **du code
mort au module 4** (quand fire_mode part en col. 2) : **le module 4 le supprime**, pas le module 3.
À noter dans le cadrage du module 4.

**2. `glyph` doit dégrader.** Un `CombatDeclareStateChip` sans `glyph` (appelant qui l'oublie, ou
usage futur) doit rendre le label texte comme aujourd'hui. Garde triviale (`{glyph && <span
class="chip-glyph" style={maskImage}/>}`), à écrire explicitement.

**3. La puce Posture exo `prone` n'a PAS le comportement d'une puce normale — le cadrage le
minimise.** Puce normale : `onChange` → `dispatch({type:'SET_FIELD', key:'position'})` → attend
DÉCLARER. Exo `prone` (Saar : « **au clic**, message chat + jet ») = **envoi immédiat**, hors
DÉCLARER, comme `handleStandUp` aujourd'hui. → le `onChange` câblé par `CombatExoActionWindow` pour
sa puce Posture **branche** : `isProne ? emitStandUp() : dispatch(SET_FIELD)`. La brique
`CombatDeclareStateChip` **reste générique** ; le branchement vit dans le wiring de la fenêtre exo.
À écrire noir sur blanc dans le module (sinon on croit à tort « même puce, même comportement »).

**4. `buildExoDeclareState` + test = scope creep — retiré.** §14.6 proposait une fonction pure +
test de caractérisation pour le fragment `state` exo. Or ce fragment est un **passe-plat de 3
champs** (`{position, weapon, vitesse}` lus de `decl`), pas de l'assemblage — le patron module 0
visait le payload **complexe** (dual-wield, Tir Multi, Charge). → `CombatExoActionWindow` **réutilise
`declarationReducer`** (déjà partagé) et envoie `state: { position, weapon, vitesse }` ; **pas de
nouvelle fonction pure, pas de nouveau test**. Le seul point qui mériterait un test est la branche
`emitStandUp` (point 3) — c'est de la logique fenêtre, couverte par la checklist manuelle. **§14.6
réécrit.**

**5. Axe `weapon` exo — TRANCHÉ (Saar 2026-08-29) : exactement comme HUMAN.** Coût d'Initiative de
transition (`STATE_TRANSITION_COST.weapon`) **et** restriction de jeu (« on ne peut pas utiliser une
arme rangée ») : sélectionner une arme exo dans la liste d'action (module 4) auto-dégaine
(`weapon → drawn`, miroir de `SELECT_ATTACK` humain) ; attaque grisée si `weapon !== 'drawn'`. Mon
hypothèse « aucune restriction » était fausse — corrigée §14.3. **À vérifier au module 4** : le
serveur (`isExo`) applique-t-il déjà ce gate ? (jamais exercé — l'exo envoie `state: {}` aujourd'hui.)

**6. Le satellite-frère alourdit le module 2 au-delà de « wrapper minimal » (§13.11 pt 5).** Un
`CombatDeclareFrame` qui « réutilise `.combat-float-win` » **et** possède `pos` **et** rend un panneau
frère positionné, c'est plus que minimal. Pas une contradiction, mais le **livrable du module 2 doit
lister explicitement** : « expose `pos`, rend le slot `satellite` comme frère positionné + masqué
avec le frame ». À ajouter au §13.3 / §13.11.

**7. z-index du satellite-frère.** Élément absolu séparé dans l'overlay, à côté des autres fenêtres
de combat → besoin d'un `z-index` explicite (aligné sur celui du frame, ou frame+1). Détail, nommé.

**8. Perf drag.** `setPos` par `mousemove` re-rend frame + satellite (3 puces `mask-image`). Les
fenêtres actuelles re-rendent déjà entièrement au drag → acceptable ; les 3 SVG masqués sont un coût
neuf négligeable. Non-sujet.

**9. Repli si le positionnement du frère résiste au code.** D8 veut « suit la fenêtre ». Si la
synchro frère se révèle fragile (clamp, multi-écran, z-index), replis gracieux **à montrer à Saar
avant de s'entêter** : (a) satellite accroché mais **non suiveur** (position fixe à gauche) ;
(b) section repliable « STATUT » en tête du corps. Nommés pour ne pas être une surprise.

**10. Glyphe `prone → crawl`.** `crawl` évoque le **déplacement** à plat, `prone` (couché) est une
**posture statique**. Léger décalage sémantique — jugement Saar (ses glyphes). `crawl.svg` est aussi
celui au `clipPath` (centrage à valider).

**Conclusion — module 3 se fait, révisé :**
- Brique `CombatDeclareStateChip` + `glyph` (dégradant, point 2). `CombatDeclareStateSelector`
  supprimé **au module 4**, pas ici (point 1).
- Exo : `declarationReducer` réutilisé, `state: {position, weapon, vitesse}` ; **pas de
  `buildExoDeclareState`** (point 4). Le `onChange` de la puce Posture exo branche `prone → emit
  immédiat` (point 3).
- `weapon` exo : **comme HUMAN** (coût INI + gate « pas d'attaque arme rangée », point 5) ; vérifier
  au module 4 que le serveur `isExo` applique le gate.
- Dépendance module 2 explicitée (point 6) + z-index (7) + repli nommé (9).
- Livrable : 1 commit brique partagée (`CombatDeclareStatePanel` + `glyph` sur le chip) + 1 commit
  par fenêtre + checklist manuelle.

---

## 15. Cadrage M0.4 — `useAssaultDeclaration` + `useMeleeDeclaration` (volet technique, option C §12)

> Cadrage 2026-08-29, sous rappel des priorités Saar (qualité structurelle >>> vitesse, aggradation,
> se documenter, ne jamais coder de zéro). Lecture faite : blocs assaut/mêlée de `CombatActionWindow`
> (l.100-127, 417-517, 522-540, 582-598, 825-887) et `CombatGmDeclareWindow` (l.55-77, 340-397,
> 425-502), `declarationReducer.js`, `buildDeclarePayload.js`, `combatSections.js`
> (`computeFireVariant`), `shared/combatExclusiveActions.js`. **Aucun code — cadrage seul.**

### 15.1 Responsabilité

Extraire le **sous-état de sélection Tir** et le **sous-état de sélection Corps à corps** —
aujourd'hui recopiés à ~90 % entre `CombatActionWindow` (PJ) et `CombatGmDeclareWindow` (MJ) — en
**deux hooks de domaine sans `mode`** (option C, §12.3), chacun bâti sur un **reducer pur testé
`.mjs`** (patron `declarationReducer` + `buildDeclarePayload`). Les fenêtres gardent : leur `decl`
tactique, leur acquisition de données, leur pilotage, **et l'orchestration du mode de ciblage carte**
(`onEnterTargetMode` — le point divergent, §15.4).
**Ne touche pas** : le payload (forme figée par le golden master 51 tests), le calcul métier
(`computeFireVariant`, `getAim*` — déjà purs et testés), la fusion des orchestrateurs (rejetée).

### 15.2 Recherche — pratique pro, dépôts, choix de paradigme

**Problème type** : sortir de la logique *stateful* entremêlée de deux gros composants, avec un état
lié à des callbacks asynchrones (le flux de ciblage). Sources :
- [Kent C. Dodds — *The State Reducer Pattern with React Hooks*](https://kentcdodds.com/blog/the-state-reducer-pattern-with-react-hooks)
  : un hook expose son `reducer` ; le consommateur peut le surcharger. **Envisagé, écarté ici** — PJ
  et MJ veulent le *même* comportement de sous-état (la divergence est ailleurs, §15.4), pas besoin
  de surcharge.
- [`useReducer` comme machine à états légère](https://swizec.com/blog/reader-question-usereducer-or-xstate/)
  (« clean up your ternary soup ») : le flux « aucune cible → cible[i] posée → série complète » **est**
  une petite FSM. La consolider en `useReducer` est le geste idiomatique.
- **XState** ([useMachine](https://www.typeonce.dev/course/xstate-complete-getting-started-guide/toggle-actors-states-and-context/using-state-machine-in-react-component))
  : **rejeté** — nouvelle dépendance, contraire à §8 (« aucune nouvelle dépendance », même logique
  que le rejet de vitest/RTL au round 4). `useReducer` = choix aligné Enclume (`declarationReducer`
  existe déjà, pur, testé `.mjs`).
- Dépôts de référence — **headless hooks composés par le consommateur, sans `mode`** :
  [`downshift`](https://github.com/downshift-js/downshift) (Kent C. Dodds — select/combobox headless,
  state-reducer, multi-select = analogue au multi-cible),
  [`@tanstack/react-table`](https://github.com/TanStack/table) (le hook rend état + handlers, zéro
  rendu), [`react-hook-form` `useController`](https://github.com/react-hook-form/react-hook-form)
  (sous-hooks de champ composés). Tous valident : **petits hooks de domaine, l'appelant compose**.

**Décision** : `use{Assault,Melee}Declaration` = `useReducer(pureReducer, init)` +
sélecteurs dérivés purs (`.mjs`), aucun `mode`, aucune dépendance neuve. Le patron exact que le
module 0 a déjà posé (M0.1-M0.3), poursuivi.

### 15.3 État des lieux `[VÉRIFIÉ]` — l'état dupliqué

| Concept | PJ (`CombatActionWindow`) | MJ (`CombatGmDeclareWindow`) | Identique ? |
|---|---|---|---|
| Cibles Tir | `assaultPendingTokenIds[]` | `assaultTargets[]` | ✅ (nom ≠) |
| Nb de tirs | `assaultCount` (1-3) | `assaultCount` (1-3) | ✅ |
| Variante rafale | `assaultBulletCount`, `assaultVariantAB` | idem | ✅ |
| Deux armes Tir | `isDualWield` | `isDualWield` | ✅ |
| Tir visé | `aimTranches`, `aimedLocation` | idem | ✅ |
| Cibles CaC | `meleePendingTokenIds[]` | `meleeTargets[]` | ✅ (nom ≠) |
| Nb attaques CaC | `meleeCount` | `meleeAttackCount` | ✅ (nom ≠) |
| Arme CaC choisie | `selectedMeleeWeaponId` (`undefined`=auto) | `selectedGmMeleeWeaponId` | ✅ |
| Arme naturelle CaC | `selectedMeleeNaturalWeaponId` | `selectedGmMeleeNaturalWeaponId` | ✅ |
| Deux armes CaC | `isDualWieldMelee` | `isDualWieldMelee` | ✅ |
| CaC « en cours » | *(dérivé de `mapSelected`)* | `meleePendingMode` (bool explicite) | ⚠️ modélisé ≠ |
| Charge | `moveSelection` + `meleePendingTokenIds` chaînés (`handleChargeFlow`) | objet `chargeSelection: {move, targetTokenId}` (`handleStartCharge`) | ⚠️ forme ≠ |
| « 1er clic remplit la série » | `handleChooseTarget` l.587-593 | `handleStartAttack` l.432-437 | ✅ **logique identique, recopiée** |
| Dérivés (`effectiveAssaultCount`, `currentVariant`, `assaultValid`, `*IneligibilityReasons`) | l.446-479, 625-636 | l.366-411 | ✅ **mêmes appels, recopiés** |
| Reset (~15 setters) | effet l.254-285 | effet l.143-170 | ✅ **même discipline, recopiée** |

→ **partageable** : tout le sous-état Tir, tout le sous-état CaC *sauf* la forme de la Charge et le
flag « CaC en cours ». **Ces deux-là** : à unifier dans le hook (forme canonique
`charge: {move, targetTokenId} | null` + `phase` explicite), les 2 fenêtres s'y alignent — c'est
l'aggradation, pas un contournement.

### 15.4 La frontière — hook vs fenêtre (le point délicat, §12.3-C)

Le **flux de ciblage carte** diverge et **reste à la fenêtre** :
- PJ : `inTargetMode` / `inMeleeTargetMode` (flags locaux) + `handleChooseTarget(index)` (un slot à
  la fois, bouton par slot).
- MJ : `isSelectingOnMap` (flag unique, conflate) + `handleStartAttack` / `handleStartMelee` avec la
  **chaîne récursive `selectNext`** (auto-avance sur les N cibles) + refs `isMountedRef` /
  `*CountRef` (StrictMode).

**Le hook n'orchestre PAS `onEnterTargetMode`.** Il expose des *mutations d'état* que le callback de
la fenêtre appelle :
```
const assault = useAssaultDeclaration({ weapon, currentFireMode, hasTwoWeapons, sameFirMode, rosterEntry, … })
// … état : assault.targets, assault.count, assault.effectiveCount, assault.currentVariant,
//          assault.isValid, assault.multiShotIneligibility, assault.aimIneligibility …
// … mutations : assault.setCount(n), assault.setTarget(index, tokenId), assault.setDualWield(b),
//               assault.setAimTranches(n), assault.setAimedLocation(loc), assault.setBulletCount(n),
//               assault.setVariantAB(ab), assault.reset(), assault.clear() …

// dans la fenêtre, inchangé :
onEnterTargetMode(tokenId, pos, (picked) => assault.setTarget(i, picked), onCancel, 'ranged')
```
`setTarget(index, tokenId)` **contient** la règle « 1er clic remplit la série, clic ultérieur touche
le slot » (recopiée 2× aujourd'hui → 1 fois dans le reducer). La chaîne récursive `selectNext` du MJ
reste dans la fenêtre MJ, mais **`melee.setTarget` porte sa propre borne** (retourne « série
complète ? ») pour que `selectNext` n'ait pas à lire `effectiveMeleeCount` dans un callback async
(§15.10 pt 3).

**Indépendance : state oui, validité non `[VÉRIFIÉ]` (§15.10 pt 2).** `assault.aimIneligibility`
dépend de la *présence* CaC (Tir visé ⊕ CaC). → la **fenêtre** assemble `mapActionsObj` depuis
`assault.*` + `melee.*` et le repasse au sélecteur d'éligibilité. Ce n'est pas un couplage de state
(1 objet plat au call site), mais les deux hooks ne sont pas « totalement indépendants ».

### 15.5 API — le reducer pur + le hook

Fichier neuf `client/src/lib/assaultDeclaration.js` (pur, `+ .test.mjs`) :
```
export const ASSAULT_INITIAL = { targets: [], count: 1, bulletCount: null, variantAB: 'A',
                                 isDualWield: false, aimTranches: 0, aimedLocation: null }
export function assaultReducer(state, action) { … }   // SET_COUNT, SET_TARGET{index,tokenId},
                                                       // SET_BULLET_COUNT, SET_VARIANT_AB,
                                                       // SET_DUAL_WIELD, SET_AIM_TRANCHES,
                                                       // SET_AIMED_LOCATION, RESET, CLEAR
// sélecteurs purs (mêmes calculs qu'aujourd'hui, un seul endroit) :
export function effectiveAssaultCount(state, currentFireMode) { … }   // CC only
export function assaultValid(state, { currentFireMode, assaultBulletCount, … }) { … }
```
`client/src/lib/useAssaultDeclaration.js` : `useReducer(assaultReducer, ASSAULT_INITIAL)` + `useMemo`
sur les sélecteurs + `computeFireVariant` / `getAim*` (déjà purs) + `useCallback` sur les mutations.
Idem `meleeDeclaration.js` / `useMeleeDeclaration.js`.

**Le payload** : `buildHumanDeclarePayload` / `buildGmDeclarePayload` (module 0) prennent toujours un
bag plat — la fenêtre le remplit désormais depuis `assault.*` / `melee.*` au lieu de ses `useState`.
**Forme du bag et du payload : inchangée** → golden master 51 tests = filet direct.

### 15.6 Découpe en petits pas (tests verts après chaque)

| Pas | Contenu | Filet |
|---|---|---|
| M0.4-a | `assaultDeclaration.js` (reducer + sélecteurs) `+ .test.mjs` (caractérisation : série de tirs, Tir Multi CC, visé, dual-wield, RESET/CLEAR) — **aucun câblage** | `npm test` |
| M0.4-b | `useAssaultDeclaration.js` + câblage dans **`CombatActionWindow`** (PJ) : les 7 `useState` assaut → le hook ; `handleDeclare` remplit le bag depuis `assault.*` | golden master + `vite build` + eslint baseline |
| M0.4-c | Câblage `useAssaultDeclaration` dans **`CombatGmDeclareWindow`** (MJ). Différences légitimes (defaults `0` vs `null`) déjà dans `buildGmDeclarePayload` | idem |
| M0.4-d | `meleeDeclaration.js` + `.test.mjs` | `npm test` |
| M0.4-e | `useMeleeDeclaration` câblé PJ, puis MJ (2 sous-commits). `phase` explicite (§15.3, PO-M04-b). **PAS la Charge** (→ M0.4-g) | golden master |
| M0.4-f | Reset : l'effet des 2 fenêtres appelle `assault.reset()` / `melee.reset()` (de ~15 setters → 3 appels) | golden master + relecture manuelle du reset tour/slot |
| M0.4-g | Unification de la forme `charge` (`{move, targetTokenId}`) — le PJ s'y aligne, ripple 4-5 sites (§15.10 pt 4). **Ou reportée** si trop de surface. Golden master mis à jour explicitement si le payload bouge (§15.10 pt 8) | golden master (màj délibérée possible) + checklist Charge PJ/MJ |

Un pas = un commit. Ancien `useState` retiré dans le même commit. `assault.clear()` = comportement
PJ (reset `isDualWield`) → **correctif MJ** documenté (§15.10 pt 1), test + commit à part si besoin.

### 15.7 Risque + rollback

**Risque moyen-élevé** (état interne de 2 gros composants), **mais le mieux filet du chantier** :
le golden master (`buildDeclarePayload.test.mjs`, 51 tests) teste **exactement la sortie** que ce
refactor doit préserver — comportement iso garanti à chaque pas. `+` les nouveaux `.test.mjs` des
reducers. `+` `vite build` + eslint baseline (patron modules 0). Rollback = `git revert` par pas.
Pas de feature flag (§6).
**Zone sans filet** : le flux de ciblage carte (reste à la fenêtre, non testé) — mais il **ne
change pas** (M0.4 ne le touche pas, §15.4). Vérif : parcours navigateur Tir Multi + CaC multiple
(PJ et MJ) à la fin, checklist.

### 15.8 Hors périmètre M0.4

- Le flux de ciblage carte (`onEnterTargetMode`, `selectNext`, `isSelectingOnMap`) — reste fenêtre.
- Le `decl` tactique (`declarationReducer`, déjà partagé).
- Le drone / l'exo (`useDroneDeclare` / `useExoDeclare` — déjà des hooks de domaine, pas concernés).
- Le rendu (module 4).
- La fusion PJ/MJ des orchestrateurs (REWORK-05).

### 15.9 Points ouverts M0.4

| # | Question |
|---|---|
| PO-M04-a | `charge` : forme canonique `{move, targetTokenId} \| null` (celle du MJ) — le PJ s'y aligne (aujourd'hui `moveSelection` + `meleePendingTokenIds` chaînés). Confirmer que rien côté PJ ne dépend de la forme actuelle hors `handleChargeFlow` / `buildHumanDeclarePayload`. |
| PO-M04-b | Le flag « CaC en cours » : `phase: 'idle' \| 'targeting' \| 'ready'` dans le hook, ou un simple `bool` ? (le MJ a `meleePendingMode` explicite, le PJ le dérive de `mapSelected`) |
| PO-M04-c | `selectedMeleeWeaponId === undefined` (auto) vs `null` (mains nues) vs `id` : la sémantique tri-valuée passe telle quelle dans le reducer — vérifier qu'aucun `?? undefined` implicite ne casse. |
| PO-M04-d | `mapSelected` (Set PJ) : reste-t-il à la fenêtre PJ (c'est de l'état de *tuile*, pas de sous-état d'attaque) ou disparaît-il au module 4 avec « l'arme EST l'action » ? → probablement module 4, noté. |

### 15.10 Analyse à charge M0.4 (2026-08-29)

**1. « 90 % recopié » — vrai, mais deux clears qui divergent `[VÉRIFIÉ]`.** Le clear d'attaque :
- PJ (`clearAttackState` l.522-531) : `+ setIsDualWield(false)` `+ setInTargetMode(false)`.
- MJ (inline l.674-679 / 702-707) : **ne remet PAS `isDualWield`**.
→ à l'unification (`assault.clear()`), **le comportement PJ gagne** (reset `isDualWield` aussi — plus
sûr : une valeur `true` restée en mémoire s'appliquerait sinon silencieusement après un re-choix
d'arme, cf. la même prudence dans `effectiveDualWieldMelee`). **Changement de comportement pour le
MJ** — le golden master l'attrape si un test exerce « MJ dual-wield → clear → re-sélection » ; sinon
à couvrir par un test neuf. Pas « recopie iso » : à documenter comme correctif.

**2. Les deux hooks NE sont PAS indépendants `[VÉRIFIÉ]`.** `getAimIneligibilityReasons` (assaut)
prend `mapActions: { move, attack, melee, reload }` — il a besoin de la **présence CaC** (Tir visé ⊕
CaC). Donc `assault.aimIneligibility` dépend de l'état mêlée. → **la fenêtre est le point de
composition** : elle assemble `mapActionsObj` depuis `assault.*` **et** `melee.*` et le repasse au
sélecteur d'éligibilité. Ce n'est pas de l'entanglement recréé (c'est 1 objet plat assemblé au call
site, pas un couplage bidirectionnel de state) — mais le cadrage §15.4 le sous-entendait « hooks
indépendants », c'est faux : **indépendants pour le *state*, composés pour la *validité*.** À écrire.

**3. La chaîne récursive `selectNext` (MJ multi-CaC) lit `effectiveMeleeCountRef.current` dans un
callback async `[VÉRIFIÉ]`.** Si `meleeCount` passe dans `useMeleeDeclaration`, la fenêtre MJ n'a plus
ce ref. `melee.effectiveCount` (valeur, pas ref) serait **capturé périmé** dans la closure
`selectNext`. → le hook doit exposer **soit un `ref`** (`melee.effectiveCountRef`) pour lecture dans
les callbacks async, **soit** `melee.setTarget(i, id)` retourne « série complète ? » et `selectNext`
n'a plus besoin de connaître `N`. La 2ᵉ est plus propre (le hook porte sa propre borne). **PO-M04-e
neuf.**

**4. PO-M04-a (unification de la forme `charge`) est plus qu'un renommage côté PJ `[VÉRIFIÉ]`.**
`handleChargeFlow` (PJ) pose `moveSelection` **ET** `meleePendingTokenIds`. `moveSelection` (state
fenêtre) alimente : l'aperçu INI (`mapActionsObj.move`), le payload `move` (`buildHumanDeclarePayload`
lit `sel.moveSelection`), le masquage (`hasPendingOwnMove`). Si `charge` devient
`melee.charge = {move, targetTokenId}`, `moveSelection` doit être **dérivé** de `melee.charge.move`
quand `combatMode === 'charge'` — ripple sur 4-5 sites PJ. → **découpe** : sortir l'unification
`charge` de M0.4-e en **pas M0.4-g dédié**, OU garder 2 formes `charge` derrière le hook pour M0.4 et
unifier plus tard. **À trancher au moment du code** ; ne pas gonfler M0.4-e.

**5. Que change le module 4 sur le sous-état assaut ? `[INFÉRÉ]` — à confirmer au cadrage du
module 4.** M0.4 extrait `targets / count / bulletCount / variantAB / isDualWield / aimTranches /
aimedLocation`. Avec « l'arme EST l'action » (D5) ces 7 **survivent** (ce sont des options de
l'attaque, pas des tuiles). Ce qui meurt : `mapSelected` (Set de tuiles, **état fenêtre PJ**, pas
sous-état) et le radio Tir/CaC séparé. → M0.4 extrait le **cœur stable** ; le module 4 ne change que
*comment on déclenche* `setTarget` / la sélection d'arme. **Pas de churn** — sous réserve de
confirmer au cadrage du module 4 qu'aucun de ces 7 champs n'est reshapé.

**6. Le sélecteur `isValid` prend un bag de contexte fenêtre (`weapon`, `hasTwoWeapons`,
`rosterEntry`, `lunetteNiveau`…).** Si la fenêtre en oublie un / le passe périmé, `isValid` renvoie
faux **en silence** (le code inline actuel a tout en portée). Nouvelle surface d'erreur, non testée
(pas de test composant). Atténuation : signature de sélecteur explicite, `.test.mjs` du sélecteur
avec entrées connues, **checklist manuelle** (Tir simple/Multi/visé/dual-wield valides et invalides,
PJ + MJ).

**7. Le hook n'est PAS auto-resettant.** Il reste passif : la fenêtre appelle `assault.reset()` /
`melee.reset()` dans son effet `[tokenId, has_announced]`. Le hook ne s'abonne à rien. Correct pour
2 fenêtres ; à écrire (sinon on cherchera un `useEffect` fantôme dans le hook).

**8. M0.4-e peut légitimement toucher le golden master.** Si l'unification `charge` / `phase`
change quoi que ce soit d'observable au payload (point 1, point 4), un test `buildDeclarePayload`
est **mis à jour explicitement** (règle de l'en-tête `buildDeclarePayload.js` : « toute évolution de
règle passe par un test mis à jour explicitement »). Autorisé, mais **délibéré + justifié en commit**,
jamais un `.expected` ré-enregistré à l'aveugle.

**9. Granularité fichiers.** 4 sources (`assaultDeclaration.js` + `useAssaultDeclaration.js` +
idem mêlée) + 2 `.test.mjs`. Le reducer pur **doit** être un fichier séparé (importable sans React
pour `node --test`) — patron `buildDeclarePayload.js`. Le hook wrapper séparé aussi (React). 6
fichiers = juste, pas de la dispersion.

**Conclusion — M0.4 se fait, révisé :**
- Hooks indépendants pour le *state*, **composés par la fenêtre pour la validité** (point 2) — §15.4
  à préciser.
- `assault.clear()` = comportement PJ (reset `isDualWield`), **correctif** pour le MJ (point 1),
  test + commit dédiés.
- `selectNext` MJ : le hook porte sa borne (`setTarget` self-terminant), pas de ref exposé (point 3).
- Unification `charge` = **pas M0.4-g dédié** ou reportée (point 4) — décidé au code.
- Découpe M0.4-a..f **+ g** (charge). Golden master mis à jour explicitement si besoin (point 8).
- Livrable : 1 commit/pas + checklist manuelle Tir Multi / CaC multiple (PJ + MJ).

---

## 16. Cadrage Module 4 — `CombatDeclareActionList` (liste d'action groupée, D5/D6/D7/D9/D13)

> Cadrage 2026-08-29, sous rappel des priorités Saar. Lecture faite : `AssaultRangedPanel.jsx`
> (376 l., intégral), `MeleeCombatPanel.jsx` (400 l., intégral), `handleMapToggle` / `MAP_ACTIONS` /
> sections ACTION+ARMEMENT des 2 fenêtres, `weaponSlots.js`, `combatSections.js` (`COMBAT_MODE_DEFS`).
> Recherche : master-detail pattern ([Wikipedia](https://en.wikipedia.org/wiki/Master%E2%80%93detail_interface),
> [MUI X](https://mui.com/x/react-data-grid/master-detail/) — master ~360 / detail flexible,
> côte-à-côte pour écran large, empilé pour écran étroit). **Aucun code — cadrage seul.**

### 16.1 Responsabilité

Le **cœur visuel** : remplacer, dans le corps des fenêtres, le modèle « tuiles ACTION + bloc
ARMEMENT + panneau droit » par une **liste d'armes groupée (Distance / Contact) où choisir une arme
= déclarer cette attaque** (D5), en **deux colonnes hiérarchiques** (D6), Rechargement dans la
col. 2 (D7), Déplacement en ligne distincte au-dessus (D13), sélection sans radio (D9).
**Consomme** : `CombatDeclareFrame` (module 2), le satellite (module 3), `useAssaultDeclaration` /
`useMeleeDeclaration` (M0.4). **Ne fait que du rendu + du câblage** — golden master 51 tests garde le
payload. **Ne touche pas** : le payload, le calcul métier, la phase RÉSOLUTION.

### 16.2 État des lieux `[VÉRIFIÉ]`

- **`AssaultRangedPanel` (376 l.) et `MeleeCombatPanel` (400 l.) sont *présentationnels*** : props +
  callbacks, **zéro `useState`**, sections empilées verticalement, **aucune largeur interne figée**
  (sliders/segments en `width:100%` / `flex:1`). → **PO3(b) tranché : réagencement (resserrage CSS),
  PAS réécriture.** Les 2 panneaux **restent**, colonne plus étroite. Seule exception :
  `AimedLocationPicker` (silhouette) → 2 sous-colonnes (D11).
- **Les modes de combat CaC (Charge/Défensif/Retraite) sont DÉJÀ dans `MeleeCombatPanel`** (section
  « Mode de combat », badges `COMBAT_MODE_DEFS`, l.213-257). → PO2 = choix de *présentation*, pas de
  logique neuve.
- **Assemblage de la liste** : PJ a `assaultWeapons` / `meleeWeapons` / `naturalWeapons` /
  `allInventoryItems` ; MJ a `equipment[tokenId].{weaponMg,weaponMd,weapon2M,weaponTr}` + mutations.
  Formes ≠ → il faut un **normalisateur**.
- **`mapSelected` (Set PJ) / `isAttackActive`+`isMeleeSetup` (MJ)** = l'état « quelle action » →
  **remplacé** par « quelle arme sélectionnée ». L'exclusivité CaC ⊕ Tir devient **automatique**.
- **`fire_mode`** arrive ici (retiré du corps au module 3). `AssaultRangedPanel` a déjà la « Section
  mode de tir ». → `CombatDeclareStateSelector` devient **code mort, supprimé par ce module**
  (§14.11 pt 1).

### 16.3 Structure cible

```
┌ Corps de la fenêtre ───────────────────────────────────────────┐
│ + Déplacement                                    8 m · −5       │ ← D13, ligne distincte, cumulable
├ COL. 1 — ACTION (un choix) ──────────┬ COL. 2 — détail (si arme choisie) ┤
│ ▸ DISTANCE                            │ → Scorpion                        │
│    Scorpion                   24/24   │ [ Tir │ Recharger ]               │ ← D7 segment
│    (…)                                │ …AssaultRangedPanel réagencé…     │
│ ▸ CONTACT                             │  — OU si arme de contact :        │
│    Couteau Congre                     │ → Couteau Congre                  │
│    Mains nues            (permanent)  │ …MeleeCombatPanel réagencé…       │
│    Griffes (mutation)                 │   (modes Charge/Défensif/Retraite │
│                                       │    RESTENT où ils sont, PO2)      │
└──────────────────────────────────────┴──────────────────────────────────┘
```
- **Arme mixte** (contact + distance) : ligne dans **les deux** groupes (§4.1).
- **Mains nues** : ligne permanente du groupe Contact. **Armes naturelles** : lignes Contact
  (éligibilité via `naturalWeapons.js`, déjà là).
- Sélection = `data-active` → bordure `--combat-accent-*` + fond teinté (D9, pas de radio).
- Col. 2 **absente** si rien de sélectionné → fenêtre 1 colonne (plus de `width: 720` en dur,
  c'est `baseWidth` + `expanded`).

### 16.4 Le normalisateur — `buildWeaponList` (pur, testé `.mjs`)

`client/src/lib/weaponList.js` : `buildWeaponList(sel) → { distance: WeaponRow[], contact: WeaponRow[] }`,
`WeaponRow = { id, invId, label, slot, group, damage, range, fireMode, ammo, isNatural, isBareHands, … }`.
Entrée = le bag brut de chaque fenêtre → sortie = **une** liste normalisée, groupée. Pur →
`+ weaponList.test.mjs` (arme mixte dans 2 groupes, mains nues permanente, arme naturelle inéligible,
MJ 4 slots, inventaire PJ). **Seule vraie logique neuve du module** — le reste est du rendu.

### 16.5 PO2 — modes de combat CaC — **TRANCHÉ : on ne bouge pas (Saar 2026-08-29)**

Saar : *« ok, pourquoi pas. mais **pourquoi changer d'un coup ?** »*. Juste — la rangée de badges
`Mode de combat` au milieu de `MeleeCombatPanel` (l.213-257) **fonctionne**. La déplacer en tête
était cosmétique. → **elle reste où elle est.** `Charge`/`Défensif`/`Retraite` inchangés
(`onStartCharge`, passifs).
D7 (`Tir │ Recharger` en tête de col. 2) s'applique donc **uniquement à une arme de distance**. Pour
une arme de contact : en-tête = `→ Nom d'arme` seul (le rechargement d'une arme de contact est rare
— arme de jet à munitions ; si le cas se présente, `Recharger` s'ajoute au même endroit, pas un
segment neuf). **Principe : changement minimal, on ne restructure pas ce qui marche.**

### 16.6 Découpe — module 4 est trop gros pour un seul

| Sous-module | Contenu | Risque |
|---|---|---|
| **4a** | `buildWeaponList` + `.test.mjs` (aucun câblage) | faible |
| **4b** | `CombatDeclareActionList` col. 1 : ligne Déplacement (D13) + liste groupée (D5/D9) + sélection. Câblé PJ puis MJ. Col. 2 reste temporairement l'ancien panneau droit | **élevé** (corps des 2 fenêtres) |
| **4c** | Col. 2 : `AssaultRangedPanel` / `MeleeCombatPanel` réagencés en colonne étroite + en-tête `→ Arme` ; silhouette 2 sous-col. (D11) | moyen |
| **4d** | Segment `Tir │ Recharger` (D7, **distance seule** — PO2 tranché, modes CaC ne bougent pas) ; suppression `CombatDeclareStateSelector` ; `mapSelected` / `isAttackActive` retirés | moyen |
| **4e** | Exo : `CombatExoActionWindow` bascule sur `CombatDeclareActionList` (liste d'armes exo, `useExoDeclare` déjà là) | moyen |

Un sous-module validé (golden master + navigateur Saar) avant le suivant. `git revert` par
sous-module.

### 16.7 PO3(a) — faisabilité écran — **TRANCHÉ (Saar 2026-08-29)**

*« Principalement sur PC. L'interface actuelle n'est pas prévue pour portable. »* → cible **PC
(1920 px+)**. Cluster satellite(~90) + fenêtre(720) = ~820 px, reste ~1100 px de carte — confortable.
**Côte-à-côte col. 1 + col. 2 confirmé**, pas de pop-out. Le cas 1366 px n'est pas un critère de
conception (l'interface actuelle ne le supporte déjà pas). Repli pop-out abandonné.

### 16.8 Hors périmètre module 4

- Le payload, le calcul métier, la phase RÉSOLUTION, la fusion des orchestrateurs.
- Le flux de ciblage carte (window, inchangé depuis M0.4).
- Le drone (`DroneDeclareSection` déjà minimal ; hors scope sauf alignement trivial).

### 16.9 Points ouverts module 4

**Tranchés (Saar 2026-08-29) :** PO-M4-a — modes de combat CaC **ne bougent pas** (§16.5).
PO-M4-b — **côte-à-côte, cible PC** (§16.7), pas de pop-out.

**Restants :**

| # | Question |
|---|---|
| PO-M4-c | En-tête col. 2 arme de distance sans munitions suivies : `Recharger` grisé ou absent ? (détail) |
| PO-M4-d | `buildWeaponList` : appelé dans chaque fenêtre, ou dans un `useWeaponList(sel)` fin (miroir `useDroneDeclare`) ? |
| PO-M4-e | Changement d'arme = reset config col. 2 précédente (assumé §7 PO3) — `assault.reset()` / `melee.reset()` au changement d'arme est-il le bon geste ? |
