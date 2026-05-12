// Maritime mode: six named scenes built from the same primitive
// vocabulary the abstract mode uses (no SVG file imports). Every scene
// is chord-driven so it stays tonally coherent with the surface, and
// every random choice flows from the seeded RNG.
//
//   horizon       horizontal stroke + sun/moon disc + optional sail
//   becalmed      vertical mast at canvas centre, flat horizon
//   storm         stacked sinuous waves + leaning sail + cloud blob
//   whale-back    dominating sinuous curve + fluke wedge + eye dot
//   doubloon      large centred disc + ring of asterisks
//   lookout       mast at canvas centre, lookout disc, low horizon

import { pickSurface, pickAccents, crewHex } from "./palette.js";
import {
  pickChord,
  buildPaperRamp,
  buildGradient,
  baseRect,
  defaultGrain,
  defaultVignette,
  densityInt,
  clamp,
  pushMark,
  buildBlobPath,
  buildLargeSnakePath,
  arrangeAround,
  rgba,
} from "./compose-shared.js";

export const SCENES = [
  "horizon",
  "becalmed",
  "storm",
  "whale-back",
  "doubloon",
  "lookout",
];

export function composeMaritime(p, rng, state, vp) {
  const scene = rng.pick(SCENES);
  const surface = pickSurface(p, rng, state.theme);
  const accents = pickAccents(rng, state.accentCount, state.accents);

  const palette = {
    surface,
    accents: accents.map((name) => ({
      name,
      hex: crewHex(p, name, state.theme),
    })),
    inkHex: state.theme === "light" ? p.log["800"] : p.log["100"],
    paperHex: state.theme === "light" ? p.log["50"] : p.log["950"],
  };

  const chord = pickChord(p, state.theme, palette, rng);
  const layout = renderScene(p, rng, state, scene, palette, chord, vp);

  return {
    kind: scene,
    substyle: scene, // legacy compatibility
    surface,
    palette,
    chord,
    shapes: layout.shapes || [],
    gradients: layout.gradients || [],
    grain: layout.grain ?? defaultGrain(rng),
    vignette: layout.vignette ?? defaultVignette(state.theme),
  };
}

function renderScene(p, rng, state, scene, palette, chord, vp) {
  switch (scene) {
    case "horizon":    return renderHorizon(p, rng, state, palette, chord, vp);
    case "becalmed":   return renderBecalmed(p, rng, state, palette, chord, vp);
    case "storm":      return renderStorm(p, rng, state, palette, chord, vp);
    case "whale-back": return renderWhaleBack(p, rng, state, palette, chord, vp);
    case "doubloon":   return renderDoubloon(p, rng, state, palette, chord, vp);
    case "lookout":    return renderLookout(p, rng, state, palette, chord, vp);
    default:           return { shapes: [] };
  }
}

