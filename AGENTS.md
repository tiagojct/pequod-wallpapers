# AGENTS.md

## What this is

Static web app generating wallpapers from the Pequod palette.
Canvas + SVG, no framework, no bundler, no build step.

## Architecture notes

- The codebase has evolved past CLAUDE.md. Maritime mode, motifs SVGs,
  and `js/motifs.js` were dropped. Only the abstract mode remains
  (5 sub-styles: mist, ripple, constellation, lunar, gesture).
  `url-state.js` still validates `VALID_MODES` with "maritime" but
  the control is not in the UI and the function is unused.
- `compose-abstract.js` drives all output. `compose-maritime.js` does
  not exist. The `motifs/` directory does not exist.
- Entry: `index.html` loads `js/main.js` via `<script type="module">`.

## Critical constraints

- **Seeded PRNG**: `js/prng.js` (mulberry32 + cyrb53 hash). Every random
  choice in composition must use the seeded PRNG, never `Math.random`.
  The only acceptable use of `Math.random` is in `newSeed()`.
- **Seed format**: `PEQUOD-` plus 4 base36 chars (regex: `/^PEQUOD-[0-9A-Z]{4}$/`).
- **Palette**: `pequod.json` at root is the single source of truth. Never
  invent hex values. Vendored from `tiagojct/pequod`; record the upstream
  commit SHA in `README.md` on update.
- **Composition rules** (enforced in `js/palette.js`):
  - Light theme surface from Log 50, 100, 150, or 200. Dark from Log 800, 900, or 950.
  - Light variants pair with light surfaces, dark with dark. Never mixed.
  - Max 1 warm crew accent (Ahab, Pip, Stubb, Daggoo) per composition.
  - Ishmael and Tashtego must not be the only 2 accents (lowest deuteranopia delta-E).
- **Watermark**: uses JetBrains Mono font. Theme-adaptive colour based on surface lightness.

## Authoring conventions

- No emojis, no em-dashes, no AI writing tropes ("delve", "tapestry", "serves as").
- Lowercase labels preferred for buttons/controls.
- Straight quotes only. No unicode arrows, use `->`.
- English throughout — no Portuguese unless explicitly asked.
- No bold/italic in UI text where avoidable.

## Run locally

Open `index.html` in a browser. ES modules need a server in Chromium:
```
python3 -m http.server 8000
```
Firefox works with `file://` directly.

## Deploy

Push to `main` triggers `.github/workflows/deploy.yml`. Published via
GitHub Pages artifact (not branch). No manual build step.

## URL state schema

Query params: `mode`, `theme`, `aspect` (e.g. `16x10`, `19x9` for 19.5:9),
`density`, `count`, `accents` (comma-separated), `seed`, `wm` (1/0).
Defaults in `DEFAULT_STATE` in `js/url-state.js`.
Same seed + same controls = same output.
