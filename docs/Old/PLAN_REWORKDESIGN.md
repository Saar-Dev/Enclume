# PLAN_REWORKDESIGN — Implémentation Design System Enclume
> Rédigé session 83 — exécution dans une conversation dédiée
> Auteur du plan : Claude (session 83), après inventaire exhaustif de tous les composants

---

## Contexte & objectif

**Problème actuel :** Les 9 composants combat utilisent chacun leur propre objet de style JS
(`const S = {...}`, `const W = {...}`, etc.) avec des hex hardcodés dupliqués.
Changer la couleur d'un header = toucher 6 fichiers. Aucun lien avec `index.css`.

**Objectif :** Appliquer le modèle `.btn` / `.badge` aux fenêtres de combat.
Définir une seule fois dans `index.css` → utiliser partout via `className`.
`style={}` ne garde que les valeurs **calculées dynamiquement** (position, width, opacity).

**Règle absolue :** Ne jamais modifier des propriétés visuelles composant par composant.
Tout changement visuel passe par `index.css`. C'est le point de contrôle unique.

---

## Périmètre — 9 composants + 1 fichier CSS

| Composant | Objet(s) style | Palette | Priorité |
|---|---|---|---|
| `CombatRosterWindow.jsx` | `const S` | **A — HUD Tactical** | ★★★ |
| `CombatGmDeclareWindow.jsx` | `const S` | **A — HUD Tactical** | ★★★ |
| `CombatInitStateWindow.jsx` | `const S` | **A — HUD Tactical** | ★★ |
| `CombatActionWindow.jsx` | `const W`, `const ss` | **B — In-session** | ★★★ |
| `CombatModifiersWindow.jsx` | `const styles` | **B — In-session + Gold** | ★★ |
| `CombatDamageWindow.jsx` | `const styles` | **B — In-session** | ★★ |
| `CombatResultPanels.jsx` | `const C` inline | **B — In-session** | ★★ |
| `CombatTimeline.jsx` | `const styles` | Scrim bar | ★ |
| `TimelineCard.jsx` | tout inline | Dynamique pur | ★ (minimal) |

> ⚠️ **Erreur corrigée (run à vide session 83) :** `CombatActionWindow` est sur la Palette B
> (in-session `#16162a` / `#2a2a3e`), PAS sur la Palette A HUD Tactical.
> La fenêtre joueur est délibérément plus claire/douce que les fenêtres GM tactiques.

---

## Les 3 palettes identifiées

### Palette A — HUD Tactical (fenêtres GM flottantes)
`CombatRosterWindow`, `CombatGmDeclareWindow`, `CombatInitStateWindow`
```
body:   #0d0f18  (ou rgba(8,12,20,0.97)) → --combat-body
header: #080a12                           → --combat-header
border: #1e2435  (ou #15212e)            → --combat-border  ← ≈ même famille
title:  #3a8aaa                           → --combat-title (cyan)
shadow: 0 8px 32px rgba(0,0,0,0.7)       → --combat-shadow
```
> Note : CombatInitStateWindow utilise `border: '1.5px solid #15212e'` — légèrement
> différent de `#1e2435`. Acceptable : même token `--combat-border`, delta visuel négligeable.

### Palette B — In-session floating (fenêtres joueur + résultats)
`CombatActionWindow`, `CombatModifiersWindow`, `CombatDamageWindow`, `CombatResultPanels`
```
body:   #16162a  (ou #0f0f1a)  → --bg-session-raised / --bg-session
header: #0e0e1a  (≈ #0f0f1a)   → --bg-session   (delta 1pt négligeable)
border: #2a2a3e                 → --border-session-2
sep:    #1e1e2e                 → --border-session
text:   #c0c0d0                 → --text-session-hi
```

**Particularités par composant Palette B :**
- `CombatActionWindow` : `transition: 'opacity 0.15s ease, width 0.2s ease'`
  → appartient à `.combat-float-win` (animation élargissement 360→720, masquage targetMode)
- `CombatModifiersWindow` : `border: '1px solid #f5c542'` (gold) — signal visuel "ton tour"
  → surcharge via `.combat-float-win--gold`
