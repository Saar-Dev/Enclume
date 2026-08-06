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

> **Révisé après contre-revue du lot 2 (2026-08-05)** : l'ordre 3→4 initial supposait que l'objet
> `styles` resterait dans `Sidebar.jsx` jusqu'au lot 3. Le lot 2 a dû le sortir plus tôt (dépendance de
> `CharacterModal`), scindant l'audit entre 2 fichiers consommateurs — et surtout **CHARMODAL-DEAD1**
> n'était pas tranché. → **Dépassé (2026-08-05)** : Saar a résolu CHARMODAL-DEAD1 lui-même
> (suppression du fichier) pendant que le lot 3 était en cours ; le lot 3 a été mené à son terme
> directement, lot 4 n'a finalement pas eu besoin de passer avant. Table à jour ci-dessous.

| # | Lot | Statut | Risque |
|---|---|---|---|
| 1 | `SidebarIcons.jsx` — extraction des 9 icônes SVG | ✅ confirmé | Quasi nul |
| 2 | `CharacterModal.jsx` + `DiceBreakdownPopover.jsx` — composants déjà isolés, juste à déplacer | ✅ confirmé (`CharacterModal.jsx` supprimé depuis, cf. CHARMODAL-DEAD1 — `DiceBreakdownPopover.jsx` reste) | Faible-moyen |
| 3 | Audit et migration `Sidebar.styles.js` vers classes CSS + custom properties (`react.md`) | ✅ clos fonctionnellement (dette couleur brute résolue, 29 clés basse priorité laissées) | Moyen |
| 4 | Onglets `SidebarChatTab.jsx`, `SidebarCharactersTab.jsx`, `SidebarProfileTab.jsx`, `SidebarHelpModal.jsx` | 4a/4b/4c ✅ confirmés, 4d ✅ codé (2026-08-06) — rendu navigateur à confirmer par Saar, détail §3 | Moyen |
| 5 | `SurfaceEditorPanel.jsx` (palette textures/connecteurs/effets) + hook `useWorldEffects(battlemapId, socket)` partagé avec `Editor3D.jsx` | À faire — dépend d'une décision sur `Editor3D.jsx` | Le plus élevé |

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

### Lot 2 — `CharacterModal.jsx` + `DiceBreakdownPopover.jsx` — ✅ codé (2026-08-05)
Extraction verbatim, comportement inchangé. `Sidebar.jsx` : 3386 → 2089 lignes.

- `client/src/components/CharacterModal.jsx` (343 l.) — importe `styles` depuis le nouveau
  `Sidebar.styles.js` (voir ci-dessous), `IconPen/IconEye/IconEyeOff/IconX` depuis `SidebarIcons.jsx`.
- `client/src/components/DiceBreakdownPopover.jsx` (44 l.) — composant seul, aucune dépendance à
  `styles` (déjà 100% inline styles locaux).
- **Dépendance non anticipée dans le plan initial** : `CharacterModal`/`DiceBreakdownPopover`
  utilisaient l'objet `styles` (906 l.) encore dans `Sidebar.jsx` à ce stade (lot 3 pas encore fait).
  Plutôt que dupliquer des clés ou avancer le lot 3 en catimini, l'objet `styles` complet a été
  déplacé tel quel (aucune modification de contenu) vers `client/src/components/Sidebar.styles.js`
  (909 l., export nommé `styles`), importé par les 3 fichiers. Le lot 3 (audit CSS/custom properties)
  reste entièrement à faire — ce déplacement ne fait qu'éliminer le risque de dépendance circulaire,
  il ne migre aucun style vers des classes.
- `formatMrDegreeTitle` a d'abord été déplacé dans `DiceBreakdownPopover.jsx`, puis **ESLint a
  rejeté ça** (`react-refresh/only-export-components`, erreur : un fichier composant ne doit exporter
  que des composants, sinon le Fast Refresh de Vite casse). Déplacé dans
  `client/src/lib/mrDegreeTitle.js` à la place — cohérent avec la convention déjà en place
  (`client/src/lib/*.js` pour les fonctions utilitaires pures). **À retenir pour les lots 4/5** : tout
  futur fichier composant extrait de `Sidebar.jsx` doit rester component-only, toute fonction pure
  associée part dans `client/src/lib/`.
