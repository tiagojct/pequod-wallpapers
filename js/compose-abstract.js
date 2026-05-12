// Abstract mode: three confident named sub-styles, all chord-driven.
//
//   constellation  big biomorphic blob + marks around it
//   lunar          crescent + companion dot + a few stars
//   gesture        sinuous hero curve + scattered marks
//
// All compositions are centre-anchored with gentle asymmetry and use a
// chord chosen up-front so colours harmonise.

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
  pushSnake,
  buildBlobPath,
  arrangeAround,
  arrangeFreeform,
  scatterMarks,
} from "./compose-shared.js";

export const SUBSTYLES = ["constellation", "lunar", "gesture"];

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
    inkHex: state.theme === "light" ? p.log["800"] : p.log["100"],
    paperHex: state.theme === "light" ? p.log["50"] : p.log["950"],
  };

  const chord = pickChord(p, state.theme, palette, rng);
  const layout = renderSubstyle(p, rng, state, substyle, palette, chord, vp);

  return {
    kind: substyle,
    substyle, // legacy field for older gallery entries
    surface,
    palette,
    chord,
    shapes: layout.shapes || [],
    gradients: layout.gradients || [],
    grain: layout.grain ?? defaultGrain(rng),
    vignette: layout.vignette ?? defaultVignette(state.theme),
  };
}

function renderSubstyle(p, rng, state, substyle, palette, chord, vp) {
  switch (substyle) {
    case "constellation":
      return renderConstellation(p, rng, state, palette, chord, vp);
    case "lunar":
      return renderLunar(p, rng, state, palette, chord, vp);
    case "gesture":
      return renderGesture(p, rng, state, palette, chord, vp);
    default:
      return { shapes: [] };
  }
}

// ── constellation ───────────────────────────────────────────────────
function renderConstellation(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "radial", weight: 4 },
    { value: "vertical", weight: 2 },
    { value: "diagonal", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const cx = vp.w / 2 + rng.range(-0.08, 0.08) * vp.w;
  const cy = vp.h / 2 + rng.range(-0.08, 0.08) * vp.h;
  const minDim = Math.min(vp.w, vp.h);
  const blobR = rng.range(0.32, 0.42) * minDim;

  const blobHex = rng.next() > 0.6 ? chord.focal : chord.ink;
  shapes.push({
    type: "path",
    d: buildBlobPath(cx, cy, blobR, rng, rng.int(7, 9)),
    fill: blobHex,
  });

  if (rng.next() > 0.35) {
    const innerR = blobR * rng.range(0.18, 0.3);
    const innerCx = cx + rng.range(-0.3, 0.3) * blobR;
    const innerCy = cy + rng.range(-0.3, 0.3) * blobR;
    const innerHex = blobHex === chord.ink ? chord.focal : chord.secondary;
    shapes.push({
      type: "circle",
      cx: innerCx,
      cy: innerCy,
      r: innerR,
      fill: innerHex,
    });
  }

  const markCount = densityInt(rng, state.density, 5, 8);
  scatterMarks(shapes, rng, chord, markCount, vp, { cx, cy, blobR });

  if (rng.next() > 0.5) {
    pushSnake(shapes, vp, rng, chord.ink, 1.0, 0.004 * minDim);
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}

// ── lunar ───────────────────────────────────────────────────────────
function renderLunar(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const grad = buildGradient("g-base", "radial", ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const minDim = Math.min(vp.w, vp.h);
  const outerR = rng.range(0.28, 0.38) * minDim;
  const innerR = outerR * rng.range(0.85, 0.93);
  const offsetSign = rng.next() > 0.5 ? 1 : -1;
  const offset = outerR * rng.range(0.32, 0.5) * offsetSign;

  const crescentHex = rng.next() > 0.5 ? chord.focal : chord.ink;
  shapes.push({ type: "circle", cx, cy, r: outerR, fill: crescentHex });
  shapes.push({
    type: "circle",
    cx: cx + offset,
    cy,
    r: innerR,
    fill: chord.surface,
  });

  const companionAngle = offsetSign > 0 ? Math.PI : 0;
  const companionDist = outerR * 1.9;
  const companionR = rng.range(0.03, 0.05) * minDim;
  shapes.push({
    type: "circle",
    cx: cx + Math.cos(companionAngle) * companionDist,
    cy: cy + Math.sin(companionAngle) * companionDist,
    r: companionR,
    fill: chord.secondary,
  });

  const starCount = densityInt(rng, state.density, 3, 4);
  const starPositions = arrangeAround(cx, cy, outerR * 2.7, starCount, rng);
  for (const pos of starPositions) {
    pushMark(
      shapes,
      "asterisk",
      pos.x,
      pos.y,
      rng.range(0.04, 0.06) * minDim,
      rng.next() > 0.5 ? chord.focal : chord.ink,
      rng,
    );
  }

  if (rng.next() > 0.4) {
    const extra = rng.weighted([
      { value: "wedge", weight: 2 },
      { value: "eye", weight: 1 },
    ]);
    const angle = rng.range(0, Math.PI * 2);
    const dist = outerR * rng.range(2.7, 3.4);
    pushMark(
      shapes,
      extra,
      clamp(cx + Math.cos(angle) * dist, vp.w * 0.08, vp.w * 0.92),
      clamp(cy + Math.sin(angle) * dist, vp.h * 0.08, vp.h * 0.92),
      rng.range(0.05, 0.08) * minDim,
      chord.secondary,
      rng,
    );
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
    vignette: { intensity: state.theme === "light" ? 0.16 : 0.24 },
  };
}

// ── gesture ─────────────────────────────────────────────────────────
function renderGesture(p, rng, state, palette, chord, vp) {
  const ramp = buildPaperRamp(p, state.theme, rng);
  const direction = rng.weighted([
    { value: "vertical", weight: 3 },
    { value: "diagonal", weight: 2 },
    { value: "radial", weight: 1 },
  ]);
  const grad = buildGradient("g-base", direction, ramp, vp, rng);
  const shapes = [baseRect(vp, `url(#${grad.id})`)];

  const minDim = Math.min(vp.w, vp.h);
  const snakeHex = rng.next() > 0.4 ? chord.focal : chord.ink;
  pushSnake(shapes, vp, rng, snakeHex, 1.0, 0.014 * minDim);

  // Denser support cast than the old version: 5-7 marks instead of 4-6.
  const markCount = densityInt(rng, state.density, 5, 7);
  const positions = arrangeFreeform(rng, markCount, vp, minDim * 0.16);
  for (const pos of positions) {
    const t = rng.weighted([
      { value: "dot", weight: 3 },
      { value: "asterisk", weight: 3 },
      { value: "wedge", weight: 1 },
      { value: "smallring", weight: 1 },
    ]);
    pushMark(
      shapes,
      t,
      pos.x,
      pos.y,
      rng.range(0.035, 0.06) * minDim,
      rng.next() > 0.5 ? chord.ink : chord.secondary,
      rng,
    );
  }

  return {
    shapes,
    gradients: [grad],
    grain: { intensity: 0.09, freq: rng.range(0.85, 1.05) },
  };
}