- `CombatDamageWindow` : `borderRadius: 10` (vs 8 standard) + structure `overlay→window` (modal centré, pas draggable)
  → `borderRadius: 10` reste en inline `style={{ borderRadius: 10 }}`
- `CombatResultPanels` : fenêtres positionnées à des coins fixes (bottom-left, bottom-right)
  → positionnement inline, visuel via `.combat-float-win`

> ⚠️ **Plus de Palette C** : CombatModifiersWindow EST sur Palette B, juste avec une
> surcharge de bordure gold. C'est un modifier CSS, pas une palette distincte.

---

## Phase 1 — Compléter les tokens dans `index.css`

Ajouter dans la section `/* === TACTICAL HUD COMBAT === */` de `index.css` :

```css
/* Tokens manquants — à ajouter au bloc existant */

--combat-shadow:        0 8px 32px rgba(0,0,0,0.7);
--combat-seg-border:    #15212e;
--combat-seg-active:    #162028;

/* Rôles (badges PJ / PNJ) */
--combat-pj-fg:         #50c878;
--combat-pj-bg:         #0a1a0a;
--combat-pj-border:     #50c878;
--combat-pnj-fg:        #c86030;
--combat-pnj-bg:        #1a0a08;
--combat-pnj-border:    #c86030;

/* États d'équipement */
--combat-equip-ok:      #90c090;
--combat-equip-dot:     #50c878;
--combat-danger-fg:     #e08080;
--combat-danger-bg:     #1a0808;
--combat-danger-border: #aa3030;
--combat-warn-fg:       #e0a060;
--combat-warn-bg:       #1a1208;
--combat-warn-border:   #aa6030;
--combat-alert-fg:      #e8a060;
--combat-alert-label:   #6a4a20;

/* Chips armure T C B J */
--combat-chip-pj-fg:     #5a6a7a;
--combat-chip-pj-bg:     #1a2030;
--combat-chip-pj-border: #2a3a4a;
--combat-chip-pnj-fg:    #50c878;
--combat-chip-pnj-bg:    #0a2010;
--combat-chip-pnj-border:#2a6040;
--combat-chip-gap-border: #6a2020;
--combat-chip-empty:     #2a3a4a;
```

---

## Phase 2 — Système de classes CSS dans `index.css`

Ajouter une **Section 11 — COMBAT WINDOW SYSTEM** dans `index.css`.
Modèle : une classe = un rôle structural. Jamais de propriétés visuelles dans les composants.

### 2-A : Palette HUD Tactical