// ── horizon ─────────────────────────────────────────────────────────
function renderHorizon(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "vertical", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);
  const horizonY = rng.range(0.55, 0.70) * vp.h;
  const strokeW = Math.max(2, minDim * 0.004);

  // Sun/moon disc on one side of canvas, above or below the horizon.
  const discAbove = rng.next() > 0.45;
  const discR = rng.range(0.10, 0.16) * minDim;
  const discSideSign = rng.next() > 0.5 ? -1 : 1;
  const discCx = vp.w / 2 + discSideSign * vp.w * rng.range(0.16, 0.26);
  const discCy = horizonY + (discAbove ? -1 : 1) * (discR * rng.range(1.05, 1.6));
  const discHex = chord.focal;
  shapes.push({ type: "circle", cx: discCx, cy: discCy, r: discR, fill: discHex });

  // Faint disc halo, just slightly bigger, low opacity.
  shapes.push({
    type: "circle",
    cx: discCx,
    cy: discCy,
    r: discR * 1.35,
    fill: rgba(discHex, 0.18),
    blur: discR * 0.35,
  });

  // Optional sail triangle on the opposite side.
  if (rng.next() > 0.4) {
    const sailSign = -discSideSign;
    const sailBaseY = horizonY - minDim * 0.005;
    const sailH = rng.range(0.10, 0.18) * minDim;
    const sailW = sailH * rng.range(0.45, 0.7);
    const sailCx = vp.w / 2 + sailSign * vp.w * rng.range(0.14, 0.28);
    const points = [
      [sailCx, sailBaseY - sailH],
      [sailCx - sailW * 0.5, sailBaseY],
      [sailCx + sailW * 0.5, sailBaseY],
    ];
    shapes.push({ type: "polygon", points, fill: chord.secondary });
  }

  // Horizon line, last so it sits on top of the disc halo.
  shapes.push({
    type: "line",
    x1: vp.w * 0.05,
    y1: horizonY,
    x2: vp.w * 0.95,
    y2: horizonY,
    stroke: chord.ink,
    strokeWidth: strokeW,
  });

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── becalmed ────────────────────────────────────────────────────────
function renderBecalmed(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "vertical", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);
  const horizonY = rng.range(0.72, 0.82) * vp.h;
  const strokeW = Math.max(2, minDim * 0.004);

  // Mast: a vertical bar near canvas centre with slight off-axis.
  const mastX = vp.w / 2 + rng.range(-0.1, 0.1) * vp.w;
  const mastTopY = rng.range(0.18, 0.28) * vp.h;
  const mastW = Math.max(3, minDim * 0.012);
  shapes.push({
    type: "line",
    x1: mastX,
    y1: mastTopY,
    x2: mastX,
    y2: horizonY,
    stroke: chord.ink,
    strokeWidth: mastW,
  });

  // Small disc atop the mast: the lookout's perch or a hung lantern.
  const headR = minDim * rng.range(0.018, 0.028);
  shapes.push({
    type: "circle",
    cx: mastX,
    cy: mastTopY - headR * 0.4,
    r: headR,
    fill: chord.focal,
  });

  // Optional companion: a small dot lower on the mast (a bell, a tag).
  if (rng.next() > 0.5) {
    const tagY = mastTopY + (horizonY - mastTopY) * rng.range(0.35, 0.65);
    shapes.push({
      type: "circle",
      cx: mastX + mastW * 0.6,
      cy: tagY,
      r: minDim * 0.012,
      fill: chord.secondary,
    });
  }

  // Horizon.
  shapes.push({
    type: "line",
    x1: vp.w * 0.04,
    y1: horizonY,
    x2: vp.w * 0.96,
    y2: horizonY,
    stroke: chord.ink,
    strokeWidth: strokeW,
  });

  // A faint sun behind the mast, very low opacity. Adds depth.
  if (rng.next() > 0.5) {
    const sunR = minDim * rng.range(0.08, 0.12);
    shapes.push({
      type: "circle",
      cx: mastX + vp.w * (rng.next() > 0.5 ? 0.18 : -0.18),
      cy: horizonY - sunR * rng.range(0.6, 1.1),
      r: sunR,
      fill: rgba(chord.focal, 0.28),
      blur: sunR * 0.5,
    });
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── storm ───────────────────────────────────────────────────────────
function renderStorm(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "diagonal", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);

  // Cloud blob in the upper third, soft and large.
  const cloudCx = vp.w * rng.range(0.18, 0.42);
  const cloudCy = vp.h * rng.range(0.16, 0.30);
  const cloudR = minDim * rng.range(0.22, 0.32);
  shapes.push({
    type: "path",
    d: buildBlobPath(cloudCx, cloudCy, cloudR, rng, rng.int(8, 10)),
    fill: rgba(chord.ink, 0.6),
    blur: cloudR * 0.18,
  });

  // Three stacked waves at the lower half, diminishing amplitude.
  const waveYs = [vp.h * 0.60, vp.h * 0.72, vp.h * 0.84];
  const amps = [0.06, 0.045, 0.03];
  for (let i = 0; i < waveYs.length; i++) {
    const localVp = { w: vp.w, h: vp.h }; // unchanged; we offset the curve via translate
    const snake = buildLargeSnakePath(localVp, rng, 1.05, "horizontal", amps[i]);
    // Translate the snake path's Y so it sits at waveYs[i] instead of vp/2.
    // Cheaper than rebuilding: wrap in a path with a transform.
    const dy = waveYs[i] - vp.h / 2;
    shapes.push({
      type: "path",
      d: translatePath(snake.d, 0, dy),
      fill: "none",
      stroke: i === 1 ? chord.focal : chord.ink,
      strokeWidth: minDim * (i === 1 ? 0.008 : 0.005),
    });
  }

  // Leaning sail: a triangle tipped to the side.
  const lean = rng.next() > 0.5 ? 1 : -1;
  const sailH = minDim * rng.range(0.18, 0.26);
  const sailBaseY = vp.h * 0.58;
  const sailCx = vp.w * (lean > 0 ? rng.range(0.62, 0.76) : rng.range(0.24, 0.38));
  const points = [
    [sailCx + lean * sailH * 0.18, sailBaseY - sailH],
    [sailCx - sailH * 0.32, sailBaseY],
    [sailCx + sailH * 0.32, sailBaseY],
  ];
  shapes.push({ type: "polygon", points, fill: chord.secondary });

  // A few rain marks scattered between the cloud and horizon.
  const drops = densityInt(rng, state.density, 3, 6);
  for (let i = 0; i < drops; i++) {
    const x = cloudCx + rng.range(-1, 1) * cloudR * 1.1;
    const y = cloudCy + cloudR * 0.5 + rng.range(0, vp.h * 0.18);
    pushMark(shapes, "bar", x, y, minDim * 0.025, chord.ink, rng);
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.10, freq: rng.range(0.85, 1.05) },
    vignette: { intensity: state.theme === "light" ? 0.18 : 0.26 },
  };
}

