// Maritime mode composition.
// Sub-styles: horizon, isolated-motif, scattered-fleet.
// Output is a list of shape descriptors plus motif placements with
// motif name, position, scale, rotation, and fill.

import { pickSurface, pickForegroundLogs, pickAccents, crewHex } from "./palette.js";
import { MOTIF_NAMES } from "./motifs.js";

const SUBSTYLES = ["horizon", "isolated-motif", "scattered-fleet"];

export function composeMaritime(p, rng, state) {
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

  const layout = renderSubstyle(rng, state, substyle, palette);

  return {
    substyle,
    surface,
    palette,
    shapes: layout.shapes,
    motifs: layout.motifs,
  };
}

function renderSubstyle(rng, state, substyle, palette) {
  switch (substyle) {
    case "horizon":
      return renderHorizon(rng, state, palette);
    case "isolated-motif":
      return renderIsolatedMotif(rng, state, palette);
    case "scattered-fleet":
      return renderScatteredFleet(rng, state, palette);
    default:
      return { shapes: [], motifs: [] };
  }
}

// Horizon: split into sky+sea using two same-temperature Log steps,
// place a motif on or near the horizon line.
function renderHorizon(rng, state, palette) {
  const horizonY = rng.range(380, 640);
  const skyHex = palette.fgLogs[0]?.hex || palette.surface.hex;
  const seaHex = palette.fgLogs[1]?.hex || palette.surface.hex;

  const shapes = [
    { type: "rect", x: 0, y: 0, w: 1000, h: horizonY, fill: skyHex },
    { type: "rect", x: 0, y: horizonY, w: 1000, h: 1000 - horizonY, fill: seaHex },
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
  const motifSize = rng.range(120, 220);
  const motifX = rng.range(200, 800) - motifSize / 2;
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

// Isolated motif: single large silhouette, monochromatic.
function renderIsolatedMotif(rng, state, palette) {
  const motifName = rng.pick(MOTIF_NAMES);
  const motifFill =
    palette.accents[0]?.hex || palette.fgLogs[0]?.hex;
  const size = rng.range(420, 640);
  // Rule-of-thirds horizontal positioning.
  const xCentre = rng.pick([330, 500, 670]);
  const yCentre = rng.pick([400, 500, 600]);
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

// Scattered fleet: 3-8 small motifs with varied scale and rotation.
function renderScatteredFleet(rng, state, palette) {
  const n = state.density === "low" ? 3 : state.density === "high" ? 8 : 5;
  const fills = [
    ...palette.accents.map((a) => a.hex),
    ...palette.fgLogs.map((s) => s.hex),
  ];
  const motifs = [];
  for (let i = 0; i < n; i++) {
    const name = rng.pick(["pequod", "whaleboat", "whale-fluke", "sperm-whale", "compass-rose"]);
    const size = rng.range(90, 180);
    const x = rng.range(40, 960) - size / 2;
    const y = rng.range(60, 940) - size / 2;
    const rotate = rng.range(-12, 12);
    const fill = rng.pick(fills);
    motifs.push({ name, x, y, size, rotate, fill });
  }
  return { shapes: [], motifs };
}
