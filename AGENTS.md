# AGENTS.md

## What this is

Static web app generating wallpapers from the Pequod palette.
Canvas + SVG, no framework, no bundler, no build step.

## Architecture notes

- Two modes: **abstract** (3 sub-styles, in `js/compose-abstract.js`)
  and **maritime** (6 scenes, in `js/compose-maritime.js`). Both call
  into `js/compose-shared.js` for chord, ramp, gradient, mark, snake,
  and path helpers.
- Mode routing lives in `regenerate()` in `js/main.js`. The chosen
  compose function returns `{ kind, surface, palette, chord, shapes,
  gradients, grain, vignette }`. `substyle` is also written for
  backward compatibility with older gallery entries.
- Optional chapter epigraph: `js/epigraph.js` picks a chapter from
  `chapters.json` using an RNG seeded as `seed + ":epigraph"` so
  toggling does not disturb the visual composition. `js/render.js`
  draws the resulting text shape between the vignette and the
  watermark layers.
- Entry: `index.html` loads `js/main.js` via `<script type="module">`.
  UI is preview-first: full-bleed stage, floating top and bottom
  toolbars, right-side panel drawer for advanced controls.

## Critical constraints

- **Seeded PRNG**: `js/prng.js` (mulberry32 + cyrb53 hash). Every
  random choice in composition must use the seeded PRNG, never
  `Math.random`. The only acceptable use of `Math.random` is in
  `newSeed()`.
- **Seed format**: `PEQUOD-` plus 4 base36 chars
  (regex: `/^PEQUOD-[0-9A-Z]{4}$/`).
- **Palette**: `pequod.json` at root is the single source of truth.
  Never invent hex values. Vendored from `tiagojct/pequod`; record
  the upstream commit SHA in `README.md` on update.
- **Chapter list**: `chapters.json` at root. 138 entries (135
  chapters plus Etymology, Extracts, Epilogue). Public-domain
  source text.
- **Composition rules** (enforced in `js/palette.js`):
  - Light theme surface from Log 50, 100, 150, or 200. Dark from
    Log 800, 900, or 950.
  - Light variants pair with light surfaces, dark with dark. Never
    mixed.
  - Max 1 warm crew accent (Ahab, Pip, Stubb, Daggoo) per
    composition.
  - Ishmael and Tashtego must not be the only 2 accents (lowest
    deuteranopia delta-E).
- **Watermark**: JetBrains Mono, corner-stamped, theme-adaptive
  colour based on surface lightness.
- **Epigraph**: system serif stack (Georgia, Crimson Pro, Cambria,
  Times). System fonts only, so PNG export rasterises with the
  browser's native font rendering, no embedding needed.
- **No SVG file imports**. Both modes draw everything from
  primitives in `js/compose-shared.js`. Re-introducing imported
  motif SVGs would re-open the issue that led to their removal in
  commit `2e043d7`.

## Authoring conventions

- No emojis, no em-dashes, no AI writing tropes ("delve", "tapestry",
  "serves as", "it's not X, it's Y", "Here's the kicker", bold-first
  bullets in prose).
- Lowercase labels preferred for buttons and controls.
- Straight quotes only. No unicode arrows, use `->`.
- English throughout, no Portuguese unless explicitly asked.

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

Query params: `mode`, `theme`, `aspect` (e.g. `16x10`, `19x9` for
19.5:9), `density`, `count`, `accents` (comma-separated), `seed`,
`wm` (1/0), `epi` (1/0). Defaults in `DEFAULT_STATE` in
`js/url-state.js`. Same seed plus same controls always produces the
same output.

## Keyboard shortcuts

Wired in `onGlobalKeydown` in `js/main.js`. Ignored while focus is in
an `INPUT`, `TEXTAREA`, or `SELECT`, and ignored when any modifier is
held.

- `space`: regenerate.
- `m`: toggle mode.
- `t`: toggle theme.
- `s`: save to gallery.
- `e`: export PNG.
- `g`: open / close gallery.
- `Esc`: close gallery or advanced panel.
