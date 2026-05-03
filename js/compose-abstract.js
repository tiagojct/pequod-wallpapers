// Abstract composition. One mode, six minimalist sub-styles, every
// one centre-anchored. The vocabulary is Miró by way of Pequod:
// biomorphic blobs, dots, crescents, asterisks, thin lines on a soft
// painterly base.
//
//   mist           rich Pequod ramp + optional soft centred stain
//   field          three Rothko-style soft bands
//   ripple         concentric soft rings centred on the geometric centre
//   constellation  centred biomorphic blob + small dots arranged around it
//   lunar          centred crescent + a small dot offset to one side
//   signs          gradient base + a handful of small asterisks (Miró stars)

import {
  pickSurface,
  pickAccents,
  crewHex,
  rgba,
} from "./palette.js";

const SUBSTYLES = [
  "mist",
  "field",
  "ripple",
  "constellation",
  "lunar",
  "signs",
];

export function composeAbstract(p, rng, state, vp) {
  const substyle = rng.pick(SUBSTYLES);
  const surface = pickSurface(p, rng, state.theme);
  const accents = pickAccents(rng, state.accentCount, state.accents);

  const palette = {
    surface,
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
    grain: layout.grain ?? defaultGrain(rng),
    vignette: layout.vignette ?? defaultVignette(state.theme),
  };
}

function renderSubstyle(p, rng, state, substyle, palette, vp) {
  switch (substyle) {
    case "mist":
      return renderMist(p, rng, state, palette, vp);
    case "field":
      return renderField(p, rng, state, palette, vp);
    case "ripple":
      return renderRipple(p, rng, state, palette, vp);
    case "constellation":
      return renderConstellation(p, rng, state, palette, vp);
    case "lunar":
      return renderLunar(p, rng, state, palette, vp);
    case "signs":
      return renderSigns(p, rng, state, palette, vp);
    default:
      return { shapes: [] };
  }
}

// ── mist ────────────────────────────────────────────────────────────
// Multi-stop Pequod gradient that grows from the centre. Optional
// very-soft accent stain at the centre.
function renderMist(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "radial", weight: 5 },
    { value: "vertical", weight: 2 },
    { value: "diagonal", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);

  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  if (rng.next() > 0.3 && palette.accents.length > 0) {
    const accent = rng.pick(palette.accents);
    const r = rng.range(0.22, 0.4) * Math.min(vp.w, vp.h);
    shapes.push({
      type: "circle",
      cx: vp.w / 2,
      cy: vp.h / 2,
      r,
      fill: rgba(accent.hex, rng.range(0.18, 0.32)),
      blend: "multiply",
      blur: r * 0.5,
    });
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.1) },
  };
}

// ── field ───────────────────────────────────────────────────────────
// Three feathered horizontal bands; small focal accent band between
// two larger flanking bands.
function renderField(p, rng, state, palette, vp) {
  const swatches = swatchPool(p, palette, state.theme);
  const accentHex = palette.accents[0]?.hex || swatches[0];

  const upperHex = swatches[rng.int(0, swatches.length - 1)];
  const lowerHex = swatches[rng.int(0, swatches.length - 1)];

  const upperH = rng.range(0.26, 0.36) * vp.h;
  const focalH = rng.range(0.14, 0.22) * vp.h;
  const gap1 = rng.range(0.04, 0.08) * vp.h;
  const gap2 = rng.range(0.04, 0.08) * vp.h;

  let cursor = rng.range(0.06, 0.14) * vp.h;
  const shapes = [];
  shapes.push(featherRect(vp, cursor, upperH, upperHex));
  cursor += upperH + gap1;
  shapes.push(featherRect(vp, cursor, focalH, accentHex));
  cursor += focalH + gap2;
  const lowerH = Math.max(0.18 * vp.h, vp.h - cursor - 0.05 * vp.h);
  shapes.push(featherRect(vp, cursor, lowerH, lowerHex));

  return {
    shapes,
    grain: { intensity: 0.12, freq: rng.range(0.8, 1.0) },
  };
}