```css
/* ══ COMBAT WINDOW SYSTEM — Section 11 ══════════════════════════════════════
   Fenêtres flottantes mode combat.
   Palette A (HUD Tactical) : Roster, Déclaration, GmDeclare, InitState
   Palette B (In-session)   : Damage, Résultats, Modificateurs
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Structure fenêtre HUD ────────────────────────────────────────────── */
.combat-win {
  position: absolute;
  background: var(--combat-body);
  border: 1.5px solid var(--combat-border);
  border-radius: 4px;
  box-shadow: var(--combat-shadow);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--font-ui);
  max-height: calc(100vh - 100px);
}

/* ── Header (drag handle) ────────────────────────────────────────────── */
.combat-win-header {
  padding: 8px 12px;
  background: var(--combat-header);
  border-bottom: 1px solid var(--combat-border);
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}
.combat-win-header:active { cursor: grabbing; }

/* ── Titre de fenêtre (ex: "PHASE 1 — DÉCLARATION") ─────────────────── */
.combat-win-title {
  font-size: 9px;
  letter-spacing: 0.15em;
  font-weight: 700;
  color: var(--combat-title);
  text-transform: uppercase;
}

/* ── Corps de fenêtre ────────────────────────────────────────────────── */
.combat-win-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ── Section (bloc séparé par une ligne) ─────────────────────────────── */
.combat-win-section {
  padding: 6px 12px 8px;
  border-bottom: 1px solid var(--combat-sep);
}

/* ── Eyebrow de section (ex: "TACTIQUE", "ARMEMENT") ────────────────── */
.combat-win-section-title {
  display: block;
  font-size: 8px;
  letter-spacing: 0.12em;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--combat-section);
  margin-bottom: 5px;
}

/* ── Label de champ (ex: "POSTURE", "ARME") ─────────────────────────── */
.combat-win-field-label {
  font-size: 7px;
  color: var(--combat-field);
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-family: var(--font-mono);
}

/* ── Footer ──────────────────────────────────────────────────────────── */
.combat-win-footer {
  padding: 8px 12px;
  background: var(--combat-header);
  border-top: 1.5px solid var(--combat-border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ── Table / Roster ──────────────────────────────────────────────────── */
.combat-win-th {
  padding: 6px 10px;
  font-size: 9px;
  color: var(--combat-title);
  letter-spacing: 0.1em;
  text-align: left;
  border-bottom: 1px solid var(--combat-border);
  background: var(--combat-header);
  position: sticky;
  top: 0;
  z-index: 1;
  white-space: nowrap;
}
.combat-win-td {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--combat-cell);
  border-bottom: 1px solid var(--combat-row);
  vertical-align: middle;
}

/* ── Bannière alerte (AVANT DÉMARRAGE) ───────────────────────────────── */
.combat-win-alert {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  background: var(--combat-warn-bg);
  border-bottom: 1px solid var(--combat-warn-border);
  flex-shrink: 0;
}
.combat-win-alert-label {
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--combat-alert-label);
  font-weight: 700;
}
.combat-win-alert-item {
  font-size: 10px;
  color: var(--combat-alert-fg);
  font-weight: 600;
}

/* ── Badges rôle PJ / PNJ ────────────────────────────────────────────── */
.combat-badge-pj {
  font-size: 9px;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 2px;
  font-weight: 600;
  color: var(--combat-pj-fg);
  background: var(--combat-pj-bg);
  border: 1px solid var(--combat-pj-border);
}
.combat-badge-pnj {
  font-size: 9px;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 2px;
  font-weight: 600;
  color: var(--combat-pnj-fg);
  background: var(--combat-pnj-bg);
  border: 1px solid var(--combat-pnj-border);
}

/* ── Chips armure T C B J ─────────────────────────────────────────────── */
.combat-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 9px;
  font-weight: 700;
  border-radius: 2px;
  font-family: var(--font-mono);
  user-select: none;
}
.combat-chip-pj       { background: var(--combat-chip-pj-bg);  color: var(--combat-chip-pj-fg);  border: 1px solid var(--combat-chip-pj-border);  }
.combat-chip-pj-empty { background: transparent; color: var(--combat-chip-pj-border); border: 1px solid var(--combat-chip-pj-bg); }
.combat-chip-pnj      { background: var(--combat-chip-pnj-bg); color: var(--combat-chip-pnj-fg); border: 1px solid var(--combat-chip-pnj-border); }
.combat-chip-pnj-gap  { background: transparent; color: var(--combat-chip-gap-border); border: 1px solid var(--combat-chip-gap-border); }

/* ── Dropdowns équipement ─────────────────────────────────────────────── */
.combat-select-danger {
  width: 100%;
  padding: 3px 6px;
  font-size: 10px;
  background: var(--combat-danger-bg);
  border: 1px solid var(--combat-danger-border);
  border-radius: 2px;
  color: var(--combat-danger-fg);
  cursor: pointer;
  outline: none;
  font-family: var(--font-ui);
}
.combat-select-warn {
  width: 100%;
  padding: 3px 6px;
  font-size: 10px;
  background: var(--combat-warn-bg);
  border: 1px solid var(--combat-warn-border);
  border-radius: 2px;
  color: var(--combat-warn-fg);
  cursor: pointer;
  outline: none;
  font-family: var(--font-ui);
}

/* ── Arme équipée ─────────────────────────────────────────────────────── */
.combat-equip-ok {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: var(--combat-equip-ok);
}
.combat-equip-dot::before { content: '●'; color: var(--combat-equip-dot); font-size: 8px; }

/* ──────────────────────────────────────────────────────────────────────── */
/* ── Palette B : In-session floating (Damage, Résultats) ─────────────── */
/* ──────────────────────────────────────────────────────────────────────── */
.combat-float-win {
  pointer-events: auto;
  background: var(--bg-session-raised);
  border: 1px solid var(--border-session-2);
  border-radius: 8px;
  box-shadow: var(--combat-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--font-ui);
  /* Animation élargissement (CombatActionWindow 360→720px) + masquage targetMode */
  transition: opacity 0.15s ease, width 0.2s ease;
}

/* Variante gold (CombatModifiersWindow — "c'est ton tour d'agir") */
.combat-float-win--gold {
  border-color: var(--color-gold);
  box-shadow: 0 4px 24px rgba(0,0,0,0.6);
}

.combat-float-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border-session-2);
  background: var(--bg-session-raised);
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}
.combat-float-header:active { cursor: grabbing; }

.combat-float-section {
  padding: 6px 14px;
  border-bottom: 1px solid var(--border-session);
}

.combat-float-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--border-session-2);
  flex-shrink: 0;
}

/* ── .btn-tac-confirm — footer vert "DÉCLARER / ANNONCER" ───────────────── */
/* Utilisé par : CombatRosterWindow S.btnAnnounce + CombatGmDeclareWindow S.btnDeclare */
/* ≠ .btn-tac (cyan) : vert = confirmation d'action, PAS navigation tactique */
.btn-tac-confirm {
  display: block;
  width: 100%;
  padding: 7px 14px;
  background: rgba(80, 200, 120, 0.10);
  border: none;
  border-top: 1px solid var(--combat-border);
  color: var(--combat-pj-fg);
  font: 700 11px/1 var(--font-ui);
  text-transform: uppercase;
  letter-spacing: 0.10em;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.1s;
}
.btn-tac-confirm:hover   { background: rgba(80, 200, 120, 0.18); filter: none; }
.btn-tac-confirm:active  { transform: none; }
.btn-tac-confirm:disabled { opacity: 0.35; cursor: not-allowed; }

/* ──────────────────────────────────────────────────────────────────────── */
/* ── Timeline bar ─────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────────────── */
.combat-timeline-bar {
  position: absolute;
  left: 0;
  right: var(--sidebar-w, 0px);
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-session-scrim);
  border-bottom: 1px solid var(--border-session-2);
  pointer-events: auto;
  z-index: 10;
}
```

