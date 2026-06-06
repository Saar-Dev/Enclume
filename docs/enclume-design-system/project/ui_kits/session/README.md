# UI Kit — Enclume Session

A high-fidelity, interactive recreation of Enclume's single product surface: the **pre-game flow** (login → dashboard) and the **live game session** (3D-map backdrop, resizable sidebar, GM bar, floating combat windows). Built from the real `client/src` source, not from screenshots.

## Run it
Open `index.html`. It's a click-through:

1. **Login** — anvil-watermarked card, Venus Rising wordmark. *Se connecter* →
2. **Dashboard** — campaign grid (MJ/Joueur badges, invite codes, join card). *Jouer* →
3. **Session** — the live table:
   - **GM bar** (top): battlemap switcher + `⚔ Combat` toggle.
   - **3D map backdrop**: honest placeholder for the React-Three-Fiber voxel scene — faint anvil watermark, iso grid, player/PNJ tokens. *(Not a real 3D engine — the chrome is the focus.)*
   - **Sidebar** (right, 300px): tabs **Chat / Persos / Joueurs / Biblio / Config**. The chat renders real **dice-roll messages** (success/fail tints, mono totals, MR badges, favorite ★ & secret 🔒). Type `/d20+3` in the composer to roll.
   - **Dice tray** (bottom-right 🎲): the radial selector — d20 center, d4/d6/d8/d10/d12/d100 around, modifier stepper, roll → posts to chat.
   - **Combat** (toggle): the BG3-style **initiative timeline** (portraits, wound-colored borders, gold active halo, turn timer) + the draggable **Déclaration** window (21 Polaris actions, CaC modes).

## Files
| File | Component(s) |
|---|---|
| `index.html` | Shell — loads fonts/tokens, inlines the anvil logo, mounts the app. |
| `EncUI.jsx` | `ENC` token map, inline stroke icons (`IconDice/Ruler/Pen/Plus/X/Send/Sword`), `AnvilLogo`, `Eyebrow`. |
| `SessionApp.jsx` | `Login`, `Dashboard`, `MapBackdrop`. |
| `SessionSidebar.jsx` | `SessionSidebar` — tabbed chat/persos/joueurs/config + dice messages. |
| `DiceTray.jsx` | `DiceTray` — radial dice selector with SVG die shapes. |
| `CombatWindows.jsx` | `TimelineBar` (initiative portraits + hex status badges) + shared `useDrag` hook. |
| `RosterWindow.jsx` | `RosterWindow` — faithful `CombatRosterWindow`: pré-combat (arme/armure chips/surpris/inclus + alert banner) and roster (ini order) modes. |
| `DeclareWindow.jsx` | `DeclareWindow` — faithful Phase 1 `CombatActionWindow`: TACTIQUE/ARMEMENT segmented state selectors, ACTION grid, ACTIONS RAPIDES sliders, ROSTER checklist. |
| `App.jsx` | Screen state machine + GM bar + combat phase stepper (pré-combat → déclaration) + fake roll logic. |

## Fidelity notes
- Two palettes are honored: the cooler **in-session** surfaces (`#0f0f1a`/`#16162a`) for the sidebar, and the denser **tactical-HUD** surfaces (`#0d0f18`/`#080a12`, cyan titles, 2px chips) for combat windows — matching the real `CombatRosterWindow`/`CombatActionWindow`.
- Icons are the app's own inline stroke SVGs + unicode status glyphs. No icon library.
- Combat windows are genuinely **draggable** (drag the header), as in the app.
- All copy is French, sentence-case, with the LdB vocabulary (CaC, Assaut, MR, INI, Annonce/Résolution).

**Cut corners (intentional):** no real 3D, no websockets/backend, dice are pseudo-random, the 21-action list is abridged, character-sheet & damage windows are not rebuilt. This kit is for **visual + interaction fidelity of the core shell**, not production logic.
