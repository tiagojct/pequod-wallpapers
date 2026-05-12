# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

A static web application that generates wallpapers from the Pequod
palette. Two modes (abstract with three named sub-styles, maritime with
six named scenes), two themes (light, dark), seed-reproducible, optional
Moby-Dick chapter epigraph, PNG and SVG export, in-browser gallery via
IndexedDB.

## Stack and constraints

- Vanilla HTML, CSS, and ES modules. No framework, no bundler, no build step.
- Canvas API for raster preview and PNG export. Inline SVG for shapes and
  SVG export. No imported SVG files; every primitive is drawn from code.
- IndexedDB for the gallery, with a small inline wrapper. No external
  library.
- mulberry32 PRNG inline in `js/prng.js`. Every random choice in the
  composition pipeline must come from the seeded PRNG, never from
  `Math.random`.
- `pequod.json` is vendored at the repository root and never fetched
  from the network at runtime. Update by copying the file from
  `tiagojct/pequod` and recording the upstream commit SHA in `README.md`.
- `chapters.json` is vendored at the repository root with 135
  Moby-Dick chapter titles plus Etymology, Extracts, and Epilogue. The
  source text is public domain.

## File layout

```
index.html
css/style.css
js/main.js               entry, controls, regenerate loop, shortcuts
js/prng.js               mulberry32 plus cyrb53 string-to-int hash
js/palette.js            loader and surface/accent selection helpers
js/url-state.js          query-string serialisation and restore
js/compose-shared.js     chord, ramp, gradient, mark/snake, path helpers
js/compose-abstract.js   three named sub-styles (constellation, lunar, gesture)
js/compose-maritime.js   six named scenes (horizon, becalmed, storm,
                         whale-back, doubloon, lookout)
js/epigraph.js           seeded chapter pick + serif text shape
js/render.js             SVG build, grain, vignette, text, watermark
js/export.js             PNG and SVG export
js/gallery.js            IndexedDB gallery with thumbnails
pequod.json              canonical palette tokens, vendored
chapters.json            Moby-Dick chapter titles, vendored
.github/workflows/deploy.yml    GitHub Pages deploy
```

## Composition rule summary

- Light theme surface from Log 50, 100, 150, or 200. Dark theme
  surface from Log 800, 900, or 950. Foreground Log steps stay on the
  same temperature side as the surface.
- Light variants pair with light surfaces, dark variants with dark.
  Never mixed within one composition.
- Never two warm crew accents (Ahab, Pip, Stubb, Daggoo) in the same
  composition. Ishmael and Tashtego must not be the only two accents
  in one composition (their deuteranopia delta-E is 6.8, the lowest in
  the palette).
- Both modes use a chord chosen up-front: surface, near-tone Log step,
  focal accent, secondary accent. Helpers live in `js/compose-shared.js`.
  Reusing the chord across all marks keeps every output tonally
  coherent.

## Authoring conventions

- No emojis anywhere. None in code, comments, README, UI labels, commit
  messages, or the project page.
- No em-dashes. Use commas, full stops, parentheses, or colons instead.
- No "AI writing tropes": no "delve", no "tapestry", no "serves as", no
  "it's not X, it's Y", no "Here's the kicker", no negative parallelism,
  no bold-first bullets in prose, no signposted "in conclusion". Write
  like a person.
- No bold or italic in UI text where avoidable. Lowercase labels preferred
  for buttons and controls (matches the rest of the Pequod ecosystem).
- English throughout. Do not introduce Portuguese strings unless
  explicitly asked.
- Straight quotes only, never curly. Plain `->` if an arrow is needed,
  never the unicode arrow.

## Single source of truth

`pequod.json` at the repository root is the authoritative palette source.
Never invent hex values. If a hex appears in code, it must be loaded from
this file.

## Do not change without asking

- The composition rules above. They prevent ugly outputs and protect
  the CVD floor documented at
  https://tiagojct.eu/projects/pequod#colourblindness.
- The Ishmael-Tashtego pairing rule.
- The seed format `PEQUOD-` plus four base36 characters, and the URL
  query-string schema.
- The "no imported SVG files" rule for compositions. Both modes draw
  every primitive in code from `js/compose-shared.js`. Reintroducing
  motif file imports would reopen the issue that led to their removal.