// ── whale-back ──────────────────────────────────────────────────────
function renderWhaleBack(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "radial", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);

  // Faint horizon to anchor the whale in the sea.
  if (rng.next() > 0.4) {
    const horizonY = vp.h * rng.range(0.60, 0.72);
    shapes.push({
      type: "line",
      x1: vp.w * 0.06,
      y1: horizonY,
      x2: vp.w * 0.94,
      y2: horizonY,
      stroke: rgba(chord.ink, 0.32),
      strokeWidth: Math.max(1.5, minDim * 0.0025),
    });
  }

  // The whale: a thick sinuous curve roughly horizontal, with endpoints.
  const snake = buildLargeSnakePath(vp, rng, 0.85, "horizontal", 0.05);
  const whaleHex = rng.next() > 0.3 ? chord.ink : chord.focal;
  shapes.push({
    type: "path",
    d: snake.d,
    fill: "none",
    stroke: whaleHex,
    strokeWidth: minDim * 0.026,
  });

  // The fluke: a wedge at one end. Decide by RNG which end is the tail.
  const tailIsLeft = rng.next() > 0.5;
  const tail = tailIsLeft ? snake.endpoints.start : snake.endpoints.end;
  const head = tailIsLeft ? snake.endpoints.end : snake.endpoints.start;
  pushMark(shapes, "wedge", tail[0], tail[1], minDim * 0.10, whaleHex, rng);

  // The eye: a small contrasting dot near the head.
  const eyeR = minDim * 0.012;
  // Place eye slightly inward from the head along the curve direction.
  const dx = head[0] - tail[0];
  const dy = head[1] - tail[1];
  const len = Math.max(1, Math.hypot(dx, dy));
  const eyeX = head[0] - (dx / len) * minDim * 0.04;
  const eyeY = head[1] - (dy / len) * minDim * 0.04;
  shapes.push({
    type: "circle",
    cx: eyeX,
    cy: eyeY,
    r: eyeR,
    fill: chord.secondary,
  });

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
    vignette: { intensity: state.theme === "light" ? 0.14 : 0.20 },
  };
}