// ── ripple ──────────────────────────────────────────────────────────
// Concentric soft rings centred on the geometric centre, over a
// centred radial gradient base.
function renderRipple(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const baseGrad = buildGradient("g-base", "radial", ramp, vp, rng);
  baseGrad.cx = vp.w / 2;
  baseGrad.cy = vp.h / 2;
  baseGrad.r = Math.max(vp.w, vp.h) * 0.95;

  const shapes = [baseRect(vp, `url(#${baseGrad.id})`)];

  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const accent = palette.accents[0]?.hex;
  const swatches = swatchPool(p, palette, state.theme);
  const minDim = Math.min(vp.w, vp.h);
  const layers = rng.int(7, 12);
  const maxR = rng.range(0.7, 1.05) * minDim;

  for (let i = layers - 1; i >= 0; i--) {
    const t = i / (layers - 1);
    const r = maxR * (0.18 + 0.82 * t);
    const isAccent = i === Math.floor(layers / 2) && accent;
    const hex = isAccent ? accent : swatches[i % swatches.length];
    const op = isAccent ? 0.45 : rng.range(0.16, 0.28);
    shapes.push({
      type: "circle",
      cx,
      cy,
      r,
      fill: rgba(hex, op),
      blend: "multiply",
      blur: r * 0.04,
    });
  }

  return {
    shapes,
    gradients: [baseGrad],
    grain: { intensity: 0.08, freq: rng.range(0.85, 1.0) },
  };
}