---

## Cas limites documentés (run à vide session 83)

**1. Section separators — deux couleurs différentes dans le code prod :**
- `CombatActionWindow W.section` → `borderBottom: '1px solid #1e1e2e'` (= `--combat-sep`)
- `CombatGmDeclareWindow S.section` → `borderBottom: '1px solid #0e1520'` (plus sombre — nuance subtile)
- **Décision recommandée :** utiliser `--combat-sep` (`#1e1e2e`) pour les deux. Delta visuel
  imperceptible sur fond `#0d0f18`. Si refus : ajouter `--combat-sep-dark: #0e1520` comme token.

**2. Section padding — modèle différent par composant :**
- `GmDeclareWindow` : `padding: '6px 12px 8px'` → correspond exactement à `.combat-win-section`
- `ActionWindow` : `paddingBottom: 4` uniquement (les enfants ont leur propre padding)
  → `className="combat-win-section" style={{ padding: '0 0 4px 0' }}` pour override

**3. `W.sectionTitle` vs `S.sectionTitle` :**
- `GmDeclareWindow S.sectionTitle` → `color: '#3a8aaa'` (= `--combat-title`) → `.combat-win-section-title` ✅
- `ActionWindow W.sectionTitle` → `color: '#5a8aaa'` (= `--combat-section`) + `padding: '7px 10px 3px'`
  → remplacer hex par `var(--combat-section)` **en inline**, ne pas utiliser la classe
  (la classe a `color: var(--combat-section)` mais le padding est différent)

