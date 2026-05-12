# pequod-wallpapers

A static web application that generates desktop and mobile wallpapers from
the [Pequod palette](https://tiagojct.eu/projects/pequod). Two modes
(abstract, maritime), two themes (light, dark), seed-reproducible output,
optional Moby-Dick chapter epigraph, PNG and SVG export, and an
in-browser gallery.

Live at: https://tiagojct.github.io/pequod-wallpapers/

## What it does

Pick a mode, theme, and aspect ratio, press regenerate. Out comes a
Pequod-coherent wallpaper at the resolution you asked for. Same seed
plus same controls always produces the same image, so URLs are
permalinks and the gallery only needs to store parameters, not pixels.

**Abstract mode** picks uniformly between three named sub-styles:

- `constellation`, a biomorphic blob anchored centre-ish with marks
  scattered around it.
- `lunar`, a crescent disc with a companion dot and a few star marks
  on a wider ring.
- `gesture`, a sinuous hero curve crossing the canvas with supporting
  marks.

**Maritime mode** picks uniformly between six named scenes, all built
from the same primitives the abstract mode uses (no SVG file imports):

- `horizon`, horizontal stroke plus a sun or moon disc, optional sail.
- `becalmed`, a flat horizon and a single vertical mast at the centre.
- `storm`, three stacked sinuous waves, a leaning sail, a cloud blob.
- `whale-back`, one dominating sinuous curve with a fluke wedge and
  an eye dot.
- `doubloon`, a large centred disc with a ring of small asterisks.
- `lookout`, a vertical mast with a small disc atop and a low horizon.

**Chapter epigraph** is optional. Toggle in `more` to overlay a
seeded Moby-Dick chapter title in italic serif at the bottom-left of
the composition. The pick is reproducible from the seed.

Every composition runs through a chord-driven colour pipeline: surface
plus a near-tone Log step, a focal crew accent, and a secondary accent
for marks. The composition rules in `js/palette.js` keep contrast and
deuteranopia separation safe.

## Keyboard

- `space`, regenerate.
- `m`, toggle mode.
- `t`, toggle theme.
- `s`, save to gallery.
- `e`, export PNG.
- `g`, open gallery.
- `Esc`, close drawer.

Shortcuts are ignored while typing in an input.

## Stack

Vanilla HTML, CSS, and ES modules. No framework. No bundler. No build
step. Files load directly from the static host.

- Canvas API for raster preview and PNG export.
- Inline SVG for shapes and SVG export.
- IndexedDB (thin wrapper, no library) for the gallery.
- mulberry32 PRNG (inline in `js/prng.js`) for seed reproducibility.
- `pequod.json` is vendored from the upstream repo. Update by copying
  and recording the upstream commit SHA in this file.
- `chapters.json` is vendored at the repo root. 135 chapter titles
  plus Etymology, Extracts, and Epilogue.

## File layout

```
index.html
css/style.css
js/main.js               entry, controls, regenerate loop, shortcuts
js/prng.js               mulberry32 plus cyrb53 hash
js/palette.js            loader and surface / accent helpers
js/url-state.js          query-string serialisation
js/compose-shared.js     chord, ramp, gradient, marks, snake, paths
js/compose-abstract.js   three named sub-styles
js/compose-maritime.js   six named scenes, built from primitives
js/epigraph.js           chapter pick + serif text shape
js/render.js             SVG build, grain, vignette, text, watermark
js/export.js             PNG and SVG export
js/gallery.js            IndexedDB gallery with thumbnails
pequod.json              canonical palette tokens, vendored
chapters.json            Moby-Dick chapter titles, vendored
.github/workflows/deploy.yml    GitHub Pages deploy
```

## Run locally

Open `index.html` in a browser, or serve the directory with any static
server. The application uses ES module imports, so a `file://` open
works in Firefox but not in Chromium-based browsers; for those, use:

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## Deploy

Pushes to `main` trigger the GitHub Actions workflow at
`.github/workflows/deploy.yml`, which publishes the repository root to
GitHub Pages via the official actions. The page reads from the
workflow artifact, not from a branch.

## URL schema

Query params, all optional:

- `mode`: `abstract` or `maritime`.
- `theme`: `light` or `dark`.
- `aspect`: `16x10`, `16x9`, `21x9`, `4x3`, `19x9` (for 19.5:9 phone
  landscape), `9x19` (for 9:19.5 phone portrait), `1x1`, or
  `<int>x<int>`.
- `density`: `low`, `medium`, `high`.
- `count`: `1`, `2`, or `3` (accent count).
- `accents`: comma-separated crew names (`ahab`, `starbuck`,
  `queequeg`, `pip`, `ishmael`, `stubb`, `tashtego`, `daggoo`).
- `seed`: `PEQUOD-` plus four base36 characters.
- `wm`: `1` to enable the seed watermark.
- `epi`: `1` to enable the chapter epigraph.

Same seed plus same controls always produces the same image.

## Licences

- Code: [MIT](LICENSE-CODE)
- Generated images: [CC BY 4.0](LICENSE-IMAGES)

## Provenance

The `pequod.json` vendored at the root of this repository was copied
from upstream commit
[`619982d`](https://github.com/tiagojct/pequod/commit/619982d518a66af65b19117652e9dba977e7bbbd)
of `tiagojct/pequod`.

The `chapters.json` titles are derived from the 1851 first edition of
Herman Melville's _Moby-Dick; or, The Whale_ (public domain). Where
the source text uses a double-hyphen break inside a title, the JSON
renders it as a comma or period to keep the file plain ASCII.
