// Abstract mode composition.
// Six sub-styles: gradient, bauhaus, risograph, topographic,
// colour-field, mondrian. Coordinates use the actual viewport
// (vp.w x vp.h) so layouts fill any aspect ratio cleanly.
//
// Compositional principles applied across every sub-style:
//   - Rule-of-thirds anchors for focal elements.
//   - One primary, one or two secondaries (no scattered noise).
//   - Generous negative space.
//   - Pequod warm/cool axis used for gradient direction.

import { pickSurface, pickForegroundLogs, pickAccents, crewHex, rgba } from "./palette.js";

const SUBSTYLES = [
  "gradient",
  "bauhaus",
  "risograph",
  "topographic",
  "colour-field",
  "mondrian",
];

const THIRDS = [1 / 3, 2 / 3];

export function composeAbstract(p, rng, state, vp) {
  const substyle = rng.pick(SUBSTYLES);
  const surface = pickSurface(p, rng, state.theme);
  const accents = pickAccents(rng, state.accentCount, state.accents);
  const fgLogs = pickForegroundLogs(p, rng, state.theme, 3);

  const palette = {
    surface,
    fgLogs,
    accents: accents.map((name) => ({
      name,
      hex: crewHex(p, name, state.theme),
    })),
  };

  const layout = renderSubstyle(p, rng, state, substyle, palette, vp);

  return {
    substyle,
    surface,
    palette,
    shapes: layout.shapes || [],
    gradients: layout.gradients || [],
  };
}

function renderSubstyle(p, rng, state, substyle, palette, vp) {
  switch (substyle) {
    case "gradient":
      return renderGradient(p, rng, state, palette, vp);
    case "bauhaus":
      return renderBauhaus(rng, state, palette, vp);
    case "risograph":
      return renderRisograph(rng, state, palette, vp);
    case "topographic":
      return renderTopographic(rng, state, palette, vp);
    case "colour-field":
      return renderColourField(rng, state, palette, vp);
    case "mondrian":
      return renderMondrian(rng, state, palette, vp);
    default:
      return { shapes: [], gradients: [] };
  }
}

// Gradient: a Pequod ramp filling the surface, optionally crowned by
// one floating shape in a complementary tone.
function renderGradient(p, rng, state, palette, vp) {
  // Pick stops from the warm/cool side of the surface plus one accent
  // for richness. Use 3-4 stops total.
  const lightOrDark = state.theme;
  const stopHexes = [];
  const surfaceStep = parseInt(palette.surface.step, 10);

  // Build a soft ramp using nearby Log steps.
  const allLog = p.log;
  if (lightOrDark === "light") {
    // Warm side: from lighter to darker warm tones, then one accent.
    const choices = ["100", "150", "200", "300", "400", "500"];
    const ordered = rng.shuffle(choices).slice(0, 3).sort((a, b) => parseInt(a) - parseInt(b));
    stopHexes.push(allLog["50"]);
    for (const c of ordered) stopHexes.push(allLog[c]);
  } else {
    // Cool side
    const choices = ["600", "700", "800", "900"];
    const ordered = rng.shuffle(choices).slice(0, 3).sort((a, b) => parseInt(b) - parseInt(a));
    stopHexes.push(allLog["950"]);
    for (const c of ordered) stopHexes.push(allLog[c]);
  }

  // Optionally inject one accent stop near the middle for warmth.
  if (palette.accents.length > 0 && rng.next() > 0.4) {
    const acc = palette.accents[0].hex;
    const insertAt = Math.max(1, Math.min(stopHexes.length - 1, 2));
    stopHexes.splice(insertAt, 0, acc);
  }

  const gradId = "g-bg";
  const direction = rng.pick(["vertical", "horizontal", "diagonal", "radial"]);
  const grad = buildGradient(gradId, direction, stopHexes, vp, rng);

  const shapes = [
    {
      type: "rect",
      x: 0,
      y: 0,
      w: vp.w,
      h: vp.h,
      fill: `url(#${gradId})`,
    },
  ];

  // Optional single floating element on rule-of-thirds for visual anchor.
  if (rng.next() > 0.45 && palette.accents.length > 0) {
    const cx = rng.pick(THIRDS) * vp.w;
    const cy = rng.pick(THIRDS) * vp.h;
    const size = rng.range(0.18, 0.32) * Math.min(vp.w, vp.h);
    const kind = rng.pick(["circle", "rect"]);
    const fill = palette.accents[palette.accents.length - 1].hex;
    if (kind === "circle") {
      shapes.push({
        type: "circle",
        cx,
        cy,
        r: size / 2,
        fill: rgba(fill, 0.85),
        blend: "multiply",
      });
    } else {
      shapes.push({
        type: "rect",
        x: cx - size / 2,
        y: cy - size / 2,
        w: size,
        h: size,
        fill: rgba(fill, 0.85),
        blend: "multiply",
      });
    }
  }

  return { shapes, gradients: [grad] };
}

