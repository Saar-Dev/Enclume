# PLAN_REWORK10_COMBATDECLARELOG.md — Log déclarations intégré chat Sidebar
> Créé Session 105 — 2026-06-18 | Mis à jour Session 106c — 2026-06-18

## État final ⚠️ CLOS PARTIEL

**Implémentation réelle :** `DeclareLogContent` intégré dans le tab chat de `Sidebar.jsx`, en haut de la zone messages, collapsible sur une ligne. Visible GM + joueurs pendant `ANNOUNCEMENT` et `RESOLUTION`.

**Approche initiale abandonnée :** `CombatDeclareLogSidebar` (sidebar fixe gauche dans `CombatOverlay`) — rejetée après test : non déplaçable, positionnée au milieu du playground.

**Code actuel :**
- `Sidebar.jsx` : bloc CDL en premier enfant du fragment tab 'chat', classes `.cdl-chat*`
- `CombatOverlay.jsx` : import + render CDL supprimés
- `index.css` : classes `.cdl-chat` / `.cdl-chat-header` / `.cdl-chat-body` + override fond blanc
- `CombatDeclareLogSidebar` (default export) : code conservé mais non utilisé — dead code

**Scénarios 1–8 : non testés** (nécessite session de combat)

---

---

## Problème

`CombatDeclareLog` (GM) est une fenêtre flottante draggable qui utilise `combat-float-win` — le même chrome visuel que toutes les fenêtres interactives du combat. Or ce composant est en **lecture seule** : l'utilisateur n'a aucune action à y faire. Aucun signal visuel ne distingue "observer" de "agir".

Côté joueur, `DeclareLogContent` est embarqué dans `CombatActionWindow` — noyé dans une fenêtre d'action, mélangé avec des boutons de déclaration.

---

## État actuel

**`client/src/components/CombatDeclareLog.jsx` :**
- `EntryLines` (interne) : rendu d'une entrée (acteur + lignes action/déplacement). Classes `combat-declare-log-*`.
- `DeclareLogContent` (named export) : corps du log sans chrome. Lit `announcedActions` depuis `combatStore` + `tokens` depuis `tokenStore`. Utilisé par `CombatActionWindow` (joueur).
- `CombatDeclareLog` (default export) : chrome floatant GM — `useDraggable`, `combat-float-win`, position `right: window.innerWidth - 290`, `useState(isOpen)`.

**`client/src/components/CombatOverlay.jsx` L.363 :**
```jsx
{isGm && (phase === 'ANNOUNCEMENT' || phase === 'RESOLUTION') && <CombatDeclareLog />}
```

**`client/src/components/CombatActionWindow.jsx` :**
- `declareLogSection` : section intégrée joueur — importe et rend `DeclareLogContent`. À lire en Étape 3 avant toute modification.

---

## Décision

**Remplacer `CombatDeclareLog` par `CombatDeclareLogSidebar`** — panneau fixe gauche, style MacOS Terminal, collapsible.

**Esthétique retenue : MacOS Terminal**
- Fenêtre avec barre de titre uniquement (pas de boutons close/minimize/maximize)
- Titre centré ou gauche : `DÉCLARATIONS · TOUR N`
- Collapse = "windowshading" MacOS — le corps se replie sous la barre de titre (collapse vertical, pas horizontal)
- Fond sombre `#0d0d12`, titre légèrement plus clair `#1e1e26`, monospace

- GM **et** joueurs : même composant, même rendu
- `DeclareLogContent` et `EntryLines` : **inchangés** (logique de rendu des entrées préservée)
- `useDraggable` : supprimé (panneau fixe — pas de drag)
- `combat-float-win` : supprimé pour ce composant
- Chrome : nouvelles classes `.cdl-*` dans `index.css` Section 11

---

## Interface cible

**Aperçu visuel :**

```
OUVERT                              FERMÉ (windowshade)
┌────────────────────────────┐      ┌────────────────────────────┐
│ DÉCLARATIONS · TOUR 3    ▼ │      │ DÉCLARATIONS · TOUR 3    ▶ │
├────────────────────────────┤      └────────────────────────────┘
│  ● SOLEIL        INI 14   │
│    → Dépl [3, 4]           │
│    ⚡ Assaut → KILIAN     │
│                            │
│  ● KILIAN        INI 11   │
│    ◆ Attendre              │
└────────────────────────────┘
```

```jsx
// CombatDeclareLog.jsx — remplace CombatDeclareLog (default export)
export default function CombatDeclareLogSidebar() {
  const { currentTurn } = useCombatStore()
  const [isOpen, setIsOpen] = useState(true)

  // Fermé : barre de titre seule (windowshade) — corps masqué
  // Ouvert : barre de titre + corps scrollable
}
```

**Position CSS :**
```css
.cdl-window {
  position: fixed;
  left: var(--sidebar-w, 0px);   /* respecte la sidebar Enclume */
  top: 8px;                       /* petite marge sous le bord */
  width: 240px;
  /* pas de bottom fixe — hauteur naturelle + max-height */
}
```

