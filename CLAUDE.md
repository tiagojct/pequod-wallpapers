# CLAUDE.md

Guidance for AI assistants working in this repository.

## What this is

A static web application that generates wallpapers from the Pequod palette.
Two modes (abstract, maritime), two themes (light, dark), seed-reproducible,
PNG and SVG export, in-browser gallery via IndexedDB.

## Stack and constraints

- Vanilla HTML, CSS, and ES modules. No framework, no bundler, no build step.
- Canvas API for raster preview and PNG export. Inline SVG for motifs and
  SVG export.
- IndexedDB for the gallery, with a small inline wrapper. No external
  library.
- mulberry32 PRNG inline in `js/prng.js`. Every random choice in the
  composition pipeline must come from the seeded PRNG, never from
  `Math.random`.
- `pequod.json` is vendored at the repository root and never fetched at
  runtime. Update by copying the file from `tiagojct/pequod` and recording
  the upstream commit SHA in `README.md`.

## File layout

```
index.html
css/style.css
js/main.js               entry, controls, regenerate loop
js/prng.js               mulberry32 plus cyrb53 string-to-int hash
js/palette.js            loader and surface/accent selection helpers
js/url-state.js          query-string serialisation and restore
js/motifs.js             SVG motif loader
js/compose-abstract.js   five abstract sub-styles
js/compose-maritime.js   three maritime sub-styles
js/export.js             PNG and SVG export
js/gallery.js            IndexedDB gallery with thumbnails
motifs/*.svg             six motif SVGs, single-fill paths, 100x100 viewBox
pequod.json              canonical palette tokens, vendored
.github/workflows/deploy.yml    GitHub Pages deploy
```

## Composition rule summary

- Light theme surface from Log 50, 100, 150, or 200. Dark theme surface
  from Log 800, 900, or 950. Foreground Log steps stay on the same
  temperature side as the surface.
- Light variants pair with light surfaces, dark variants with dark. Never
  mixed within one composition.
- Never two warm crew accents (Ahab, Pip, Stubb, Daggoo) in the same
  composition. Ishmael and Tashtego must not be the only two accents in
  one composition (their deuteranopia delta-E is 6.8, the lowest in the
  palette).

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

- The composition rules above. They prevent ugly outputs and protect the
  CVD floor documented at https://tiagojct.eu/projects/pequod#colourblindness.
- The motif viewBox dimensions (100x100). Layout depends on this.
- The Ishmael-Tashtego pairing rule.
- The seed format `PEQUOD-` plus four base36 characters, and the URL
  query-string schema.
