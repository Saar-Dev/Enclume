---
name: enclume-design
description: Use this skill to generate well-branded interfaces and assets for Enclume — a homemade dark-theme VTT (virtual tabletop) for the French RPG Polaris — either for production or throwaway prototypes/mocks. Contains design guidelines, color & type tokens, fonts, the anvil logo, and a UI kit recreating the live game-session interface.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

Key files:
- `README.md` — product context, CONTENT FUNDAMENTALS, VISUAL FOUNDATIONS, ICONOGRAPHY.
- `colors_and_type.css` — all design tokens (colors, type families, semantic scale, spacing, radius, elevation). Import it in any Enclume design.
- `assets/` — the anvil logo + favicon (set `color` + `--icon-secondary` when embedding).
- `fonts/` — Venus Rising (wordmark) + Inter (UI). Share Tech Mono & Caveat load from Google Fonts.
- `preview/` — specimen cards for every token group.
- `ui_kits/session/` — interactive recreation of the session UI (login, dashboard, live session with sidebar, dice, combat windows). Reuse its JSX components.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy the assets out and produce static HTML files for the user to view. If working on production code, copy assets and read the rules here to become an expert in designing with this brand.

Remember the essentials: French throughout (informal « tu »), exclusive dark theme, Enclume blue `#5b8dee`, dense information layout on a strict 4px scale, small radii (4–14px), 1px hairline borders doing the structural work, all-caps 10px eyebrow labels, monospace for all numbers/dice, and inline stroke SVGs + unicode glyphs for icons (no icon library). Combat/floating windows use a denser tactical-HUD palette (`#0d0f18`/`#080a12`, cyan titles).

If the user invokes this skill without other guidance, ask what they want to build or design, ask a few focused questions, then act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