function buildGradient(id, direction, stopHexes, vp, rng) {
  const stops = stopHexes.map((hex, i) => ({
    offset: i / (stopHexes.length - 1),
    color: hex,
  }));
  if (direction === "radial") {
    return {
      id,
      type: "radial",
      cx: rng.pick(THIRDS) * vp.w,
      cy: rng.pick(THIRDS) * vp.h,
      r: Math.max(vp.w, vp.h) * rng.range(0.7, 1.0),
      stops,
    };
  }
  let x1 = 0, y1 = 0, x2 = vp.w, y2 = vp.h;
  if (direction === "vertical") {
    x1 = vp.w / 2; y1 = 0; x2 = vp.w / 2; y2 = vp.h;
  } else if (direction === "horizontal") {
    x1 = 0; y1 = vp.h / 2; x2 = vp.w; y2 = vp.h / 2;
  } else {
    // diagonal: pick one of the four corners as the start
    const flipX = rng.next() > 0.5;
    const flipY = rng.next() > 0.5;
    x1 = flipX ? vp.w : 0;
    y1 = flipY ? vp.h : 0;
    x2 = flipX ? 0 : vp.w;
    y2 = flipY ? 0 : vp.h;
  }
  return { id, type: "linear", x1, y1, x2, y2, stops };
}

// Bauhaus: one large primary on rule-of-thirds, one or two
// counterbalancing secondaries, sometimes a single bisecting line.
function renderBauhaus(rng, state, palette, vp) {
  const minDim = Math.min(vp.w, vp.h);
  const swatches = swatchPool(palette);
  const accentHex = palette.accents[0]?.hex || swatches[0];
  const shapes = [];

  // Primary anchor on a rule-of-thirds intersection.
  const ax = rng.pick(THIRDS) * vp.w;
  const ay = rng.pick(THIRDS) * vp.h;
  const primarySize = rng.range(0.42, 0.58) * minDim;
  const primaryKind = rng.pick(["circle", "rect", "triangle"]);
  shapes.push(makePrimitive(primaryKind, ax, ay, primarySize, accentHex, rng));

  // Counterbalancing secondary on the opposite third.
  const bx = ax / vp.w < 0.5 ? (2 / 3) * vp.w : (1 / 3) * vp.w;
  const by = ay / vp.h < 0.5 ? (2 / 3) * vp.h : (1 / 3) * vp.h;
  const secondarySize = rng.range(0.18, 0.28) * minDim;
  const secondaryKind = rng.pick(["circle", "rect"]);
  const secondaryHex = palette.fgLogs[0]?.hex || swatches[0];
  shapes.push(makePrimitive(secondaryKind, bx, by, secondarySize, secondaryHex, rng));

  // Optional third small element offset from the secondary.
  if (state.density !== "low" && rng.next() > 0.4) {
    const cx = bx + (rng.next() > 0.5 ? 1 : -1) * rng.range(0.12, 0.2) * vp.w;
    const cy = by + (rng.next() > 0.5 ? 1 : -1) * rng.range(0.1, 0.18) * vp.h;
    const tertiarySize = rng.range(0.08, 0.14) * minDim;
    const tertiaryHex = palette.fgLogs[1]?.hex || palette.surface.hex;
    shapes.push(makePrimitive("circle", cx, cy, tertiarySize, tertiaryHex, rng));
  }

  // Optional bisecting line (one in three).
  if (state.density === "high" && rng.next() > 0.65) {
    const horizontal = rng.next() > 0.5;
    const lineHex = palette.fgLogs[1]?.hex || swatches[0];
    if (horizontal) {
      const yLine = rng.pick(THIRDS) * vp.h;
      shapes.push({
        type: "line",
        x1: 0,
        y1: yLine,
        x2: vp.w,
        y2: yLine,
        stroke: lineHex,
        strokeWidth: 0.012 * minDim,
      });
    } else {
      const xLine = rng.pick(THIRDS) * vp.w;
      shapes.push({
        type: "line",
        x1: xLine,
        y1: 0,
        x2: xLine,
        y2: vp.h,
        stroke: lineHex,
        strokeWidth: 0.012 * minDim,
      });
    }
  }

  return { shapes };
}

