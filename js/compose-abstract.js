// Abstract mode: four atmospheric sub-styles that lean into Pequod's
// painterly register. Every composition layers a base (gradient or
// solid surface), shapes on top, a paper-grain wash, and a vignette,
// in that order.
//
//   mist    rich multi-stop gradient + grain + optional soft blob
//   field   three Rothko-style soft bands + grain + vignette
//   strata  many horizontal gradient layers + grain
//   ripple  concentric soft circles, gradient base, grain
//
// All shapes use viewport-relative coordinates (vp.w, vp.h) so the
// composition fills any aspect cleanly.

import {
  pickSurface,
  pickAccents,
  crewHex,
  rgba,
} from "./palette.js";

const SUBSTYLES = ["mist", "field", "strata", "ripple"];
const THIRDS = [1 / 3, 2 / 3];

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
    case "strata":
      return renderStrata(p, rng, state, palette, vp);
    case "ripple":
      return renderRipple(p, rng, state, palette, vp);
    default:
      return { shapes: [] };
  }
}

// mist: a rich Pequod gradient that grows from the centre. Direction
// is weighted heavily toward radial; the optional accent stain is
// centred too.
function renderMist(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "radial", weight: 5 },
    { value: "vertical", weight: 2 },
    { value: "diagonal", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);

  const shapes = [
    { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill: `url(#${grad.id})` },
  ];

  // Optional very-soft accent stain at the centre (60-75% chance).
  if (rng.next() > 0.3 && palette.accents.length > 0) {
    const accent = palette.accents[rng.int(0, palette.accents.length - 1)];
    const cx = vp.w / 2;
    const cy = vp.h / 2;
    const r = rng.range(0.22, 0.4) * Math.min(vp.w, vp.h);
    shapes.push({
      type: "circle",
      cx,
      cy,
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

// field: three Rothko bands with very strong feathering on a solid or
// near-solid Pequod surface.
function renderField(p, rng, state, palette, vp) {
  const swatches = swatchPool(p, palette, state.theme);
  const accentHex = palette.accents[0]?.hex || swatches[0];

  const shapes = [];

  // Two outer bands (close in tone) flanking one focal band (accent).
  const upperHex = swatches[rng.int(0, swatches.length - 1)];
  const lowerHex = swatches[rng.int(0, swatches.length - 1)];

  const upperH = rng.range(0.26, 0.36) * vp.h;
  const focalH = rng.range(0.14, 0.22) * vp.h;
  const gap1 = rng.range(0.04, 0.08) * vp.h;
  const gap2 = rng.range(0.04, 0.08) * vp.h;

  let cursor = rng.range(0.06, 0.14) * vp.h;

  shapes.push({
    type: "rect",
    x: -0.06 * vp.w,
    y: cursor,
    w: 1.12 * vp.w,
    h: upperH,
    fill: upperHex,
    feather: 1, // signal: heavy feather
  });
  cursor += upperH + gap1;

  shapes.push({
    type: "rect",
    x: -0.06 * vp.w,
    y: cursor,
    w: 1.12 * vp.w,
    h: focalH,
    fill: accentHex,
    feather: 1,
  });
  cursor += focalH + gap2;

  const lowerH = Math.max(0.18 * vp.h, vp.h - cursor - 0.05 * vp.h);
  shapes.push({
    type: "rect",
    x: -0.06 * vp.w,
    y: cursor,
    w: 1.12 * vp.w,
    h: lowerH,
    fill: lowerHex,
    feather: 1,
  });

  return {
    shapes,
    grain: { intensity: 0.12, freq: rng.range(0.8, 1.0) },
  };
}

// strata: many horizontal gradient layers, each filled with a thin
// linear ramp between two close Log steps. Like atmospheric layers.
function renderStrata(p, rng, state, palette, vp) {
  const layers = rng.int(5, 9);
  const ramp = buildPaperRamp(p, state.theme, rng);
  const shapes = [];
  const gradients = [];

  // Build a single base gradient as a wash, then stack semi-transparent
  // bands on top in slightly different tones to suggest stratification.
  const baseGrad = buildGradient("g-base", "vertical", ramp, vp, rng);
  shapes.push({ type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill: `url(#${baseGrad.id})` });
  gradients.push(baseGrad);

  const swatches = swatchPool(p, palette, state.theme);

  let cursor = rng.range(0.05, 0.12) * vp.h;
  for (let i = 0; i < layers && cursor < vp.h * 0.92; i++) {
    const h = rng.range(0.05, 0.13) * vp.h;
    const hex = swatches[i % swatches.length];
    const op = rng.range(0.18, 0.32);
    shapes.push({
      type: "rect",
      x: -0.06 * vp.w,
      y: cursor,
      w: 1.12 * vp.w,
      h,
      fill: rgba(hex, op),
      blend: "multiply",
      feather: 1,
    });
    cursor += h + rng.range(0.02, 0.06) * vp.h;
  }

  return {
    shapes,
    gradients,
    grain: { intensity: 0.08, freq: rng.range(0.85, 1.05) },
  };
}

// ripple: concentric soft circles centred on the geometric centre,
// each at slightly different opacity, over a gentle radial base.
function renderRipple(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const baseGrad = buildGradient("g-base", "radial", ramp, vp, rng);
  // Override radial centre to the exact geometric centre so the ripple
  // and the gradient share an origin.
  baseGrad.cx = vp.w / 2;
  baseGrad.cy = vp.h / 2;
  baseGrad.r = Math.max(vp.w, vp.h) * 0.95;

  const shapes = [
    { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill: `url(#${baseGrad.id})` },
  ];

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

// Build a seven-stop ramp using same-temperature Log steps. Light
// theme uses the warm paper side; dark uses the cool ink side. Stop
// offsets are slightly non-linear so the ramp does not feel banded.
export function buildPaperRamp(p, theme, rng) {
  const log = p.log;
  const lightSteps = ["50", "100", "150", "200", "300", "400", "500"];
  const darkSteps = ["950", "900", "800", "700", "600", "500", "400"];
  const steps = theme === "light" ? lightSteps : darkSteps;
  // Non-linear offsets that compress the lighter end and stretch the
  // darker end (or reverse for dark theme).
  const offsetCurve = [0, 0.14, 0.3, 0.48, 0.66, 0.83, 1.0];
  // Subtle perturbation so two seeds with the same theme do not produce
  // identical gradients.
  const stops = steps.map((step, i) => ({
    offset: clamp(offsetCurve[i] + rng.range(-0.02, 0.02), 0, 1),
    color: log[step],
  }));
  // Ensure offsets remain non-decreasing.
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

function defaultGrain(rng) {
  return { intensity: 0.1, freq: rng.range(0.8, 1.05) };
}

function defaultVignette(theme) {
  // Subtle dark vignette on light theme, subtle dark-deeper on dark.
  return { intensity: theme === "light" ? 0.12 : 0.18 };
}

function swatchPool(p, palette, theme) {
  // Same-temperature Log step swatches plus accents.
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
