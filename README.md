# pequod-wallpapers

A static web application that generates desktop and mobile wallpapers from
the [Pequod palette](https://tiagojct.eu/projects/pequod). Two modes
(abstract, maritime), two themes (light, dark), seed-reproducible output,
PNG and SVG export, and an in-browser gallery.

Live at: https://tiagojct.github.io/pequod-wallpapers/

## What it does

Pick a mode, theme, and aspect ratio, press regenerate. Out comes a
Pequod-coherent wallpaper at the resolution you asked for. Same seed plus
same controls always produces the same image, so URLs are permalinks and
the gallery only needs to store parameters, not pixels.

The abstract mode shoots through five sub-styles (bauhaus, risograph,
topographic, colour-field, generative-grid). The maritime mode picks
between three (horizon, isolated-motif, scattered-fleet) and uses six
hand-styled SVG motifs (whaler, sperm whale, fluke, whaleboat, sun-moon,
compass rose).

## Stack

Vanilla HTML, CSS, and ES modules. No framework. No bundler. No build
step. Files load directly from the static host.

- Canvas API for raster preview and PNG export.
- Inline SVG for motifs and SVG export.
- IndexedDB (thin wrapper, no library) for the gallery.
- mulberry32 PRNG (inline in `js/prng.js`) for seed reproducibility.
- `pequod.json` is vendored from the upstream repo at build time.

## Run locally

Open `index.html` in a browser, or serve the directory with any static
server. The application uses ES module imports, so a `file://` open works
in Firefox but not in Chromium-based browsers; for those, use:

```
python3 -m http.server 8000
```

then open http://localhost:8000.

## Deploy

Pushes to `main` trigger the GitHub Actions workflow at
`.github/workflows/deploy.yml`, which publishes the repository root to
GitHub Pages via the official actions. The page reads from the workflow
artifact, not from a branch.

To switch to a custom subdomain later: in repository settings, Pages
section, set the custom domain. GitHub will write a `CNAME` for you. No
code change is needed; all internal asset paths are relative.

## Licences

- Code: [MIT](LICENSE-CODE)
- Generated images and motif SVGs: [CC BY 4.0](LICENSE-IMAGES)

## Motif credit

The motif SVGs in `motifs/` are placeholders in v1, generated as simple
geometric stand-ins so the application can ship and be exercised. They
match the Pequod sensibility (single-fill paths, weathered, organic
silhouettes) but are not hand-drafted illustrations. Replacement with
hand-drafted motifs is tracked at issue #1.

## Provenance

The `pequod.json` vendored at the root of this repository was copied
from upstream commit
[`619982d`](https://github.com/tiagojct/pequod/commit/619982d518a66af65b19117652e9dba977e7bbbd)
of `tiagojct/pequod`.