// ── doubloon ────────────────────────────────────────────────────────
function renderDoubloon(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "radial", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);
  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const discR = minDim * rng.range(0.30, 0.38);

  // The doubloon: chord.focal fill, ink inscribed rings.
  shapes.push({ type: "circle", cx, cy, r: discR, fill: chord.focal });

  // Inscribed thin ring just inside the disc edge.
  shapes.push({
    type: "ring",
    cx,
    cy,
    r: discR * 0.88,
    stroke: rgba(chord.ink, 0.5),
    strokeWidth: Math.max(1.5, minDim * 0.0035),
  });

  // Centre mark: small disc or asterisk.
  if (rng.next() > 0.4) {
    pushMark(shapes, "asterisk", cx, cy, discR * 0.32, chord.ink, rng);
  } else {
    shapes.push({
      type: "circle",
      cx,
      cy,
      r: discR * 0.10,
      fill: chord.ink,
    });
  }

  // Ring of small asterisks around the disc.
  const starCount = 8;
  const starPositions = arrangeAround(cx, cy, discR * 1.42, starCount, rng);
  for (const pos of starPositions) {
    pushMark(
      shapes,
      "asterisk",
      pos.x,
      pos.y,
      minDim * 0.035,
      chord.secondary,
      rng,
    );
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
    vignette: { intensity: state.theme === "light" ? 0.14 : 0.20 },
  };
}

// ── lookout ─────────────────────────────────────────────────────────
function renderLookout(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "vertical", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);
  const horizonY = vp.h * rng.range(0.75, 0.82);
  const mastX = vp.w / 2 + rng.range(-0.04, 0.04) * vp.w;
  const mastTopY = vp.h * rng.range(0.12, 0.20);
  const mastW = Math.max(3.5, minDim * 0.014);

  // The mast.
  shapes.push({
    type: "line",
    x1: mastX,
    y1: mastTopY,
    x2: mastX,
    y2: horizonY,
    stroke: chord.ink,
    strokeWidth: mastW,
  });

  // The lookout: a small disc at the masthead.
  const lookoutR = minDim * rng.range(0.022, 0.032);
  shapes.push({
    type: "circle",
    cx: mastX,
    cy: mastTopY - lookoutR * 0.6,
    r: lookoutR,
    fill: chord.focal,
  });

  // A faint crossbar (the spar) just below the masthead.
  const sparY = mastTopY + (horizonY - mastTopY) * 0.10;
  const sparHalf = minDim * 0.055;
  shapes.push({
    type: "line",
    x1: mastX - sparHalf,
    y1: sparY,
    x2: mastX + sparHalf,
    y2: sparY,
    stroke: chord.ink,
    strokeWidth: Math.max(2, minDim * 0.006),
  });

  // Horizon line.
  shapes.push({
    type: "line",
    x1: vp.w * 0.04,
    y1: horizonY,
    x2: vp.w * 0.96,
    y2: horizonY,
    stroke: chord.ink,
    strokeWidth: Math.max(2, minDim * 0.004),
  });

  // A distant whale-spout dot on the horizon, opposite the slight mast lean.
  if (rng.next() > 0.5) {
    const spoutX = mastX + (rng.next() > 0.5 ? 1 : -1) * vp.w * rng.range(0.22, 0.34);
    const spoutY = horizonY - minDim * 0.018;
    shapes.push({
      type: "circle",
      cx: clamp(spoutX, vp.w * 0.08, vp.w * 0.92),
      cy: spoutY,
      r: minDim * 0.012,
      fill: chord.secondary,
    });
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── helpers ─────────────────────────────────────────────────────────

// Translate every absolute coordinate in a path's "M" and "C" commands
// by (dx, dy). Relies on the cubic-Bezier paths produced by
// buildLargeSnakePath, which contain only alternating x/y numbers; not
// a general SVG path transform.
function translatePath(d, dx, dy) {
  let i = 0;
  return d.replace(/-?\d+(\.\d+)?/g, (m) => {
    const n = parseFloat(m);
    const out = (i % 2 === 0 ? n + dx : n + dy).toFixed(2);
    i++;
    return out;
  });
}