**Intégration CombatOverlay :**
```jsx
// Remplace l'ancienne ligne L.363 — visible GM + joueurs
{(phase === 'ANNOUNCEMENT' || phase === 'RESOLUTION') && <CombatDeclareLogSidebar />}
```

---

## Périmètre

**Fichiers modifiés :**
| Fichier | Modification |
|---|---|
| `client/src/components/CombatDeclareLog.jsx` | Remplacer `CombatDeclareLog` (chrome floatant) par `CombatDeclareLogSidebar`. `EntryLines` + `DeclareLogContent` inchangés. Supprimer import `useDraggable`. |
| `client/src/components/CombatOverlay.jsx` | L.363 — retirer condition `isGm`, mettre `CombatDeclareLogSidebar` |
| `client/src/components/CombatActionWindow.jsx` | Supprimer `declareLogSection` (import + rendu `DeclareLogContent`) — lire le fichier en Étape 3 |
| `client/src/index.css` | Ajouter classes `.cdl-*` en Section 11 — ne pas modifier les classes `combat-declare-log-*` existantes |

**NON touchés :**
- `EntryLines` — inchangé
- `DeclareLogContent` — inchangé
- `client/src/stores/combatStore.js`
- `client/src/stores/tokenStore.js`
- `client/src/lib/useDraggable.js`
- `server/` — aucune modification
- DB / migrations

---

## CSS cible — style MacOS Terminal