**4. `CombatDamageWindow` n'est pas draggable :**
Structure `styles.overlay → styles.window` (modal centré via flexbox fullscreen overlay).
La classe `.combat-float-win` s'applique à `styles.window` uniquement.
`styles.overlay` reste entièrement inline (`position: absolute, inset: 0, flex center`).

---

## Phase 3 — Migration composant par composant

### Règle générale
Pour chaque composant :
1. Lire le fichier en entier avant de toucher quoi que ce soit.
2. Identifier chaque `style={S.xxx}` ou `style={styles.xxx}`.
3. Décider : **CSS class** (visuel statique) ou **inline style** (valeur dynamique).
4. Remplacer. Supprimer les entrées de l'objet style migrées.
5. Si l'objet style est entièrement migré → supprimer la const entière.

### Ce qui reste TOUJOURS en inline `style={}`
- `position: 'absolute'` (toutes les fenêtres)
- `left: pos.left`, `top: pos.top` (position draggable)
- `width` calculé (ex: `isMeleeSetup ? 720 : 440`)
- `maxHeight: 'calc(100vh - Xpx)'` (variable selon contexte)
- `opacity: isDimmed ? 0.35 : 1` (état dynamique)
- `color: isRushed ? '#c83030' : '#3aaa6a'` (état dynamique)
- `background: severityColor` (couleur de blessure dynamique)
- `borderColor: worstSeverity ? SEVERITY_COLORS[x] : '...'` (TimelineCard)
- `boxShadow: isActive ? '...' : 'none'` (TimelineCard halo)
- `width: w, height: h` (TimelineCard dimensions actives/normales)

---

### 3-A : CombatRosterWindow.jsx

**Objet à migrer :** `const S` (ligne 429)

| Style actuel | Remplacé par |
|---|---|
| `S.window` | `className="combat-win"` + `style={{ width: 560, left: pos.left, top: pos.top }}` |
| `S.header` | `className="combat-win-header"` |
| `S.title` | `className="combat-win-title"` |
| `S.badgePj` | `className="combat-badge-pj"` |
| `S.badgePnj` | `className="combat-badge-pnj"` |
| `S.alertBanner` | `className="combat-win-alert"` |
| `S.alertLabel` | `className="combat-win-alert-label"` |
| `S.alertItem` | `className="combat-win-alert-item"` |
| `S.th` | `className="combat-win-th"` |
| `S.td` | `className="combat-win-td"` |
| `S.chips` | inline `style={{ display: 'flex', gap: 3, alignItems: 'center' }}` (layout pur) |
| `S.chip` | `className="combat-chip"` |
| `S.chipPjFilled` | `className="combat-chip-pj"` |
| `S.chipPjEmpty` | `className="combat-chip-pj-empty"` |
| `S.chipPnjFilled` | `className="combat-chip-pnj"` |
| `S.chipPnjGap` | `className="combat-chip-pnj-gap"` |
| `S.selectDanger` | `className="combat-select-danger"` |
| `S.selectWarn` | `className="combat-select-warn"` |
| `S.equippedGreen` | `className="combat-equip-ok"` |
| `S.btnStart` | `className="btn-tac"` (cyan — "Démarrer le combat") |
| `S.btnAnnounce` | `className="btn-tac-confirm"` (vert — "Passer en Annonce") ← NOUVEAU |
| `S.badge` (PNJ warning) | `className="combat-badge-pnj"` |

**Restes inline** : `S.participantCount`, `S.excludedSection`, `S.tokenCell`, `S.tokenLabel`, `S.excludedRow`, `S.excludedName`, `S.btnReinclude`, `S.initConfirmed`, `S.initPending` — garder en inline (small count, peu de réutilisation ou vraiment spécifique au composant).

---

### 3-B : CombatActionWindow.jsx

> ⚠️ **PALETTE B — In-session** (pas A). Cette fenêtre est celle du JOUEUR.
> Ne jamais utiliser `.combat-win` ici — la couleur de fond est différente.

**Objets à migrer :** `const ss` (StateSelector, ligne ~1464) + `const W` (fenêtre principale, ligne ~1523)

