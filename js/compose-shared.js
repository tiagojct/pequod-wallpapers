// Composition primitives shared by abstract and maritime modes.
// Chord builder, paper ramp, gradients, mark builder, path builders,
// arrangement helpers. Both compose-abstract.js and compose-maritime.js
// import everything they need from here.

import { rgba } from "./palette.js";

export const MARK_TYPES = [
  "dot",
  "asterisk",
  "snake",
  "wedge",
  "eye",
  "smallring",
  "bar",
];

// A composition uses at most four colours: the surface (picked
// separately), a near-tone Log step that complements it, the focal
// accent, and a secondary accent for marks.
export function pickChord(p, theme, palette, rng) {
  const log = p.log;
  const surfaceN = parseInt(palette.surface.step, 10);
  const sameSide = theme === "light"
    ? ["50", "100", "150", "200", "300", "400", "500"]
    : ["950", "900", "800", "700", "600", "500", "400"];
  const sortedNearby = sameSide
    .map((s) => ({ step: s, dist: Math.abs(parseInt(s, 10) - surfaceN) }))
    .filter((s) => s.dist > 0 && s.dist <= 400)
    .sort((a, b) => a.dist - b.dist);
  const nearStep = sortedNearby[rng.int(0, Math.min(3, sortedNearby.length - 1))]?.step
    || sameSide[1];
  const nearHex = log[nearStep];

  const focal = palette.accents[0]?.hex || palette.inkHex;
  const secondary = palette.accents[1]?.hex || palette.accents[0]?.hex || palette.inkHex;
  const ink = palette.inkHex;

  return { focal, secondary, nearHex, ink, surface: palette.surface.hex };
}

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

export function baseRect(vp, fill) {
  return { type: "rect", x: 0, y: 0, w: vp.w, h: vp.h, fill };
}

export function defaultGrain(rng) {
  return { intensity: 0.1, freq: rng.range(0.8, 1.05) };
}

export function defaultVignette(theme) {
  return { intensity: theme === "light" ? 0.12 : 0.18 };
}