Référence : [MagicUI Terminal](https://magicui.design/docs/components/terminal) — palette dark, sans boutons de contrôle.

```css
/* Section 11 — CombatDeclareLog (REWORK-10) — MacOS Terminal style */

/* Fenêtre principale */
.cdl-window {
  position: fixed;
  left: var(--sidebar-w, 0px);
  top: 8px;                            /* [R10-5] provisoire — ajuster après test visuel */
  width: 240px;
  max-height: calc(100vh - 56px);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  z-index: 2;                          /* [R10-1] résolu : sous combat-float-win (DOM order) */
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
}

/* Barre de titre — MacOS style, sans boutons */
.cdl-titlebar {
  background: #2a2a35;
  border-bottom: 1px solid #3a3a48;
  padding: 7px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.cdl-title {
  font-size: 10px;
  letter-spacing: 0.1em;
  color: #7878a0;
  text-transform: uppercase;
  font-weight: 500;
}

.cdl-toggle {
  background: none;
  border: none;
  color: #4a4a6a;
  font-size: 9px;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  pointer-events: none; /* clic géré par .cdl-titlebar */
}

/* Corps — masqué en windowshade */
.cdl-body {
  background: #0d0d12;
  overflow-y: auto;
  flex: 1;
  padding: 6px 10px 10px;
  scrollbar-width: thin;
  scrollbar-color: #2a2a3a #0d0d12;
}

.cdl-body--hidden {
  display: none;
}

.cdl-empty {
  font-size: 10px;
  color: #2a2a40;
  padding: 10px 0;
  font-style: italic;
}

/* Entrées — surcharge des classes combat-declare-log-* dans ce contexte */
.cdl-body .combat-declare-log-actor {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #161622;
}
.cdl-body .combat-declare-log-actor:first-child {
  margin-top: 4px;
  border-top: none;
}

/* dot couleur joueur — inchangé (inline style depuis tok.color) */

.cdl-body .combat-declare-log-name   { font-size: 11px; color: #e0e0f0; font-weight: 600; }
.cdl-body .combat-declare-log-ini    { font-size: 9px;  color: #569cd6; font-variant-numeric: tabular-nums; }
.cdl-body .combat-declare-log-icon   { font-size: 9px;  color: #4a4a6a; width: 13px; flex-shrink: 0; }

.cdl-body .combat-declare-log-detail           { font-size: 10px; color: #6a8a6a; }
.cdl-body .combat-declare-log-detail--atk      { color: #e06c6c; }  /* assaut tir — rouge */
.cdl-body .combat-declare-log-detail--melee    { color: #ce9178; }  /* cac — orange */
.cdl-body .combat-declare-log-detail--move     { color: #9cdcfe; }  /* déplacement — bleu clair */

/* [R10-6] combat-declare-log-body a un fond blanc (#f4f7f8) + max-height 260px + overflow auto
   → fond blanc dans terminal sombre + double scrollbar si non resetté */
.cdl-body .combat-declare-log-body {
  background: transparent;
  max-height: none;
  overflow-y: visible;
}
```

---

## Plan

### Étape 1 — CSS (`index.css` Section 11) ✅ Session 105
- Bloc `.cdl-*` ajouté après `combat-declare-log-detail--melee` (L.1348)
- Classes `combat-declare-log-*` existantes non touchées
- `npm run build` → 0 erreur Vite ✅

### Étape 2 — `CombatDeclareLog.jsx` — nouveau chrome
- **Prérequis : vérifier la hauteur réelle de la timeline** (lire `CombatTimeline.jsx` + test visuel) pour ajuster `top` de `.cdl-window` — valeur actuelle `8px` provisoire [R10-5]
- Remplacer `CombatDeclareLog` (default export) par `CombatDeclareLogSidebar`
- Supprimer import `useDraggable`
- `DeclareLogContent` + `EntryLines` : inchangés
- `node --check client/src/components/CombatDeclareLog.jsx` → 0 erreur
- `npm run build` → 0 erreur Vite

### Étape 3 — `CombatActionWindow.jsx` — retirer `declareLogSection`
- **Lire `CombatActionWindow.jsx` en entier avant de toucher quoi que ce soit**
- Identifier et supprimer l'import `DeclareLogContent` + le rendu `declareLogSection`
- `node --check client/src/components/CombatActionWindow.jsx` → 0 erreur
- `npm run build` → 0 erreur Vite

### Étape 4 — `CombatOverlay.jsx` — condition rendu + ordre DOM
- **Déplacer** le rendu `CombatDeclareLogSidebar` AVANT la `CombatTimeline` dans le JSX (première position dans le return) — nécessaire pour que `z-index: 2` fonctionne (DOM order < combat windows)
- L.363 : `{isGm && (...) && <CombatDeclareLog />}` → supprimer (déplacé en tête)
- Import : `CombatDeclareLog` reste un default import — l'alias local ne change pas, seul le composant rendu change
- `node --check` → 0 erreur
- SR sans erreur

### Étape 5 — Validation fonctionnelle
- Scénarios ci-dessous

---

## Validation

| # | Scénario | Résultat attendu |
|---|---|---|
| 1 | GM en phase ANNOUNCEMENT | Sidebar visible à gauche (ouverte par défaut), liste les déclarations au fur et à mesure |
| 2 | Joueur en phase ANNOUNCEMENT | Même sidebar visible, même rendu — plus de log dans `CombatActionWindow` |
| 3 | Clic sur la barre de titre | Corps masqué (windowshade) — seule la barre de titre reste, toggle ▶ |
| 4 | Clic sur la barre de titre (fermé) | Corps réapparaît, toggle ▼ |
| 5 | Phase RESOLUTION | Sidebar toujours visible (déclarations du tour en cours) — GM + joueur |
| 6 | Phase ROSTER (hors combat) | Sidebar absente |
| 7 | Non-régression : drag token | Token se déplace normalement — sidebar n'interfère pas avec le canvas |
| 8 | Non-régression : sélection cible | Mode cible fonctionne — sidebar n'intercepte pas les clics canvas |

---

## Definition of done

- [ ] `npm run build` → 0 erreur Vite à chaque étape
- [ ] SR sans erreur après Étape 4
- [ ] Scénarios 1–8 validés
- [ ] `combat-float-win` absent de `CombatDeclareLog.jsx` (grep → 0)
- [ ] `useDraggable` absent de `CombatDeclareLog.jsx` (grep → 0)
- [ ] `DeclareLogContent` absent de `CombatActionWindow.jsx` (grep → 0)
- [ ] JOURNAL4.md appendé
- [ ] EN_COURS.md mis à jour

---

## Pièges anticipés

**[R10-1] z-index sidebar vs fenêtres flottantes — ✅ RÉSOLU**
`combat-float-win` n'a pas de z-index explicite. `combat-stun-overlay` = 1100, `combat-timeline-bar` = 10.
Décision : `.cdl-window { z-index: 2 }` + rendu AVANT les autres fenêtres combat dans le JSX (Étape 4) → DOM order garantit que les fenêtres interactives passent au-dessus.

**[R10-2] `--sidebar-w` disponibilité côté joueur**
`CombatOverlay` reçoit `sidebarWidth` prop et l'expose via `style={{ '--sidebar-w': sidebarWidth + 'px' }}`. La sidebar hérite de cette variable. Si joueur → `sidebarWidth` différent de GM, vérifier que la prop est bien passée dans les deux cas depuis `SessionPage.jsx`.

**[R10-3] Timeline overlap**
`combat-timeline-bar` : `position: absolute; z-index: 10; padding: 10px 14px; top: topOffset` (GM=40px, joueur=0px). Hauteur réelle inconnue sans test visuel.
`.cdl-window { top: 8px }` est provisoire [R10-5] — la titlebar sera partiellement derrière la timeline (z-index: 10 > 2). Acceptable si le corps reste visible. Ajuster `top` en Étape 2 après vérification visuelle.

**[R10-5] `top` provisoire — à ajuster en Étape 2**
Valeur actuelle `top: 8px` dans `index.css`. Après SR en Étape 2 : vérifier visuellement si la titlebar est masquée par la timeline → ajuster en conséquence (estimation : GM ≈ 110px, joueur ≈ 70px).

**[R10-6] `combat-declare-log-body` fond blanc + double scrollbar — ✅ RÉSOLU Étape 1**
La classe avait `background: #f4f7f8` + `max-height: 260px` + `overflow-y: auto`.
Correction ajoutée dans `index.css` : `.cdl-body .combat-declare-log-body { background: transparent; max-height: none; overflow-y: visible }`.

**[R10-4] `CombatActionWindow` — périmètre exact de `declareLogSection`**
Ne pas supprimer à l'aveugle — lire le fichier complet en Étape 3. La section peut être conditionnelle (phase, isGm, etc.) et son retrait peut affecter la mise en page du composant.