**Valeurs réelles de W.window :**
```js
background: '#16162a'       → --bg-session-raised
border: '1px solid #2a2a3e' → --border-session-2
borderRadius: 8             → --radius-sm (6px) ← accepter la légère différence
boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
transition: 'opacity 0.15s ease, width 0.2s ease'  → dans .combat-float-win
```

| Style actuel | Remplacé par |
|---|---|
| `W.window` | `className="combat-float-win"` + `style={{ width, left, top, maxHeight: 'calc(100vh - 80px)' }}` |
| `W.header` | `className="combat-float-header"` |
| `W.body` | `className="combat-win-body"` (layout flex — commun) |
| `W.section` | `className="combat-win-section" style={{ padding: '0 0 4px 0' }}` ← override padding |
| `W.sectionTitle` | garder inline — `W.sectionTitle` a `padding: '7px 10px 3px'` propre, `color: '#5a8aaa'` (= var(--combat-section)) |
| `W.footer` | `className="combat-float-footer"` |
| `W.item` / `W.itemSelected` / `W.itemGreyed` | garder inline (grille action locale, peu réutilisable) |
| `W.leftPanel` (`flex: '0 0 360px'`) | garder inline (largeur spécifique) |
| `W.assaultPanel` (`flex: '0 0 360px'`) | garder inline (panneau droit expansion) |
| `W.chooseTargetBtn` / `W.changeTargetBtn` | garder inline |
| `W.rosterHeader` / `W.rosterTitle` | garder inline (roster collapsible local) |
| `W.waitText` / `W.surpriseText` | garder inline |

**Pour `const ss` (StateSelector) :**
Les couleurs de `ss` sont HUD tactical (`#0a1018`, `#15212e`, `#162028`, `#3a8aaa66`).
→ Remplacer les hex par les CSS vars **dans les inline styles existants** (ne pas créer de classes) :
```js
ss.seg.background  '#0a1018'  → 'var(--combat-seg-bg)'
ss.seg.border      '#15212e'  → '1px solid var(--combat-seg-border)'
ss.segOptActive    '#162028'  → 'var(--combat-seg-active)'
ss.segCostCurrent  '#3a8aaa'  → 'var(--combat-title)'
```
L'objet `ss` reste en place — on substitue juste les hex par des vars.

---

### 3-C : CombatGmDeclareWindow.jsx

**Objet à migrer :** `const S` (ligne ~976)

| Style actuel | Remplacé par |
|---|---|
| `S.window` | `className="combat-win"` + `style={{ width, left, top }}` |
| `S.header` | `className="combat-win-header"` |
| `S.headerLabel` | `className="combat-win-title"` |
| `S.controls` | inline (layout local) |
| `S.section` | `className="combat-win-section"` |
| `S.sectionTitle` | `className="combat-win-section-title"` |
| `S.footer` | `className="combat-win-footer"` |
| `S.chip` / `S.chipLabel` / `S.chipValue` | garder inline (InlineChip interne) |
| `S.meleePanelGm` / `S.meleePanelTitle` | garder inline (panneau CaC spécifique) |
| `S.assaultPanelGm` + sections tir | garder inline (ajouté session 83) |
| `S.roster` / `S.rosterRow` / `S.rosterRowActive` | garder inline (layout roster local) |
| `S.btnDeclare` | `className="btn-tac-confirm"` (vert — "DÉCLARER") ← NOUVEAU |
| `S.btnDeclareDisabled` | géré par `disabled` prop sur le bouton + `.btn-tac-confirm:disabled` |
| `S.weaponOption` / `S.weaponOptionActive` | garder inline (local) |

---

### 3-D : CombatInitStateWindow.jsx

**Objet à migrer :** `const S` (ligne 73)

| Style actuel | Remplacé par |
|---|---|
| `S.window` | `className="combat-win"` + `style={{ width: 260, left: pos.left, top: pos.top, padding: '12px' }}` |
| `S.header` | `className="combat-win-title"` (+ cursor drag) |
| `S.chip` / `S.chipLabel` / `S.chipValue` | garder inline (StateChip interne) |
| `S.btnConfirm` | `className="btn-tac-confirm"` (vert) |