- Import icônes de `Sidebar.jsx` nettoyé (`IconX`/`IconPen` retirés — plus utilisés dans ce fichier
  après extraction de `CharacterModal`). `IconPlus` reste importé mais inutilisé — **dette
  préexistante, confirmée par `git show HEAD` avant ce lot, pas introduite ici, hors scope**.
- **Trouvaille hors scope, consignée séparément** : `CharacterModal` n'était appelé (`<CharacterModal
  .../>`) **nulle part** dans `Sidebar.jsx`, avant comme après ce lot. Extrait fidèlement quand même
  (comportement inchangé, y compris son absence d'utilisation) — → **résolu**, voir encart
  "CHARMODAL-DEAD1" en fin de section Lot 3.

**Testé** : `eslint` sur les 5 fichiers touchés/créés (0 erreur, 0 warning), `npm run build` (client,
propre — même warning préexistant sur la taille de chunk), fidélité byte-à-byte vérifiée après coup
(`diff` entre `CharacterModal.jsx`/`DiceBreakdownPopover.jsx`/`mrDegreeTitle.js`/`Sidebar.styles.js` et
le contenu correspondant du commit précédent — 4/4 identiques, aucune dérive de transcription), `diff
--stat` de `Sidebar.jsx` confirmé à 5 insertions/1302 suppressions sans aucune ligne collatérale
modifiée dans le corps restant, `DiceBreakdownPopover` confirmé réellement monté et câblé (bouton `⊞`
"Détail du calcul", `Sidebar.jsx` state `breakdownPopover`/`handleOpenBreakdown`) — contrairement à
`CharacterModal`.
**Non testé** : rendu réel en navigateur → ✅ confirmé indirectement (aucune régression rapportée sur
les lots suivants qui dépendent des mêmes fichiers).
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar` (groupé avec lots 3a/3b, voir §5).

### Lot 3 — Audit et migration `Sidebar.styles.js` vers CSS
Statut : **en cours** (décision Saar 2026-08-05 : démarrer maintenant, malgré CHARMODAL-DEAD1 non
tranché — risque jugé faible, un audit CSS sur des clés potentiellement supprimées plus tard n'est pas
un coût significatif).

