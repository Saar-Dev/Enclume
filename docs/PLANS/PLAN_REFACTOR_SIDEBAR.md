# PLAN_REFACTOR_SIDEBAR — Découpage de `client/src/components/Sidebar.jsx`

> Statut : en cours. Créé 2026-08-05 (Saar), extrait de `docs/PLANS/REFACTOR_GLOBAL.md` §2 pour
> segmenter le travail fichier par fichier (décision Saar : un chantier de refactor = un fichier
> source à la fois, ce PLAN ne couvre que `Sidebar.jsx`).
>
> Principe directeur (précision Saar, 2026-08-05) : *"1 fichier = 1 responsabilité" n'est pas une
> règle absolue, la logique prime — c'est un mantra pour éviter les fichiers de type Sidebar.*
> Ici le mantra s'applique pleinement : les 8 blocs identifiés ci-dessous sont réellement
> indépendants (chat, fiche perso, palette monde, profil, raccourcis...), pas une seule
> responsabilité cohérente exprimée en plusieurs mécanismes (contrairement à `Editor3D.jsx`, où le
> mantra s'appliquerait mal — voir `REFACTOR_GLOBAL.md` §3). Chaque lot ci-dessous justifie son
> découpage par une indépendance réelle, pas par la taille seule (Règle 3, `RegleDocumentaire.md`).
>
> Règle 10 (`RegleDocumentaire.md`) : ce PLAN est temporaire. À la clôture (tous les lots retenus
> faits et confirmés), retirer ce fichier et transférer tout invariant durable vers
> `docs/SYSTEME/REACT.md` ou la règle `.claude/rules/react.md` si pertinent.

---

## 1. État des lieux (hérité de `REFACTOR_GLOBAL.md` §2, vérifié)

`Sidebar.jsx` fait 3449 lignes, **aucun test** (`find … -iname "*sidebar*.test.*"` vide, confirmé par
recherche du nom du composant dans le contenu de tous les `*.test.mjs` du dépôt — pas seulement par
nom de fichier). 8 blocs indépendants, dont 3 composants React internes non exportés :

| Bloc | Lignes approx. | Nature |
|---|---|---|
| Icônes SVG (`IconEdit`, `IconPlay`, etc., 9 composants) | 44-107 | Présentation pure |
| `CharacterModal` | 114-444 | Modale fiche perso (onglets, upload, notes GM) |
| `DiceBreakdownPopover` + `formatMrDegreeTitle` | 449-500 | Popover breakdown de jet |
| Palette monde/surface (blueprints connecteurs, textures, matériaux) | 503-1149, 1107-1930 | ~800 lignes, le plus gros bloc JSX |
| Effets runtime monde (`worldEffects`) | 735-789 | Fetch + listener socket dupliqué avec `Editor3D.jsx` |
| Barre d'outils GM (mode edit/play, layers) | 1059-1105 | UI |
| Chat + dés + déclarations combat | 946-965, 1975-2329 | Chat temps réel |
| Onglet Personnages | 2332-2411 | Formulaire + liste draggable |
| Onglet Profil | 2418-2496 | Config compte + membres connectés |
| Modale raccourcis clavier | 2501-2538 | UI |
| Objet `styles` inline | 2543-3449 | **906 lignes**, ~26 % du fichier, 38 usages en spread (`...styles.X`) |

**Duplication confirmée avec d'autres fichiers** (à garder en tête, pas à corriger dans ce lot sauf
mention contraire) :
- `DiceBreakdownPopover` (449-488) réimplémente un pattern proche du popover `.ini-popover` de
  `CombatActionWindow.jsx:169,661,1441-1451`.
- Fetch `/battlemaps/:id/world-effects` dupliqué avec `Editor3D.jsx:1242-1243,1515` — aucun store
  partagé aujourd'hui, en violation de `react.md` ("éviter une seconde copie locale divergente").

---

## 2. Séquençage des lots

Un lot = un commit isolé, testé et rapporté (Testé/Non testé) avant de passer au suivant. Ordonné par
risque croissant, pas par ordre d'apparition dans le fichier.

| # | Lot | Risque | Prérequis |
|---|---|---|---|
| 1 | `SidebarIcons.jsx` — extraction des 9 icônes SVG | Quasi nul — déplacement mécanique de composants purs sans state ni prop dynamique | Aucun |
| 2 | `CharacterModal.jsx` + `DiceBreakdownPopover.jsx` — composants déjà isolés, juste à déplacer | Faible-moyen — changt de frontière de montage/démontage, mais comportement identique visé | Un test de rendu par composant avant extraction (aucun test n'existe aujourd'hui) |
| 3 | Audit puis migration de l'objet `styles` (906 l., 38 sites en spread) vers classes CSS + custom properties (`react.md`) | Moyen — 38 sites à auditer un par un, pas un passage automatisé | Lots 1-2 faits (moins de bruit dans le diff) |
| 4 | Onglets `SidebarChatTab.jsx`, `SidebarCharactersTab.jsx`, `SidebarProfileTab.jsx`, `SidebarHelpModal.jsx` | Moyen — plus de surface, mais chaque onglet est déjà conditionné par un seul flag d'affichage | Après lot 3 (dépend des classes CSS) |
| 5 | `SurfaceEditorPanel.jsx` (palette textures/connecteurs/effets) + hook `useWorldEffects(battlemapId, socket)` partagé avec `Editor3D.jsx` | Le plus élevé — touche 2 fichiers, élimine la duplication de fetch | Fait en dernier, en chantier séparé si `Editor3D.jsx` est refactoré en parallèle (`PLAN_REFACTOR_EDITOR3D.md`, pas encore créé) |

---

## 3. Suivi des lots

### Lot 1 — `SidebarIcons.jsx` — ✅ confirmé (2026-08-05, Saar : aucune régression)
9 icônes (`IconEdit`, `IconPlay`, `IconEye`, `IconEyeOff`, `IconRuler`, `IconPlus`, `IconX`, `IconDice`,
`IconPen`) déplacées telles quelles dans `client/src/components/SidebarIcons.jsx`, importées par
`Sidebar.jsx` (3449 → 3386 lignes). Zéro changement de comportement (mêmes composants, même JSX).

**Testé** : `eslint` sur les 2 fichiers touchés (0 erreur, 0 warning), `npm run build` (client, propre —
seul warning : taille de chunk, préexistant, sans rapport), rendu réel en navigateur confirmé par Saar
(aucune régression).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar`.

### Lot 2 — `CharacterModal.jsx` + `DiceBreakdownPopover.jsx`
Statut : à faire.

### Lot 3 — Audit et migration `styles`
Statut : à faire.

### Lot 4 — Onglets (`Chat`/`Characters`/`Profile`/`Help`)
Statut : à faire.

### Lot 5 — `SurfaceEditorPanel.jsx` + `useWorldEffects` partagé
Statut : à faire — dépend d'une décision sur `Editor3D.jsx` (voir `REFACTOR_GLOBAL.md` §3).

---

## 4. Hors périmètre de ce PLAN

- Tout ce qui touche `Editor3D.jsx` au-delà du hook partagé du lot 5.
- La correction du popover dupliqué avec `CombatActionWindow.jsx` (mentionnée en §1, pas un objectif
  de ce chantier — à traiter dans un PLAN dédié si retenu).
- Tout autre fichier du tableau `REFACTOR_GLOBAL.md` §1 (`socketCombatHelpers.js`, etc.).
