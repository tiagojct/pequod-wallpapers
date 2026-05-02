// Maritime mode composition.
// Sub-styles: horizon, isolated-motif, scattered-fleet.
// Coordinates use the actual viewport (vp.w x vp.h) so layouts fill any
// aspect ratio without cropping or letterboxing.

import { pickSurface, pickForegroundLogs, pickAccents, crewHex } from "./palette.js";
import { MOTIF_NAMES } from "./motifs.js";

const SUBSTYLES = ["horizon", "isolated-motif", "scattered-fleet"];

export function composeMaritime(p, rng, state, vp) {
  const substyle = rng.pick(SUBSTYLES);
  const surface = pickSurface(p, rng, state.theme);
  const accents = pickAccents(rng, state.accentCount, state.accents);
  const fgLogs = pickForegroundLogs(p, rng, state.theme, 2);

  const palette = {
    surface,
    fgLogs,
    accents: accents.map((name) => ({
      name,
      hex: crewHex(p, name, state.theme),
    })),
  };

  const layout = renderSubstyle(rng, state, substyle, palette, vp);

  return {
    substyle,
    surface,
    palette,
    shapes: layout.shapes,
    motifs: layout.motifs,
  };
}

function renderSubstyle(rng, state, substyle, palette, vp) {
  switch (substyle) {
    case "horizon":
      return renderHorizon(rng, state, palette, vp);
    case "isolated-motif":
      return renderIsolatedMotif(rng, state, palette, vp);
    case "scattered-fleet":
      return renderScatteredFleet(rng, state, palette, vp);
    default:
      return { shapes: [], motifs: [] };
  }
}

function renderHorizon(rng, state, palette, vp) {
  const horizonY = rng.range(0.38 * vp.h, 0.64 * vp.h);
  const skyHex = palette.fgLogs[0]?.hex || palette.surface.hex;
  const seaHex = palette.fgLogs[1]?.hex || palette.surface.hex;

  const shapes = [
    { type: "rect", x: 0, y: 0, w: vp.w, h: horizonY, fill: skyHex },
    { type: "rect", x: 0, y: horizonY, w: vp.w, h: vp.h - horizonY, fill: seaHex },
  ];

  const motifName = rng.pick([
    "pequod",
    "sperm-whale",
    "whaleboat",
    "sun-moon",
    "whale-fluke",
  ]);
  const motifFill =
    palette.accents[0]?.hex || palette.fgLogs[0]?.hex || palette.surface.hex;
  const minDim = Math.min(vp.w, vp.h);
  const motifSize = rng.range(0.12 * minDim, 0.22 * minDim);
  const motifX = rng.range(0.2 * vp.w, 0.8 * vp.w) - motifSize / 2;
  let motifY;
  if (motifName === "sun-moon") {
    motifY = horizonY - motifSize * 0.7;
  } else if (motifName === "whale-fluke") {
    motifY = horizonY - motifSize * 0.55;
  } else {
    motifY = horizonY - motifSize * 0.6;
  }
  const motifs = [
    {
      name: motifName,
      x: motifX,
      y: motifY,
      size: motifSize,
      rotate: 0,
      fill: motifFill,
    },
  ];

  return { shapes, motifs };
}

function renderIsolatedMotif(rng, state, palette, vp) {
  const motifName = rng.pick(MOTIF_NAMES);
  const motifFill =
    palette.accents[0]?.hex || palette.fgLogs[0]?.hex;
  const minDim = Math.min(vp.w, vp.h);
  const size = rng.range(0.42 * minDim, 0.64 * minDim);
  const xCentre = rng.pick([0.33, 0.5, 0.67]) * vp.w;
  const yCentre = rng.pick([0.4, 0.5, 0.6]) * vp.h;
  const x = xCentre - size / 2;
  const y = yCentre - size / 2;
  const rotate = rng.next() > 0.85 ? rng.range(-8, 8) : 0;

  return {
    shapes: [],
    motifs: [
      { name: motifName, x, y, size, rotate, fill: motifFill },
    ],
  };
}

function renderScatteredFleet(rng, state, palette, vp) {
  const n = state.density === "low" ? 3 : state.density === "high" ? 8 : 5;
  const fills = [
    ...palette.accents.map((a) => a.hex),
    ...palette.fgLogs.map((s) => s.hex),
  ];
  const minDim = Math.min(vp.w, vp.h);
  const motifs = [];
  for (let i = 0; i < n; i++) {
    const name = rng.pick(["pequod", "whaleboat", "whale-fluke", "sperm-whale", "compass-rose"]);
    const size = rng.range(0.09 * minDim, 0.18 * minDim);
    const x = rng.range(0.04 * vp.w, 0.96 * vp.w) - size / 2;
    const y = rng.range(0.06 * vp.h, 0.94 * vp.h) - size / 2;
    const rotate = rng.range(-12, 12);
    const fill = rng.pick(fills);
    motifs.push({ name, x, y, size, rotate, fill });
  }
  return { shapes: [], motifs };
}