---

### 3-E : CombatModifiersWindow.jsx

**Objet à migrer :** `const styles` (ligne 407)

Palette B avec variante gold.

| Style actuel | Remplacé par |
|---|---|
| `styles.window` | `className="combat-float-win combat-float-win--gold"` + `style={{ width: 360, left, top }}` |
| `styles.header` | `className="combat-float-header"` |
| `styles.headerTitle` | inline `style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-gold)' }}` |
| `styles.body` | inline `style={{ overflowY: 'auto', flex: 1 }}` |
| `styles.section` | `className="combat-float-section"` |
| `styles.sectionTitle` | inline `style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}` |
| `styles.footer` | `className="combat-float-footer"` |
| `styles.select` | inline (select spécifique) |
| `styles.checkLabel` / `styles.checkbox` / `styles.checkText` | garder inline |
| `styles.btnValider` | `className="btn btn-gold"` |
| `styles.btnFermer` | `className="btn btn-ghost"` |

---

### 3-F : CombatDamageWindow.jsx

**Objet à migrer :** `const styles` (ligne 118)

Palette B.

| Style actuel | Remplacé par |
|---|---|
| `styles.overlay` | inline (position overlay fullscreen) |
| `styles.window` | `className="combat-float-win"` + `style={{ minWidth: 340, maxWidth: 420, padding: '18px 22px', gap: 14 }}` |
| `styles.header` | `className="combat-float-header"` (adapté : `borderBottom`, `paddingBottom`) |
| `styles.headerTitle` | inline `style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-session-hi)', textTransform: 'uppercase' }}` |
| `styles.section` (diceRow etc.) | garder inline (layout dés spécifique) |

---

### 3-G : CombatResultPanels.jsx

**Objet à migrer :** `const C` + inline styles répandus dans le JSX

Palette B. Ce composant a des styles quasi-entièrement inline avec des valeurs de la palette `C`.
**Approche :** Remplacer `C.bg` → `var(--bg-session-raised)`, `C.border` → `var(--border-session-2)`, etc. directement dans les inline styles, puis supprimer `const C`.

| Constante `C` | Remplacé par variable CSS |
|---|---|
| `C.bg` = `#16162a` | `var(--bg-session-raised)` |
| `C.bgInner` = `#0f0f20` | `var(--bg-session)` |
| `C.border` = `#2a2a3e` | `var(--border-session-2)` |
| `C.text` = `#c0c0d0` | `var(--text-session-hi)` |
| `C.textDim` = `#7a7a90` | `var(--text-session-mid)` |
| `C.textBright` = `#e8e8f5` | `var(--text-primary)` |
| `C.gold` = `#f5c542` | `var(--color-gold)` |
| `C.red` = `#c83030` | `var(--color-danger-soft)` |
| `C.green` = `#3aaa6a` | `var(--color-success-soft)` |

> Note : les inline styles RESTENT inline (structure complexe, trop dynamique pour des classes).
> On supprime juste la couche d'indirection `C.xxx` au profit des CSS vars directes.

---

### 3-H : CombatTimeline.jsx

**Objet à migrer :** `const styles` (ligne 151)

| Style actuel | Remplacé par |
|---|---|
| `styles.bar(topOffset)` | `className="combat-timeline-bar"` + `style={{ top: topOffset }}` |
| `styles.cardList` | inline (layout flex local) |
| `styles.timer(color)` | inline (couleur dynamique selon temps restant) |
| `styles.turnLabel` | inline (simple label) |
| `styles.overflow` | inline |
| `styles.leftPanel` | inline |

---

### 3-I : TimelineCard.jsx

**Approche :** Ce composant est quasi-entièrement dynamique (width, height, border couleur blessure, opacity, boxShadow actif).
**Pas de migration de classes** — remplacer les hex hardcodés par les CSS vars correspondantes dans les inline styles existants.

