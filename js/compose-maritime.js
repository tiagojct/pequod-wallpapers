// Maritime mode: three center-anchored sub-styles. Motifs land on
// the centre line; concentric patterns grow outward from the
// geometric centre. Symmetric, iconic, like a stamp or a seal.
//
//   horizon     sky gradient meeting sea gradient + centred motif
//               on the horizon line
//   silhouette  centred radial gradient + one large dark motif at
//               the geometric centre
//   beacon      centred motif surrounded by 6 to 9 concentric soft
//               rings emanating outward, on a soft radial base

import {
  pickSurface,
  pickAccents,
  crewHex,
  rgba,
} from "./palette.js";
import { MOTIF_NAMES } from "./motifs.js";
import { buildPaperRamp, buildGradient } from "./compose-abstract.js";

const SUBSTYLES = ["horizon", "silhouette", "beacon"];

export function composeMaritime(p, rng, state, vp) {
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
    motifs: layout.motifs || [],
    grain: layout.grain || { intensity: 0.09, freq: 0.95 },
    vignette: layout.vignette || { intensity: state.theme === "light" ? 0.14 : 0.22 },
  };
}

function renderSubstyle(p, rng, state, substyle, palette, vp) {
  switch (substyle) {
    case "horizon":
      return renderHorizon(p, rng, state, palette, vp);
    case "silhouette":
      return renderSilhouette(p, rng, state, palette, vp);
    case "beacon":
      return renderBeacon(p, rng, state, palette, vp);
    default:
      return { shapes: [], motifs: [] };
  }
}

// horizon: two stacked vertical gradients meeting at the horizon
// line. The motif is centred horizontally and sits on the horizon.
function renderHorizon(p, rng, state, palette, vp) {
  const horizonY = rng.range(0.45, 0.6) * vp.h;
  const skyRamp = buildSkyRamp(p, state.theme);
  const seaRamp = buildSeaRamp(p, state.theme);

  const skyGrad = {
    id: "g-sky",
    type: "linear",
    x1: vp.w / 2,
    y1: 0,
    x2: vp.w / 2,
    y2: horizonY,
    stops: skyRamp,
  };
  const seaGrad = {
    id: "g-sea",
    type: "linear",
    x1: vp.w / 2,
    y1: horizonY,
    x2: vp.w / 2,
    y2: vp.h,
    stops: seaRamp,
  };

  const shapes = [
    { type: "rect", x: 0, y: 0, w: vp.w, h: horizonY, fill: "url(#g-sky)" },
    { type: "rect", x: 0, y: horizonY, w: vp.w, h: vp.h - horizonY, fill: "url(#g-sea)" },
  ];

  const motifPalette = horizonMotifPalette(palette, state.theme);
  const motifName = rng.weighted([
    { value: "sun-moon", weight: 4 },
    { value: "pequod", weight: 3 },
    { value: "whale-fluke", weight: 2 },
    { value: "whaleboat", weight: 2 },
    { value: "sperm-whale", weight: 1 },
  ]);

  const minDim = Math.min(vp.w, vp.h);
  const motifSize = motifName === "sun-moon"
    ? rng.range(0.16, 0.24) * minDim
    : rng.range(0.1, 0.16) * minDim;
  const motifX = vp.w / 2 - motifSize / 2;
  let motifY;
  if (motifName === "sun-moon") {
    motifY = horizonY - motifSize * 0.65;
  } else if (motifName === "whale-fluke") {
    motifY = horizonY - motifSize * 0.45;
  } else {
    motifY = horizonY - motifSize * 0.7;
  }

  const motifs = [
    {
      name: motifName,
      x: motifX,
      y: motifY,
      size: motifSize,
      rotate: 0,
      fill: motifPalette.fill,
      shadow: motifPalette.shadow,
    },
  ];

  return {
    shapes,
    gradients: [skyGrad, seaGrad],
    motifs,
    grain: { intensity: 0.08, freq: rng.range(0.85, 1.0) },
  };
}

