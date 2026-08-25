# Enclume — Design System

**Enclume** is a homemade VTT (Virtual Tabletop) — a private, self-hosted alternative to Roll20 — built to play the French tabletop RPG **Polaris** online. It is designed for intimate sessions of **4–8 players**, running on a **Raspberry Pi 4**. The whole product is French-language and lives in an exclusive **dark theme**.

The core experience is a single **game session**: a full-screen 3D map (voxel terrain + tokens) as the backdrop, a right-hand **sidebar** (chat, dice, character sheets, players), and **floating, draggable windows** for combat (initiative timeline, action declaration, dice results, damage).

> "Enclume" is French for **anvil** — the logo is an anvil silhouette with an inscribed faceted gem. The forge metaphor (hammering things into shape over many sessions) runs through the project's own dev culture.

---

## Sources

This design system was reverse-engineered from the product's real codebase. The reader is encouraged to explore the repository directly to build higher-fidelity designs:

- **GitHub:** [`Saar-Dev/Enclume`](https://github.com/Saar-Dev/Enclume) @ `master`
  - `client/src/index.css` — the canonical design-token sheet (colors, spacing, radius, elevation)
  - `client/src/components/Sidebar.jsx` — the in-session sidebar (chat, dice messages, tabs); source of the in-session palette
  - `client/src/components/CombatTimeline.jsx` + `TimelineCard.jsx` — BG3-style initiative bar
  - `client/src/pages/SessionPage.jsx` — session layout, GM bar, floating windows orchestration
  - `client/src/pages/DashboardPage.jsx`, `LoginPage.jsx` — pre-game surfaces
  - `shared/woundConstants.js` — wound severity colors & penalties
  - `client/public/logo.svg`, `favicon.svg` — the anvil mark
  - `client/public/fonts/` — Venus Rising (display) + Inter (UI)
- **Uploaded:** `uploads/logo.svg` (same anvil mark)

> **Stack** (for context): React 19 + Vite, Node + Express + Socket.io, PostgreSQL + Redis + MinIO, Three.js / React Three Fiber, Zustand, JWT httpOnly cookies. i18n via `react-i18next` (`fr.json` is the single source of strings).

---

## CONTENT FUNDAMENTALS

The product is **100% French**, written by and for a small group of friends. The tone is **terse, technical, and rules-literate** — it assumes you know Polaris.

- **Language:** French throughout. Game terms follow the Polaris *Livre de Base* (**LdB**) and are often cited verbatim, including page numbers (`malus −5/−7/−10 (LdB p.224)`).
- **Person & address:** The UI addresses the player informally with **« tu »** in instructions (`Annonce ton action`, `méfie-toi du pont`). Labels themselves are bare nouns, no pronouns (`Code d'invitation`, `Tableau de bord`).
- **Casing:** **Sentence case** for body and buttons (`Rejoindre une campagne`, `Lancer les dés`). **ALL-CAPS** reserved for the signature micro labels — sidebar tabs and section eyebrows (`CHAT`, `PERSOS`, `JOUEURS`). Roles are short caps badges (`MJ`, `GM`).
- **Vocabulary (house terms):**
  - **MJ** = Maître du Jeu (GM / Game Master). **PJ** = personnage joueur. **PNJ** = non-player character. **Entité** = scenery object (never a PNJ — a documented gotcha, PC27).
  - **CaC** = Corps à Corps (melee). **Assaut** = ranged attack. **Jet** = a roll. **Seuil** = success threshold. **MR** = marge de réussite. **INI** = initiative.
  - **Blessure** = wound (severities: *légère, moyenne, grave, critique, mortelle*).
- **Numbers as voice:** big monospace numbers carry meaning — a dice total, a threshold, an invite code. They are the loudest text on a roll card.
- **Emoji & glyphs:** used **functionally, never decoratively**, as compact status/verb icons: `⚔` (combat), `★` (favorite roll), `✓` (announced), `⚠` (surprised / warning), `🔒` (secret roll), `⚙` (entity config), `ⓘ` (skill info), `📋` (copy), `→ ←` (phase direction). No celebratory or filler emoji.
- **Microcopy vibe:** dry, action-oriented, occasionally wry (`✕ Combat` to end combat, `+ Nouveau perso`, placeholder *"méfie-toi du pont"*). Errors are plain and specific (`cible hors portée` with the distance shown).
- **Dev voice (CLAUDE.md / CHANGELOG):** the internal docs are intense and disciplined — `[add]/[fix]/[chg]` changelog tags, session-numbered versions (`## v74 — …`), and an almost ritual "CODE > conversation" mantra. Not user-facing, but it explains the rigor in the rules implementation.

---

## VISUAL FOUNDATIONS

A **cool, deep-space dark theme** that has to stay legible while floating over a live, textured 3D scene. Restrained, technical, slightly nocturnal — closer to a flight-sim HUD or a code editor than a fantasy parchment UI.

- **Two coordinated palettes.** There is a *canonical token palette* (`index.css`: `--bg-app #0f1115` → `--bg-elevated #1b2232`, cool blue-grey) used on pre-game pages (login, dashboard), and a slightly **cooler/darker in-session palette** (`#0f0f1a` body, `#16162a` raised, `#1e1e2e` hairlines) used by the sidebar and floating windows because they sit *over* the 3D map and need extra contrast. Both share the same accent blue.
- **A third, distinct "Combat HUD" palette.** The floating **combat windows** (Roster, Déclaration, GM-Declare, Modificateurs, Dégâts, Résultats) run on their *own* cooler, darker tactical palette — body `#0d0f18`, header/thead `#080a12`, border `#1e2435`, **cyan** titles/accents `#3a8aaa` (not the Enclume blue), segmented controls on `#0a1018`. Roles are color-coded (PJ green `#50c878` / PNJ orange `#c86030`), equipment states use danger-red and warn-amber dropdowns, and armor coverage shows as T/C/B/J chips. This is effectively a HUD-within-the-UI: an instrument panel that reads as harder, more technical than the chat/dashboard chrome. **It is fully tokenized** under the `--combat-*` group in `colors_and_type.css` (see the *Combat HUD* preview cards) — historically these windows hardcoded the values in their own style objects, so naming them here makes the system the source of truth for that whole surface.
- **Accent:** one signature **Enclume blue `#5b8dee`** — links, active tab underline, focus, primary buttons, dice author names. Used sparingly. Secondary accents: green `#4caf77` (success/hit/player), red `#e05b5b` (danger/combat), amber `#e0a050` (warning/surprise), gold `#f5c542`/`#aa8a30` (active token halo / favorite rolls).
- **Wound system color ramp:** a dedicated, *warm* gradient (`#FFD700` légère → `#8B0000` mortelle) that deliberately breaks from the cool UI — wounds are meant to draw the eye. Drives timeline card borders.
- **Type:** **Inter** for all UI (400/500, occasionally 600). **Venus Rising** — a wide, futuristic display face — for the *wordmark only*. **Share Tech Mono** for all numbers, dice totals, invite codes, stats (tabular). **Caveat** for rare handwritten flavor. The signature is the **10px uppercase tracked eyebrow** label on tabs and sections.
- **Spacing:** strict **4px base** (`4 / 8 / 12 / 16 / 24`). The UI is **information-dense** — small paddings (6–12px), tight gaps (4–6px), labels down to 9–10px. This is a power-user tool, not a marketing site.
- **Radius:** small and consistent — `4px` chips/swatches, `6px` in-session cards/buttons/inputs, `12px` token-level inputs & modals, `14px` primary cards. Nothing pill-shaped except status dots (circles).
- **Backgrounds:** no photography, no illustration in the chrome. The "imagery" is the **live 3D voxel map** itself. Static surfaces use **flat fills** or a subtle **vertical gradient** on cards (`linear-gradient(180deg, #151923, #10131b)`). Login/empty states show the **anvil logo as a faint watermark** (`opacity 0.06–0.12`, sometimes inverted) plus soft **radial glows** in the corners (`radial-gradient(circle at 20% 20%, #1a2340, transparent)`). No repeating patterns, no noise/grain.
- **Animation:** quick and utilitarian. Buttons: `transform .08s` + `filter .08s`. Timeline reorders with **Motion FLIP** layout animations (`0.18s easeOut`). Dice messages get a brief one-shot highlight (~800ms). One decorative loop exists: a slow **hourglass flip** (`1.2s ease-in-out infinite`) marking an entity waiting on the GM. Respect `prefers-reduced-motion` when recreating.
- **Hover / press:** hover = **brightness(1.08)** or a faint primary-tinted background (`rgba(91,141,238,.15)`) + border shift to the accent. Press = **scale(.98)**. Cards lift on hover (`translateY(-2px)` + `--shadow-md`). Links underline on hover.
- **Borders:** **1px hairlines** everywhere — `#252b3a`/`#2f374a` (tokens) or `#1e1e2e`/`#2a2a3e` (session). Borders, not shadows, do most of the structural separation. Active/selected elements switch their border to the accent blue.
- **Shadows / elevation:** minimal. `sm 0 2px 8px`, `md 0 10px 30px` for cards, `0 4px 12px rgba(0,0,0,.4)` for floating combat windows. The one **glow** is the gold active-token halo (`0 0 12px rgba(245,197,66,.35)`).
- **Transparency & blur:** used for overlays *on the map* — the timeline bar is `rgba(10,10,20,.88)`, modals dim with `rgba(0,0,0,.6)`. Semantic backgrounds are tinted alphas of their accent (`rgba(76,175,119,.07)` success row, `rgba(224,92,92,.07)` fail row). No heavy glassmorphism/backdrop-blur in the core.
- **Cards:** dark fill (flat or subtle vertical gradient), 1px subtle border, small radius (6–14px), restrained shadow. Combat-result and dice cards add a **tinted alpha background + matching tinted border** in the result color (green = success, red = fail, severity color = damage).
- **Layout rules:** the session is **fixed, full-viewport, no page scroll** — the map fills everything, chrome floats on top. The GM gets a top **GM bar** (battlemap switcher + `⚔ Combat` toggle). The sidebar is **resizable** (drag handle, ~300px default) and dismissible. Combat windows are **draggable and persist position in localStorage**. Scroll lives *inside* panels, never the page.
- **Imagery vibe:** character **portraits** are full-bleed inside timeline cards with a bottom black gradient for the name/INI — cool, illustrated, RPG-style. The only "warm" colors in the system are wounds and the gold halo.

---

## ICONOGRAPHY

Enclume has **no icon font and no icon library**. The signature is a **hard-SF, HUD-badge aesthetic** — not soft Feather strokes. Iconography is layered by purpose:

1. **Status-effect icons → hexagonal HUD badges (THE signature system).** `assets/status/*.svg` — 15 character-condition icons sharing one frame: an elongated **faceted hexagon** (the same gem/d20 motif as the logo) with a dark `#0a0d12` fill, a near-black `#05070b` 3px outer stroke, and a **per-family accent** inner stroke (1.6px) + centered glyph. This is the brand's icon DNA. Four semantic accent families:
   - **`#d84838` dégâts continus** — acide, asphyxie, en feu, décompression, électrocuté
   - **`#38a8c8` environnement / bio** — hypothermie, infecté, irradié, déséquilibré, empoisonné
   - **`#d8a838` contrôle physique** — agrippé, entravé
   - **`#9858c8` neuro / mental** — étourdi, aveuglé, inconscient
   When you need a *new* icon, build it as a hex badge in this system (frame + accent glyph), not as a thin-line outline icon.
2. **Dice → the d20 model (imposed).** The DicePanel die is a **20-sided die rendered as a faceted hexagon** with internal facet lines and a `Share Tech Mono` "20", drawn in the player's color. This is the canonical dice mark — **do not** substitute a pip/d6 cube. (`IconDice` in the UI kit reproduces it; the DicePanel radial tray draws the same shape per die type.)
3. **Utility icons → minimal inline stroke SVGs**, only for plumbing actions: mesure (`IconRuler`), éditer (`IconPen`), `IconPlus`, `IconX`, send. `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, 2px, round joins. Kept deliberately quiet — they are not the brand's voice; the hex badges are.
4. **Status & combat-verb glyphs → unicode/emoji** inline at text size, tinted by role color: `⚔` combat, `★` favorite (gold), `✓` announced (green), `⚠` warning (amber), `🔒` secret, `⚙` entity config, `ⓘ` skill info, `📋` copy, `→ ←` phase direction.
5. **Brand mark → the anvil logo** (`assets/logo.svg`, `assets/favicon.svg`). One path is the faceted gem (`stroke: currentColor`); another is the anvil body (`fill: var(--icon-secondary)`). Set **both** `color` and `--icon-secondary` when embedding inline. Note the gem facets rhyme with the hex status badges and the d20 — one geometric family across the whole brand.

> **Note — Vite template leftovers.** The repo's `client/public/icons.svg` (bluesky/discord/github/x social icons) and `client/src/assets/hero.png` (rotating cube) are **unused starter-template debris**, *not* Enclume iconography. They are intentionally **excluded** from this design system. Do not use them.

---

## Assets in this system

- `assets/logo.svg`, `assets/favicon.svg` — the anvil + gem mark (set `color` + `--icon-secondary`).
- `assets/status/*.svg` — 15 hexagonal HUD status-effect badges (the signature icon system).
- `fonts/venus-rising.woff2` — display wordmark face (local).
- `fonts/inter.woff` — UI face (local; full weights also pulled from Google Fonts in the CSS).
- *(Share Tech Mono & Caveat are loaded from Google Fonts — swap to local woff for offline use.)*

---

## Index — what's in this folder

| File / folder | What it is |
|---|---|
| `README.md` | This file — product context, content & visual foundations, iconography. |
| `colors_and_type.css` | All design tokens (colors, type families, semantic type scale, spacing, radius, elevation) as CSS vars + helper classes. **Import this in any Enclume design.** |
| `SKILL.md` | Agent-Skill manifest so this system works as a downloadable Claude Skill. |
| `assets/` | Logo, favicon. |
| `fonts/` | Venus Rising + Inter web fonts. |
| `preview/` | The Design-System-tab specimen cards (colors, type, spacing, components, brand). |
| `ui_kits/session/` | High-fidelity recreation of the in-game session UI (dashboard, login, the live session with sidebar, dice, floating combat windows). Start at `ui_kits/session/index.html`. |

### UI kits
- **`ui_kits/session/`** — the single product surface: pre-game (login, dashboard) + the live game session (3D-map backdrop placeholder, resizable sidebar with chat/dice/persos, GM bar, floating combat windows: faithful **Roster Combat** (pré-combat + roster), **Phase 1 — Déclaration**, and the initiative timeline). See its own `README.md`.