// ── constellation ───────────────────────────────────────────────────
// One centred biomorphic blob and three to five small accent dots
// arranged around it on radial spokes. Sometimes a thin curved line
// passes through the blob.
function renderConstellation(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "radial", weight: 4 },
    { value: "vertical", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const minDim = Math.min(vp.w, vp.h);
  const blobR = rng.range(0.2, 0.3) * minDim;
  const blobHex = state.theme === "light" ? p.log["800"] : (palette.accents[0]?.hex || p.log["100"]);
  shapes.push({
    type: "path",
    d: buildBlobPath(cx, cy, blobR, rng, rng.int(7, 9)),
    fill: blobHex,
  });

  // Dots on radial spokes around the blob.
  const dotCount = rng.int(3, 5);
  const accent = palette.accents[0]?.hex || swatchPool(p, palette, state.theme)[0];
  const dotPool = palette.accents.length > 0 ? palette.accents.map((a) => a.hex) : [blobHex];
  for (let i = 0; i < dotCount; i++) {
    const angle = (i / dotCount) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const distance = blobR * rng.range(1.6, 2.4);
    const dx = cx + Math.cos(angle) * distance;
    const dy = cy + Math.sin(angle) * distance;
    const dr = rng.range(0.018, 0.04) * minDim;
    shapes.push({
      type: "circle",
      cx: dx,
      cy: dy,
      r: dr,
      fill: rng.pick(dotPool),
    });
  }

  // Optional thin straight line crossing the canvas.
  if (rng.next() > 0.55) {
    const angle = rng.range(-Math.PI / 8, Math.PI / 8);
    const len = vp.w * 1.2;
    const dx = (Math.cos(angle) * len) / 2;
    const dy = (Math.sin(angle) * len) / 2;
    shapes.push({
      type: "line",
      x1: cx - dx,
      y1: cy - dy,
      x2: cx + dx,
      y2: cy + dy,
      stroke: blobHex,
      strokeWidth: 0.005 * minDim,
    });
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── lunar ───────────────────────────────────────────────────────────
// Large centred crescent (built from two overlapping circles, one in
// the surface tone), a small offset companion dot, and a soft radial
// background.
function renderLunar(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "radial", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const minDim = Math.min(vp.w, vp.h);
  const outerR = rng.range(0.18, 0.26) * minDim;
  const innerR = outerR * rng.range(0.85, 0.95);
  const offsetSign = rng.next() > 0.5 ? 1 : -1;
  const offset = outerR * rng.range(0.32, 0.5) * offsetSign;

  const crescentHex = state.theme === "light" ? p.log["800"] : (palette.accents[0]?.hex || p.log["100"]);

  // The crescent: full circle minus an offset circle in the surface
  // tone. The mask circle uses the underlying gradient stop colour at
  // the centre so it carves cleanly out of the foreground crescent.
  shapes.push({
    type: "circle",
    cx,
    cy,
    r: outerR,
    fill: crescentHex,
  });
  // A second circle in the same colour as the surface gradient at
  // its lightest stop, slightly offset, so it carves a crescent.
  const surfaceCutHex = state.theme === "light"
    ? p.log["50"]
    : p.log["950"];
  shapes.push({
    type: "circle",
    cx: cx + offset,
    cy,
    r: innerR,
    fill: surfaceCutHex,
  });

  // Companion dot on the outside of the crescent.
  const dotAngle = offsetSign > 0 ? Math.PI : 0;
  const dotDistance = outerR * 1.8;
  const dotR = rng.range(0.02, 0.035) * minDim;
  const dotHex = palette.accents[0]?.hex || crescentHex;
  shapes.push({
    type: "circle",
    cx: cx + Math.cos(dotAngle) * dotDistance,
    cy: cy + Math.sin(dotAngle) * dotDistance,
    r: dotR,
    fill: dotHex,
  });

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
    vignette: { intensity: state.theme === "light" ? 0.16 : 0.24 },
  };
}

// ── signs ───────────────────────────────────────────────────────────
// Gradient base with a handful of small Miró asterisks (thin crossed
// lines through a point) arranged in a balanced layout. One sign at
// centre, others on a roughly symmetric grid.
function renderSigns(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "vertical", weight: 3 },
    { value: "radial", weight: 2 },
    { value: "diagonal", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);
  const inkHex = state.theme === "light" ? p.log["800"] : p.log["100"];
  const accentHex = palette.accents[0]?.hex || inkHex;

  // Symmetric set of star positions: one centre, four on the
  // diagonals, optionally two on the cardinals.
  const positions = [{ cx: 0.5, cy: 0.5, accent: true }];
  const layout = rng.weighted([
    { value: "diagonal", weight: 3 },
    { value: "cardinal", weight: 2 },
    { value: "scatter", weight: 2 },
  ]);
  if (layout === "diagonal") {
    positions.push(
      { cx: 0.25, cy: 0.25 },
      { cx: 0.75, cy: 0.25 },
      { cx: 0.25, cy: 0.75 },
      { cx: 0.75, cy: 0.75 },
    );
  } else if (layout === "cardinal") {
    positions.push(
      { cx: 0.5, cy: 0.18 },
      { cx: 0.5, cy: 0.82 },
      { cx: 0.2, cy: 0.5 },
      { cx: 0.8, cy: 0.5 },
    );
  } else {
    // Scatter: rule-of-thirds diagonally
    positions.push(
      { cx: 1 / 3, cy: 1 / 3 },
      { cx: 2 / 3, cy: 2 / 3 },
      { cx: 1 / 3, cy: 2 / 3 },
      { cx: 2 / 3, cy: 1 / 3 },
    );
  }

  // Sometimes drop one position randomly so layouts are not always
  // the same five-point pattern.
  if (rng.next() > 0.5 && positions.length > 3) {
    positions.splice(rng.int(1, positions.length - 1), 1);
  }

  for (const pos of positions) {
    const x = pos.cx * vp.w;
    const y = pos.cy * vp.h;
    const size = (pos.accent ? rng.range(0.06, 0.09) : rng.range(0.04, 0.065)) * minDim;
    shapes.push({
      type: "path",
      d: buildAsteriskPath(x, y, size, rng.int(4, 6)),
      fill: "none",
      stroke: pos.accent ? accentHex : inkHex,
      strokeWidth: rng.range(0.0035, 0.006) * minDim,
    });
    // A small filled dot at the centre of each star.
    shapes.push({
      type: "circle",
      cx: x,
      cy: y,
      r: 0.006 * minDim,
      fill: pos.accent ? accentHex : inkHex,
    });
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── shape helpers ───────────────────────────────────────────────────

function baseRect(vp, fill) {
  return { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill };
}

function featherRect(vp, y, h, fill) {
  return {
    type: "rect",
    x: -0.06 * vp.w,
    y,
    w: 1.12 * vp.w,
    h,
    fill,
    feather: 1,
  };
}

// Catmull-Rom-to-Bezier closed blob with `sides` sample points around
// the centre, each radius perturbed by 30 percent. Returns an SVG
// path d-string.
function buildBlobPath(cx, cy, baseR, rng, sides = 8) {
  const points = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    const r = baseR * (0.7 + rng.next() * 0.5);
    points.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < sides; i++) {
    const p0 = points[(i - 1 + sides) % sides];
    const p1 = points[i];
    const p2 = points[(i + 1) % sides];
    const p3 = points[(i + 2) % sides];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d + " Z";
}

// Asterisk: `rays` thin lines crossing at the point (cx, cy), each
// half-length size/2. Returned as a path with multiple subpaths.
function buildAsteriskPath(cx, cy, size, rays) {
  let d = "";
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI;
    const dx = (Math.cos(angle) * size) / 2;
    const dy = (Math.sin(angle) * size) / 2;
    d += `M ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} L ${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)} `;
  }
  return d.trim();
}

// ── ramps and gradients ─────────────────────────────────────────────

export function buildPaperRamp(p, theme, rng) {
  const log = p.log;
  const lightSteps = ["50", "100", "150", "200", "300", "400", "500"];
  const darkSteps = ["950", "900", "800", "700", "600", "500", "400"];
  const steps = theme === "light" ? lightSteps : darkSteps;
  const offsetCurve = [0, 0.14, 0.3, 0.48, 0.66, 0.83, 1.0];
  const stops = steps.map((step, i) => ({
    offset: clamp(offsetCurve[i] + rng.range(-0.02, 0.02), 0, 1),
    color: log[step],
  }));
  for (let i = 1; i < stops.length; i++) {
    if (stops[i].offset <= stops[i - 1].offset) {
      stops[i].offset = Math.min(1, stops[i - 1].offset + 0.005);
    }
  }
  return stops;
}

export function buildGradient(id, direction, stops, vp, rng) {
  if (direction === "radial") {
    return {
      id,
      type: "radial",
      cx: vp.w / 2,
      cy: vp.h / 2,
      r: Math.max(vp.w, vp.h) * rng.range(0.85, 1.15),
      stops,
    };
  }
  let x1 = 0, y1 = 0, x2 = vp.w, y2 = vp.h;
  if (direction === "vertical") {
    x1 = vp.w / 2; y1 = 0; x2 = vp.w / 2; y2 = vp.h;
  } else if (direction === "horizontal") {
    x1 = 0; y1 = vp.h / 2; x2 = vp.w; y2 = vp.h / 2;
  } else {
    const flipX = rng.next() > 0.5;
    const flipY = rng.next() > 0.5;
    x1 = flipX ? vp.w : 0;
    y1 = flipY ? vp.h : 0;
    x2 = flipX ? 0 : vp.w;
    y2 = flipY ? 0 : vp.h;
  }
  return { id, type: "linear", x1, y1, x2, y2, stops };
}

// ── defaults and pools ──────────────────────────────────────────────

function defaultGrain(rng) {
  return { intensity: 0.1, freq: rng.range(0.8, 1.05) };
}

function defaultVignette(theme) {
  return { intensity: theme === "light" ? 0.12 : 0.18 };
}

function swatchPool(p, palette, theme) {
  const log = p.log;
  const lightFg = ["200", "300", "400", "500"].map((s) => log[s]);
  const darkFg = ["600", "700", "800"].map((s) => log[s]);
  return [
    ...(theme === "light" ? lightFg : darkFg),
    ...palette.accents.map((a) => a.hex),
  ];
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
