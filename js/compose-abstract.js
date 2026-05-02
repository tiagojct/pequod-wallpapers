// Abstract mode composition.
// Sub-styles: bauhaus, risograph, topographic, colour-field, generative-grid.
// All draws use viewport-relative coordinates inside a virtual 1000x1000
// box. The renderer then scales to the chosen output dimensions.

import { pickSurface, pickForegroundLogs, pickAccents, crewHex, rgba } from "./palette.js";

const SUBSTYLES = ["bauhaus", "risograph", "topographic", "colour-field", "generative-grid"];

export function composeAbstract(p, rng, state) {
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

  const shapes = renderSubstyle(rng, state, substyle, palette);

  return {
    substyle,
    surface,
    palette,
    shapes,
  };
}

function renderSubstyle(rng, state, substyle, palette) {
  switch (substyle) {
    case "bauhaus":
      return renderBauhaus(rng, state, palette);
    case "risograph":
      return renderRisograph(rng, state, palette);
    case "topographic":
      return renderTopographic(rng, state, palette);
    case "colour-field":
      return renderColourField(rng, state, palette);
    case "generative-grid":
      return renderGenerativeGrid(rng, state, palette);
    default:
      return [];
  }
}

function densityRange(density, lo, hi) {
  if (density === "low") return lo;
  if (density === "high") return hi;
  return Math.round((lo + hi) / 2);
}

// Bauhaus: 3-7 hard-edged primitives, large scale, pure colours.
function renderBauhaus(rng, state, palette) {
  const n = densityRange(state.density, 3, 7);
  const swatches = swatchPool(palette);
  const shapes = [];
  for (let i = 0; i < n; i++) {
    const kind = rng.pick(["circle", "rect", "triangle", "line"]);
    const fill = rng.pick(swatches);
    const x = rng.range(50, 950);
    const y = rng.range(50, 950);
    const size = rng.range(120, 400);
    if (kind === "circle") {
      shapes.push({
        type: "circle",
        cx: x,
        cy: y,
        r: size / 2,
        fill,
      });
    } else if (kind === "rect") {
      const w = size;
      const h = rng.range(0.5, 1.5) * size;
      shapes.push({
        type: "rect",
        x: x - w / 2,
        y: y - h / 2,
        w,
        h,
        fill,
      });
    } else if (kind === "triangle") {
      const half = size / 2;
      shapes.push({
        type: "polygon",
        points: [
          [x, y - half],
          [x + half, y + half],
          [x - half, y + half],
        ],
        fill,
      });
    } else {
      const len = size;
      const angle = rng.range(0, Math.PI);
      const dx = Math.cos(angle) * len;
      const dy = Math.sin(angle) * len;
      shapes.push({
        type: "line",
        x1: x - dx / 2,
        y1: y - dy / 2,
        x2: x + dx / 2,
        y2: y + dy / 2,
        stroke: fill,
        strokeWidth: rng.range(8, 22),
      });
    }
  }
  return shapes;
}

// Risograph: 2-4 translucent layered shapes with multiply blend.
function renderRisograph(rng, state, palette) {
  const n = densityRange(state.density, 2, 4);
  const swatches = swatchPool(palette);
  const shapes = [];
  for (let i = 0; i < n; i++) {
    const fill = rng.pick(swatches);
    const x = rng.range(150, 850);
    const y = rng.range(150, 850);
    const size = rng.range(350, 700);
    const kind = rng.pick(["circle", "soft-rect"]);
    if (kind === "circle") {
      shapes.push({
        type: "circle",
        cx: x,
        cy: y,
        r: size / 2,
        fill: rgba(fill, 0.55),
        blend: "multiply",
      });
    } else {
      shapes.push({
        type: "rect",
        x: x - size / 2,
        y: y - size / 2,
        w: size,
        h: size * rng.range(0.6, 1.0),
        fill: rgba(fill, 0.5),
        blend: "multiply",
        rx: rng.range(0, 30),
      });
    }
  }
  return shapes;
}

// Topographic: nested concentric shapes suggesting contour lines.
function renderTopographic(rng, state, palette) {
  const layers = densityRange(state.density, 5, 14);
  const swatches = [...palette.fgLogs.map((s) => s.hex), ...palette.accents.map((a) => a.hex)];
  const cx = rng.range(300, 700);
  const cy = rng.range(300, 700);
  const maxR = rng.range(380, 560);
  const minR = rng.range(40, 90);
  const irregular = rng.next() > 0.5;
  const shapes = [];
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const r = maxR - t * (maxR - minR);
    const fill = swatches[i % swatches.length];
    if (irregular) {
      const sides = 24;
      const points = [];
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const wobble = 1 + rng.range(-0.08, 0.08);
        points.push([cx + Math.cos(a) * r * wobble, cy + Math.sin(a) * r * wobble]);
      }
      shapes.push({ type: "polygon", points, fill });
    } else {
      shapes.push({ type: "circle", cx, cy, r, fill });
    }
  }
  return shapes;
}

// Colour-field: 2-4 large rectangular blocks, soft borders.
function renderColourField(rng, state, palette) {
  const n = densityRange(state.density, 2, 4);
  const swatches = [...palette.fgLogs.map((s) => s.hex), ...palette.accents.map((a) => a.hex)];
  const shapes = [];
  // Vertical or horizontal stack.
  const horizontal = rng.next() > 0.5;
  let cursor = rng.range(40, 100);
  for (let i = 0; i < n; i++) {
    const swatch = rng.pick(swatches);
    const thickness = rng.range(150, 380);
    if (horizontal) {
      shapes.push({
        type: "rect",
        x: 0,
        y: cursor,
        w: 1000,
        h: thickness,
        fill: swatch,
        feather: 14,
      });
    } else {
      shapes.push({
        type: "rect",
        x: cursor,
        y: 0,
        w: thickness,
        h: 1000,
        fill: swatch,
        feather: 14,
      });
    }
    cursor += thickness * rng.range(0.7, 1.0);
  }
  return shapes;
}

// Generative grid: tiled rectangular cells with palette variation.
function renderGenerativeGrid(rng, state, palette) {
  const cells = densityRange(state.density, 6, 14);
  const cellW = 1000 / cells;
  const cellH = 1000 / cells;
  const swatches = [...palette.fgLogs.map((s) => s.hex), ...palette.accents.map((a) => a.hex)];
  // Include the surface as a "blank" weight so the grid breathes.
  const pool = [...swatches, palette.surface.hex, palette.surface.hex];
  const shapes = [];
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const fill = rng.pick(pool);
      if (fill === palette.surface.hex) continue; // leave blank
      shapes.push({
        type: "rect",
        x: c * cellW,
        y: r * cellH,
        w: cellW,
        h: cellH,
        fill,
      });
    }
  }
  return shapes;
}

function swatchPool(palette) {
  return [
    ...palette.fgLogs.map((s) => s.hex),
    ...palette.accents.map((a) => a.hex),
  ];
}