**Audit complet (132 clés)** avant tout code : 68 sont déjà layout-only (aucune propriété visuelle,
conformes à `react.md`, rien à faire — ex. `roomToolToggle` déjà couplé à `.sidebar-tool-toggle`
existant, pattern de référence à suivre). Sur les 64 restantes avec propriété visuelle
(background/color/border/boxShadow) : 30 utilisent déjà un token `var(--...)` (priorité basse — le
gain réel de migration en classe CSS est marginal, la valeur est déjà centralisée) ; **34 utilisent une
couleur brute (#hex/rgba)** — vraie dette de cohérence de thème, priorité haute. De ces 34, ~20
appartiennent à `CharacterModal.jsx` (gelées tant que CHARMODAL-DEAD1 n'est pas tranché), ~13-14 sont
hors `CharacterModal` — c'est ce sous-ensemble qui est traité en premier, sous-lot par sous-lot.

**Sous-lot 3a — cluster "modale aide raccourcis"** (`helpBtn`, `helpOverlay`, `helpModal`,
`helpHeader`, `helpTitle`, `helpCloseBtn`, `helpSection`, `helpRow`, `kbd` — 9 clés, dont `helpHeader`
migrée par cohérence bien que déjà layout-only) — ✅ codé (2026-08-05). Cluster 100% statique (aucun
usage en spread trouvé) → migration complète en classes CSS (`.sidebar-help-btn`, `.sidebar-help-overlay`,
`.sidebar-help-modal`, `.sidebar-help-header`, `.sidebar-help-title`, `.sidebar-help-close-btn`,
`.sidebar-help-section`, `.sidebar-help-row`, `.sidebar-kbd` dans `client/src/index.css`), `style={}`
entièrement supprimé sur ces éléments (pas juste séparé layout/visuel — rien de dynamique à garder).
Couleurs mappées vers les tokens existants (`--bg-session-raised`, `--border-session`,
`--border-session-2`, `--text-session-hi/mid/lo`) sauf `#5b8dee` (accent titre), sans token
`--color-*` équivalent dans `:root` — laissé en valeur brute, noter comme dette séparée si ça revient
souvent (déjà vu 5× dans `Sidebar.styles.js`).

**Trouvaille en cours de route, corrigée dans ce sous-lot (pas hors scope — même cluster)** :
`styles.helpBtn` n'était référencé nulle part — le vrai bouton d'ouverture (`Sidebar.jsx:589-594`)
réimplémentait les mêmes propriétés en inline `style={{...}}` ad hoc (avec sa propre couleur brute
`#2a2a3e`), sans jamais lire `styles.helpBtn`. Consolidé : le bouton utilise maintenant
`className="btn-icon sidebar-help-btn"`, plus de style inline dupliqué.

**Testé** : `eslint` (0 erreur, 0 warning), `npm run build` (client, propre — CSS 96.63→98.15 kB,
attendu). `Sidebar.jsx` : 2089 → 2088 lignes (peu de gain en lignes ici, le gain est qualitatif :
9 clés + 1 duplication de style éliminées, `Sidebar.styles.js` : 909 → 818 lignes).
**Non testé** : ~~rendu réel en navigateur~~ → ✅ confirmé (2026-08-05, Saar : identique visuellement).
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar` une fois confirmé.

**Sous-lot 3b — dés critique/catastrophe, config, badge en attente** — ✅ codé (2026-08-05).
5 clés prévues (`diceCritSuccess`, `diceCritFail`, `configSuccess`, `configColorPicker`,
`pendingBadge`) + 1 trouvée en cours de route (`undoBtn`, pas dans `CharacterModal` contrairement à
mon hypothèse initiale — utilisable immédiatement, hors gel CHARMODAL-DEAD1).

- `diceCritSuccess`/`diceCritFail` : seul cas de spread dynamique du sous-lot (`{ ...styles.messageDice,
  ...(critStyle || {}) }` sur le message de dé). Remplacé par un attribut `data-crit="success"|"fail"`
  + sélecteurs `.sidebar-glass[data-crit="..."]`, même patron que `[data-active]` déjà utilisé ailleurs
  dans le fichier — plus de spread, plus de merge d'objets à l'exécution.
- `configSuccess`, `pendingBadge` : statiques, migration complète vers classe, `style={}` supprimé.
- `configColorPicker` : même situation que `roomToolToggle` (lot déjà connu) — une classe
  `.sidebar-tool-color-input` existait déjà à côté du style inline, qui la rendait inopérante par
  spécificité (l'inline gagnait toujours). Nouvelle classe `.sidebar-config-color-picker` ajoutée
  après en ordre source pour préserver exactement le rendu actuel (`#16162a`, désormais via le token
  `--bg-session-raised`), `style={}` supprimé.
- **`undoBtn` — trouvaille avec impact fonctionnel réel, pas juste cosmétique** : `.sidebar-undo-btn`
  (+ `.sidebar-undo-btn:disabled`) existaient déjà dans `index.css`, correctement tokenés, y compris
  un état désactivé grisé — mais `style={styles.undoBtn}` restait posé sur les deux boutons Annuler/
  Refaire, avec les **anciennes couleurs brutes**. Une valeur inline gagne toujours sur une classe :
  la classe `:disabled` n'a donc **jamais pu s'appliquer**, le bouton "Annuler" désactivé affichait
  probablement les couleurs actives au lieu du grisé prévu. `styles.undoBtn` ne garde plus que le
  layout (flex/padding/radius/police) ; `undoBtnDisabled` (déjà mort, 0 usage) supprimé. **Restaure un
  comportement visuel prévu par le CSS existant plutôt qu'il ne le change** — à confirmer par toi
  quand même (bouton Annuler désactivé pendant l'édition, doit apparaître grisé).

**Bilan lot 3 (hors `CharacterModal`)** : 34 clés à couleur brute identifiées au départ ; 13 traitées en
3a+3b, 21 restantes toutes confirmées exclusives à `CharacterModal.jsx` (vérifié : aucune n'est
utilisée dans `Sidebar.jsx`). **Tout ce qui n'est pas gelé par CHARMODAL-DEAD1 est fait.** La suite du
lot 3 attend la décision Saar sur ce composant.

**Testé** : `eslint` (0 erreur), `npm run build` (propre). `Sidebar.jsx` : 2088 → 2084 lignes,
`Sidebar.styles.js` : 818 → 777 lignes. Bouton Annuler désactivé → ✅ confirmé grisé par Saar
(2026-08-05) — le comportement restauré par la suppression du style inline dupliqué est le bon.
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé sur `dev/Saar` (groupé, voir §5).

**CHARMODAL-DEAD1 — résolu par Saar directement (2026-08-05), hors session** : `CharacterModal.jsx`
supprimé, confirmé remplacé par `client/src/character/CharacterWindow.jsx` (`characterStore.js`
commentaire mis à jour en conséquence), 2 clés `fr.json` orphelines retirées, `BUGIDENTIFIE.md` clos.
Conséquence sur ce PLAN : le gel du reste du lot 3 est levé.

**Lot 3 — clôture** : ré-audit sur l'état actuel de `Sidebar.styles.js` (572 lignes après suppression
de `CharacterModal`) — **0 clé à couleur brute restante** (les 21 dernières, toutes exclusives à
`CharacterModal.jsx`, ont disparu avec le fichier). Les 29 clés visuelles restantes utilisent déjà un
token (`var(--...)`) — conformité littérale à `react.md` non atteinte (elles vivent en JS, pas en
classe), mais aucune dette de cohérence de couleur réelle ; jugé non rentable de les migrer une par une
maintenant. **Lot 3 déclaré fonctionnellement clos** — dette de couleur dupliquée entièrement résolue,
29 clés basse priorité laissées telles quelles (documenté ici si quelqu'un veut reprendre plus tard).

**Erreur d'outillage trouvée et corrigée en vérifiant** : un script d'audit (`node -e` avec
`new RegExp` construite depuis une chaîne contenant `\\`) a été silencieusement corrompu par
l'invocation Node sous ce terminal Windows/Git Bash (antislashs perdus), annonçant à tort "90 clés sur
90 mortes". Reproduit avec `grep` (fiable) : une seule clé réellement morte, `diceIconAnimating`
(commentaire dans le code prétend "appliqué inline via style spread" — plus vrai, personne ne la lit).
Pas corrigée dans ce lot (trouvée après la clôture du sous-lot 3b, hors scope de continuer à coder) —
micro-nettoyage laissé pour une prochaine passe sur ce fichier.

### Lot 4 — Onglets (`Chat`/`Characters`/`Profile`/`Help`)
Statut : en cours. Ordre revu à charge, du plus simple au plus risqué (4a→4d), un commit isolé par
sous-lot (retour au principe initial, contrairement au regroupement exceptionnel des lots 2/3).

**4a — `SidebarHelpModal.jsx`** — ✅ confirmé (2026-08-05). Extraction pure, aucun état propre —
`showHelp`/`setShowHelp` restent dans `Sidebar.jsx` (le bouton qui ouvre la modale vit dans la barre
d'outils permanente, pas dans la modale). `Sidebar.jsx` : 2084 → ~2050 lignes.
**Testé** : `eslint` (0 erreur), `npm run build` (propre), rendu réel confirmé par Saar (identique
avant/après, modes jeu et édition).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé à venir sur `dev/Saar`.

**4b — `SidebarCharactersTab.jsx`** — ✅ confirmé (2026-08-05). Formulaire de création, liste avec
drag&drop vers la carte, et tout l'état associé (`showNewChar`, `newCharName`, `newCharType`,
`creating`, handlers de drag/clic) déménagés en bloc — plus rien n'en reste dans `Sidebar.jsx`. Le
composant lit `characters`/`isGm`/`addCharacter` directement depuis `useCharacterStore` (même patron
que `CharacterWindow.jsx`), reçoit `campaignId`/`onOpenCharacter` en props.

**Trouvaille hors scope, corrigée séparément (pas dans ce lot)** : le drag&drop vers la carte ne
fonctionnait pas (bug préexistant, sans lien avec cette extraction) — cause racine et correctif
détaillés dans `docs/JOURNAL8.md` (session « Drop personnage : position curseur au lieu d'un point
fixe »).

**Testé** : `eslint` (0 erreur), `npm run build` (propre), rendu réel confirmé par Saar (création,
drag vers la carte — après correctif drag&drop ci-dessus —, clic pour ouvrir la fiche).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé à venir sur `dev/Saar`.

**4c — `SidebarProfileTab.jsx`** — ✅ confirmé (2026-08-05). Réglages compte (pseudo/couleur), liste
des connectés, bouton Quitter, et tout l'état associé (`configUsername`, `configColor`, `configSaving`,
`configSuccess`, `handleConfigSave`) déménagés en bloc. Le `useEffect` de préremplissage au changement
d'onglet devient un effet au montage (équivalent : ce composant n'existe que quand l'onglet est actif).
Lit `user`/`setUser` (`useAuthStore`), `members`/`characters` (`useCharacterStore`), `onlineUsers`
(`useSessionStore`) directement — `useAuthStore` et les destructures `members`/`onlineUsers`/`characters`
devenus inutiles, retirés de `Sidebar.jsx`. Reçoit `onReconnectSocket` en prop.

**Testé** : `eslint` (0 erreur), `npm run build` (propre), rendu réel confirmé par Saar (changement
pseudo/couleur, liste des connectés, bouton Quitter).
**Non testé** : —
**Données** : aucune.
**Retour arrière** : commit isolé à venir sur `dev/Saar`.

**4d — hooks + `SidebarChatTab.jsx`** — ✅ codé (2026-08-06). Anciennement gelé (superseded par
`PLAN_CHAT.md` Phase 3), partiellement satisfait par cette dernière (rendu + envoi/historique, détail
ci-dessous conservé), puis repris et clos comme lot Sidebar normal une fois le blocage levé.

- **Rendu** : fait plus tôt, via `client/src/components/MessageRendererRegistry.jsx` (Phase 3d) —
  remplace la cascade if/else de 330 lignes que `SidebarChatMessage.jsx` aurait construite. Périmètre
  plus large que prévu : gère aussi les types déjà existants (dés, actions entité, trade, combat), pas
  seulement le nouveau format persisté.
- **Envoi + historique** : fait plus tôt, via `client/src/lib/useChatSocket.js` (Phase 3c/3e) —
  remplace ce que l'envoi/réception du conteneur `SidebarChatTab.jsx` aurait fait pour le texte tapé.
- **Fait maintenant** : `client/src/lib/useDiceBreakdownPopover.js` (popover "Détail du calcul") et
  `client/src/lib/useSidebarPendingActionsBadge.js` (badge de compteur d'actions en attente) —
  extraits en hooks (convention déjà posée par `useChatSocket.js` : les hooks vivent dans
  `client/src/lib/`, pas dans un dossier `hooks/`). Les deux **restent appelés depuis `Sidebar.jsx`**,
  pas depuis `SidebarChatTab.jsx` : le popover et le badge sont rendus au niveau racine / sur le
  bouton d'onglet, visibles quel que soit l'onglet actif — les déplacer dans le composant d'onglet
  aurait changé leur portée de rendu. `client/src/components/SidebarChatTab.jsx` (nouveau, 123 l.)
  reçoit `socket`, `breakdownPopover`, `onOpenBreakdown`, `setPendingActionCount`,
  `onEntityActionResolve`, `onOpenTrade`, `onOpenExchange` en props ; lit `messages`/`phase`/`isGm`/
  `t`/`tCombat` directement via les stores et l'i18n (même patron que `SidebarCharactersTab.jsx`/
  `SidebarProfileTab.jsx`, lots 4b/4c) — `chatInput`, `cdlOpen`, `animatingDiceId`, `messagesEndRef`,
  les effets auto-scroll/animation dé et `sendMessage` déménagés en bloc. `Sidebar.jsx` :
  1492 → 1375 lignes ; `tCombat`/`useCombatStore`/`phase` et les imports `renderMessage`/
  `CombatDeclareLogChatPanel` retirés (plus utilisés ailleurs dans le fichier, vérifié par recherche
  exhaustive avant suppression). Le `<style>` keyframes de l'animation dé reste dans `Sidebar.jsx`
  (déjà commenté "indépendant de l'onglet", aucun gain à le déplacer, risque nul à le laisser).

**Trouvaille en cours de route, corrigée dans ce lot (pas hors scope — même fichier)** : `eslint`
(`eslint-plugin-react-hooks` v7, règle `react-hooks/set-state-in-effect` basée sur le compilateur
React) a rejeté l'effet d'animation du dé tel que déplacé verbatim. Vérifié que ce n'est pas une
régression de l'extraction : relint de l'ancien `Sidebar.jsx` (`git show HEAD:...`) directement dans
`client/src/components/` (pour que la config eslint s'applique) — 0 erreur sur le même code, l'analyseur
abandonne silencieusement sur un composant de cette taille (limite connue du compilateur React, aucun
diagnostic remonté en mode bailout). En l'isolant dans un petit composant, l'analyseur devient capable
de le lire et révèle un **vrai bug latent** : l'effet original, keyé sur `[messages]`, annulait le
timer d'extinction (800ms) dès qu'un message *quelconque* arrivait (pas seulement un dé) sans jamais
le relancer si ce n'était pas un nouveau dé — `setAnimatingDiceId(null)` n'était alors jamais rappelé,
l'icône dé restait animée indéfiniment si un message texte arrivait avant la fin des 800ms. Corrigé en
scindant l'effet (pattern React documenté "adjusting state during render" pour le déclenchement +
effet dédié keyé sur `animatingDiceId` pour l'extinction, indépendant des messages non-dé) — même
timing (800ms), même déclencheur (nouveau message dé), plus de fenêtre où l'animation reste bloquée.
Aucun `eslint-disable` introduit (aucun précédent dans le dépôt pour cette règle ni pour une autre —
gardé ainsi).

**Testé** : `eslint` sur les 4 fichiers touchés/créés (0 erreur, 0 warning — y compris après le
correctif d'effet), `npm run build` (client, propre — mêmes avertissements préexistants : taille de
chunk, temps plugin), serveur relancé sans erreur et usage général en navigateur confirmé par Saar
(2026-08-06, aucune régression visible — pas de check-list spécifique exécutée).
**Non testé** : le scénario précis du bug corrigé (lancer un dé puis envoyer un message texte avant
800ms — vérifier que l'icône s'éteint normalement au lieu de rester bloquée) n'a pas été rejoué
explicitement. Risque jugé faible (correction logique directe, cf. analyse ci-dessus) — laissé en
`⚠️ clos partiel` sur ce seul point, pas bloquant pour la suite.
**Données** : aucune.
**Retour arrière** : commit isolé à venir sur `dev/Saar`.

### Lot 5 — `SurfaceEditorPanel.jsx` + `useWorldEffects` partagé
Statut : à faire — dépend d'une décision sur `Editor3D.jsx` (voir `REFACTOR_GLOBAL.md` §3).

---

## 4. Hors périmètre de ce PLAN

- Tout ce qui touche `Editor3D.jsx` au-delà du hook partagé du lot 5.
- La correction du popover dupliqué avec `CombatActionWindow.jsx` (mentionnée en §1, pas un objectif
  de ce chantier — à traiter dans un PLAN dédié si retenu).
- Tout autre fichier du tableau `REFACTOR_GLOBAL.md` §1 (`socketCombatHelpers.js`, etc.).

---

## 5. Commits

Lots 2, 3a et 3b n'ont pas été committés isolément (contrairement au principe énoncé en §2) — les
diffs se sont imbriqués sur plusieurs tours d'édition et la suppression de `CharacterModal.jsx` par
Saar est intervenue avant tout commit intermédiaire, rendant une séparation a posteriori risquée et peu
utile. Committés ensemble en un seul commit (2026-08-05) sur `dev/Saar`, avec la clôture du lot 3 et
CHARMODAL-DEAD1. Pour les lots 4 et 5 : revenir au principe d'un commit isolé par lot, plus facile à
tenir sur des extractions qui ne partagent pas de dépendance imprévue comme celle du lot 2.