function makePrimitive(kind, cx, cy, size, fill, rng) {
  if (kind === "circle") {
    return { type: "circle", cx, cy, r: size / 2, fill };
  }
  if (kind === "rect") {
    const aspect = rng.range(0.7, 1.4);
    const w = size;
    const h = size * aspect;
    return { type: "rect", x: cx - w / 2, y: cy - h / 2, w, h, fill };
  }
  // triangle
  const half = size / 2;
  return {
    type: "polygon",
    points: [
      [cx, cy - half],
      [cx + half, cy + half],
      [cx - half, cy + half],
    ],
    fill,
  };
}

// Risograph: 2-3 large overlapping forms with multiply blend, so the
// overlap creates a deliberate third tone.
function renderRisograph(rng, state, palette, vp) {
  const minDim = Math.min(vp.w, vp.h);
  const swatches = swatchPool(palette);
  const n = state.density === "low" ? 2 : 3;
  const shapes = [];

  // Anchor each shape around the centre with controlled offset so the
  // forms overlap meaningfully.
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 + rng.range(0, Math.PI / 4);
    const offset = 0.12 * minDim;
    const cx = vp.w / 2 + Math.cos(angle) * offset;
    const cy = vp.h / 2 + Math.sin(angle) * offset;
    const size = rng.range(0.45, 0.62) * minDim;
    const hex = swatches[i % swatches.length];
    shapes.push({
      type: "circle",
      cx,
      cy,
      r: size / 2,
      fill: rgba(hex, 0.55),
      blend: "multiply",
    });
  }

  return { shapes };
}

// Topographic: nested concentric layers, centre on rule-of-thirds.
function renderTopographic(rng, state, palette, vp) {
  const layers = densityRange(state.density, 6, 12);
  const swatches = [
    ...palette.fgLogs.map((s) => s.hex),
    ...palette.accents.map((a) => a.hex),
  ];
  const minDim = Math.min(vp.w, vp.h);
  const cx = rng.pick(THIRDS) * vp.w;
  const cy = rng.pick(THIRDS) * vp.h;
  const maxR = rng.range(0.75, 1.05) * minDim;
  const minR = rng.range(0.04, 0.08) * minDim;
  const irregular = rng.next() > 0.5;
  const shapes = [];
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const r = maxR - t * (maxR - minR);
    const fill = swatches[i % swatches.length];
    if (irregular) {
      const sides = 28;
      const points = [];
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2;
        const wobble = 1 + rng.range(-0.05, 0.05);
        points.push([cx + Math.cos(a) * r * wobble, cy + Math.sin(a) * r * wobble]);
      }
      shapes.push({ type: "polygon", points, fill });
    } else {
      shapes.push({ type: "circle", cx, cy, r, fill });
    }
  }
  return { shapes };
}