| Valeur hardcodée | Remplacé par |
|---|---|
| `rgba(0,0,0,0.88)` (gradient) | inchangé (valeur d'effet) |
| `'#5b8dee'` (INI color) | `var(--color-primary)` |
| `'#50c878'` (✓ announced) | `var(--color-success-soft)` |
| `'#e0a050'` (⚠ surprised) | `var(--color-warning-soft)` |
| `'linear-gradient(160deg, #2e1a1a, #4e2a2a)'` (PNJ placeholder) | inchangé (esthétique) |
| `'linear-gradient(160deg, #1a1a2e, #2a2a4e)'` (PJ placeholder) | inchangé (esthétique) |
| `'#f5c542'` (label actif) | `var(--color-gold)` |
| `0 0 12px rgba(245,197,66,0.35)` (halo) | `var(--halo-active)` |

---

## Phase 4 — Status SVGs

**Source :** `docs/enclume-design-system/project/assets/status/` (15 fichiers SVG)
**Destination :** `client/public/assets/status/`

```
acid.svg, asphyxia.svg, blinded.svg, burning.svg, decompression.svg,
electrocuted.svg, grappled.svg, hypothermia.svg, infected.svg,
irradiated.svg, off_balance.svg, poisoned.svg, restrained.svg,
stunned.svg, unconscious.svg
```

**Commande (PowerShell depuis `Enclume/`) :**
```powershell
New-Item -ItemType Directory -Force "client/public/assets/status"
Copy-Item "docs/enclume-design-system/project/assets/status/*.svg" "client/public/assets/status/"
```

**Usage en production :** `<img src="/assets/status/stunned.svg" width="24" />`

---

## Ordre d'exécution recommandé

1. **Phase 1** — Tokens `index.css` (5 min, zéro risque, fondation)
2. **Phase 4** — Copy SVGs (2 min, zéro risque)
3. **Phase 2** — Classes CSS Section 11 dans `index.css` (30 min)
4. **Phase 3-A** `CombatRosterWindow` — le plus simple, bonne mise en jambes
5. **Phase 3-D** `CombatInitStateWindow` — très petit, confirme le pattern
6. **Phase 3-C** `CombatGmDeclareWindow` — medium (modifié session 83, relire avant)
7. **Phase 3-B** `CombatActionWindow` — le plus gros (~1500 lignes)
8. **Phase 3-E** `CombatModifiersWindow` — palette B, variante gold
9. **Phase 3-F** `CombatDamageWindow` — palette B, simple
10. **Phase 3-G** `CombatResultPanels` — substitution `C.xxx` → CSS vars inline
11. **Phase 3-H** `CombatTimeline` — `.combat-timeline-bar` + inline vars
12. **Phase 3-I** `TimelineCard` — substitution inline vars uniquement

---

## Validation (à faire après chaque composant)

- [ ] `npm run dev` → zéro erreur console
- [ ] Fenêtre s'affiche visuellement identique avant/après
- [ ] Position draggable fonctionne
- [ ] Les états dynamiques (opacity isDimmed, width 440/720) fonctionnent
- [ ] L'objet `const S` / `const W` / `const styles` est absent ou vidé au maximum

---

## Ce que ce sprint NE fait PAS

- Ne change pas l'apparence visuelle (aucun nouveau design, aucune couleur inventée)
- Ne touche pas à la logique métier ou aux événements WS
- Ne refactore pas les composants non-combat (Sidebar, DicePanel, etc.)
- Ne migre pas les inline styles 100% dynamiques (TimelineCard dimensions, etc.)
- Le rework visuel hard-SF (chamfer sur les boutons internes des fenêtres) est un sprint ULTÉRIEUR

---

## Prérequis avant exécution

- Lire CLAUDE.md en entier (protocole habituel)
- Lire les fichiers `JOURNAL3.md` + `EN_COURS.md` + `ASBUILT.md`
- Lire chaque composant EN ENTIER avant de le modifier (règle CLAUDE.md)
- Lire `client/src/index.css` en entier avant d'y écrire
- Confirmer que `client/src/components/CombatGmDeclareWindow.jsx` est dans l'état post-session 83
  (panneau droit tir + sélection arme CaC ajoutés — il y a un `const S` étendu à ne pas réécraser)