export function densityInt(rng, density, lo, hi) {
  if (density === "low") return rng.int(Math.max(lo - 1, 1), Math.max(hi - 1, lo));
  if (density === "high") return rng.int(lo + 1, hi + 1);
  return rng.int(lo, hi);
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ── marks ─────────────────────────────────────────────────────────

export function pushMark(shapes, type, x, y, size, fill, rng) {
  const minStroke = size * 0.09;
  switch (type) {
    case "dot":
      shapes.push({ type: "circle", cx: x, cy: y, r: size * 0.5, fill });
      break;
    case "asterisk": {
      const rays = rng.int(4, 6);
      shapes.push({
        type: "path",
        d: buildAsteriskPath(x, y, size, rays),
        fill: "none",
        stroke: fill,
        strokeWidth: minStroke,
      });
      shapes.push({ type: "circle", cx: x, cy: y, r: size * 0.07, fill });
      break;
    }
    case "snake":
      shapes.push({
        type: "path",
        d: buildSnakePath(x, y, size, rng),
        fill: "none",
        stroke: fill,
        strokeWidth: minStroke,
      });
      break;
    case "wedge": {
      const rot = rng.range(0, Math.PI * 2);
      const half = size * 0.55;
      const points = [
        [x + Math.cos(rot) * half, y + Math.sin(rot) * half],
        [
          x + Math.cos(rot + (2 * Math.PI) / 3) * half,
          y + Math.sin(rot + (2 * Math.PI) / 3) * half,
        ],
        [
          x + Math.cos(rot + (4 * Math.PI) / 3) * half,
          y + Math.sin(rot + (4 * Math.PI) / 3) * half,
        ],
      ];
      shapes.push({ type: "polygon", points, fill });
      break;
    }
    case "eye": {
      const rx = size * 0.55;
      const ry = size * 0.3;
      const rot = rng.next() > 0.5 ? 0 : 90;
      const h = fill.replace("#", "");
      const luma = (parseInt(h.slice(0, 2), 16) * 299
                  + parseInt(h.slice(2, 4), 16) * 587
                  + parseInt(h.slice(4, 6), 16) * 114) / 1000;
      shapes.push({
        type: "path",
        d: buildEllipsePath(x, y, rx, ry, rot),
        fill,
      });
      shapes.push({
        type: "circle",
        cx: x,
        cy: y,
        r: ry * 0.55,
        fill: luma > 128 ? "#0B1720" : "#F7F3EE",
        fillOpacity: 0.85,
      });
      break;
    }
    case "smallring":
      shapes.push({
        type: "ring",
        cx: x,
        cy: y,
        r: size * 0.5,
        stroke: fill,
        strokeWidth: minStroke,
      });
      break;
    case "bar": {
      const angle = rng.range(0, Math.PI);
      const len = size;
      const w = size * 0.2;
      const dx = Math.cos(angle) * len * 0.5;
      const dy = Math.sin(angle) * len * 0.5;
      shapes.push({
        type: "line",
        x1: x - dx,
        y1: y - dy,
        x2: x + dx,
        y2: y + dy,
        stroke: fill,
        strokeWidth: w,
      });
      break;
    }
  }
}

export function pushSnake(shapes, vp, rng, hex, lengthFactor, strokeW) {
  const snake = buildLargeSnakePath(vp, rng, lengthFactor);
  shapes.push({
    type: "path",
    d: snake.d,
    fill: "none",
    stroke: hex,
    strokeWidth: strokeW,
  });
  return snake;
}

// ── path builders ──────────────────────────────────────────────────

export function buildBlobPath(cx, cy, baseR, rng, sides = 8) {
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

export function buildAsteriskPath(cx, cy, size, rays) {
  let d = "";
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI;
    const dx = (Math.cos(angle) * size) / 2;
    const dy = (Math.sin(angle) * size) / 2;
    d += `M ${(cx - dx).toFixed(2)} ${(cy - dy).toFixed(2)} L ${(cx + dx).toFixed(2)} ${(cy + dy).toFixed(2)} `;
  }
  return d.trim();
}

export function buildSnakePath(cx, cy, size, rng) {
  const half = size * 0.5;
  const angle = rng.range(0, Math.PI * 2);
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const points = [
    [-half, 0],
    [-half * 0.5, -size * 0.25],
    [0, size * 0.18],
    [half * 0.5, -size * 0.18],
    [half, 0],
  ];
  const rotated = points.map(([x, y]) => [cx + x * cosA - y * sinA, cy + x * sinA + y * cosA]);
  let d = `M ${rotated[0][0].toFixed(2)} ${rotated[0][1].toFixed(2)}`;
  for (let i = 0; i < rotated.length - 1; i++) {
    const p0 = rotated[Math.max(0, i - 1)];
    const p1 = rotated[i];
    const p2 = rotated[i + 1];
    const p3 = rotated[Math.min(rotated.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 4;
    const c1y = p1[1] + (p2[1] - p0[1]) / 4;
    const c2x = p2[0] - (p3[0] - p1[0]) / 4;
    const c2y = p2[1] - (p3[1] - p1[1]) / 4;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return d;
}

// vp-spanning sinuous curve. `orientation` forces "horizontal" /
// "vertical", or `"auto"` to pick randomly. `amplitudeFactor` scales
// the wave height (default 0.18 of the cross-axis).
export function buildLargeSnakePath(vp, rng, lengthFactor = 1.0, orientation = "auto", amplitudeFactor = 0.18) {
  const horizontal = orientation === "horizontal"
    ? true
    : orientation === "vertical"
      ? false
      : rng.next() > 0.4;
  const cx = vp.w / 2;
  const cy = vp.h / 2;
  const span = (horizontal ? vp.w : vp.h) * lengthFactor;
  const amp = (horizontal ? vp.h : vp.w) * amplitudeFactor * (rng.next() > 0.5 ? 1 : -1);
  const segments = 4;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = (t - 0.5) * span;
    const v = Math.sin(t * Math.PI * 2) * amp;
    if (horizontal) points.push([cx + u, cy + v]);
    else points.push([cx + v, cy + u]);
  }
  let d = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 4;
    const c1y = p1[1] + (p2[1] - p0[1]) / 4;
    const c2x = p2[0] - (p3[0] - p1[0]) / 4;
    const c2y = p2[1] - (p3[1] - p1[1]) / 4;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return { d, horizontal, endpoints: { start: points[0], end: points[points.length - 1] } };
}

export function buildEllipsePath(cx, cy, rx, ry, rotDeg) {
  const r = (rotDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const x1 = cx - rx * c;
  const y1 = cy - rx * s;
  const x2 = cx + rx * c;
  const y2 = cy + rx * s;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} ${rotDeg} 0 0 ${x2.toFixed(2)} ${y2.toFixed(2)} A ${rx.toFixed(2)} ${ry.toFixed(2)} ${rotDeg} 0 0 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

// ── arrangement helpers ────────────────────────────────────────────

export function arrangeAround(cx, cy, radius, count, rng) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + rng.range(-0.25, 0.25);
    const r = radius * rng.range(0.85, 1.2);
    out.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    });
  }
  return out;
}

export function scatterMarks(shapes, rng, chord, count, vp, primary) {
  const minDim = Math.min(vp.w, vp.h);
  const colorPool = [chord.ink, chord.focal, chord.secondary];
  const placed = [];
  for (let i = 0; i < count; i++) {
    let tries = 0;
    let pos = null;
    while (tries < 14 && !pos) {
      const angle = rng.range(0, Math.PI * 2);
      const dist = primary.blobR * rng.range(1.45, 2.5);
      const x = primary.cx + Math.cos(angle) * dist;
      const y = primary.cy + Math.sin(angle) * dist;
      const margin = minDim * 0.05;
      if (x < margin || x > vp.w - margin || y < margin || y > vp.h - margin) {
        tries++;
        continue;
      }
      const tooClose = placed.some(
        (q) => Math.hypot(q.x - x, q.y - y) < minDim * 0.08,
      );
      if (tooClose) {
        tries++;
        continue;
      }
      pos = { x, y };
    }
    if (!pos) continue;
    placed.push(pos);
    const type = rng.pick(MARK_TYPES);
    const size = (type === "snake" || type === "eye"
      ? rng.range(0.06, 0.1)
      : rng.range(0.035, 0.065)) * minDim;
    pushMark(shapes, type, pos.x, pos.y, size, rng.pick(colorPool), rng);
  }
}

export function arrangeFreeform(rng, count, vp, minSpacing) {
  const out = [];
  let tries = 0;
  while (out.length < count && tries < 250) {
    tries++;
    const x = rng.range(0.1, 0.9) * vp.w;
    const y = rng.range(0.1, 0.9) * vp.h;
    const tooClose = out.some((p) => Math.hypot(p.x - x, p.y - y) < minSpacing);
    if (!tooClose) out.push({ x, y });
  }
  return out;
}

// rgba re-exported so compose modules can use a single import surface.
export { rgba };