// Colour-field: 2-3 soft horizontal bands, Rothko-style, with one
// smaller central band acting as the focal element.
function renderColourField(rng, state, palette, vp) {
  const swatches = [
    ...palette.fgLogs.map((s) => s.hex),
    ...palette.accents.map((a) => a.hex),
  ];
  const shapes = [];

  // Three bands: a tall upper, a smaller central focal, a tall lower.
  // Heights chosen so the focal band is the smallest (rule of thirds).
  const upperH = rng.range(0.22, 0.34) * vp.h;
  const focalH = rng.range(0.14, 0.22) * vp.h;
  const gap1 = rng.range(0.04, 0.08) * vp.h;
  const gap2 = rng.range(0.04, 0.08) * vp.h;

  let cursor = rng.range(0.06, 0.14) * vp.h;

  shapes.push({
    type: "rect",
    x: -0.05 * vp.w,
    y: cursor,
    w: 1.1 * vp.w,
    h: upperH,
    fill: rng.pick(swatches),
    feather: 24,
  });
  cursor += upperH + gap1;

  shapes.push({
    type: "rect",
    x: -0.05 * vp.w,
    y: cursor,
    w: 1.1 * vp.w,
    h: focalH,
    fill: palette.accents[0]?.hex || rng.pick(swatches),
    feather: 24,
  });
  cursor += focalH + gap2;

  // Lower band fills the remainder.
  const lowerH = Math.max(0.18 * vp.h, vp.h - cursor - 0.05 * vp.h);
  shapes.push({
    type: "rect",
    x: -0.05 * vp.w,
    y: cursor,
    w: 1.1 * vp.w,
    h: lowerH,
    fill: rng.pick(swatches),
    feather: 24,
  });

  return { shapes };
}

// Mondrian: asymmetric grid with golden-ratio splits, only 30-40% of
// cells filled, generous negative space.
function renderMondrian(rng, state, palette, vp) {
  const phi = 0.618;
  // Recursive bisection: start with one rect, split a few times.
  let rects = [{ x: 0, y: 0, w: vp.w, h: vp.h }];
  const splits = densityRange(state.density, 3, 6);
  for (let i = 0; i < splits; i++) {
    // Pick the largest rect and split it.
    rects.sort((a, b) => b.w * b.h - a.w * a.h);
    const target = rects.shift();
    const splitVertical = target.w >= target.h;
    const ratio = rng.next() > 0.5 ? phi : 1 - phi;
    if (splitVertical) {
      const splitX = target.x + target.w * ratio;
      rects.push({ x: target.x, y: target.y, w: splitX - target.x, h: target.h });
      rects.push({ x: splitX, y: target.y, w: target.x + target.w - splitX, h: target.h });
    } else {
      const splitY = target.y + target.h * ratio;
      rects.push({ x: target.x, y: target.y, w: target.w, h: splitY - target.y });
      rects.push({ x: target.x, y: splitY, w: target.w, h: target.y + target.h - splitY });
    }
  }

  // Fill 35% of cells with a Log step or accent. Favour the largest
  // and smallest cells (most visually anchored).
  const filledCount = Math.max(2, Math.round(rects.length * 0.4));
  const ordered = rects.slice().sort((a, b) => b.w * b.h - a.w * a.h);
  const fillRects = ordered.slice(0, filledCount);
  const swatches = [
    ...palette.fgLogs.map((s) => s.hex),
    ...palette.accents.map((a) => a.hex),
  ];

  const shapes = [];
  for (const r of fillRects) {
    shapes.push({
      type: "rect",
      x: r.x,
      y: r.y,
      w: r.w,
      h: r.h,
      fill: rng.pick(swatches),
    });
  }

  // Thin separator lines between every cell (Mondrian's signature).
  const lineHex = palette.fgLogs[palette.fgLogs.length - 1]?.hex || palette.surface.hex;
  const minDim = Math.min(vp.w, vp.h);
  const sep = 0.005 * minDim;
  for (const r of rects) {
    // Right edge
    shapes.push({
      type: "rect",
      x: r.x + r.w - sep / 2,
      y: r.y,
      w: sep,
      h: r.h,
      fill: lineHex,
    });
    // Bottom edge
    shapes.push({
      type: "rect",
      x: r.x,
      y: r.y + r.h - sep / 2,
      w: r.w,
      h: sep,
      fill: lineHex,
    });
  }

  return { shapes };
}

function densityRange(density, lo, hi) {
  if (density === "low") return lo;
  if (density === "high") return hi;
  return Math.round((lo + hi) / 2);
}

function swatchPool(palette) {
  return [
    ...palette.fgLogs.map((s) => s.hex),
    ...palette.accents.map((a) => a.hex),
  ];
}