// silhouette: a centred radial gradient with one large motif at the
// geometric centre. Cinematic, iconic.
function renderSilhouette(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  // Force radial direction so the gradient grows outward from centre.
  const grad = buildGradient("g-base", "radial", ramp, vp, rng);

  const shapes = [
    { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill: `url(#${grad.id})` },
  ];

  const motifName = rng.pick(MOTIF_NAMES);
  const minDim = Math.min(vp.w, vp.h);
  const size = rng.range(0.42, 0.6) * minDim;
  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const fill = silhouetteFill(p, palette, state.theme);

  return {
    shapes,
    gradients: [grad],
    motifs: [
      {
        name: motifName,
        x: cx - size / 2,
        y: cy - size / 2,
        size,
        rotate: 0,
        fill,
        shadow: state.theme === "light",
      },
    ],
    grain: { intensity: 0.1, freq: rng.range(0.85, 1.0) },
    vignette: { intensity: state.theme === "light" ? 0.18 : 0.26 },
  };
}

// beacon: a small centred motif surrounded by concentric soft rings
// emanating outward, like a stamp or a mark on parchment. The motif
// is the focal point; the rings are the atmosphere.
function renderBeacon(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const baseGrad = buildGradient("g-base", "radial", ramp, vp, rng);
  baseGrad.r = Math.max(vp.w, vp.h) * 1.05;

  const shapes = [
    { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill: `url(#${baseGrad.id})` },
  ];

  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const minDim = Math.min(vp.w, vp.h);

  // 6 to 9 concentric rings, semi-transparent, growing outward. Each
  // ring is a thin stroked circle that fades as it moves out.
  const ringCount = rng.int(6, 9);
  const accent = palette.accents[0]?.hex || palette.surface.hex;
  const ringHex = state.theme === "light" ? "#0D2F42" : "#EAE1D7";
  const innerR = rng.range(0.1, 0.14) * minDim;
  const ringStep = rng.range(0.06, 0.085) * minDim;
  for (let i = 0; i < ringCount; i++) {
    const r = innerR + (i + 1) * ringStep;
    const t = i / (ringCount - 1);
    const op = 0.32 * (1 - 0.7 * t);
    shapes.push({
      type: "ring",
      cx,
      cy,
      r,
      stroke: i === 1 && rng.next() > 0.5 ? accent : ringHex,
      strokeWidth: rng.range(0.0035, 0.006) * minDim,
      strokeOpacity: op,
      blend: "multiply",
    });
  }

  // Centre motif. Pick something that reads well as a small icon.
  const motifName = rng.weighted([
    { value: "compass-rose", weight: 4 },
    { value: "sun-moon", weight: 3 },
    { value: "whale-fluke", weight: 2 },
    { value: "pequod", weight: 1 },
    { value: "sperm-whale", weight: 1 },
  ]);
  const motifSize = innerR * rng.range(1.4, 1.7);
  const motifFill = silhouetteFill(p, palette, state.theme);

  return {
    shapes,
    gradients: [baseGrad],
    motifs: [
      {
        name: motifName,
        x: cx - motifSize / 2,
        y: cy - motifSize / 2,
        size: motifSize,
        rotate: 0,
        fill: motifFill,
        shadow: state.theme === "light",
      },
    ],
    grain: { intensity: 0.08, freq: rng.range(0.85, 1.0) },
    vignette: { intensity: state.theme === "light" ? 0.16 : 0.24 },
  };
}

function buildSkyRamp(p, theme) {
  const log = p.log;
  return theme === "light"
    ? [
        { offset: 0, color: log["50"] },
        { offset: 0.4, color: log["100"] },
        { offset: 0.8, color: log["200"] },
        { offset: 1.0, color: log["300"] },
      ]
    : [
        { offset: 0, color: log["950"] },
        { offset: 0.4, color: log["900"] },
        { offset: 0.8, color: log["800"] },
        { offset: 1.0, color: log["700"] },
      ];
}

function buildSeaRamp(p, theme) {
  const log = p.log;
  return theme === "light"
    ? [
        { offset: 0, color: log["300"] },
        { offset: 0.5, color: log["400"] },
        { offset: 1.0, color: log["500"] },
      ]
    : [
        { offset: 0, color: log["700"] },
        { offset: 0.5, color: log["800"] },
        { offset: 1.0, color: log["900"] },
      ];
}

function horizonMotifPalette(palette, theme) {
  if (theme === "light") {
    return { fill: "#0D2F42", shadow: false };
  }
  const accent = palette.accents[0]?.hex;
  return { fill: accent || "#EAE1D7", shadow: false };
}

function silhouetteFill(p, palette, theme) {
  if (theme === "light") {
    return p.log["800"];
  }
  return palette.accents[0]?.hex || p.log["100"];
}
