// Maritime mode: three sub-styles, every one atmospheric. Like the
// abstract sub-styles, each composition layers a base (gradient),
// motifs on top, paper-grain wash, and a vignette.
//
//   horizon     sky gradient meeting sea gradient + motif on horizon
//   silhouette  rich gradient base + one large dark motif on thirds
//   departing   moody gradient + small motif near an edge

import {
  pickSurface,
  pickAccents,
  crewHex,
  rgba,
} from "./palette.js";
import { MOTIF_NAMES } from "./motifs.js";
import { buildPaperRamp, buildGradient } from "./compose-abstract.js";

const SUBSTYLES = ["horizon", "silhouette", "departing"];
const THIRDS = [1 / 3, 2 / 3];

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
    case "departing":
      return renderDeparting(p, rng, state, palette, vp);
    default:
      return { shapes: [], motifs: [] };
  }
}

// horizon: two stacked vertical gradients meeting at a horizon line,
// with a single motif silhouette on or just above the horizon.
function renderHorizon(p, rng, state, palette, vp) {
  const horizonY = rng.range(0.42, 0.62) * vp.h;
  const skyRamp = buildSkyRamp(p, state.theme, rng);
  const seaRamp = buildSeaRamp(p, state.theme, rng);

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
    { value: "sun-moon", weight: 3 },
    { value: "pequod", weight: 3 },
    { value: "whale-fluke", weight: 2 },
    { value: "whaleboat", weight: 2 },
    { value: "sperm-whale", weight: 1 },
  ]);

  const minDim = Math.min(vp.w, vp.h);
  const motifSize = motifName === "sun-moon"
    ? rng.range(0.12, 0.2) * minDim
    : rng.range(0.08, 0.14) * minDim;
  const motifX = rng.range(0.2, 0.8) * vp.w - motifSize / 2;
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

// silhouette: rich gradient base with one large dark motif (or accent
// motif) anchored on rule-of-thirds. Cinematic.
function renderSilhouette(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "vertical", weight: 3 },
    { value: "diagonal", weight: 2 },
    { value: "radial", weight: 2 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);

  const shapes = [
    { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill: `url(#${grad.id})` },
  ];

  const motifName = rng.pick(MOTIF_NAMES);
  const minDim = Math.min(vp.w, vp.h);
  const size = rng.range(0.42, 0.6) * minDim;
  const cx = rng.pick(THIRDS) * vp.w;
  const cy = rng.pick(THIRDS) * vp.h;
  const fill = silhouetteFill(p, palette, state.theme);
  const rotate = rng.next() > 0.85 ? rng.range(-6, 6) : 0;

  return {
    shapes,
    gradients: [grad],
    motifs: [
      {
        name: motifName,
        x: cx - size / 2,
        y: cy - size / 2,
        size,
        rotate,
        fill,
        shadow: state.theme === "light",
      },
    ],
    grain: { intensity: 0.1, freq: rng.range(0.85, 1.0) },
    vignette: { intensity: state.theme === "light" ? 0.18 : 0.26 },
  };
}

// departing: a moody gradient (often single-direction) with one
// small motif near an edge, suggesting movement out of frame.
function renderDeparting(p, rng, state, palette, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "diagonal", weight: 3 },
    { value: "horizontal", weight: 2 },
    { value: "vertical", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);

  const shapes = [
    { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill: `url(#${grad.id})` },
  ];

  const motifName = rng.weighted([
    { value: "pequod", weight: 3 },
    { value: "whaleboat", weight: 3 },
    { value: "whale-fluke", weight: 2 },
    { value: "sperm-whale", weight: 1 },
  ]);
  const minDim = Math.min(vp.w, vp.h);
  const size = rng.range(0.1, 0.18) * minDim;

  // Place toward an edge, leaving room "out of frame" in one direction.
  const edge = rng.pick(["right", "left", "bottom-right", "bottom-left"]);
  let cx, cy;
  if (edge === "right") {
    cx = rng.range(0.7, 0.85) * vp.w;
    cy = rng.range(0.4, 0.65) * vp.h;
  } else if (edge === "left") {
    cx = rng.range(0.15, 0.3) * vp.w;
    cy = rng.range(0.4, 0.65) * vp.h;
  } else if (edge === "bottom-right") {
    cx = rng.range(0.65, 0.85) * vp.w;
    cy = rng.range(0.62, 0.78) * vp.h;
  } else {
    cx = rng.range(0.15, 0.35) * vp.w;
    cy = rng.range(0.62, 0.78) * vp.h;
  }

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
        rotate: rng.range(-3, 3),
        fill,
        shadow: state.theme === "light",
      },
    ],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.0) },
    vignette: { intensity: state.theme === "light" ? 0.16 : 0.24 },
  };
}

function buildSkyRamp(p, theme, rng) {
  const log = p.log;
  const stops = theme === "light"
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
  return stops;
}

function buildSeaRamp(p, theme, rng) {
  const log = p.log;
  const stops = theme === "light"
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
  return stops;
}

function horizonMotifPalette(palette, theme) {
  if (theme === "light") {
    // Dark silhouette against bright sky: use the deepest available.
    return { fill: "#0D2F42", shadow: false };
  }
  // Dark theme: motifs need to be lighter than the sea so they read.
  // Use Log 100 or an accent dark variant.
  const accent = palette.accents[0]?.hex;
  return { fill: accent || "#EAE1D7", shadow: false };
}

function silhouetteFill(p, palette, theme) {
  if (theme === "light") {
    return p.log["800"];
  }
  // On dark theme, silhouette in cream or accent.
  return palette.accents[0]?.hex || p.log["100"];
}
